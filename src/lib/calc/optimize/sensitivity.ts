/**
 * ダメージ感度計算モジュール
 * 各ステータスに対するダメージの偏微分を数値的に計算し、
 * 最適なステータス配分を判定する
 */

import { StatBlock, DamageCalcInput, CalculatedStats, WeaponType } from '@/types/calc';
import { calculateDamage } from '../damageCalculator';

/** ステータス感度 */
export interface StatSensitivity {
  stat: string;
  sensitivity: number;  // ∂Damage/∂Stat (ステータス1あたりのダメージ増加量)
  currentValue: number;
}

/** 感度計算結果 */
export interface SensitivityResult {
  sensitivities: StatSensitivity[];
  optimalRatios: Map<string, number>;  // 最適なステータス比率
  inefficiencyPenalty: number;  // 非効率配分によるペナルティ (0-1)
}

/** 感度計算対象のステータス */
const SENSITIVITY_STATS = ['Power', 'Magic', 'HP', 'Mind', 'Agility', 'Dex', 'CritDamage', 'Defense'] as const;

/** 変化量（微分のδ） */
const DELTA = 10;

/**
 * 数値微分でダメージ感度を計算
 * @param baseStats 現在のステータス
 * @param damageInput ダメージ計算入力
 * @param weaponCalc 武器計算式
 * @param skillCalc スキル計算式
 * @param weaponCritRate 武器会心率（Dex感度計算で使用）
 */
export function calculateDamageSensitivities(
  baseStats: StatBlock,
  damageInput: DamageCalcInput,
  weaponCalc: any,
  skillCalc: any,
  weaponCritRate: number = 0
): StatSensitivity[] {
  // ベースダメージを計算
  const baseResult = calculateDamage(
    damageInput,
    weaponCalc,
    skillCalc
  );
  const baseDamage = baseResult.success ? baseResult.data.finalDamage : 0;

  if (baseDamage === 0) {
    return SENSITIVITY_STATS.map(stat => ({
      stat,
      sensitivity: 0,
      currentValue: baseStats[stat] || 0,
    }));
  }

  const sensitivities: StatSensitivity[] = [];

  for (const stat of SENSITIVITY_STATS) {
    const currentValue = baseStats[stat] || 0;

    // Dexの場合、会心率100%を超えていれば感度は0
    if (stat === 'Dex') {
      const currentCritRate = weaponCritRate + currentValue * 0.3;
      if (currentCritRate >= 100) {
        sensitivities.push({ stat, sensitivity: 0, currentValue });
        continue;
      }
    }

    // ステータスを+deltaして再計算
    const modifiedStats: CalculatedStats = {
      ...damageInput.userStats,
      final: {
        ...damageInput.userStats.final,
        [stat]: currentValue + DELTA,
      },
    };

    const modifiedInput: DamageCalcInput = {
      ...damageInput,
      userStats: modifiedStats,
    };

    // Dexの場合は会心率も更新
    if (stat === 'Dex') {
      const newCritRate = Math.min(100, weaponCritRate + (currentValue + DELTA) * 0.3);
      modifiedInput.weaponCritRate = newCritRate;
    }

    const modifiedResult = calculateDamage(
      modifiedInput,
      weaponCalc,
      skillCalc
    );
    const modifiedDamage = modifiedResult.success ? modifiedResult.data.finalDamage : baseDamage;

    const sensitivity = (modifiedDamage - baseDamage) / DELTA;
    sensitivities.push({ stat, sensitivity, currentValue });
  }

  return sensitivities;
}

/**
 * 感度に基づいて非効率配分ペナルティを計算
 * 感度が低いステータスが高い場合にペナルティを適用
 */
export function calculateInefficiencyPenalty(
  sensitivities: StatSensitivity[],
  equipmentStats: StatBlock
): number {
  // 正の感度を持つステータスのみ考慮
  const positiveSensitivities = sensitivities.filter(s => s.sensitivity > 0);
  if (positiveSensitivities.length === 0) return 1;

  // 最大感度
  const maxSensitivity = Math.max(...positiveSensitivities.map(s => s.sensitivity));
  if (maxSensitivity === 0) return 1;

  // 感度が低いのに高いステータスに対してペナルティ
  let totalInefficiency = 0;
  let totalStats = 0;

  for (const sens of positiveSensitivities) {
    const equipValue = (equipmentStats as Record<string, number>)[sens.stat] || 0;
    if (equipValue <= 0) continue;

    // 感度比率（最大感度に対する相対値）
    const sensitivityRatio = sens.sensitivity / maxSensitivity;

    // 感度が低い（0.5未満）のに高いステータス値 → 非効率
    if (sensitivityRatio < 0.5) {
      totalInefficiency += equipValue * (0.5 - sensitivityRatio);
    }
    totalStats += equipValue;
  }

  if (totalStats === 0) return 1;

  // 非効率度をペナルティに変換（最大30%減）
  const inefficiencyRatio = totalInefficiency / totalStats;
  return Math.max(0.7, 1 - inefficiencyRatio * 0.6);
}

/**
 * P:Mバランス最適化のためのペナルティ計算
 * P=Mが最適な職業（SpellRefactor等）やP:M比率が重要な職業に適用
 */
export function calculateBalancePenalty(
  sensitivities: StatSensitivity[],
  stats: StatBlock
): number {
  const powerSens = sensitivities.find(s => s.stat === 'Power');
  const magicSens = sensitivities.find(s => s.stat === 'Magic');

  // Power/Magic両方に正の感度がある場合のみバランスを考慮
  if (!powerSens || !magicSens) return 1;
  if (powerSens.sensitivity <= 0 || magicSens.sensitivity <= 0) return 1;

  const power = stats.Power || 0;
  const magic = stats.Magic || 0;
  if (power === 0 || magic === 0) return 1;

  // 感度の比率を計算
  const sensRatio = powerSens.sensitivity / magicSens.sensitivity;

  // 現在のP:M比率
  const pmRatio = power / magic;

  // 感度比率と実際の比率の乖離を計算
  // 感度が同じなら P=M が最適、感度が2:1なら P:M=2:1 が最適
  const optimalRatio = sensRatio;
  const deviation = Math.abs(Math.log(pmRatio / optimalRatio));

  // 乖離に応じたペナルティ（最大25%減）
  // deviation=0.2で約5%減、deviation=0.5で約12%減
  const penalty = Math.max(0.75, 1 - deviation * 0.25);

  return penalty;
}

/**
 * 総合的なステータス効率ペナルティを計算
 */
export function calculateEfficiencyPenalty(
  baseStats: StatBlock,
  equipmentStats: StatBlock,
  damageInput: DamageCalcInput,
  weaponCalc: any,
  skillCalc: any,
  weaponCritRate: number
): { penalty: number; sensitivities: StatSensitivity[] } {
  const sensitivities = calculateDamageSensitivities(
    baseStats,
    damageInput,
    weaponCalc,
    skillCalc,
    weaponCritRate
  );

  const balancePenalty = calculateBalancePenalty(sensitivities, baseStats);
  const inefficiencyPenalty = calculateInefficiencyPenalty(sensitivities, equipmentStats);

  // 両方のペナルティを掛け合わせる
  const combinedPenalty = balancePenalty * inefficiencyPenalty;

  return { penalty: combinedPenalty, sensitivities };
}
