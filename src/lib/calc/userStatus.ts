import {
  StatBlock,
  EquipmentSet,
  SPAllocation,
  JobSPData,
  RingOption
} from '@/types/calc';
import { StatType } from '@/types';
import { evaluateFormula } from './formulaEvaluator';
import { sumEquipmentStats } from './equipmentStatus';

/**
 * 装備の合計ステータスを取得
 * @param equipment - 装備セット
 * @returns 合計ステータス
 */
export { sumEquipmentStats } from './equipmentStatus';

/**
 * 職業の初期値とSPによるステータス計算
 * @param job - 職業名
 * @param level - レベル
 * @param spAllocation - SP割り振り
 * @param jobData - 職業SPデータ
 * @returns 職業によるステータス
 */
export function calcJobStats(
  job: string,
  level: number,
  spAllocation: SPAllocation,
  jobData: JobSPData[]
): StatBlock {
  const stats: StatBlock = {};

  // 職業の初期値 × レベル
  // ※実際の初期値データがあれば使用、ここでは仮の実装
  const jobInitialStats: Record<string, StatBlock> = {
    warrior: { HP: 50, ATK: 10, DEF: 8 },
    mage: { HP: 30, MP: 20, MATK: 12, MDEF: 6 },
    archer: { HP: 40, ATK: 8, AGI: 10, DEX: 12 },
    // 他の職業...
  };

  const initialStats = jobInitialStats[job.toLowerCase()] || {};
  Object.entries(initialStats).forEach(([stat, value]) => {
    stats[stat as StatType] = value * level;
  });

  // SP割り振りによるステータス追加
  jobData.forEach(spData => {
    const spLevel = spAllocation[spData.name] || 0;
    if (spLevel > 0 && spData.stats) {
      Object.entries(spData.stats).forEach(([stat, value]) => {
        const statKey = stat as StatType;
        stats[statKey] = (stats[statKey] || 0) + (value * spLevel);
      });
    }
  });

  return stats;
}

/**
 * BaseStatusの計算
 * UserStatusFormula: "(SumEquipment.<Stat> + Job.Initial.<Stat> * <JobLevel> + Job.SP.<Stat> + Food.<Stat> + UserOption.<Stat>) * (1 + Job.Bonus.<Stat>/100 + Emblem.Bonus.<Stat>/100)"
 *
 * @param sumEquip - 装備の合計ステータス
 * @param jobStats - 職業ステータス（初期値×レベル + SP）
 * @param food - 食事効果
 * @param userOption - ユーザーオプション
 * @param jobBonus - 職業ボーナス（%）
 * @param emblemBonus - エンブレムボーナス（%）
 * @returns BaseStatus
 */
export function calcBaseStatus(
  sumEquip: StatBlock,
  jobStats: StatBlock,
  food: StatBlock,
  userOption: StatBlock,
  jobBonus: number,
  emblemBonus: number
): StatBlock {
  const baseStatus: StatBlock = {};

  // 全ての可能なステータスタイプを取得
  const allStatKeys = new Set<string>([
    ...Object.keys(sumEquip),
    ...Object.keys(jobStats),
    ...Object.keys(food),
    ...Object.keys(userOption)
  ]);

  allStatKeys.forEach(stat => {
    const statKey = stat as StatType;

    // 各コンポーネントの値を取得（存在しない場合は0）
    const equipValue = sumEquip[statKey] || 0;
    const jobValue = jobStats[statKey] || 0;
    const foodValue = food[statKey] || 0;
    const optionValue = userOption[statKey] || 0;

    // 基本合計
    const baseSum = equipValue + jobValue + foodValue + optionValue;

    // ボーナス乗数を計算
    const bonusMultiplier = 1 + (jobBonus / 100) + (emblemBonus / 100);

    // 最終値を計算（小数点以下切り捨て）
    baseStatus[statKey] = Math.floor(baseSum * bonusMultiplier);
  });

  return baseStatus;
}

/**
 * リング収束計算
 * RingOption: "repeat( round( CurrentStatus * (1 + Ring.<Stat>/100) ), until_converged )"
 *
 * @param baseStats - ベースステータス
 * @param ringOption - リングオプション設定
 * @returns リング効果適用後のステータス
 */
export function applyRingOption(
  baseStats: StatBlock,
  ringOption: RingOption
): StatBlock {
  if (!ringOption.enabled) {
    return baseStats;
  }

  const result: StatBlock = { ...baseStats };
  const maxIterations = ringOption.iterations || 100; // 最大反復回数
  const convergenceThreshold = 0.01; // 収束判定の閾値

  // 各ステータスについて収束計算
  Object.keys(result).forEach(stat => {
    const statKey = stat as StatType;
    const ringBonus = ringOption.stats[statKey];

    if (ringBonus && ringBonus > 0) {
      let currentValue = result[statKey] || 0;
      let previousValue = currentValue;
      let converged = false;
      let iterations = 0;

      // 収束するまで反復計算
      while (!converged && iterations < maxIterations) {
        // CurrentStatus * (1 + Ring.<Stat>/100) を計算して丸める
        currentValue = Math.round(currentValue * (1 + ringBonus / 100));

        // 収束判定（値が変わらなくなったら収束）
        if (Math.abs(currentValue - previousValue) < convergenceThreshold) {
          converged = true;
        }

        previousValue = currentValue;
        iterations++;
      }

      result[statKey] = currentValue;
    }
  });

  return result;
}

/**
 * 最終ステータス計算（全ての要素を統合）
 * @param equipment - 装備セット
 * @param job - 職業名
 * @param level - レベル
 * @param spAllocation - SP割り振り
 * @param jobData - 職業SPデータ
 * @param food - 食事効果
 * @param userOption - ユーザーオプション
 * @param jobBonus - 職業ボーナス
 * @param emblemBonus - エンブレムボーナス
 * @param ringOption - リングオプション
 * @returns 最終ステータス
 */
export function calcFinalStatus(
  equipment: EquipmentSet,
  job: string,
  level: number,
  spAllocation: SPAllocation,
  jobData: JobSPData[],
  food: StatBlock = {},
  userOption: StatBlock = {},
  jobBonus: number = 0,
  emblemBonus: number = 0,
  ringOption?: RingOption
): StatBlock {
  // 1. 装備合計を計算
  const sumEquip = sumEquipmentStats(equipment);

  // 2. 職業ステータスを計算
  const jobStats = calcJobStats(job, level, spAllocation, jobData);

  // 3. BaseStatusを計算
  const baseStatus = calcBaseStatus(
    sumEquip,
    jobStats,
    food,
    userOption,
    jobBonus,
    emblemBonus
  );

  // 4. リングオプションを適用（有効な場合）
  if (ringOption && ringOption.enabled) {
    return applyRingOption(baseStatus, ringOption);
  }

  return baseStatus;
}

/**
 * ステータス変化の詳細を計算
 * @param equipment - 装備セット
 * @param job - 職業名
 * @param level - レベル
 * @param spAllocation - SP割り振り
 * @param jobData - 職業SPデータ
 * @param food - 食事効果
 * @param userOption - ユーザーオプション
 * @param jobBonus - 職業ボーナス
 * @param emblemBonus - エンブレムボーナス
 * @param ringOption - リングオプション
 * @returns ステータスの詳細情報
 */
export function calcStatusDetails(
  equipment: EquipmentSet,
  job: string,
  level: number,
  spAllocation: SPAllocation,
  jobData: JobSPData[],
  food: StatBlock = {},
  userOption: StatBlock = {},
  jobBonus: number = 0,
  emblemBonus: number = 0,
  ringOption?: RingOption
): {
  equipment: StatBlock;
  job: StatBlock;
  food: StatBlock;
  userOption: StatBlock;
  base: StatBlock;
  final: StatBlock;
  bonusMultiplier: number;
} {
  const sumEquip = sumEquipmentStats(equipment);
  const jobStats = calcJobStats(job, level, spAllocation, jobData);
  const baseStatus = calcBaseStatus(
    sumEquip,
    jobStats,
    food,
    userOption,
    jobBonus,
    emblemBonus
  );

  const finalStatus = ringOption && ringOption.enabled
    ? applyRingOption(baseStatus, ringOption)
    : baseStatus;

  return {
    equipment: sumEquip,
    job: jobStats,
    food,
    userOption,
    base: baseStatus,
    final: finalStatus,
    bonusMultiplier: 1 + (jobBonus / 100) + (emblemBonus / 100)
  };
}