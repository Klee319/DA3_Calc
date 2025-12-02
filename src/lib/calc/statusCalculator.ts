/**
 * ステータス計算モジュール
 *
 * 職業、装備、食べ物、高度設定を統合してキャラクターの最終ステータスを計算する
 * UserStatusCalc.yamlの計算式を使用
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

import { evaluateFormula } from './formulaEvaluator';
import { UserStatusCalcData } from '@/types/data';

/**
 * ステータス計算のメイン関数
 *
 * @param input 計算入力パラメータ
 * @param userStatusFormulas YAMLから読み込んだ計算式（オプション）
 * @returns 計算済みステータス or エラー
 */
export function calculateStatus(
  input: StatusCalcInput,
  userStatusFormulas?: UserStatusCalcData
): CalcResult<CalculatedStats> {
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
    const runestoneBonus = input.runestoneBonus || {};
    const jobLevel = input.jobLevel || 1;

    // YAMLから計算式を取得
    const baseFormula = userStatusFormulas?.UserStatusFormula?.BaseStatus;

    // 1. BaseStatus算出（%補正前）
    // ルーンストーンボーナスを固定値として加算する
    const baseBeforePercent = calculateBaseStatus(
      equipment,
      jobInitial,
      jobSP,
      food,
      userOption,
      runestoneBonus,
      jobLevel,
      baseFormula
    );

    // 2. %補正適用（YAML式の%補正部分は既にcalculateBaseStatusで適用される場合）
    // ただし、BaseStatus式が%補正も含む場合は、再計算が必要
    let baseAfterPercent = baseBeforePercent;

    // YAML式がない場合、または%補正が別処理の場合
    if (!baseFormula || !baseFormula.includes('Bonus')) {
      baseAfterPercent = applyPercentBonus(
        baseBeforePercent,
        jobBonusPercent,
        emblemBonusPercent
      );
    } else {
      // YAML式が%補正を含む場合、統合計算を行う
      const result: StatBlock = {};

      // 全ステータスキーを取得
      const allKeys = new Set([
        ...Object.keys(equipment),
        ...Object.keys(jobInitial),
        ...Object.keys(jobSP),
        ...Object.keys(food),
        ...Object.keys(userOption),
        ...Object.keys(runestoneBonus),
        ...Object.keys(jobBonusPercent),
        ...Object.keys(emblemBonusPercent)
      ]);

      for (const statKey of Array.from(allKeys)) {
        const key = statKey as keyof StatBlock;
        const variables: Record<string, number> = {
          [`SumEquipment.${statKey}`]: equipment[key] || 0,
          [`Job.Initial.${statKey}`]: jobInitial[key] || 0,
          [`Job.SP.${statKey}`]: jobSP[key] || 0,
          [`Food.${statKey}`]: food[key] || 0,
          [`UserOption.${statKey}`]: userOption[key] || 0,
          [`Runestone.${statKey}`]: runestoneBonus[key] || 0,
          [`Job.Bonus.${statKey}`]: jobBonusPercent[key] || 0,
          [`Emblem.Bonus.${statKey}`]: emblemBonusPercent[key] || 0,
          JobLevel: jobLevel,
        };

        const statFormula = baseFormula.replace(/<Stat>/g, statKey);

        try {
          result[key] = round(evaluateFormula(statFormula, variables));
        } catch (error) {
          console.warn(`Failed to evaluate full formula for ${statKey}, using fallback`, error);
          // フォールバック: デフォルト計算（ルーンストーン含む）
          const baseValue = (equipment[key] || 0) +
                          (jobInitial[key] || 0) +
                          (jobSP[key] || 0) +
                          (food[key] || 0) +
                          (userOption[key] || 0) +
                          (runestoneBonus[key] || 0);
          const multiplier = 1 + ((jobBonusPercent[key] || 0) + (emblemBonusPercent[key] || 0)) / 100;
          result[key] = round(baseValue * multiplier);
        }
      }

      baseAfterPercent = result;
    }

    // 3. ユーザー指定%ボーナス計算（職業・紋章補正とは別）
    let afterUserPercent = baseAfterPercent;
    let userPercentResult = undefined;

    if (input.userPercentBonus) {
      const convergence = applyUserPercentBonus(
        baseAfterPercent,
        input.userPercentBonus,
        input.recursiveEnabled || false
      );
      afterUserPercent = convergence.final;
      userPercentResult = {
        iterations: convergence.iterations,
        delta: convergence.delta
      };
    }

    // 4. リング収束計算（有効な場合）
    // YAMLの式: repeat( BaseValue + round(SumEquipment.<Stat>) * Multiplier, until_converged )
    let finalStats = afterUserPercent;
    let ringResult = undefined;

    if (input.ring?.enabled && input.ring?.ringType && input.ring?.equipmentTotal) {
      const convergence = applyRingConvergenceAdditive(
        afterUserPercent,
        input.ring.ringType,
        input.ring.equipmentTotal,
        100, // maxIterations
        userStatusFormulas
      );
      finalStats = convergence.final;
      ringResult = {
        iterations: convergence.iterations,
        delta: convergence.delta
      };
    }

    // 5. 会心率計算（仕様書に従って器用=UserCritRateを使用）
    const weaponCritRate = input.weaponCritRate || 0;
    const userCritRate = (finalStats as any).UserCritRate || (finalStats as any).CritRate ||
                        (finalStats as any).DEX || (finalStats as any).Dex ||
                        (finalStats as any).dex || (finalStats as any).器用さ || 0;
    const critRate = calculateCritRate(weaponCritRate, userCritRate);

    // 結果構築
    const result: CalculatedStats = {
      breakdown: {
        equipment,
        jobInitial,
        jobSP,
        food,
        userOption,
        runestone: runestoneBonus
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
 * YAML式またはデフォルト計算:
 * 装備合計 + 職業初期値×Level + SP + Food + UserOption + Runestone
 *
 * @param equipment 装備合計ステータス
 * @param jobInitial 職業初期値×レベル
 * @param jobSP SP由来ステータス
 * @param food 食べ物バフ
 * @param userOption 高度設定
 * @param runestone ルーンストーンボーナス
 * @param jobLevel 職業レベル（YAML式用）
 * @param formula YAMLから読み込んだ計算式（オプション）
 * @returns 合算されたBaseStatus
 */
export function calculateBaseStatus(
  equipment: StatBlock,
  jobInitial: StatBlock,
  jobSP: StatBlock,
  food: StatBlock,
  userOption: StatBlock,
  runestone: StatBlock,
  jobLevel: number = 1,
  formula?: string
): StatBlock {
  // YAML式が指定されている場合
  if (formula) {
    const result: StatBlock = {};

    // 全ステータスキーを取得
    const allKeys = new Set([
      ...Object.keys(equipment),
      ...Object.keys(jobInitial),
      ...Object.keys(jobSP),
      ...Object.keys(food),
      ...Object.keys(userOption),
      ...Object.keys(runestone)
    ]);

    // 各ステータスについて計算
    for (const statKey of Array.from(allKeys)) {
      // プレースホルダーマッピングに基づく変数名準備
      const variables: Record<string, number> = {
        // 装備合計値
        [`SumEquipment.${statKey}`]: (equipment as any)[statKey] || 0,
        // 職業初期値
        [`Job.Initial.${statKey}`]: (jobInitial as any)[statKey] || 0,
        // 職業SP
        [`Job.SP.${statKey}`]: (jobSP as any)[statKey] || 0,
        // 食べ物
        [`Food.${statKey}`]: (food as any)[statKey] || 0,
        // ユーザーオプション
        [`UserOption.${statKey}`]: (userOption as any)[statKey] || 0,
        // ルーンストーン
        [`Runestone.${statKey}`]: (runestone as any)[statKey] || 0,
        // 職業レベル
        JobLevel: jobLevel,
      };

      // 計算式の<Stat>を実際のステータス名に置き換え
      const statFormula = formula.replace(/<Stat>/g, statKey);

      try {
        (result as any)[statKey] = round(evaluateFormula(statFormula, variables));
      } catch (error) {
        console.warn(`Failed to evaluate formula for ${statKey}, using default calculation`, error);
        // エラー時はデフォルト計算を使用（ルーンストーン含む）
        (result as any)[statKey] = ((equipment as any)[statKey] || 0) +
                         ((jobInitial as any)[statKey] || 0) +
                         ((jobSP as any)[statKey] || 0) +
                         ((food as any)[statKey] || 0) +
                         ((userOption as any)[statKey] || 0) +
                         ((runestone as any)[statKey] || 0);
      }
    }

    return result;
  }

  // デフォルト計算（既存のロジック + ルーンストーン）
  return sumStats(equipment, jobInitial, jobSP, food, userOption, runestone);
}

/**
 * %補正の適用
 *
 * YAML式のBaseStatus部分の%補正部分:
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

    // YAML式: base × (1 + jobBonus/100 + emblemBonus/100)
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
 * ユーザー指定%ボーナスの再帰収束計算
 * 変化が1未満になるまで繰り返す
 *
 * @param base 基礎ステータス（%補正適用前）
 * @param percentBonus ユーザー指定%ボーナス
 * @param recursive 再帰計算を行うかどうか
 * @param maxIterations 最大反復回数
 * @returns 収束後のステータス、反復回数、変化量
 */
export function applyUserPercentBonus(
  base: StatBlock,
  percentBonus: StatBlock,
  recursive: boolean = false,
  maxIterations: number = 100
): { final: StatBlock; iterations: number; delta: StatBlock } {
  // %ボーナスがない場合はそのまま返す
  const hasBonus = Object.values(percentBonus).some(v => v && v !== 0);
  if (!hasBonus) {
    return {
      final: cloneStats(base),
      iterations: 0,
      delta: {}
    };
  }

  let current = cloneStats(base);
  let iterations = 0;

  if (!recursive) {
    // 非再帰: 1回だけ%を適用
    const next: StatBlock = {};
    const allKeys = new Set([
      ...Object.keys(current),
      ...Object.keys(percentBonus)
    ]);

    for (const key of Array.from(allKeys)) {
      const currentValue = (current as any)[key] || 0;
      const bonusValue = (percentBonus as any)[key] || 0;
      (next as any)[key] = round(currentValue * (1 + bonusValue / 100));
    }

    const delta: StatBlock = {};
    for (const key in next) {
      const baseValue = (base as any)[key] || 0;
      const finalValue = (next as any)[key] || 0;
      (delta as any)[key] = finalValue - baseValue;
    }

    return { final: next, iterations: 1, delta };
  }

  // 再帰計算: 変化が1未満になるまで繰り返す
  for (let i = 0; i < maxIterations; i++) {
    iterations++;

    const next: StatBlock = {};
    const allKeys = new Set([
      ...Object.keys(current),
      ...Object.keys(percentBonus)
    ]);

    let maxChange = 0;

    for (const key of Array.from(allKeys)) {
      const currentValue = (current as any)[key] || 0;
      const bonusValue = (percentBonus as any)[key] || 0;
      const newValue = round(currentValue * (1 + bonusValue / 100));
      (next as any)[key] = newValue;

      const change = Math.abs(newValue - currentValue);
      if (change > maxChange) {
        maxChange = change;
      }
    }

    current = next;

    // 最大変化が1未満なら収束
    if (maxChange < 1) {
      break;
    }
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
 * リング収束計算
 *
 * 基準値 = 装備値 + BaseValue (デフォルト: 40)
 * 1回目: 基準値 + (装備値 * Multiplier) = currentValue (デフォルト Multiplier: 0.1)
 * 2回目以降: 基準値 + round(currentValue * Multiplier) を繰り返し、変化がなくなるまで
 *
 * 例: 装備1000の場合（BaseValue=40, Multiplier=0.1）
 *   基準値 = 1000 + 40 = 1040
 *   1回目: 1040 + (1000 * 0.1) = 1040 + 100 = 1140
 *   2回目: 1040 + round(1140 * 0.1) = 1040 + 114 = 1154
 *   3回目: 1040 + round(1154 * 0.1) = 1040 + 115 = 1155
 *   4回目: 1040 + round(1155 * 0.1) = 1040 + 116 = 1156
 *   5回目: 1040 + round(1156 * 0.1) = 1040 + 116 = 1156 (収束)
 *
 * @param base 基礎ステータス（%補正適用後）
 * @param ringType リング種類（power/magic/speed）
 * @param equipmentTotal 装備合計ステータス
 * @param maxIterations 最大反復回数（デフォルト: 100）
 * @param userStatusFormulas YAMLから読み込んだ計算式（オプション）
 * @returns 収束結果
 */
export function applyRingConvergenceAdditive(
  base: StatBlock,
  ringType: 'power' | 'magic' | 'speed',
  equipmentTotal: StatBlock,
  maxIterations: number = 100,
  userStatusFormulas?: UserStatusCalcData
): { final: StatBlock; iterations: number; delta: StatBlock } {
  // リングタイプに対応するステータスキー
  const targetStatKey = ringType === 'power' ? 'Power' :
                        ringType === 'magic' ? 'Magic' : 'Agility';

  // 装備ステータスの対象値を取得
  const equipValue = (equipmentTotal as any)[targetStatKey] || 0;

  // 装備ステータスが0以下の場合は何もしない
  if (equipValue <= 0) {
    return {
      final: cloneStats(base),
      iterations: 0,
      delta: {}
    };
  }

  let current = cloneStats(base);
  let iterations = 0;

  // YAMLからBaseValueとMultiplierを取得（デフォルト値: 40, 0.1）
  const ringBaseValue = userStatusFormulas?.RingConvergence?.BaseValue ?? 40;
  const ringMultiplier = userStatusFormulas?.RingConvergence?.Multiplier ?? 0.1;

  // 基準値 = 装備値 + BaseValue
  const baseRingValue = equipValue + ringBaseValue;

  // 1回目: 基準値 + (装備値 * Multiplier)
  let currentValue = baseRingValue + equipValue * ringMultiplier;
  iterations++;

  // 2回目以降: 基準値 + round(currentValue * Multiplier) を繰り返し
  for (let i = 0; i < maxIterations; i++) {
    const nextValue = baseRingValue + round(currentValue * ringMultiplier);
    iterations++;

    // 変化がなければ収束
    if (nextValue === Math.floor(currentValue)) {
      currentValue = nextValue;
      break;
    }
    currentValue = nextValue;
  }

  // リング効果（最終値）を整数化
  const ringValue = Math.floor(currentValue);

  // リング効果を基礎ステータスに加算
  const baseValue = (current as any)[targetStatKey] || 0;
  (current as any)[targetStatKey] = baseValue + ringValue;

  // 変化量を計算
  const delta: StatBlock = {};
  (delta as any)[targetStatKey] = ringValue;

  return {
    final: current,
    iterations,
    delta
  };
}

/**
 * 会心率の計算
 *
 * 会心率 = weaponCritRate + userCritRate × 0.3
 *
 * @param weaponCritRate 武器の会心率
 * @param userCritRate ユーザーの器用さ（会心率ステータス）
 * @returns 計算された会心率
 */
export function calculateCritRate(weaponCritRate: number, userCritRate: number): number {
  return weaponCritRate + userCritRate * 0.3;
}