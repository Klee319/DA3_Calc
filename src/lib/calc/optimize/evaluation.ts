/**
 * 最適化モジュール - 評価関数
 */

import { EquipSlot } from '@/types';
import { CandidateEquipment, RANK_VALUES, OptimizeMode, MinimumStatRequirements } from '@/types/optimize';
import {
  WeaponData,
  ArmorData,
  AccessoryData,
  EqConstData,
} from '@/types/data';
import { StatBlock, StatusCalcInput, CalculatedStats, DamageCalcInput, WeaponType, InternalStatKey } from '@/types/calc';
import {
  calculateWeaponStats,
  calculateAccessoryStats,
  calculateArmorEX,
  calculateAccessoryEX,
} from '../equipmentCalculator';
import { ArmorSmithingDistribution } from '../equipment/types';
import { selectOptimalEX, RelevantStats } from '../skillAnalyzer';
import { calculateStatus } from '../statusCalculator';
import { calculateAllJobStats, convertToSPTree, calculateBranchBonus } from '../jobCalculator';
import { calculateDamage } from '../damageCalculator';
import { EvaluationContext, SimpleStatBlock, ArmorEXType, AccessoryEXType } from './types';
import {
  EX_TYPE_TO_STAT_KEY, CSV_WEAPON_TO_TYPE,
  MAX_EVALUATION_CACHE_SIZE, MAX_EQUIPMENT_STATS_CACHE_SIZE, MAX_JOB_STATS_CACHE_SIZE,
  DEX_TO_CRIT_RATE, MAX_CRIT_RATE, CONSTRAINT_PENALTY_FACTOR
} from './constants';
import { extractEmblemBonusPercent, checkMinimumStats, calculateMinimumStatsProgress, determineArmorSmithingDistribution } from './utils';
import { calculateEfficiencyPenalty } from './sensitivity';

/** 評価結果のキャッシュ */
const evaluationCache = new Map<string, { score: number; originalScore: number; stats: SimpleStatBlock; meetsMinimum: boolean }>();
/** 装備ステータスキャッシュ */
const equipmentStatsCache = new Map<string, SimpleStatBlock>();
/** ジョブ計算キャッシュ */
const jobStatsCache = new Map<string, { jobStats: StatBlock; jobBonusPercent: StatBlock; spStats: StatBlock }>();

/** キャッシュをクリア（サイズ制限付き） */
export function clearEvaluationCache(): void {
  const trimCache = <T>(cache: Map<string, T>, maxSize: number) => {
    if (cache.size > maxSize) {
      const toDelete = cache.size - Math.floor(maxSize * 0.7);
      const iter = cache.keys();
      for (let i = 0; i < toDelete; i++) {
        const key = iter.next().value;
        if (key) cache.delete(key);
      }
    }
  };
  trimCache(evaluationCache, MAX_EVALUATION_CACHE_SIZE);
  trimCache(equipmentStatsCache, MAX_EQUIPMENT_STATS_CACHE_SIZE);
  trimCache(jobStatsCache, MAX_JOB_STATS_CACHE_SIZE);
}

/** 完全クリア（必要な場合のみ呼び出す） */
export function forceCleanAllCaches(): void {
  evaluationCache.clear();
  equipmentStatsCache.clear();
  jobStatsCache.clear();
}

/** キャッシュキーを生成 */
export function generateCacheKey(
  combination: Record<EquipSlot, CandidateEquipment | null>,
  configIndices: Record<EquipSlot, number>,
  contextKey: string
): string {
  const slots: EquipSlot[] = ['weapon', 'head', 'body', 'leg', 'accessory1', 'accessory2'];
  const parts = slots.map(slot => {
    const cand = combination[slot];
    if (!cand) return `${slot}:null`;
    const cfgIdx = configIndices[slot] || 0;
    const cfg = cand.configurations[cfgIdx];
    const exStr = cfg?.exStats ? `${cfg.exStats.ex1}-${cfg.exStats.ex2 || ''}` : '';
    const smithStr = cfg?.smithing ? JSON.stringify(cfg.smithing) : '';
    return `${slot}:${cand.id}:${cfgIdx}:${exStr}:${smithStr}`;
  });
  return `${contextKey}|${parts.join('|')}`;
}
/** 装備ステータスキャッシュキーを生成 */
function generateEquipmentStatsCacheKey(
  candidateId: string,
  configIndex: number,
  config: { rank?: string; enhancement?: number; smithing?: unknown; exStats?: { ex1?: string; ex2?: string } }
): string {
  const smithStr = config.smithing ? JSON.stringify(config.smithing) : '';
  const exStr = config.exStats ? `${config.exStats.ex1 || ''}-${config.exStats.ex2 || ''}` : '';
  return `${candidateId}:${configIndex}:${config.rank || 'SSS'}:${config.enhancement || 10}:${smithStr}:${exStr}`;
}

/**
 * 装備のステータスを計算（キャッシュ付き）
 */
export function calculateEquipmentStatsFn(
  candidate: CandidateEquipment,
  configIndex: number,
  eqConst: EqConstData,
  relevantStats?: RelevantStats
): SimpleStatBlock {
  const config = candidate.configurations[configIndex];
  if (!config) return {};

  // キャッシュチェック
  const cacheKey = generateEquipmentStatsCacheKey(candidate.id, configIndex, config);
  const cached = equipmentStatsCache.get(cacheKey);
  if (cached) {
    return { ...cached }; // 浅いコピーを返す
  }

  const stats: SimpleStatBlock = {};

  try {
    if (candidate.type === 'weapon') {
      const weapon = candidate.sourceData as WeaponData;
      const smithing = config.smithing as { attackPower?: number; critRate?: number; critDamage?: number } || {};
      const weaponSmithing = {
        attackPower: smithing.attackPower || 0,
        critRate: smithing.critRate || 0,
        critDamage: smithing.critDamage || 0,
      };

      const weaponStats = calculateWeaponStats(
        weapon,
        (config.rank || 'SSS') as any,
        config.enhancement ?? 80,  // 武器強化値は最大80
        weaponSmithing,
        config.alchemyEnabled ?? true,
        eqConst
      );

      stats.WeaponAttackPower = weaponStats.attackPower || 0;
      stats.CritRate = weaponStats.critRate || 0;
      stats.CritDamage = weaponStats.critDamage || 0;
      stats.CoolTime = weaponStats.coolTime || 0;
      stats.DamageCorrection = weaponStats.damageCorrection || 1;
    } else if (candidate.type === 'armor') {
      const armor = candidate.sourceData as ArmorData;
      const smithing = config.smithing as { armorDistribution?: ArmorSmithingDistribution; tatakiCount?: number } || {};

      let armorDistribution: ArmorSmithingDistribution;
      if (smithing.armorDistribution) {
        armorDistribution = smithing.armorDistribution;
      } else if (smithing.tatakiCount && smithing.tatakiCount > 0) {
        armorDistribution = determineArmorSmithingDistribution(armor, relevantStats, smithing.tatakiCount);
      } else {
        armorDistribution = {};
      }

      // buildStore.tsと同じ計算ロジックを使用
      // 叩きをランク計算に含める（叩き後に単純加算ではない）
      const rank = (config.rank || 'SSS') as string;
      const reinforcementCount = config.enhancement ?? 40;

      // ランク値をEqConst.yamlから取得
      const rankValue = eqConst.Armor?.Rank?.[rank as keyof typeof eqConst.Armor.Rank] || 0;
      const availableLv = armor.使用可能Lv || 1;

      // 叩き・強化係数をEqConst.yamlから取得
      const forgeDefence = eqConst.Armor?.Forge?.Defence ?? 1;
      const forgeOther = eqConst.Armor?.Forge?.Other ?? 2;
      const reinforceDefence = eqConst.Armor?.Reinforcement?.Defence ?? 2;
      const reinforceOther = eqConst.Armor?.Reinforcement?.Other ?? 2;

      // ステータス定義（buildStore.tsと同じ）
      const armorStatDefs = [
        { csvKey: '守備力（初期値）', outputKey: 'Defense', smithingParam: 'defense', forgeMultiplier: forgeDefence, reinforceMultiplier: reinforceDefence },
        { csvKey: '体力（初期値）', outputKey: 'HP', smithingParam: 'hp', forgeMultiplier: forgeOther, reinforceMultiplier: reinforceOther },
        { csvKey: '力（初期値）', outputKey: 'Power', smithingParam: 'power', forgeMultiplier: forgeOther, reinforceMultiplier: reinforceOther },
        { csvKey: '魔力（初期値）', outputKey: 'Magic', smithingParam: 'magic', forgeMultiplier: forgeOther, reinforceMultiplier: reinforceOther },
        { csvKey: '精神（初期値）', outputKey: 'Mind', smithingParam: 'mind', forgeMultiplier: forgeOther, reinforceMultiplier: reinforceOther },
        { csvKey: '素早さ（初期値）', outputKey: 'Agility', smithingParam: 'speed', forgeMultiplier: forgeOther, reinforceMultiplier: reinforceOther },
        { csvKey: '器用（初期値）', outputKey: 'Dex', smithingParam: 'dexterity', forgeMultiplier: forgeOther, reinforceMultiplier: reinforceOther },
        { csvKey: '撃力（初期値）', outputKey: 'CritDamage', smithingParam: 'critDamage', forgeMultiplier: forgeOther, reinforceMultiplier: reinforceOther },
      ];

      // 各ステータスを個別に計算（buildStore.tsと同じ計算式）
      for (const statDef of armorStatDefs) {
        const baseValue = (armor as unknown as Record<string, unknown>)[statDef.csvKey] as number || 0;
        if (baseValue === 0) continue; // 基礎値0のステータスはスキップ

        // パラメータ別叩き回数を取得
        const paramSmithingCount = (armorDistribution as Record<string, number>)[statDef.smithingParam] || 0;
        const smithingBonus = paramSmithingCount * statDef.forgeMultiplier;

        // 強化ボーナス
        const enhanceBonus = reinforcementCount * statDef.reinforceMultiplier;

        // ランク計算: round(baseWithTataki * (1 + baseWithTataki^0.2 * (rankValue / availableLv)))
        const baseWithTataki = baseValue + smithingBonus;
        const calculatedValue = Math.round(
          baseWithTataki * (1 + Math.pow(baseWithTataki, 0.2) * (rankValue / availableLv))
        );

        // 最終値 = ランク計算後の値 + 強化ボーナス
        const finalValue = calculatedValue + enhanceBonus;

        if (statDef.outputKey === 'CritDamage') {
          stats.CritDamage = (stats.CritDamage || 0) + finalValue;
        } else {
          stats[statDef.outputKey] = (stats[statDef.outputKey] || 0) + finalValue;
        }
      }
      const totalTataki = Object.values(armorDistribution).reduce((sum: number, v) => sum + ((v as number) || 0), 0);

      // 叩き配分情報を保存（UI表示用）
      if (totalTataki > 0) {
        const statNameMap: Record<string, string> = {
          power: '力', magic: '魔力', hp: '体力', mind: '精神',
          speed: '素早さ', dexterity: '器用', critDamage: '撃力', defense: '守備力'
        };
        const details: Array<{ stat: string; count: number }> = [];
        for (const [key, count] of Object.entries(armorDistribution)) {
          if (count && count > 0) {
            details.push({ stat: statNameMap[key] || key, count });
          }
        }
        stats._smithingBreakdown = { details, tatakiCount: totalTataki } as any;
      }

      let ex1Type: ArmorEXType;
      let ex2Type: ArmorEXType;

      if (config.exStats?.ex1 && config.exStats?.ex2) {
        ex1Type = config.exStats.ex1 as ArmorEXType;
        ex2Type = config.exStats.ex2 as ArmorEXType;
      } else if (relevantStats) {
        const exSelection = selectOptimalEX(relevantStats, 'armor');
        ex1Type = exSelection.ex1 as ArmorEXType;
        ex2Type = exSelection.ex2 as ArmorEXType;
      } else {
        ex1Type = 'Power';
        ex2Type = 'Magic';
      }

      try {
        const exResult = calculateArmorEX(
          armor,
          config.rank as any,
          ex1Type,
          ex2Type,
          eqConst
        );

        const ex1StatKey = EX_TYPE_TO_STAT_KEY[ex1Type];
        const ex2StatKey = EX_TYPE_TO_STAT_KEY[ex2Type];

        if (ex1StatKey) {
          stats[ex1StatKey] = (stats[ex1StatKey] || 0) + exResult.ex1;
        }
        if (ex2StatKey) {
          stats[ex2StatKey] = (stats[ex2StatKey] || 0) + exResult.ex2;
        }

        stats._ex1Type = ex1Type as any;
        stats._ex1Value = exResult.ex1;
        stats._ex2Type = ex2Type as any;
        stats._ex2Value = exResult.ex2;
      } catch {
        // EX calculation failed, continue without EX
      }
    } else if (candidate.type === 'accessory') {
      const accessory = candidate.sourceData as AccessoryData;

      const accessoryStats = calculateAccessoryStats(
        accessory,
        config.rank as any,
        eqConst
      );

      if (accessoryStats.final) {
        stats.Power = (stats.Power || 0) + (accessoryStats.final.Power || 0);
        stats.Magic = (stats.Magic || 0) + (accessoryStats.final.Magic || 0);
        stats.HP = (stats.HP || 0) + (accessoryStats.final.HP || 0);
        stats.Mind = (stats.Mind || 0) + (accessoryStats.final.Mind || 0);
        stats.Agility = (stats.Agility || 0) + (accessoryStats.final.Speed || 0);
        stats.CritDamage = (stats.CritDamage || 0) + (accessoryStats.final.CritDamage || 0);
      }

      let ex1Type: AccessoryEXType;
      let ex2Type: AccessoryEXType;

      if (config.exStats?.ex1 && config.exStats?.ex2) {
        ex1Type = config.exStats.ex1 as AccessoryEXType;
        ex2Type = config.exStats.ex2 as AccessoryEXType;
      } else if (relevantStats) {
        const exSelection = selectOptimalEX(relevantStats, 'accessory');
        ex1Type = exSelection.ex1 as AccessoryEXType;
        ex2Type = exSelection.ex2 as AccessoryEXType;
      } else {
        ex1Type = 'Power';
        ex2Type = 'Magic';
      }

      try {
        // EX1の計算
        const ex1Result = calculateAccessoryEX(
          accessory,
          (config.rank || 'SSS') as any,
          ex1Type,
          eqConst
        );
        // EX2の計算
        const ex2Result = calculateAccessoryEX(
          accessory,
          (config.rank || 'SSS') as any,
          ex2Type,
          eqConst
        );

        const ex1StatKey = EX_TYPE_TO_STAT_KEY[ex1Type];
        if (ex1StatKey) {
          stats[ex1StatKey] = (stats[ex1StatKey] || 0) + ex1Result.exValue;
        }

        const ex2StatKey = EX_TYPE_TO_STAT_KEY[ex2Type];
        if (ex2StatKey) {
          stats[ex2StatKey] = (stats[ex2StatKey] || 0) + ex2Result.exValue;
        }

        stats._ex1Type = ex1Type as any;
        stats._ex1Value = ex1Result.exValue;
        stats._ex2Type = ex2Type as any;
        stats._ex2Value = ex2Result.exValue;
      } catch {
        // EX calculation failed, continue without EX
      }
    }
  } catch {
    // Fallback calculation
    const rank = config.rank || 'SSS';
    if (candidate.type === 'weapon') {
      const enhancement = config.enhancement ?? 80;  // 武器強化値は最大80
      const weapon = candidate.sourceData as WeaponData;
      const baseAttack = weapon['攻撃力（初期値）'] || 0;
      const rankBonus = RANK_VALUES[rank] * 10;
      const enhanceBonus = enhancement * 2;
      stats.WeaponAttackPower = baseAttack + rankBonus + enhanceBonus;
      stats.CritRate = weapon['会心率（初期値）'] || 0;
      stats.CritDamage = weapon['会心ダメージ（初期値）'] || 0;
    } else if (candidate.type === 'armor') {
      const armor = candidate.sourceData as ArmorData;
      stats.Power = armor['力（初期値）'] || 0;
      stats.Magic = armor['魔力（初期値）'] || 0;
      stats.HP = armor['体力（初期値）'] || 0;
      stats.Defense = armor['守備力（初期値）'] || 0;
    } else if (candidate.type === 'accessory') {
      const accessory = candidate.sourceData as AccessoryData;
      stats.Power = accessory['力（初期値）'] || 0;
      stats.Magic = accessory['魔力（初期値）'] || 0;
    }
  }

  // キャッシュに保存
  equipmentStatsCache.set(cacheKey, { ...stats });

  return stats;
}

/** ジョブ計算キャッシュキーを生成 */
function generateJobStatsCacheKey(
  jobName: string | undefined,
  jobLevel: number,
  spAllocation: Record<string, number> | undefined
): string {
  const spKey = spAllocation ? JSON.stringify(Object.entries(spAllocation).sort()) : '';
  return `${jobName || ''}:${jobLevel}:${spKey}`;
}
/** メモ化されたジョブステータス計算 */
function getJobStatsWithMemo(
  context: EvaluationContext,
  jobLevel: number,
  spAllocationArray: Array<{ branch: 'A' | 'B' | 'C'; tier: number; spCost: number }>
): { jobStats: StatBlock; jobBonusPercent: StatBlock; spStats: StatBlock } {
  const cacheKey = generateJobStatsCacheKey(context.jobName, jobLevel, context.spAllocation);
  const cached = jobStatsCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const defaultStats: StatBlock = {
    HP: jobLevel,
    Power: jobLevel * 2,
    Magic: jobLevel * 2,
    Mind: jobLevel,
    Agility: 0,
    Dex: 0,
    CritDamage: 0,
    Defense: 0,
  };

  let jobStats = defaultStats;
  let jobBonusPercent: StatBlock = {};
  let spStats: StatBlock = {};

  if (context.jobName && context.jobConst) {
    try {
      // buildStoreと同様に、空配列を渡して基礎値のみ取得（SPボーナスは別途calculateBranchBonusで計算）
      jobStats = calculateAllJobStats(
        context.jobName,
        jobLevel,
        [], // SPAllocation配列は空にして基礎値のみ取得
        context.jobConst,
        context.jobSPData
      );

      if (context.jobSPData && context.jobSPData.length > 0) {
        const spTree = convertToSPTree(context.jobSPData);
        if (spTree.jobCorrection) {
          // ?? 0 で負値（-%補正）を正しく保持（|| 0 でも動くがnullish coalescingが意図明確）
          jobBonusPercent = {
            Power: spTree.jobCorrection.Power ?? 0,
            Magic: spTree.jobCorrection.Magic ?? 0,
            HP: spTree.jobCorrection.HP ?? 0,
            Mind: spTree.jobCorrection.Mind ?? 0,
            Agility: spTree.jobCorrection.Agility ?? 0,
            Dex: spTree.jobCorrection.Dex ?? 0,
            CritDamage: spTree.jobCorrection.CritDamage ?? 0,
            Defense: spTree.jobCorrection.Defense ?? 0,
          };
        }

        // calculateBranchBonusを使用してSPボーナスを計算（buildStoreと同じ方法）
        if (context.spAllocation && context.jobSPData) {
          // 累積SP形式に変換（A, B, C）
          let cumulativeSP: { A: number; B: number; C: number } = { A: 0, B: 0, C: 0 };

          if ('A' in context.spAllocation || 'B' in context.spAllocation || 'C' in context.spAllocation) {
            // 既に累積SP形式
            cumulativeSP = {
              A: (context.spAllocation as Record<string, number>)['A'] || 0,
              B: (context.spAllocation as Record<string, number>)['B'] || 0,
              C: (context.spAllocation as Record<string, number>)['C'] || 0,
            };
          } else {
            // ティア形式から累積SPを計算（各ブランチの最大必要SPを計算）
            for (const allocation of spAllocationArray) {
              const tierData = context.jobSPData.find(r => r.解法段階 === `${allocation.branch}-${allocation.tier}`);
              if (tierData) {
                const requiredSP = typeof tierData.必要SP === 'string' ? parseFloat(tierData.必要SP) || 0 : tierData.必要SP || 0;
                cumulativeSP[allocation.branch] = Math.max(cumulativeSP[allocation.branch], requiredSP);
              }
            }
          }

          const branchBonus = calculateBranchBonus(cumulativeSP, context.jobSPData);

          // 日本語キーを内部キーにマッピングして合算
          const jpToInternal: Record<string, keyof StatBlock> = {
            '体力': 'HP',
            '力': 'Power',
            '魔力': 'Magic',
            '精神': 'Mind',
            '素早さ': 'Agility',
            '器用さ': 'Dex',
            '撃力': 'CritDamage',
            '守備力': 'Defense',
          };

          (['A', 'B', 'C'] as const).forEach(branch => {
            const bonus = branchBonus[branch];
            Object.entries(bonus).forEach(([jpKey, value]) => {
              const internalKey = jpToInternal[jpKey];
              if (internalKey && value) {
                spStats[internalKey] = ((spStats[internalKey] as number) || 0) + value;
              }
            });
          });
        }
      }
    } catch {
      // Job calculation failed, use defaults
    }
  }

  const result = { jobStats, jobBonusPercent, spStats };
  jobStatsCache.set(cacheKey, result);
  return result;
}
/** 組み合わせを評価してスコアを計算 */
export function evaluateCombination(
  combination: Record<EquipSlot, CandidateEquipment | null>,
  configIndices: Record<EquipSlot, number>,
  context: EvaluationContext,
  eqConst: EqConstData
): { score: number; originalScore: number; stats: SimpleStatBlock; meetsMinimum: boolean } {
  const equipmentStats: SimpleStatBlock = {};
  const slots: EquipSlot[] = ['weapon', 'head', 'body', 'leg', 'accessory1', 'accessory2'];

  let weaponCritRate = 0;
  let weaponCritDamage = 0;
  let weaponCoolTime = 5;
  let weaponDamageCorrection = 1;
  let weaponAttackPower = 0;
  let weaponType: WeaponType = 'sword';

  // デバッグ用：各スロットのステータス
  const slotStats: Record<string, SimpleStatBlock> = {};
  // デバッグ用：各スロットの装備タイプ（布/革/金属）
  const slotArmorTypes: Record<string, string> = {};
  // デバッグ用：各スロットの防具レベル
  const slotArmorLevels: Record<string, number> = {};

  for (const slot of slots) {
    const candidate = combination[slot];
    if (!candidate) continue;

    const configIndex = configIndices[slot] || 0;
    const stats = calculateEquipmentStatsFn(candidate, configIndex, eqConst, context.relevantStats);

    // デバッグ用に各スロットのステータスを保存
    slotStats[slot] = { ...stats };

    if (slot === 'weapon') {
      weaponCritRate = stats.CritRate || 0;
      weaponCritDamage = stats.CritDamage || 0;
      weaponCoolTime = stats.CoolTime || 5;
      weaponDamageCorrection = stats.DamageCorrection || 1;
      weaponAttackPower = stats.WeaponAttackPower || 0;

      const weaponData = candidate.sourceData as WeaponData;
      const csvWeaponType = weaponData.武器種;
      weaponType = CSV_WEAPON_TO_TYPE[csvWeaponType] || 'sword';
    }

    // 防具タイプ、レベルを記録
    if (slot === 'head' || slot === 'body' || slot === 'leg') {
      const armorData = candidate.sourceData as ArmorData;
      slotArmorTypes[slot] = armorData?.['タイプを選択'] || '不明';
      slotArmorLevels[slot] = armorData?.['使用可能Lv'] || 0;
    }

    for (const [key, value] of Object.entries(stats)) {
      if (typeof value === 'number' &&
          key !== 'WeaponAttackPower' &&
          key !== 'CoolTime' &&
          key !== 'DamageCorrection' &&
          key !== 'CritRate') {
        if (slot === 'weapon' && key === 'CritDamage') {
          continue;
        }
        equipmentStats[key] = (equipmentStats[key] || 0) + value;
      }
    }
  }

  const jobLevel = context.jobMaxLevel || 100;
  const emblemBonusPercent = extractEmblemBonusPercent(context.emblem);

  // SP配分配列を構築
  type SPAllocationItem = { branch: 'A' | 'B' | 'C'; tier: number; spCost: number };
  const spAllocationArray: SPAllocationItem[] = [];
  if (context.spAllocation && context.jobSPData) {
    // { A: number, B: number, C: number } 形式（累積SP）かどうかを判定
    const isSimpleFormat = 'A' in context.spAllocation || 'B' in context.spAllocation || 'C' in context.spAllocation;

    if (isSimpleFormat) {
      // 累積SP形式の場合、各軸のSPからティアを逆算
      const branches: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C'];
      for (const branch of branches) {
        const branchSP = (context.spAllocation as Record<string, number>)[branch] || 0;
        if (branchSP <= 0) continue;

        // この軸のティアデータを取得してソート
        const branchTiers = context.jobSPData
          .filter(row => row.解法段階?.startsWith(`${branch}-`))
          .sort((a, b) => {
            const tierA = parseInt(a.解法段階?.split('-')[1] || '0');
            const tierB = parseInt(b.解法段階?.split('-')[1] || '0');
            return tierA - tierB;
          });

        let prevSP = 0;
        for (const tierData of branchTiers) {
          const requiredSP = typeof tierData.必要SP === 'string'
            ? parseFloat(tierData.必要SP) || 0
            : tierData.必要SP || 0;

          if (requiredSP > branchSP) break; // このSPでは解放できないティア

          const tierNum = parseInt(tierData.解法段階?.split('-')[1] || '0');
          const spCost = requiredSP - prevSP;
          prevSP = requiredSP;

          spAllocationArray.push({
            branch,
            tier: tierNum,
            spCost
          });
        }
      }
    } else {
      // "A-1", "B-2" 形式（ティア形式）の場合
      const sortedAllocations: Array<{nodeId: string; branch: string; tier: number}> = [];

      for (const [nodeId, level] of Object.entries(context.spAllocation)) {
        if (level > 0) {
          const match = nodeId.match(/^([A-C])-(\d+)$/);
          if (match) {
            sortedAllocations.push({
              nodeId,
              branch: match[1],
              tier: parseInt(match[2])
            });
          }
        }
      }

      sortedAllocations.sort((a, b) => {
        if (a.branch !== b.branch) return a.branch.localeCompare(b.branch);
        return a.tier - b.tier;
      });

      const prevRequiredSP: Record<string, number> = { A: 0, B: 0, C: 0 };

      for (const alloc of sortedAllocations) {
        const tierData = context.jobSPData.find(row => row.解法段階 === alloc.nodeId);
        const requiredSP = tierData
          ? (typeof tierData.必要SP === 'string' ? parseFloat(tierData.必要SP) || 0 : tierData.必要SP || 0)
          : 0;
        const spCost = requiredSP - prevRequiredSP[alloc.branch];
        prevRequiredSP[alloc.branch] = requiredSP;

        spAllocationArray.push({
          branch: alloc.branch as 'A' | 'B' | 'C',
          tier: alloc.tier,
          spCost
        });
      }
    }
  }

  // メモ化されたジョブステータス計算
  const { jobStats, jobBonusPercent, spStats } = getJobStatsWithMemo(context, jobLevel, spAllocationArray);

  // タロット武器ボーナス（CritR, CritD, AttackP, DamageC）を武器パラメータに加算
  let adjustedWeaponCritRate = weaponCritRate;
  let adjustedWeaponCritDamage = weaponCritDamage;
  let adjustedWeaponAttackPower = weaponAttackPower;
  let adjustedWeaponDamageCorrection = weaponDamageCorrection;
  if (context.tarotWeaponBonus) {
    adjustedWeaponCritRate += context.tarotWeaponBonus['CritR'] || 0;
    adjustedWeaponCritDamage += context.tarotWeaponBonus['CritD'] || 0;
    adjustedWeaponAttackPower += context.tarotWeaponBonus['AttackP'] || 0;
    adjustedWeaponDamageCorrection += context.tarotWeaponBonus['DamageC'] || 0;
  }

  // タロット%ボーナスはuserPercentBonusとして渡す（buildStoreと同じ方式）
  // statusCalculator.tsでは:
  //   emblemBonusPercent → (1 + job%/100 + emblem%/100) の乗算枠
  //   userPercentBonus → applyUserPercentBonus()で別途適用
  //   Tarot.Bonus.<Stat> → YAML式内でハードコード0のため、userPercentBonusで補う
  const userPercentBonus: StatBlock = context.tarotBonusPercent
    ? { ...context.tarotBonusPercent }
    : {};

  const statusInput: StatusCalcInput = {
    jobStats: {
      initial: jobStats,
      sp: spStats,
      bonusPercent: context.jobBonusPercent || jobBonusPercent,
    },
    jobLevel,
    equipmentTotal: equipmentStats,
    emblemBonusPercent,
    weaponCritRate: adjustedWeaponCritRate,
    runestoneBonus: context.runestoneBonus,
    userOption: context.userOption,
    food: context.food,
    userPercentBonus: Object.keys(userPercentBonus).length > 0 ? userPercentBonus : undefined,
    // リング収束計算
    ring: context.ringOption?.enabled ? {
      enabled: true,
      ringType: context.ringOption.ringType,
      equipmentTotal: equipmentStats,
    } : undefined,
  };

  const calcResult = calculateStatus(statusInput);

  let finalStats: StatBlock = {};
  let actualCritRate = adjustedWeaponCritRate;  // 器用さ込みの会心率（タロット補正含む）
  if (calcResult.success) {
    finalStats = calcResult.data.final || {};
    const dexCritRate = (finalStats.Dex || 0) * DEX_TO_CRIT_RATE;
    actualCritRate = Math.min(MAX_CRIT_RATE, adjustedWeaponCritRate + dexCritRate);
  }

  const meetsMinimum = checkMinimumStats(finalStats, context.minimumStats);

  let score = 0;
  let maxDamage = 0;  // 最大ダメージ（会心時）
  let minDamage = 0;  // 最小ダメージ（非会心時）

  switch (context.mode) {
    case 'damage':
    case 'dps': {
      if (context.weaponCalc && context.skillCalc) {
        const calculatedStats: CalculatedStats = {
          breakdown: {
            equipment: equipmentStats,
            jobInitial: jobStats,
            jobSP: {},
            food: {},
            userOption: {},
          },
          base: finalStats,
          bonusPercent: {
            job: jobBonusPercent,
            emblem: emblemBonusPercent,
            total: {},
          },
          final: finalStats,
          critRate: actualCritRate,  // 器用さ込みの会心率を使用
        };

        const damageInput: DamageCalcInput = {
          weaponType,
          weaponAttackPower: adjustedWeaponAttackPower,
          weaponCritRate: actualCritRate,  // 器用さ込みの会心率を使用
          weaponCritDamage: adjustedWeaponCritDamage,
          damageCorrection: adjustedWeaponDamageCorrection,
          userStats: calculatedStats,
          jobName: context.jobName,
          enemy: {
            defense: context.enemyDefense,
            typeResistance: context.enemyTypeResistance,
            attributeResistance: context.enemyAttributeResistance,
          },
          options: {
            damageCorrectionMode: 'avg',
            critMode: 'expected',
            skillName: context.skillId,
          },
        };

        const damageResult = calculateDamage(damageInput, context.weaponCalc, context.skillCalc);

        // 最大ダメージ（会心あり・ダメージ補正最大）
        const maxDamageInput: DamageCalcInput = {
          ...damageInput,
          options: { ...damageInput.options, critMode: 'always', damageCorrectionMode: 'max' },
        };
        const maxDamageResult = calculateDamage(maxDamageInput, context.weaponCalc, context.skillCalc);
        if (maxDamageResult.success) {
          maxDamage = maxDamageResult.data.finalDamage;
        }

        // 最小ダメージ（会心なし・ダメージ補正最小）
        const minDamageInput: DamageCalcInput = {
          ...damageInput,
          options: { ...damageInput.options, critMode: 'never', damageCorrectionMode: 'min' },
        };
        const minDamageResult = calculateDamage(minDamageInput, context.weaponCalc, context.skillCalc);
        if (minDamageResult.success) {
          minDamage = minDamageResult.data.finalDamage;
        }

        // タロットダメージバフ乗数を事前計算（score/min/max全てに適用）
        let tarotDmgMultiplier = 1;
        if (context.tarotDamageBuffs) {
          const allBuff = context.tarotDamageBuffs['AllBuff'] || 0;
          const physBuff = context.tarotDamageBuffs['AttackBuff.Physical'] || 0;
          const magBuff = context.tarotDamageBuffs['AttackBuff.Magic'] || 0;
          const atkBuff = Math.max(physBuff, magBuff);
          tarotDmgMultiplier = (1 + allBuff / 100) * (1 + atkBuff / 100);
        }
        maxDamage = maxDamage * tarotDmgMultiplier;
        minDamage = minDamage * tarotDmgMultiplier;

        if (damageResult.success) {
          let dmg = damageResult.data.finalDamage * tarotDmgMultiplier;
          if (context.mode === 'damage') {
            score = dmg;
          } else {
            const ct = damageResult.data.ct || context.coolTime || 1;
            score = dmg / Math.max(ct, 1);
          }
        } else {
          // calculateDamageが失敗した場合のフォールバック（タロット武器補正含む）
          const mainStat = Math.max(finalStats.Power || 0, finalStats.Magic || 0);
          const baseDamage = (adjustedWeaponAttackPower + mainStat) * adjustedWeaponDamageCorrection * context.skillMultiplier;
          const totalCritDamageForFallback = adjustedWeaponCritDamage + (finalStats.CritDamage || 0);
          const critMultiplier = 1 + (adjustedWeaponCritRate / 100) * (totalCritDamageForFallback / 100);
          score = baseDamage * critMultiplier * context.hits;

          if (context.mode === 'dps') {
            const ct = Math.max(context.coolTime || 1, 1);
            score = score / ct;
          }
        }
      } else {
        // weaponCalcまたはskillCalcがない場合のフォールバック（タロット武器補正含む）
        const mainStat = Math.max(finalStats.Power || 0, finalStats.Magic || 0);
        const baseDamage = (adjustedWeaponAttackPower + mainStat) * adjustedWeaponDamageCorrection * context.skillMultiplier;
        const totalCritDamageForFallback = adjustedWeaponCritDamage + (finalStats.CritDamage || 0);
        const critMultiplier = 1 + (adjustedWeaponCritRate / 100) * (totalCritDamageForFallback / 100);
        score = baseDamage * critMultiplier * context.hits;

        if (context.mode === 'dps') {
          const ct = Math.max(weaponCoolTime + context.coolTime, 1);
          score = score / ct;
        }
      }
      break;
    }

    case 'stat': {
      if (context.targetStat) {
        score = finalStats[context.targetStat] || 0;
      }
      break;
    }
  }

  // 表示用スコア（元のダメージ期待値）を保存
  const originalScore = score;

  // 制約を満たさない場合でも、達成度に基づいた小さなスコアを返す
  // これにより、制約を満たす組み合わせがない場合でも最も近い結果が返される
  // sortScoreはソート・比較用、originalScoreは表示用
  let sortScore = score;
  if (!meetsMinimum) {
    const progress = calculateMinimumStatsProgress(finalStats, context.minimumStats);
    // 制約を満たさない場合はソート用スコアを大幅に減衰
    sortScore = score * progress * CONSTRAINT_PENALTY_FACTOR;
  }

  // 汎用的なステータス効率ペナルティ（感度ベース）
  // - P:Mバランス: 感度比率に基づいて最適なP:M比率を計算
  // - 過剰Dex: 会心率100%以上では感度0として処理
  // - 非効率配分: 感度が低いステータスに叩きが振られている場合にペナルティ
  if (context.weaponCalc && context.skillCalc && sortScore > 0) {
    try {
      const damageInputForSensitivity: DamageCalcInput = {
        weaponType,
        weaponAttackPower: adjustedWeaponAttackPower,
        weaponCritRate: adjustedWeaponCritRate,
        weaponCritDamage: adjustedWeaponCritDamage,
        damageCorrection: adjustedWeaponDamageCorrection,
        userStats: {
          breakdown: { equipment: equipmentStats, jobInitial: jobStats, jobSP: {}, food: {}, userOption: {} },
          base: finalStats,
          bonusPercent: { job: jobBonusPercent, emblem: emblemBonusPercent, total: {} },
          final: finalStats,
          critRate: actualCritRate,
        },
        jobName: context.jobName,
        enemy: { defense: 0, typeResistance: 0, attributeResistance: 0 },
        options: { critMode: 'expected', damageCorrectionMode: 'avg' },
      };

      const { penalty, sensitivities } = calculateEfficiencyPenalty(
        finalStats,
        equipmentStats,
        damageInputForSensitivity,
        context.weaponCalc,
        context.skillCalc,
        weaponCritRate
      );

      if (penalty < 1) {
        sortScore = sortScore * penalty;
      }
    } catch {
      // sensitivity calculation failed - no penalty
    }
  }

  // 撃力は装備・ルーンストーンからのみ（武器会心ダメージは別管理）
  const resultStats: SimpleStatBlock = {
    ...finalStats,
    WeaponAttackPower: adjustedWeaponAttackPower,
    CritRate: actualCritRate,  // 器用さ込みの会心率
    CritDamage: finalStats.CritDamage || 0,  // 武器会心ダメージは含まない
    WeaponCritDamage: adjustedWeaponCritDamage,
    CoolTime: weaponCoolTime,
    DamageCorrection: adjustedWeaponDamageCorrection,
    MaxDamage: maxDamage,  // 最大ダメージ（会心時）
    MinDamage: minDamage,  // 最小ダメージ（非会心時）
    // SP自動配分情報（表示用）
    _SP_A: (context.spAllocation as Record<string, number>)?.['A'] ?? 0,
    _SP_B: (context.spAllocation as Record<string, number>)?.['B'] ?? 0,
    _SP_C: (context.spAllocation as Record<string, number>)?.['C'] ?? 0,
    // デバッグ: SPボーナスと職業基礎値
    _debug_spBonus_Power: spStats.Power ?? 0,
    _debug_spBonus_Magic: spStats.Magic ?? 0,
    _debug_spBonus_CritDamage: spStats.CritDamage ?? 0,
    _debug_job_Power: jobStats.Power ?? 0,
    _debug_job_Magic: jobStats.Magic ?? 0,
    _debug_equip_Power: equipmentStats.Power ?? 0,
    _debug_equip_Magic: equipmentStats.Magic ?? 0,
    _debug_equip_CritDamage: equipmentStats.CritDamage ?? 0,
    _debug_weapon_attackPower: adjustedWeaponAttackPower,
    _debug_weapon_critRate: adjustedWeaponCritRate,
    _debug_weapon_critDamage: adjustedWeaponCritDamage,
    _debug_weapon_damageCorrection: adjustedWeaponDamageCorrection,
    _debug_jobLevel: jobLevel,
  };

  return { score: sortScore, originalScore, stats: resultStats, meetsMinimum };
}

/**
 * 近似スコア関数（Beam Search中間評価用）
 *
 * ブラックボックス評価（evaluateCombination）は重いため、
 * Beam Search の中間段階では依存ステの重み付き線形合計で近似する。
 */
export function approximateScore(
  dependentStatsSum: Record<string, number>,
  relevantStats: RelevantStats | undefined,
  mode: OptimizeMode,
  targetStat?: InternalStatKey,
  minimumStats?: MinimumStatRequirements,
  jobName?: string,
): number {
  if (mode === 'stat' && targetStat) {
    const base = dependentStatsSum[targetStat] || 0;
    if (minimumStats) {
      const progress = calculateMinimumStatsProgress(dependentStatsSum, minimumStats);
      if (progress < 1) return base * progress * 0.1;
    }
    return base;
  }

  // SpellRefactor: P=Mバランスを考慮した近似ダメージ
  if (jobName === 'SpellRefactor' || jobName === 'スペルリファクター') {
    const power = dependentStatsSum['Power'] || 0;
    const magic = dependentStatsSum['Magic'] || 0;
    const critDamage = dependentStatsSum['CritDamage'] || 0;
    const baseDamage = power * 1.6 + critDamage * 2.1;
    let bonus = 1.75;
    if (power > 0 && magic > 0) {
      const ratio = Math.max(power, magic) / Math.min(power, magic);
      bonus = Math.max(0.1, 1.75 - 0.475 * Math.log(ratio) * 2);
    }
    let score = baseDamage * bonus;
    if (minimumStats) {
      const progress = calculateMinimumStatsProgress(dependentStatsSum, minimumStats);
      if (progress < 1) score *= progress * CONSTRAINT_PENALTY_FACTOR;
    }
    return score;
  }

  // damage/dps: 依存ステの重み付き線形合計
  let score = 0;
  const directStats = relevantStats?.directStats
    ? Array.from(relevantStats.directStats)
    : ['Power', 'Magic', 'CritDamage'];

  for (const stat of directStats) {
    const value = dependentStatsSum[stat] || 0;
    const coeff = relevantStats?.statCoefficients?.[stat] ?? 1;
    const weight = coeff > 0 ? coeff : 1;

    // Dex→会心率のキャップ処理
    if (stat === 'Dex') {
      const critFromDex = value * DEX_TO_CRIT_RATE;
      if (critFromDex >= MAX_CRIT_RATE) {
        // 会心率100%以上なら追加Dexの価値は0
        score += MAX_CRIT_RATE / DEX_TO_CRIT_RATE * weight;
        continue;
      }
    }

    score += value * weight;
  }

  // 必須最低値ペナルティ
  if (minimumStats) {
    const progress = calculateMinimumStatsProgress(dependentStatsSum, minimumStats);
    if (progress < 1) {
      score *= progress * CONSTRAINT_PENALTY_FACTOR;
    }
  }

  return score;
}

/** キャッシュ付き評価関数 */
export function evaluateCombinationCached(
  combination: Record<EquipSlot, CandidateEquipment | null>,
  configIndices: Record<EquipSlot, number>,
  context: EvaluationContext,
  eqConst: EqConstData,
  contextKey: string
): { score: number; originalScore: number; stats: SimpleStatBlock; meetsMinimum: boolean } {
  const cacheKey = generateCacheKey(combination, configIndices, contextKey);

  const cached = evaluationCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const result = evaluateCombination(combination, configIndices, context, eqConst);
  evaluationCache.set(cacheKey, result);
  return result;
}
