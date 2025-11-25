/**
 * ステータス計算モジュール
 * 
 * 職業、装備、食べ物、高度設定を統合してキャラクターの最終ステータスを計算する
 */

import {
  StatBlock,
  StatusCalcInput,
  CalculatedStats,
  CalcResult,
  CalcError
} from '@/types/calc';

import {
  round,
  addStats,
  sumStats,
  multiplyStats,
  isEqualStats,
  cloneStats,
  mapStats
} from './utils/mathUtils';

/**
 * ステータス計算のメイン関数
 * 
 * @param input 計算入力パラメータ
 * @returns 計算済みステータス or エラー
 */
export function calculateStatus(input: StatusCalcInput): CalcResult<CalculatedStats> {
  try {
    // 入力検証
    if (!input.jobStats) {
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: '職業ステータスが指定されていません',
        }
      };
    }

    // 各要素を取得（デフォルト値設定）
    const equipment = input.equipmentTotal || {};
    const jobInitial = input.jobStats.initial || {};
    const jobSP = input.jobStats.sp || {};
    const food = input.food || {};
    const userOption = input.userOption || {};
    const jobBonusPercent = input.jobStats.bonusPercent || {};
    const emblemBonusPercent = input.emblemBonusPercent || {};

    // 1. BaseStatus算出（%補正前）
    const baseBeforePercent = calculateBaseStatus(
      equipment,
      jobInitial,
      jobSP,
      food,
      userOption
    );

    // 2. %補正適用
    const baseAfterPercent = applyPercentBonus(
      baseBeforePercent,
      jobBonusPercent,
      emblemBonusPercent
    );

    // 3. リング収束計算（有効な場合）
    let finalStats = baseAfterPercent;
    let ringResult = undefined;

    if (input.ring?.enabled && input.ring?.bonusPercent) {
      const convergence = applyRingConvergence(
        baseAfterPercent,
        input.ring.bonusPercent
      );
      finalStats = convergence.final;
      ringResult = {
        iterations: convergence.iterations,
        delta: convergence.delta
      };
    }

    // 4. 会心率計算
    const weaponCritRate = input.weaponCritRate || 0;
    const userDex = (finalStats as any).DEX || (finalStats as any).Dex || (finalStats as any).dex || (finalStats as any).器用さ || 0;
    const critRate = calculateCritRate(weaponCritRate, userDex);

    // 結果構築
    const result: CalculatedStats = {
      breakdown: {
        equipment,
        jobInitial,
        jobSP,
        food,
        userOption
      },
      base: baseBeforePercent,
      bonusPercent: {
        job: jobBonusPercent,
        emblem: emblemBonusPercent,
        total: sumStats(jobBonusPercent, emblemBonusPercent)
      },
      ring: ringResult,
      final: finalStats,
      critRate
    };

    return { success: true, data: result };

  } catch (error) {
    return {
      success: false,
      error: {
        code: 'CALCULATION_ERROR',
        message: error instanceof Error ? error.message : 'ステータス計算中にエラーが発生しました',
        context: { error }
      }
    };
  }
}

/**
 * BaseStatusの算出（%補正前）
 * 
 * 装備合計 + 職業初期値×Level + SP + Food + UserOption
 * 
 * @param equipment 装備合計ステータス
 * @param jobInitial 職業初期値×レベル
 * @param jobSP SP由来ステータス
 * @param food 食べ物バフ
 * @param userOption 高度設定
 * @returns 合算されたBaseStatus
 */
export function calculateBaseStatus(
  equipment: StatBlock,
  jobInitial: StatBlock,
  jobSP: StatBlock,
  food: StatBlock,
  userOption: StatBlock
): StatBlock {
  // すべてのステータスを加算
  return sumStats(equipment, jobInitial, jobSP, food, userOption);
}

/**
 * %補正の適用
 * 
 * base × (1 + jobBonus/100 + emblemBonus/100)
 * 
 * @param base 基礎ステータス
 * @param jobBonus 職業%補正
 * @param emblemBonus 紋章%補正
 * @returns %補正適用後のステータス
 */
export function applyPercentBonus(
  base: StatBlock,
  jobBonus: StatBlock,
  emblemBonus: StatBlock
): StatBlock {
  const result: StatBlock = {};

  // すべてのステータスキーを取得
  const allKeys = new Set([
    ...Object.keys(base),
    ...Object.keys(jobBonus),
    ...Object.keys(emblemBonus)
  ]);

  for (const key of Array.from(allKeys)) {
    const baseValue = (base as any)[key] || 0;
    const jobBonusValue = (jobBonus as any)[key] || 0;
    const emblemBonusValue = (emblemBonus as any)[key] || 0;

    // base × (1 + jobBonus/100 + emblemBonus/100)
    const multiplier = 1 + (jobBonusValue + emblemBonusValue) / 100;
    (result as any)[key] = round(baseValue * multiplier);
  }

  return result;
}

/**
 * リング収束計算
 * 
 * 反復計算: round(current × (1 + ringBonus/100))
 * 変化がなくなるまで繰り返す（最大100回）
 * 
 * @param base 基礎ステータス
 * @param ringBonus リング%補正
 * @param maxIterations 最大反復回数（デフォルト: 100）
 * @returns 収束結果
 */
export function applyRingConvergence(
  base: StatBlock,
  ringBonus: StatBlock,
  maxIterations: number = 100
): { final: StatBlock; iterations: number; delta: StatBlock } {
  let current = cloneStats(base);
  let iterations = 0;

  for (let i = 0; i < maxIterations; i++) {
    iterations++;
    
    // 次の値を計算
    const next: StatBlock = {};
    
    // すべてのステータスキーを取得
    const allKeys = new Set([
      ...Object.keys(current),
      ...Object.keys(ringBonus)
    ]);

    for (const key of Array.from(allKeys)) {
      const currentValue = (current as any)[key] || 0;
      const ringBonusValue = (ringBonus as any)[key] || 0;
      
      // round(current × (1 + ringBonus/100))
      (next as any)[key] = round(currentValue * (1 + ringBonusValue / 100));
    }

    // 変化がなければ収束
    if (isEqualStats(next, current)) {
      break;
    }

    current = next;
  }

  // 変化量を計算
  const delta: StatBlock = {};
  for (const key in current) {
    const baseValue = (base as any)[key] || 0;
    const finalValue = (current as any)[key] || 0;
    (delta as any)[key] = finalValue - baseValue;
  }

  return {
    final: current,
    iterations,
    delta
  };
}

/**
 * 会心率の計算
 * 
 * 会心率 = weaponCritRate + userDex × 0.3
 * 
 * @param weaponCritRate 武器の会心率
 * @param userDex ユーザーの器用さ
 * @returns 計算された会心率
 */
export function calculateCritRate(weaponCritRate: number, userDex: number): number {
  return weaponCritRate + userDex * 0.3;
}