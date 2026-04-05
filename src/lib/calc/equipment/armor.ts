/**
 * 防具計算モジュール
 */

import {
  ArmorData,
  EqConstData,
  UserStatusCalcData,
  AccessoryData,
} from '@/types/data';
import { evaluateFormula } from '../formulaEvaluator';
import { round } from '../utils/mathUtils';
import { EquipmentStats, EquipmentRank, ArmorSmithingDistribution } from './types';
import { validateRank } from './rankHelpers';

/**
 * 防具EXステータス計算
 */
function calculateArmorEXValue(
  level: number,
  rank: EquipmentRank,
  exStatType: 'Dex' | 'CritDamage' | 'Speed' | 'HP' | 'Power' | 'Magic' | 'Mind',
  eqConst: EqConstData
): number {
  if (level <= 0) {
    return 1;
  }

  const exRankCoeffs = eqConst.Equipment_EX.Rank;
  let coeff: number;

  if (exStatType === 'Dex') {
    coeff = exRankCoeffs.CritR[rank] ?? 0;
  } else if (exStatType === 'CritDamage' || exStatType === 'Speed') {
    coeff = exRankCoeffs.Speed_CritD[rank] ?? 0;
  } else {
    coeff = exRankCoeffs.Other[rank] ?? 0;
  }

  return round(level * coeff + 1);
}

/**
 * 防具ステータス計算
 */
export function calculateArmorStats(
  armor: ArmorData,
  rank: EquipmentRank,
  reinforcementCount: number,
  tatakiDistribution: ArmorSmithingDistribution | number = {},
  eqConst: EqConstData,
  userStatusCalc?: UserStatusCalcData
): EquipmentStats {
  if (!validateRank(rank, armor.最低ランク, armor.最高ランク)) {
    throw new Error(`Invalid rank ${rank} for armor ${armor.アイテム名}`);
  }

  const maxArmorReinforcement = eqConst.Armor.Reinforcement?.MAX ?? 40;
  if (reinforcementCount < 0 || reinforcementCount > maxArmorReinforcement) {
    throw new Error(`Reinforcement must be between 0 and ${maxArmorReinforcement}`);
  }

  let distribution: ArmorSmithingDistribution;
  if (typeof tatakiDistribution === 'number') {
    distribution = {};
  } else {
    distribution = tatakiDistribution;
  }

  const totalTataki = Object.values(distribution).reduce((sum, v) => sum + (v || 0), 0);
  if (totalTataki > 12) {
    throw new Error(`Total tataki count (${totalTataki}) exceeds maximum of 12`);
  }

  const rankValue = eqConst.Armor.Rank[rank] || 0;
  const armorFormula = (userStatusCalc?.EquipmentStatusFormula?.Armor as any)?.MainStatus as string | undefined;

  const statNames = [
    { key: 'power', csvKey: '力（初期値）', tatakiMultiplier: 2 },
    { key: 'magic', csvKey: '魔力（初期値）', tatakiMultiplier: 2 },
    { key: 'hp', csvKey: '体力（初期値）', tatakiMultiplier: 2 },
    { key: 'mind', csvKey: '精神（初期値）', tatakiMultiplier: 2 },
    { key: 'speed', csvKey: '素早さ（初期値）', tatakiMultiplier: 2 },
    { key: 'dexterity', csvKey: '器用（初期値）', tatakiMultiplier: 2 },
    { key: 'critDamage', csvKey: '撃力（初期値）', tatakiMultiplier: 2 },
    { key: 'defense', csvKey: '守備力（初期値）', tatakiMultiplier: 1 },
  ];

  const result: EquipmentStats = {
    initial: {},
    rankBonus: {},
    reinforcement: {},
    forge: {},
    alchemy: {},
    final: {},
  };

  for (const stat of statNames) {
    const baseValue = armor[stat.csvKey as keyof ArmorData] as number || 0;
    if (baseValue === 0) continue;

    const statTatakiCount = distribution[stat.key as keyof ArmorSmithingDistribution] || 0;
    const forgeValue = stat.key === 'defense'
      ? eqConst.Armor.Forge?.Defence || 1
      : eqConst.Armor.Forge?.Other || 2;
    const tatakiValue = statTatakiCount * forgeValue;

    const reinforcementValue = stat.key === 'defense'
      ? (eqConst.Armor.Reinforcement?.Defence || 2) * reinforcementCount  // 守備力も強化は2倍
      : (eqConst.Armor.Reinforcement?.Other || 2) * reinforcementCount;

    let finalValue: number;

    if (armorFormula) {
      const variables: Record<string, number> = {
        [`Initial.${stat.key}`]: baseValue,
        [`Forge.${stat.key}`]: forgeValue,
        'ForgeCount': statTatakiCount,
        'Bonus.Rank': rankValue,
        'AvailableLv': armor.使用可能Lv,
        'ReinforcementLevel': reinforcementCount,
        [`Reinforcement.${stat.key}`]: reinforcementValue / reinforcementCount || 0,
      };

      const statFormula = armorFormula.replace(/<Stat>/g, stat.key);

      try {
        const calculatedValue = round(evaluateFormula(statFormula, variables));
        finalValue = calculatedValue + reinforcementValue;
      } catch {
        const baseWithTataki = baseValue + tatakiValue;
        const exponentPower = eqConst.Armor?.ExponentPower ?? 0.2;
        const calculatedValue = round(
          baseWithTataki * (1 + Math.pow(baseWithTataki, exponentPower) * (rankValue / armor.使用可能Lv))
        );
        finalValue = calculatedValue + reinforcementValue;
      }
    } else {
      const baseWithTataki = baseValue + tatakiValue;
      const exponentPower = eqConst.Armor?.ExponentPower ?? 0.2;
      const calculatedValue = round(
        baseWithTataki * (1 + Math.pow(baseWithTataki, exponentPower) * (rankValue / armor.使用可能Lv))
      );
      finalValue = calculatedValue + reinforcementValue;
    }

    result.initial[stat.key] = baseValue;
    result.forge[stat.key] = tatakiValue;
    result.reinforcement[stat.key] = reinforcementValue;
    result.rankBonus[stat.key] = finalValue - baseValue - tatakiValue - reinforcementValue;
    result.final[stat.key] = finalValue;
  }

  return result;
}

/**
 * 防具EXステータス2種を計算
 */
export function calculateArmorEX(
  armor: ArmorData,
  rank: EquipmentRank,
  ex1Type: 'Dex' | 'CritDamage' | 'Speed' | 'HP' | 'Power' | 'Magic' | 'Mind',
  ex2Type: 'Dex' | 'CritDamage' | 'Speed' | 'HP' | 'Power' | 'Magic' | 'Mind',
  eqConst: EqConstData
): { ex1: number; ex2: number; ex1Type: string; ex2Type: string } {
  const level = armor.使用可能Lv;
  return {
    ex1: calculateArmorEXValue(level, rank, ex1Type, eqConst),
    ex2: calculateArmorEXValue(level, rank, ex2Type, eqConst),
    ex1Type,
    ex2Type
  };
}

/**
 * アクセサリEXステータス2種を計算
 */
export function calculateAccessoryEX(
  accessory: AccessoryData,
  rank: EquipmentRank,
  ex1Type: 'Dex' | 'CritDamage' | 'Speed' | 'HP' | 'Power' | 'Magic' | 'Mind',
  ex2Type: 'Dex' | 'CritDamage' | 'Speed' | 'HP' | 'Power' | 'Magic' | 'Mind',
  eqConst: EqConstData
): { ex1: number; ex2: number; ex1Type: string; ex2Type: string } {
  const level = accessory.使用可能Lv;
  return {
    ex1: calculateArmorEXValue(level, rank, ex1Type, eqConst),
    ex2: calculateArmorEXValue(level, rank, ex2Type, eqConst),
    ex1Type,
    ex2Type
  };
}
