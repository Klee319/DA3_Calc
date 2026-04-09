/**
 * 最適化モジュール - メインエンジン
 */

import { CharacterBuild, EquipSlot } from '@/types';
import {
  OptimizeConstraints,
  OptimizeResult,
  OptimizeProgress,
  OptimizeMode,
  MinimumStatRequirements,
} from '@/types/optimize';
import {
  WeaponData,
  ArmorData,
  AccessoryData,
  EqConstData,
  EmblemData,
  WeaponCalcData,
  SkillCalcData,
  RunestoneData,
  JobConstData,
  JobSPData,
} from '@/types/data';
import { StatBlock, EnemyParams, InternalStatKey } from '@/types/calc';
import {
  analyzeSkillDependencies,
  analyzeSkillDependenciesV2,
  formatRelevantStats,
  normalizeSkillId,
  RelevantStats,
} from '../skillAnalyzer';
import { calculateAllJobStats, calculateBranchBonus } from '../jobCalculator';
import {
  DEFAULT_STATS,
  DEFAULT_WEAPON_PARAMS,
  setCurrentOptimizationStats,
  clearCurrentOptimizationStats,
  type WeightCalculationParams,
} from '../statWeightMappingV2';
import { EvaluationContext, ScoredCombination, SearchStats as SearchStatsType, OptimizeResultWithStats as OptimizeResultWithStatsType } from './types';
import { EXHAUSTIVE_SEARCH_THRESHOLD, MAX_SOLUTIONS_IN_MEMORY } from './constants';
import { buildEquipmentPool } from './equipmentPool';
import { clearEvaluationCache, calculateEquipmentStatsFn } from './evaluation';
import {
  calculateCombinationCount,
  exhaustiveSearchAsync,
  multiStartGreedyAsync,
} from './search';
import { localSearchAsync, generateDiverseSolutionsAsync } from './localSearch';
import { filterDominatedEmblems, buildRunestoneCombinations, RunestoneCombination } from './emblemRunestone';
import { filterDominatedBuilds } from './dominance';
import { beamSearchOptimize } from './beamSearch';
import { buildTarotCandidates } from './tarotSearch';
import { optimizeRemainingSP } from './spOptimizer';
import { DEFAULT_BEAM_SEARCH_CONFIG } from '@/types/optimize';

/** 最適化用ゲームデータ（簡略版） */
export interface OptimizeGameData {
  weapons: WeaponData[];
  armors: ArmorData[];
  accessories: AccessoryData[];
  eqConst: EqConstData;
  emblems?: EmblemData[];
  jobConst?: JobConstData;
  jobSPData?: Map<string, JobSPData[]>;
  weaponCalc?: WeaponCalcData;
  skillCalc?: SkillCalcData;
  runestones?: RunestoneData[];
  tarots?: import('@/types/data').TarotCardDefinition[];
  tarotCalcData?: import('@/types/data').TarotCalcData;
}

/** 最適化オプション */
export interface OptimizeOptions {
  mode: OptimizeMode;
  targetStat?: InternalStatKey;
  skillMultiplier?: number;
  skillHits?: number;
  skillCoolTime?: number;
  availableWeaponTypes?: string[];
  availableArmorTypes?: string[];
  selectedWeaponType?: string | null;
  minimumStats?: MinimumStatRequirements;
  jobGrade?: string;
  jobMaxLevel?: number;
  jobName?: string;
  jobNameJP?: string;
  spAllocation?: Record<string, number>;
  runestoneBonus?: StatBlock;
  buffSettings?: {
    enabledBuffIds: string[];
    skillLevel: number;
  };
  unlockedSkills?: string[];
  enableRunestoneSearch?: boolean;
  enableTarotSearch?: boolean;
  beamWidth?: number;
  userOption?: StatBlock;
  food?: StatBlock;
  ringOption?: {
    enabled: boolean;
    ringType: 'power' | 'magic' | 'speed';
  };
}

/** 探索統計 */
export interface SearchStats {
  totalCandidates: number;
  evaluatedCombinations: number;
  prunedCombinations: number;
  elapsedTime: number;
  phase: string;
}

/** 最適化結果（統計付き） */
export interface OptimizeResultWithStats {
  results: OptimizeResult[];
  searchStats: SearchStats;
  warnings?: string[];
}

/**
 * 装備の最適化を実行
 */
export async function optimizeEquipment(
  currentBuild: CharacterBuild,
  targetSlots: EquipSlot[],
  constraints: OptimizeConstraints,
  skillForEvaluation: string,
  enemyParams: EnemyParams,
  gameData: OptimizeGameData,
  onProgress?: (progress: OptimizeProgress) => void,
  options?: OptimizeOptions,
  abortSignal?: AbortSignal
): Promise<OptimizeResultWithStats> {
  try {
  const startTime = Date.now();

  let currentBestSolution: (ScoredCombination & { usedEmblem?: EmblemData | null }) | null = null;
  let lastIntermediateReportTime = Date.now();
  const INTERMEDIATE_REPORT_INTERVAL = 30000;

  const reportProgress = (
    phase: string,
    current: number,
    total: number,
    message: string,
    bestScore?: number,
    bestSolution?: (ScoredCombination & { usedEmblem?: EmblemData | null }) | null
  ) => {
    if (onProgress) {
      const elapsedTime = Date.now() - startTime;
      const now = Date.now();

      let intermediateEquipment: Record<string, string> | undefined;
      let intermediateStats: Record<string, number> | undefined;

      const solutionToReport = bestSolution || currentBestSolution;
      if (solutionToReport && (now - lastIntermediateReportTime >= INTERMEDIATE_REPORT_INTERVAL || bestSolution)) {
        lastIntermediateReportTime = now;

        intermediateEquipment = {};
        for (const slot of ['weapon', 'head', 'body', 'leg', 'accessory1', 'accessory2'] as const) {
          const eq = solutionToReport.equipmentSet[slot];
          if (eq) {
            intermediateEquipment[slot] = eq.name;
          }
        }
        if (solutionToReport.usedEmblem) {
          intermediateEquipment.emblem = solutionToReport.usedEmblem['アイテム名'] || (solutionToReport.usedEmblem as any).name;
        }

        if (solutionToReport.stats) {
          intermediateStats = {
            Power: Math.round(solutionToReport.stats.Power || 0),
            Magic: Math.round(solutionToReport.stats.Magic || 0),
            HP: Math.round(solutionToReport.stats.HP || 0),
            Agility: Math.round(solutionToReport.stats.Agility || 0),
            CritDamage: Math.round(solutionToReport.stats.CritDamage || 0),
          };
        }
      }

      onProgress({
        phase: phase as any,
        current,
        total,
        percentage: total > 0 ? Math.round((current / total) * 100) : 0,
        currentBest: bestScore ?? (currentBestSolution?.originalScore || 0),  // 表示用はoriginalScoreを使用
        message,
        elapsedTime,
        intermediateEquipment,
        intermediateStats,
      });
    }
  };

  clearCurrentOptimizationStats();
  clearEvaluationCache();

  reportProgress('initializing', 0, 100, '初期化中...');

  const availableWeaponTypes: string[] = options?.availableWeaponTypes || [];
  const availableArmorTypes: string[] = options?.availableArmorTypes || [];

  let relevantStats: RelevantStats;
  const primaryWeaponType = options?.selectedWeaponType || (availableWeaponTypes.length > 0 ? availableWeaponTypes[0] : 'Sword');

  if (availableWeaponTypes.length > 0) {
    const v2Params: Partial<WeightCalculationParams> = {
      currentStats: DEFAULT_STATS,
      weaponAttackPower: DEFAULT_WEAPON_PARAMS.weaponAttackPower,
      weaponCritDamage: DEFAULT_WEAPON_PARAMS.weaponCritDamage,
      critRate: DEFAULT_WEAPON_PARAMS.critRate,
      jobName: options?.jobName,
    };

    relevantStats = analyzeSkillDependenciesV2(skillForEvaluation, primaryWeaponType, v2Params);
  } else {
    relevantStats = analyzeSkillDependencies(
      skillForEvaluation,
      gameData.skillCalc,
      gameData.weaponCalc,
      options?.jobName
    );
  }

  reportProgress('building_pool', 10, 100, '装備候補を構築中...');

  const selectedWeaponType = options?.selectedWeaponType ?? null;
  const pool = buildEquipmentPool(gameData, constraints, availableWeaponTypes, availableArmorTypes, selectedWeaponType, relevantStats, options?.minimumStats);

  const totalCandidates =
    pool.weapon.length +
    pool.head.length +
    pool.body.length +
    pool.leg.length +
    pool.accessory1.length +
    pool.accessory2.length;

  // デバッグ: 候補プールの内容を出力
  console.log('[OptPool]', {
    weapon: pool.weapon.map(c => c.name),
    body: pool.body.map(c => `${c.name}(${(c.sourceData as any)?.['タイプを選択'] || '?'})`),
    leg: pool.leg.map(c => `${c.name}(${(c.sourceData as any)?.['タイプを選択'] || '?'})`),
    configs_body: pool.body.map(c => c.configurations.length),
    configs_leg: pool.leg.map(c => c.configurations.length),
  });

  reportProgress('building_pool', 30, 100, `装備候補: ${totalCandidates}件`);

  const emblems = gameData.emblems || [];

  const jobNameForSPLookup = options?.jobNameJP || options?.jobName;
  const jobSPData = jobNameForSPLookup && gameData.jobSPData
    ? gameData.jobSPData.get(jobNameForSPLookup) || []
    : [];

  const normalizedSkillId = normalizeSkillId(skillForEvaluation);

  const context: EvaluationContext = {
    mode: options?.mode || 'damage',
    targetStat: options?.targetStat,
    skillId: normalizedSkillId,
    skillMultiplier: options?.skillMultiplier || 1.0,
    hits: options?.skillHits || 1,
    coolTime: options?.skillCoolTime || 5,
    enemyDefense: enemyParams.defense,
    enemyTypeResistance: enemyParams.typeResistance,
    enemyAttributeResistance: enemyParams.attributeResistance,
    jobMaxLevel: options?.jobMaxLevel || 100,
    jobName: options?.jobName,
    jobConst: gameData.jobConst,
    jobSPData,
    emblem: null,
    minimumStats: options?.minimumStats,
    weaponCalc: gameData.weaponCalc,
    skillCalc: gameData.skillCalc,
    relevantStats,
    spAllocation: (() => {
      const userSP = options?.spAllocation || {};
      const maxSP = (options?.jobMaxLevel || 100) * 2;
      const optimizedSP = optimizeRemainingSP(userSP, jobSPData, maxSP, relevantStats, options?.jobName);
      return optimizedSP.allocation;
    })(),
    runestoneBonus: options?.runestoneBonus,
    userOption: options?.userOption,
    food: options?.food,
    ringOption: options?.ringOption,
  };

  // 職業基礎+SPベースステータスを計算（近似スコアのP=Mバランス用）
  if (gameData.jobConst && options?.jobName) {
    try {
      const jobLevel = options?.jobMaxLevel || 100;
      const baseJobStats = calculateAllJobStats(
        options.jobName, jobLevel, [], gameData.jobConst, jobSPData
      );
      const spAlloc = context.spAllocation as Record<string, number>;
      const branchBonus = calculateBranchBonus(
        { A: spAlloc?.['A'] || 0, B: spAlloc?.['B'] || 0, C: spAlloc?.['C'] || 0 },
        jobSPData
      );
      const jpToInternal: Record<string, string> = {
        '体力': 'HP', '力': 'Power', '魔力': 'Magic', '精神': 'Mind',
        '素早さ': 'Agility', '器用さ': 'Dex', '撃力': 'CritDamage', '守備力': 'Defense',
      };
      const baseStats: Record<string, number> = {};
      for (const [key, value] of Object.entries(baseJobStats)) {
        if (typeof value === 'number') baseStats[key] = value;
      }
      for (const branch of ['A', 'B', 'C'] as const) {
        for (const [jpKey, value] of Object.entries(branchBonus[branch])) {
          const internalKey = jpToInternal[jpKey];
          if (internalKey && value) baseStats[internalKey] = (baseStats[internalKey] || 0) + value;
        }
      }
      context.jobSPBaseStats = baseStats;
    } catch (e) {
      console.warn('jobSPBaseStats計算失敗:', e instanceof Error ? e.message : e);
    }
  }

  const combinationCount = calculateCombinationCount(pool);
  const hasEmblemSearch = emblems.length > 1;
  const useExhaustiveSearch = combinationCount <= EXHAUSTIVE_SEARCH_THRESHOLD && !hasEmblemSearch;

  let allSolutions: (ScoredCombination & {
    usedEmblem?: EmblemData | null;
    usedRunestones?: RunestoneCombination;
  })[] = [];

  const trimSolutions = () => {
    if (allSolutions.length > MAX_SOLUTIONS_IN_MEMORY * 2) {
      allSolutions.sort((a, b) => b.score - a.score);
      allSolutions.length = MAX_SOLUTIONS_IN_MEMORY;
    }
  };

  let globalBestScore = 0;          // ソート・枝刈り用（sortScore）
  let globalBestOriginalScore = 0;  // 表示用（originalScore）

  const emblemsForSearch = filterDominatedEmblems(emblems, relevantStats, options?.minimumStats);

  const enableRunestoneSearch = options?.enableRunestoneSearch ?? true;
  let runestoneCombs: RunestoneCombination[] = [];
  if (enableRunestoneSearch && gameData.runestones && gameData.runestones.length > 0) {
    runestoneCombs = buildRunestoneCombinations(gameData.runestones, relevantStats, options?.minimumStats);
  } else {
    runestoneCombs = [{ runestones: [], totalBonus: options?.runestoneBonus || {} }];
  }

  // === Beam Search を実行（メインアルゴリズム） ===
  const useBeamSearch = !useExhaustiveSearch;

  if (useBeamSearch) {
    try {
      const tarotCandidates = (options?.enableTarotSearch !== false && gameData.tarots && gameData.tarotCalcData)
        ? buildTarotCandidates(gameData.tarots, gameData.tarotCalcData, relevantStats, options?.mode || 'damage')
        : [];

      const beamConfig = {
        ...DEFAULT_BEAM_SEARCH_CONFIG,
        beamWidth: options?.beamWidth || DEFAULT_BEAM_SEARCH_CONFIG.beamWidth,
      };

      const extendedPool = {
        ...pool,
        emblems: emblemsForSearch.map((e: EmblemData) => ({
          id: e.アイテム名 || 'emblem',
          name: e.アイテム名 || 'emblem',
          slot: 'emblem' as any,
          type: 'emblem',
          configurations: [{}],
          sourceData: e,
        })),
        tarot: tarotCandidates,
      };

      const beamResults = await beamSearchOptimize(
        extendedPool as any,
        context,
        gameData.eqConst,
        beamConfig,
        relevantStats,
        emblemsForSearch,
        runestoneCombs,
        (progress) => { reportProgress(progress.phase, progress.percentage, 100, progress.message, progress.currentBest); },
        abortSignal,
      );

      // Beam結果の上位にLocal Searchを適用（ローカル最適からの脱出）
      reportProgress('local_search', 85, 100, 'Beam結果をLocal Searchで改善中...', globalBestOriginalScore);
      for (let i = 0; i < Math.min(beamResults.length, 3); i++) {
        if (abortSignal?.aborted) break;
        try {
          const improved = await localSearchAsync(
            beamResults[i], pool, context, gameData.eqConst, 30, `beam_ls_${i}`
          );
          if (improved.score > beamResults[i].score) {
            beamResults[i] = improved;
          }
        } catch { break; }
      }

      for (const beamResult of beamResults) {
        const br = beamResult as any;
        const solutionWithMeta = {
          ...beamResult,
          usedEmblem: br._emblemData || null,
          usedRunestones: br._runestoneData || runestoneCombs[0],
          usedTarot: br._tarotCandidate || null,
        };
        allSolutions.push(solutionWithMeta);

        // Beam結果で暫定ベストを更新
        if (beamResult.score > globalBestScore) {
          globalBestScore = beamResult.score;
          globalBestOriginalScore = beamResult.originalScore;
          currentBestSolution = solutionWithMeta;
        }
      }
    } catch (beamError) {
      const errorMsg = beamError instanceof Error ? beamError.message : String(beamError);
      console.warn(`Beam Search failed, falling back to greedy: ${errorMsg}`);
    }
  }

  let prunedEmblems = 0;
  let prunedRunestones = 0;

  const totalIterations = runestoneCombs.length * Math.max(emblemsForSearch.length, 1);
  let completedIterations = 0;

  // 探索開始の進捗を表示
  reportProgress(
    'greedy',
    30,
    100,
    `ルーン${runestoneCombs.length}個 × 紋章${emblemsForSearch.length}個 の探索を開始...`
  );

  for (let runeIndex = 0; runeIndex < runestoneCombs.length; runeIndex++) {
    const runeComb = runestoneCombs[runeIndex];
    const runeContext = { ...context, runestoneBonus: runeComb.totalBonus };

    if (enableRunestoneSearch && globalBestScore > 0 && runeIndex > 5) {
      const runeContribution = Object.values(runeComb.totalBonus).reduce((sum: number, v) => sum + (v as number || 0), 0);
      const bestRuneContribution = Object.values(runestoneCombs[0].totalBonus).reduce((sum: number, v) => sum + (v as number || 0), 0);
      if (runeContribution < bestRuneContribution * 0.5) {
        prunedRunestones++;
        completedIterations += Math.max(emblemsForSearch.length, 1);
        continue;
      }
    }

    if (emblemsForSearch.length > 0) {
      let emblemIdx = 0;
      for (const emblem of emblemsForSearch) {
        emblemIdx++;
        completedIterations++;

        const progressPercent = Math.floor((completedIterations / totalIterations) * 50) + 30;
        if (completedIterations % Math.max(1, Math.floor(totalIterations / 20)) === 0) {
          reportProgress('local_search', progressPercent, 100, `ルーン${runeIndex + 1}/${runestoneCombs.length} × 紋章${emblemIdx}/${emblemsForSearch.length}`, globalBestOriginalScore, currentBestSolution);
        }

        if (emblemIdx % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
          if (abortSignal?.aborted) throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
        }

        const emblemContext = { ...runeContext, emblem };
        const contextKey = `rune${runeIndex}:emblem${emblemIdx}`;

        if (useExhaustiveSearch) {
          const exhaustiveResults = await exhaustiveSearchAsync(pool, emblemContext, gameData.eqConst, constraints.maxResults || 10);
          for (const sol of exhaustiveResults) {
            const solutionWithMeta = { ...sol, usedEmblem: emblem, usedRunestones: runeComb };
            allSolutions.push(solutionWithMeta);
            if (sol.score > globalBestScore) {
              globalBestScore = sol.score;
              globalBestOriginalScore = sol.originalScore;
              currentBestSolution = solutionWithMeta;
              if (sol.stats) {
                setCurrentOptimizationStats(sol.stats);
              }
              // 新しいベストが見つかった時に即座に進捗を報告
              const currentProgressPercent = Math.floor((completedIterations / totalIterations) * 50) + 30;
              reportProgress('local_search', currentProgressPercent, 100, `新しい最良解発見!`, globalBestOriginalScore, currentBestSolution);
            }
          }
        } else {
          const multiStartSolutions = await multiStartGreedyAsync(pool, emblemContext, gameData.eqConst, contextKey);

          const bestInitialSolution = multiStartSolutions[0];
          if (!bestInitialSolution) {
            prunedEmblems++;
            continue;
          }

          if (globalBestScore > 0 && bestInitialSolution.score < globalBestScore * 0.6) {
            prunedEmblems++;
            continue;
          }

          const solutionsToImprove = multiStartSolutions.slice(0, 2);
          for (const initialSolution of solutionsToImprove) {
            const improvedSolution = await localSearchAsync(
              initialSolution, pool, emblemContext, gameData.eqConst, 50, contextKey
            );

            if (improvedSolution.score > 0) {
              const solutionWithMeta = { ...improvedSolution, usedEmblem: emblem, usedRunestones: runeComb };
              allSolutions.push(solutionWithMeta);

              if (improvedSolution.score > globalBestScore) {
                globalBestScore = improvedSolution.score;
                globalBestOriginalScore = improvedSolution.originalScore;
                currentBestSolution = solutionWithMeta;
                if (improvedSolution.stats) {
                  setCurrentOptimizationStats(improvedSolution.stats);
                }
                // 新しいベストが見つかった時に即座に進捗を報告
                const currentProgressPercent = Math.floor((completedIterations / totalIterations) * 50) + 30;
                reportProgress('local_search', currentProgressPercent, 100, `新しい最良解発見!`, globalBestOriginalScore, currentBestSolution);
              }
            }
          }
        }
      }
    } else {
      completedIterations++;

      const progressPercent = Math.floor((completedIterations / totalIterations) * 50) + 30;
      reportProgress('local_search', progressPercent, 100, `ルーン${runeIndex + 1}/${runestoneCombs.length} × 紋章なし`, globalBestOriginalScore, currentBestSolution);

      const contextKey = `rune${runeIndex}:noemblem`;

      if (useExhaustiveSearch) {
        const exhaustiveResults = await exhaustiveSearchAsync(pool, runeContext, gameData.eqConst, constraints.maxResults || 10);
        for (const sol of exhaustiveResults) {
          const solutionWithMeta = { ...sol, usedEmblem: null as EmblemData | null, usedRunestones: runeComb };
          allSolutions.push(solutionWithMeta);
          if (sol.score > globalBestScore) {
            globalBestScore = sol.score;
            globalBestOriginalScore = sol.originalScore;
            currentBestSolution = solutionWithMeta;
            if (sol.stats) {
              setCurrentOptimizationStats(sol.stats);
            }
            // 新しいベストが見つかった時に即座に進捗を報告
            reportProgress('local_search', progressPercent, 100, `新しい最良解発見!`, globalBestOriginalScore, currentBestSolution);
          }
        }
      } else {
        const multiStartSolutions = await multiStartGreedyAsync(pool, runeContext, gameData.eqConst, contextKey);

        const solutionsToImprove = multiStartSolutions.slice(0, 2);
        for (const initialSolution of solutionsToImprove) {
          const improvedSolution = await localSearchAsync(
            initialSolution, pool, runeContext, gameData.eqConst, 50, contextKey
          );
          if (improvedSolution.score > 0) {
            const solutionWithMeta = { ...improvedSolution, usedEmblem: null as EmblemData | null, usedRunestones: runeComb };
            allSolutions.push(solutionWithMeta);

            if (improvedSolution.score > globalBestScore) {
              globalBestScore = improvedSolution.score;
              globalBestOriginalScore = improvedSolution.originalScore;
              currentBestSolution = solutionWithMeta;
              if (improvedSolution.stats) {
                setCurrentOptimizationStats(improvedSolution.stats);
              }
              // 新しいベストが見つかった時に即座に進捗を報告
              reportProgress('local_search', progressPercent, 100, `新しい最良解発見!`, globalBestOriginalScore, currentBestSolution);
            }
          }
        }
      }
    }

    trimSolutions();
    await new Promise(resolve => setTimeout(resolve, 0));
    if (abortSignal?.aborted) throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
  }

  allSolutions.sort((a, b) => b.score - a.score);

  reportProgress('finalizing', 80, 100, '多様な解を生成中...');

  const diverseResults = await generateDiverseSolutionsAsync(
    pool,
    context,
    gameData.eqConst,
    constraints.maxResults || 10
  );

  // 多様解には最良解のemblem/runeを適用（round-robinではなく一貫性のある割り当て）
  const bestEmblem = allSolutions.find(s => s.usedEmblem)?.usedEmblem || null;
  const bestRunestone = allSolutions.find(s => s.usedRunestones)?.usedRunestones;

  const diverseSolutions = diverseResults.map((sol) => ({
    ...sol,
    usedEmblem: bestEmblem,
    usedRunestones: bestRunestone,
  }));

  const combinedSolutions = [...allSolutions, ...diverseSolutions];
  combinedSolutions.sort((a, b) => b.score - a.score);
  const limitedSolutions = combinedSolutions.slice(0, MAX_SOLUTIONS_IN_MEMORY);

  // === SP再最適化: 上位解に対して装備に最適なSP配分を見つけて再評価 ===
  reportProgress('finalizing', 90, 100, 'SP再最適化中...');
  const topForSPReopt = limitedSolutions.slice(0, 20);
  for (const sol of topForSPReopt) {
    // この装備セットのステータスを見てSPを再計算
    const equipStats: Record<string, number> = {};
    const slots: EquipSlot[] = ['weapon', 'head', 'body', 'leg', 'accessory1', 'accessory2'];
    for (const slot of slots) {
      const cand = sol.equipmentSet[slot];
      if (!cand) continue;
      const ci = sol.configIndices[slot] || 0;
      const stats = calculateEquipmentStatsFn(cand, ci, gameData.eqConst, relevantStats);
      for (const [k, v] of Object.entries(stats)) {
        if (typeof v === 'number' && !k.startsWith('_') && !['WeaponAttackPower','CoolTime','DamageCorrection','CritRate'].includes(k)) {
          equipStats[k] = (equipStats[k] || 0) + v;
        }
      }
    }

    // 装備ステを加味したrelevantStatsでSPを再最適化
    const userSP = options?.spAllocation || {};
    const maxSP = (options?.jobMaxLevel || 100) * 2;
    const reoptSP = optimizeRemainingSP(userSP, jobSPData, maxSP, relevantStats, options?.jobName, equipStats);

    // 元のSPと異なる場合のみ再評価
    const origSP = context.spAllocation as Record<string, number>;
    const newSP = reoptSP.allocation;
    const spChanged = Object.keys(newSP).some(k => (newSP[k] || 0) !== (origSP[k] || 0));

    if (spChanged) {
      const reoptContext = { ...context, spAllocation: newSP };
      const combination = sol.equipmentSet as Record<EquipSlot, CandidateEquipment | null>;
      const result = evaluateCombination(combination, sol.configIndices, reoptContext, gameData.eqConst);
      if (result.score > sol.score) {
        sol.score = result.score;
        sol.originalScore = result.originalScore;
        sol.stats = result.stats;
        sol.meetsMinimum = result.meetsMinimum;
      }
    }
  }

  // SP再最適化後に再ソート
  limitedSolutions.sort((a, b) => b.score - a.score);

  const nonDominatedSolutions = filterDominatedBuilds(limitedSolutions);

  const seenKeys = new Set<string>();
  const solutions: (ScoredCombination & {
    usedEmblem?: EmblemData | null;
    usedRunestones?: RunestoneCombination;
  })[] = [];

  const warnings: string[] = [];

  for (const sol of nonDominatedSolutions) {
    const equipmentKey = Object.entries(sol.equipmentSet).map(([slot, e]) => {
      if (!e) return `${slot}:null`;
      const configIdx = sol.configIndices[slot as EquipSlot] || 0;
      const config = e.configurations[configIdx];
      const exStr = config?.exStats ? `${config.exStats.ex1}-${config.exStats.ex2 || ''}` : '';
      return `${slot}:${e.name}:${exStr}`;
    }).join('|');
    const emblemKey = sol.usedEmblem?.アイテム名 || 'noEmblem';
    const runeKey = sol.usedRunestones?.runestones?.map((r: any) => r.name).join(',') || 'noRunes';
    const tarotKey = (sol as any).usedTarot?.id || 'noTarot';
    const key = `${equipmentKey}||${emblemKey}||${runeKey}||${tarotKey}`;
    if (!seenKeys.has(key) && sol.score > 0) {
      seenKeys.add(key);
      solutions.push(sol);
      if (solutions.length >= (constraints.maxResults || 10)) break;
    }
  }

  if (solutions.length === 0 && nonDominatedSolutions.length > 0) {
    const hasMinimumStats = options?.minimumStats &&
      Object.values(options.minimumStats).some(v => v !== undefined && v > 0);

    if (hasMinimumStats) {
      warnings.push('指定された最低必須ステータスを満たす装備構成が見つかりませんでした。条件を緩和するか、別の防具タイプを検討してください。');
    } else {
      warnings.push('有効な装備構成が見つかりませんでした。');
    }
  }

  reportProgress('completed', 100, 100, '完了');

  const results: OptimizeResult[] = solutions.map((solution, index) => {
    const equipment: Record<string, any> = {};
    const slots: EquipSlot[] = ['weapon', 'head', 'body', 'leg', 'accessory1', 'accessory2'];

    for (const slot of slots) {
      const candidate = solution.equipmentSet[slot];
      if (candidate) {
        const configIndex = solution.configIndices[slot] || 0;
        const config = candidate.configurations[configIndex];

        equipment[slot] = {
          name: candidate.name,
          type: candidate.type,
          sourceData: candidate.sourceData,
          configuration: config,
          stats: calculateEquipmentStatsFn(candidate, configIndex, gameData.eqConst, context.relevantStats),
        };
      }
    }

    return {
      rank: index + 1,
      meetsMinimum: solution.meetsMinimum,
      build: currentBuild,
      equipment,
      expectedDamage: solution.originalScore,  // 表示用は元のスコアを使用
      calculatedStats: solution.stats,
      damageDetails: {
        baseDamage: solution.originalScore,    // 表示用は元のスコアを使用
        critRate: solution.stats.CritRate || 0,
        hitRate: 100,
      },
      selectedEmblem: solution.usedEmblem || null,
      selectedRunestones: solution.usedRunestones ? {
        runestones: solution.usedRunestones.runestones.map((r: any) => ({
          name: r.name || r['アイテム名（・<グレード>）は不要'],
          grade: r.グレード,
        })),
        totalBonus: solution.usedRunestones.totalBonus,
      } : null,
      selectedTarot: (solution as any).usedTarot || null,
    };
  });

  // 制約条件を満たす結果がない場合は警告を追加
  const hasConstraintMet = results.some((r: any) => r.meetsMinimum);
  if (!hasConstraintMet && results.length > 0) {
    warnings.push('指定された制約条件を満たす装備の組み合わせが見つかりませんでした。最も近い結果を表示しています。');
  }

  const elapsedTime = Date.now() - startTime;
  const totalPruned = prunedEmblems + prunedRunestones;
  const searchStats: SearchStats = {
    totalCandidates,
    evaluatedCombinations: allSolutions.length,
    prunedCombinations: totalPruned,
    elapsedTime,
    phase: 'completed',
  };

  return { results, searchStats, warnings: warnings.length > 0 ? warnings : undefined };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    throw new Error(`最適化処理でエラーが発生しました: ${errorMessage}\n${errorStack}`);
  }
}

/**
 * CSV出力用のデータを生成
 */
export function generateOptimizeResultCSV(results: OptimizeResult[]): string {
  if (results.length === 0) return '';

  const headers = ['順位', '期待ダメージ', '力', '魔力', '体力', '素早さ', '会心率', '会心ダメージ'];
  const rows = results.map((r) => [
    r.rank,
    Math.round(r.expectedDamage),
    r.calculatedStats.Power || 0,
    r.calculatedStats.Magic || 0,
    r.calculatedStats.HP || 0,
    r.calculatedStats.Agility || 0,
    r.calculatedStats.CritRate || 0,
    r.calculatedStats.CritDamage || 0,
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}
