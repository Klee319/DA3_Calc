/**
 * 最適化モジュール - Beam Search エンジン
 *
 * スロット順にBeam Searchで装備組み合わせを探索する。
 * 中間段階では近似スコアで高速に枝刈りし、
 * 最終段階でブラックボックス評価（evaluateCombination）を行う。
 */

import { EquipSlot } from '@/types';
import {
  CandidateEquipment,
  EquipmentPool,
  OptimizeProgress,
  BeamState,
  BeamSearchConfig,
  ExtendedSlot,
  ExtendedEquipmentPool,
  TarotCandidate,
  MinimumStatRequirements,
  DEFAULT_BEAM_SEARCH_CONFIG,
} from '@/types/optimize';
import { EqConstData, EmblemData } from '@/types/data';
import { StatBlock } from '@/types/calc';
import { EvaluationContext, ScoredCombination, SimpleStatBlock } from './types';
import { approximateScore, evaluateCombination, calculateEquipmentStatsFn } from './evaluation';
import type { ApproximateScoreExtras } from './evaluation';
import { BEAM_SLOT_ORDER, BEAM_SEARCH_DEFAULTS, SLOT_LABELS_JP } from './constants';
import { checkMinimumStats, extractEmblemBonusPercent } from './utils';
import { RelevantStats } from '../skillAnalyzer';
import { RunestoneCombination } from './emblemRunestone';

/** Beam探索の内部状態 */
interface InternalBeamState {
  equipmentSet: Record<string, CandidateEquipment | null>;
  configIndices: Record<string, number>;
  dependentStatsSum: Record<string, number>;
  approximateScore: number;
  completedSlots: string[];
  // 紋章・タロット固有
  emblemData?: EmblemData | null;
  runestoneData?: RunestoneCombination;
  tarotCandidate?: TarotCandidate | null;
  /** 適用済みの%ボーナス（紋章・タロット） */
  percentBonus?: Record<string, number>;
}

function mergePercent(
  a: Record<string, number> | undefined,
  b: Record<string, number> | undefined,
): Record<string, number> {
  const out: Record<string, number> = { ...(a || {}) };
  if (b) {
    for (const [k, v] of Object.entries(b)) {
      if (typeof v === 'number') out[k] = (out[k] || 0) + v;
    }
  }
  return out;
}

/**
 * 装備候補の依存ステータス合計を計算（軽量版）
 */
function getCandidateDependentStats(
  candidate: CandidateEquipment,
  configIndex: number,
  eqConst: EqConstData,
  relevantStats?: RelevantStats,
): Record<string, number> {
  const stats = calculateEquipmentStatsFn(candidate, configIndex, eqConst, relevantStats);
  const result: Record<string, number> = {};

  const dependentKeys = relevantStats?.directStats
    ? Array.from(relevantStats.directStats)
    : ['Power', 'Magic', 'HP', 'Mind', 'Agility', 'Dex', 'CritDamage', 'Defense'];

  for (const key of dependentKeys) {
    if (typeof stats[key] === 'number') {
      result[key] = stats[key];
    }
  }

  return result;
}

/**
 * 各スロットの依存ステ上界を事前計算
 */
function computeSlotUpperBounds(
  pool: ExtendedEquipmentPool,
  eqConst: EqConstData,
  relevantStats: RelevantStats | undefined,
  emblemCandidates: EmblemData[],
): Record<string, Record<string, number>> {
  const bounds: Record<string, Record<string, number>> = {};
  const equipSlots: EquipSlot[] = ['weapon', 'head', 'body', 'leg', 'accessory1', 'accessory2'];

  for (const slot of equipSlots) {
    const maxStats: Record<string, number> = {};
    for (const candidate of pool[slot]) {
      for (let ci = 0; ci < candidate.configurations.length; ci++) {
        const stats = getCandidateDependentStats(candidate, ci, eqConst, relevantStats);
        for (const [key, value] of Object.entries(stats)) {
          maxStats[key] = Math.max(maxStats[key] || 0, value);
        }
      }
    }
    bounds[slot] = maxStats;
  }

  // 紋章の上界
  const emblemMax: Record<string, number> = {};
  for (const emblem of emblemCandidates) {
    const bonus = extractEmblemBonusPercent(emblem);
    for (const [key, value] of Object.entries(bonus)) {
      if (typeof value === 'number') {
        emblemMax[key] = Math.max(emblemMax[key] || 0, value);
      }
    }
  }
  bounds['emblem'] = emblemMax;

  // タロットの上界
  const tarotMax: Record<string, number> = {};
  for (const tc of pool.tarot) {
    for (const [key, value] of Object.entries(tc.totalBonus)) {
      if (typeof value === 'number') {
        tarotMax[key] = Math.max(tarotMax[key] || 0, value);
      }
    }
  }
  bounds['tarot'] = tarotMax;

  return bounds;
}

/**
 * 残りスロットの到達可能上界を計算
 */
function computeRemainingUpperBound(
  completedSlots: string[],
  upperBounds: Record<string, Record<string, number>>,
): Record<string, number> {
  const remaining: Record<string, number> = {};
  for (const slot of BEAM_SLOT_ORDER) {
    if (completedSlots.includes(slot)) continue;
    const slotBounds = upperBounds[slot] || {};
    for (const [key, value] of Object.entries(slotBounds)) {
      remaining[key] = (remaining[key] || 0) + value;
    }
  }
  return remaining;
}

/**
 * 必須最低値に到達不能かチェック
 */
function isUnreachable(
  currentSum: Record<string, number>,
  remainingUpper: Record<string, number>,
  minimumStats: MinimumStatRequirements | undefined,
): boolean {
  if (!minimumStats) return false;

  const statMapping: Record<string, string> = {
    HP: 'HP', Power: 'Power', Magic: 'Magic', Defense: 'Defense',
    Mind: 'Mind', Agility: 'Agility', Dex: 'Dex', CritDamage: 'CritDamage',
  };

  for (const [statKey, minValue] of Object.entries(minimumStats)) {
    if (minValue === undefined || minValue <= 0) continue;
    const internalKey = statMapping[statKey] || statKey;
    const current = currentSum[internalKey] || 0;
    const upper = remainingUpper[internalKey] || 0;
    if (current + upper < minValue) return true;
  }

  return false;
}

/**
 * 依存ステ合計を更新（イミュータブル）
 */
function addStats(
  base: Record<string, number>,
  addition: Record<string, number>,
): Record<string, number> {
  const result = { ...base };
  for (const [key, value] of Object.entries(addition)) {
    result[key] = (result[key] || 0) + value;
  }
  return result;
}

/**
 * Beam Search メイン関数
 */
export async function beamSearchOptimize(
  pool: ExtendedEquipmentPool,
  context: EvaluationContext,
  eqConst: EqConstData,
  config: BeamSearchConfig = DEFAULT_BEAM_SEARCH_CONFIG,
  relevantStats: RelevantStats | undefined,
  emblemCandidates: EmblemData[],
  runestoneCombs: RunestoneCombination[],
  onProgress?: (progress: OptimizeProgress) => void,
  abortSignal?: AbortSignal,
): Promise<ScoredCombination[]> {
  const startTime = Date.now();
  const beamWidth = config.beamWidth || BEAM_SEARCH_DEFAULTS.beamWidth;

  const reportProgress = (
    slot: string,
    beamSize: number,
    prunedCount: number,
    message: string,
    bestScore: number = 0,
    intermediateEquipment?: Record<string, string>,
  ) => {
    if (!onProgress) return;
    const slotIndex = BEAM_SLOT_ORDER.indexOf(slot as any);
    const percentage = Math.round(((slotIndex + 1) / BEAM_SLOT_ORDER.length) * 70) + 10;
    onProgress({
      phase: 'beam_search',
      current: slotIndex + 1,
      total: BEAM_SLOT_ORDER.length,
      percentage,
      currentBest: bestScore,
      message,
      elapsedTime: Date.now() - startTime,
      currentSlot: slot as ExtendedSlot,
      beamSize,
      prunedCount,
      slotPhase: 'coarse',
      intermediateEquipment,
    });
  };

  // 上界を事前計算
  const upperBounds = computeSlotUpperBounds(pool, eqConst, relevantStats, emblemCandidates);

  // 装備スロット順序（紋章・タロットを除く）
  const equipSlots: EquipSlot[] = ['weapon', 'head', 'body', 'leg', 'accessory1', 'accessory2'];

  // 初期状態
  let beamStates: InternalBeamState[] = [{
    equipmentSet: {},
    configIndices: {},
    dependentStatsSum: {},
    approximateScore: 0,
    completedSlots: [],
  }];

  let totalPruned = 0;
  let globalBestScore = 0;
  let bestEquipmentNames: Record<string, string> = {};

  // === 装備スロット展開 ===
  for (const slot of equipSlots) {
    const candidates = pool[slot];
    if (candidates.length === 0) {
      // 候補なし: 新しい状態オブジェクトを作成（イミュータブル）
      beamStates = beamStates.map(state => ({
        ...state,
        equipmentSet: { ...state.equipmentSet, [slot]: null },
        completedSlots: [...state.completedSlots, slot],
      }));
      continue;
    }

    const nextStates: InternalBeamState[] = [];
    let slotPruned = 0;

    for (const state of beamStates) {
      for (const candidate of candidates) {
        for (let ci = 0; ci < candidate.configurations.length; ci++) {
          const candidateStats = getCandidateDependentStats(candidate, ci, eqConst, relevantStats);
          const newSum = addStats(state.dependentStatsSum, candidateStats);
          const newCompleted = [...state.completedSlots, slot];

          // 枝刈り: 必須最低値に到達不能
          const remainingUpper = computeRemainingUpperBound(newCompleted, upperBounds);
          if (isUnreachable(newSum, remainingUpper, context.minimumStats)) {
            slotPruned++;
            continue;
          }

          // 近似スコア（職業補正%を投影）
          const score = approximateScore(
            newSum, relevantStats, context.mode, context.targetStat, context.minimumStats, context.jobName, context.jobSPBaseStats,
            {
              jobBonusPercent: context.jobBonusPercent as Record<string, number> | undefined,
              percentBonus: state.percentBonus,
            },
          );

          nextStates.push({
            equipmentSet: { ...state.equipmentSet, [slot]: candidate },
            configIndices: { ...state.configIndices, [slot]: ci },
            dependentStatsSum: newSum,
            approximateScore: score,
            completedSlots: newCompleted,
            emblemData: state.emblemData,
            runestoneData: state.runestoneData,
            tarotCandidate: state.tarotCandidate,
            percentBonus: state.percentBonus,
          });
        }
      }
    }

    totalPruned += slotPruned;

    // メモリ制限: beamWidth の 10倍を超えたら中間刈り込み
    if (nextStates.length > beamWidth * 10) {
      nextStates.sort((a, b) => b.approximateScore - a.approximateScore);
      nextStates.length = beamWidth * 2;
    }

    // 上位B個を残す
    nextStates.sort((a, b) => b.approximateScore - a.approximateScore);
    beamStates = nextStates.slice(0, beamWidth);

    // ベスト更新
    if (beamStates.length > 0 && beamStates[0].approximateScore > globalBestScore) {
      globalBestScore = beamStates[0].approximateScore;
      bestEquipmentNames = {};
      for (const [s, eq] of Object.entries(beamStates[0].equipmentSet)) {
        if (eq) bestEquipmentNames[s] = (eq as CandidateEquipment).name;
      }
    }

    reportProgress(
      slot, beamStates.length, totalPruned,
      `${SLOT_LABELS_JP[slot] || slot}完了 (${beamStates.length}状態)`,
      globalBestScore, bestEquipmentNames,
    );

    // UIスレッドに制御を返す
    await new Promise(resolve => setTimeout(resolve, 0));
    if (abortSignal?.aborted) throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
  }

  // === 紋章スロット展開（上位K個のルーンストーン組み合わせも展開） ===
  if (emblemCandidates.length > 0) {
    const nextStates: InternalBeamState[] = [];
    // 上位K個のルーンストーン組み合わせを展開（ソート済み前提）
    const topRunestones = runestoneCombs.length > 0
      ? runestoneCombs.slice(0, Math.min(5, runestoneCombs.length))
      : [{ runestones: [] as any[], totalBonus: {} as Record<string, number> }];

    for (const state of beamStates) {
      for (const emblem of emblemCandidates) {
        const emblemBonus = extractEmblemBonusPercent(emblem);

        for (const runeComb of topRunestones) {
          // 紋章は%ボーナス。近似スコアには乗算枠として渡す（SpellRefactor用）。
          // ルーンストーンは絶対値なのでsumに加算する。
          const runeBonus = runeComb.totalBonus || {};
          const withRune = addStats(state.dependentStatsSum, runeBonus);
          const newPercent = mergePercent(state.percentBonus, emblemBonus as Record<string, number>);

          const score = approximateScore(
            withRune, relevantStats, context.mode, context.targetStat, context.minimumStats,
            context.jobName, context.jobSPBaseStats,
            {
              jobBonusPercent: context.jobBonusPercent as Record<string, number> | undefined,
              percentBonus: newPercent,
            },
          );

          nextStates.push({
            ...state,
            dependentStatsSum: withRune,
            approximateScore: score,
            completedSlots: [...state.completedSlots, 'emblem'],
            emblemData: emblem,
            runestoneData: runeComb,
            percentBonus: newPercent,
          });
        }
      }
    }

    // 紋章×ルーンで膨張するため中間刈り込み
    if (nextStates.length > beamWidth * 10) {
      nextStates.sort((a, b) => b.approximateScore - a.approximateScore);
      nextStates.length = beamWidth * 2;
    }

    nextStates.sort((a, b) => b.approximateScore - a.approximateScore);
    beamStates = nextStates.slice(0, beamWidth);
    totalPruned += Math.max(0, nextStates.length - beamWidth);

    reportProgress(
      'emblem', beamStates.length, totalPruned,
      `紋章完了 (${beamStates.length}状態)`,
      globalBestScore, bestEquipmentNames,
    );

    await new Promise(resolve => setTimeout(resolve, 0));
    if (abortSignal?.aborted) throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
  } else {
    // 紋章候補がなくてもルーンストーンボーナスは適用
    const defaultRunestone = runestoneCombs.length > 0
      ? runestoneCombs[0]
      : { runestones: [], totalBonus: {} };
    beamStates = beamStates.map(state => ({
      ...state,
      completedSlots: [...state.completedSlots, 'emblem'],
      runestoneData: defaultRunestone,
    }));
  }

  // === タロットスロット展開 ===
  if (pool.tarot.length > 0) {
    const nextStates: InternalBeamState[] = [];

    for (const state of beamStates) {
      for (const tarot of pool.tarot) {
        const tarotBonus = tarot.totalBonus as Record<string, number>;
        // タロットtotalBonusは%ボーナス（紋章と同じ乗算枠）
        const newPercent = mergePercent(state.percentBonus, tarotBonus);

        const score = approximateScore(
          state.dependentStatsSum, relevantStats, context.mode, context.targetStat, context.minimumStats,
          context.jobName, context.jobSPBaseStats,
          {
            jobBonusPercent: context.jobBonusPercent as Record<string, number> | undefined,
            percentBonus: newPercent,
          },
        );

        nextStates.push({
          ...state,
          approximateScore: score,
          completedSlots: [...state.completedSlots, 'tarot'],
          tarotCandidate: tarot,
          percentBonus: newPercent,
        });
      }
    }

    nextStates.sort((a, b) => b.approximateScore - a.approximateScore);
    beamStates = nextStates.slice(0, beamWidth);

    reportProgress(
      'tarot', beamStates.length, totalPruned,
      `タロット完了 (${beamStates.length}状態)`,
      globalBestScore, bestEquipmentNames,
    );

    await new Promise(resolve => setTimeout(resolve, 0));
    if (abortSignal?.aborted) throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
  }

  // === 詳細化段階: 上位N状態をブラックボックス評価 ===
  const refinementCount = Math.min(config.refinementCount || BEAM_SEARCH_DEFAULTS.refinementTopN, beamStates.length);

  onProgress?.({
    phase: 'beam_refine',
    current: 0,
    total: refinementCount,
    percentage: 80,
    currentBest: globalBestScore,
    message: `詳細化中 (0/${refinementCount})`,
    elapsedTime: Date.now() - startTime,
    slotPhase: 'fine',
  });

  const evaluatedResults: ScoredCombination[] = [];

  for (let i = 0; i < refinementCount; i++) {
    const state = beamStates[i];

    // 装備セットを EquipSlot 形式に変換
    const combination: Record<EquipSlot, CandidateEquipment | null> = {
      weapon: (state.equipmentSet['weapon'] as CandidateEquipment) || null,
      head: (state.equipmentSet['head'] as CandidateEquipment) || null,
      body: (state.equipmentSet['body'] as CandidateEquipment) || null,
      leg: (state.equipmentSet['leg'] as CandidateEquipment) || null,
      accessory1: (state.equipmentSet['accessory1'] as CandidateEquipment) || null,
      accessory2: (state.equipmentSet['accessory2'] as CandidateEquipment) || null,
    };

    const configIndices: Record<EquipSlot, number> = {
      weapon: state.configIndices['weapon'] || 0,
      head: state.configIndices['head'] || 0,
      body: state.configIndices['body'] || 0,
      leg: state.configIndices['leg'] || 0,
      accessory1: state.configIndices['accessory1'] || 0,
      accessory2: state.configIndices['accessory2'] || 0,
    };

    // 紋章をコンテキストに設定
    const evalContext: EvaluationContext = {
      ...context,
      emblem: state.emblemData || context.emblem,
      runestoneBonus: state.runestoneData?.totalBonus || context.runestoneBonus,
    };

    // タロットボーナスを正しいフィールドに設定
    // %ボーナス → tarotBonusPercent（紋章%と同じ乗算枠）
    // 武器固定値 → tarotWeaponBonus
    if (state.tarotCandidate) {
      evalContext.tarotBonusPercent = state.tarotCandidate.totalBonus;
      evalContext.tarotWeaponBonus = state.tarotCandidate.weaponBonus;
      evalContext.tarotDamageBuffs = state.tarotCandidate.damageBuffs;
    }

    // ブラックボックス評価
    const result = evaluateCombination(combination, configIndices, evalContext, eqConst);

    evaluatedResults.push({
      equipmentSet: combination,
      configIndices,
      score: result.score,
      originalScore: result.originalScore,
      stats: result.stats,
      meetsMinimum: result.meetsMinimum,
      _emblemData: state.emblemData || null,
      _runestoneData: state.runestoneData,
      _tarotCandidate: state.tarotCandidate || null,
    } as ScoredCombination & { _emblemData?: unknown; _runestoneData?: unknown; _tarotCandidate?: unknown });

    if (i % 5 === 0 || i === refinementCount - 1) {
      onProgress?.({
        phase: 'beam_refine',
        current: i + 1,
        total: refinementCount,
        percentage: 80 + Math.round((i / refinementCount) * 15),
        currentBest: evaluatedResults.length > 0
          ? Math.max(...evaluatedResults.map(r => r.originalScore))
          : 0,
        message: `詳細化中 (${i + 1}/${refinementCount})`,
        elapsedTime: Date.now() - startTime,
        slotPhase: 'fine',
      });
      await new Promise(resolve => setTimeout(resolve, 0));
    if (abortSignal?.aborted) throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
    }
  }

  // スコア降順ソート & 重複除去
  evaluatedResults.sort((a, b) => b.score - a.score);

  const seenKeys = new Set<string>();
  const deduplicated: ScoredCombination[] = [];

  for (const result of evaluatedResults) {
    const br = result as any;
    const equipKey = equipSlots
      .map(slot => {
        const eq = result.equipmentSet[slot];
        if (!eq) return `${slot}:null`;
        const ci = result.configIndices[slot] || 0;
        const cfg = eq.configurations[ci];
        const exStr = cfg?.exStats ? `${cfg.exStats.ex1}-${cfg.exStats.ex2 || ''}` : '';
        return `${slot}:${eq.name}:${ci}:${exStr}`;
      })
      .join('|');
    const emblemKey = br._emblemData?.アイテム名 || 'none';
    const tarotKey = br._tarotCandidate?.id || 'none';
    const key = `${equipKey}||${emblemKey}||${tarotKey}`;

    if (!seenKeys.has(key) && result.score > 0) {
      seenKeys.add(key);
      deduplicated.push(result);
      if (deduplicated.length >= 10) break;
    }
  }

  // === EX構成の事後最適化（全スロット横断でP=Mバランスを改善）===
  // Beam Searchの近似評価で決定したEX/叩き構成を、ブラックボックス評価で再調整。
  // 各スロットの構成を1つずつ差し替え、スコアが改善するか試行する。
  // SpellRefactor等P=Mバランスが重要な職業で特に効果が大きい。
  onProgress?.({
    phase: 'beam_refine',
    current: refinementCount,
    total: refinementCount,
    percentage: 96,
    currentBest: deduplicated.length > 0 ? Math.max(...deduplicated.map(r => r.originalScore)) : 0,
    message: 'EX構成を再最適化中...',
    elapsedTime: Date.now() - startTime,
    slotPhase: 'fine',
  });

  const rebalancedResults: ScoredCombination[] = [];

  // refinementCount<25 は非primary SPの短縮版→ EX post-optも短縮する
  const isPrimarySP = refinementCount >= 25;

  // 代替ルーンストーン候補（上位N件、ソート済み前提）
  // 上位3件のdedup結果にはより多くの代替ルーンを試し、残りは少数に絞って高速化。
  // 非primary SPでは全体を2件に絞る。
  const topAltCount = isPrimarySP ? 6 : 2;
  const lowAltCount = isPrimarySP ? 2 : 1;
  const topAltRunestones = runestoneCombs.slice(0, Math.min(topAltCount, runestoneCombs.length));
  const lowAltRunestones = runestoneCombs.slice(0, Math.min(lowAltCount, runestoneCombs.length));

  for (let dedupIdx = 0; dedupIdx < deduplicated.length; dedupIdx++) {
    const result = deduplicated[dedupIdx];
    const br = result as any;
    let best = result;
    let bestRuneData = br._runestoneData;

    // 上位3件は多くの代替ルーンを試行し、残りは最小限に
    const altRunestones = dedupIdx < 3 ? topAltRunestones : lowAltRunestones;
    const maxIter = isPrimarySP ? (dedupIdx < 3 ? 3 : 2) : (dedupIdx < 2 ? 2 : 1);

    // 複数ルーンストーン候補 × 構成最適化を同時探索
    // Beam Searchはequipment→runestone順のため、equipment確定後に
    // 別ルーンストーンで構成を再最適化することで相互依存を解決
    const runesToTry = [
      br._runestoneData,  // 元のルーンストーン
      ...altRunestones.filter((r: RunestoneCombination) =>
        r !== br._runestoneData &&
        JSON.stringify(r.totalBonus) !== JSON.stringify(br._runestoneData?.totalBonus || {})
      ),
    ];

    for (const runeCand of runesToTry) {
      if (!runeCand) continue;

      const rebalanceCtx: EvaluationContext = {
        ...context,
        emblem: br._emblemData || context.emblem,
        runestoneBonus: runeCand.totalBonus || context.runestoneBonus,
      };
      if (br._tarotCandidate) {
        rebalanceCtx.tarotBonusPercent = br._tarotCandidate.totalBonus;
        rebalanceCtx.tarotWeaponBonus = br._tarotCandidate.weaponBonus;
        rebalanceCtx.tarotDamageBuffs = br._tarotCandidate.damageBuffs;
      }

      // まず現在のconfigで評価（ルーンストーンだけ変更）
      let current = result;
      const baseEv = evaluateCombination(
        current.equipmentSet, current.configIndices, rebalanceCtx, eqConst
      );
      current = { ...current, score: baseEv.score, originalScore: baseEv.originalScore,
        stats: baseEv.stats, meetsMinimum: baseEv.meetsMinimum };

      // 局所探索（各反復で全スロットの構成を再検討）
      for (let iter = 0; iter < maxIter; iter++) {
        let foundImprovement = false;

        for (const slot of equipSlots) {
          const candidate = current.equipmentSet[slot];
          if (!candidate || candidate.configurations.length <= 1) continue;

          const currentCI = current.configIndices[slot] || 0;
          let bestScore = current.score;
          let bestCI = currentCI;

          for (let ci = 0; ci < candidate.configurations.length; ci++) {
            if (ci === currentCI) continue;
            const newIndices = { ...current.configIndices, [slot]: ci } as Record<EquipSlot, number>;
            const ev = evaluateCombination(current.equipmentSet, newIndices, rebalanceCtx, eqConst);
            if (ev.score > bestScore) {
              bestScore = ev.score;
              bestCI = ci;
            }
          }

          if (bestCI !== currentCI) {
            const newIndices = { ...current.configIndices, [slot]: bestCI } as Record<EquipSlot, number>;
            const ev = evaluateCombination(current.equipmentSet, newIndices, rebalanceCtx, eqConst);
            current = {
              ...current,
              configIndices: newIndices,
              score: ev.score,
              originalScore: ev.originalScore,
              stats: ev.stats,
              meetsMinimum: ev.meetsMinimum,
            };
            foundImprovement = true;
          }
        }

        if (!foundImprovement) break;
      }

      // このルーンストーンでの最善が全体ベストを上回るか
      if (current.score > best.score) {
        best = { ...current, _runestoneData: runeCand } as any;
        bestRuneData = runeCand;
      }
    }

    rebalancedResults.push(best);

    await new Promise(resolve => setTimeout(resolve, 0));
    if (abortSignal?.aborted) break;
  }

  // EX再最適化後に再ソート
  rebalancedResults.sort((a, b) => b.score - a.score);

  return rebalancedResults;
}
