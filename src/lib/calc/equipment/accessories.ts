/**
 * アクセサリー計算モジュール
 */

import { AccessoryData, EmblemData, EqConstData } from '@/types/data';
import { EquipmentStats, EquipmentRank, StatBlock } from './types';
import { validateRank } from './rankHelpers';

/**
 * アクセサリーステータス計算
 */
export function calculateAccessoryStats(
  accessory: AccessoryData,
  rank: EquipmentRank,
  eqConst: EqConstData
): EquipmentStats {
  if (!validateRank(rank, accessory.最低ランク, accessory.最高ランク)) {
    throw new Error(`Invalid rank ${rank} for accessory ${accessory.アイテム名}`);
  }

  const rankBonus = eqConst.Accessory?.Rank?.[rank] || 0;

  const statsMapping = [
    { key: 'HP', csvKey: '体力（初期値）' },
    { key: 'Power', csvKey: '力（初期値）' },
    { key: 'Magic', csvKey: '魔力（初期値）' },
    { key: 'Mind', csvKey: '精神（初期値）' },
    { key: 'CritDamage', csvKey: '撃力（初期値）' },
    { key: 'Speed', csvKey: '素早さ（初期値）' },
  ];

  const result: EquipmentStats = {
    initial: {},
    rankBonus: {},
    reinforcement: {},
    forge: {},
    alchemy: {},
    final: {},
  };

  for (const stat of statsMapping) {
    const baseValue = (accessory[stat.csvKey as keyof AccessoryData] as number) || 0;
    if (baseValue === 0) continue;

    let finalValue: number;
    if (rankBonus === 0) {
      finalValue = baseValue;
    } else {
      const scalingDivisor = eqConst.Accessory?.ScalingDivisor ?? 550;
      finalValue = Math.ceil(baseValue + (accessory.使用可能Lv * rankBonus / scalingDivisor));
    }

    result.initial[stat.key] = baseValue;
    result.rankBonus[stat.key] = finalValue - baseValue;
    result.final[stat.key] = finalValue;
  }

  return result;
}

/**
 * 紋章ステータス計算
 */
export function calculateEmblemStats(emblem: EmblemData): EquipmentStats {
  const finalStats: StatBlock = {};

  const statMapping: { [key: string]: string } = {
    '力（%不要）': 'power_percent',
    '魔力（%不要）': 'magic_percent',
    '体力（%不要）': 'health_percent',
    '精神（%不要）': 'spirit_percent',
    '素早さ（%不要）': 'speed_percent',
    '器用（%不要）': 'dex_percent',
    '撃力（%不要）': 'critDamage_percent',
    '守備力（%不要）': 'defence_percent',
  };

  for (const [csvKey, statKey] of Object.entries(statMapping)) {
    const value = emblem[csvKey as keyof EmblemData] as number | undefined;
    if (value && value > 0) {
      finalStats[statKey] = value;
    }
  }

  return {
    initial: {},
    rankBonus: {},
    reinforcement: {},
    forge: {},
    alchemy: {},
    final: finalStats,
  };
}
