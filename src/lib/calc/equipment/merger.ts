/**
 * 装備統合計算モジュール
 */

import { EqConstData } from '@/types/data';
import { EquipmentStats, SelectedEquipment, StatBlock } from './types';
import { calculateWeaponStats } from './weapon';
import { calculateArmorStats } from './armor';
import { calculateAccessoryStats, calculateEmblemStats } from './accessories';
import { calculateRuneStats, calculateRingStats } from './runes';

/**
 * StatBlockをマージするヘルパー関数
 */
function mergeStatBlock(target: StatBlock, source: StatBlock): void {
  for (const [key, value] of Object.entries(source)) {
    if (target[key] === undefined) {
      target[key] = 0;
    }
    target[key] += value;
  }
}

/**
 * ステータスをマージするヘルパー関数
 */
function mergeStats(target: EquipmentStats, source: EquipmentStats): void {
  mergeStatBlock(target.initial, source.initial);
  mergeStatBlock(target.rankBonus, source.rankBonus);
  mergeStatBlock(target.reinforcement, source.reinforcement);
  mergeStatBlock(target.forge, source.forge);
  mergeStatBlock(target.alchemy, source.alchemy);
  mergeStatBlock(target.final, source.final);

  if (source.attackPower !== undefined) target.attackPower = source.attackPower;
  if (source.critRate !== undefined) target.critRate = source.critRate;
  if (source.critDamage !== undefined) target.critDamage = source.critDamage;
  if (source.damageCorrection !== undefined) target.damageCorrection = source.damageCorrection;
  if (source.coolTime !== undefined) target.coolTime = source.coolTime;
}

/**
 * 全装備のステータスを合算
 */
export function calculateAllEquipmentStats(
  equipment: SelectedEquipment,
  eqConst: EqConstData
): EquipmentStats {
  const allStats: EquipmentStats = {
    initial: {},
    rankBonus: {},
    reinforcement: {},
    forge: {},
    alchemy: {},
    final: {},
  };

  // 武器
  if (equipment.weapon) {
    const weaponStats = calculateWeaponStats(
      equipment.weapon.data,
      equipment.weapon.rank,
      equipment.weapon.reinforcement,
      equipment.weapon.hammerCount,
      equipment.weapon.alchemyEnabled,
      eqConst
    );
    mergeStats(allStats, weaponStats);
  }

  // 頭防具
  if (equipment.head) {
    const headStats = calculateArmorStats(
      equipment.head.data,
      equipment.head.rank,
      equipment.head.reinforcement,
      equipment.head.tatakiCount || 0,
      eqConst
    );
    mergeStats(allStats, headStats);
  }

  // 胴防具
  if (equipment.body) {
    const bodyStats = calculateArmorStats(
      equipment.body.data,
      equipment.body.rank,
      equipment.body.reinforcement,
      equipment.body.tatakiCount || 0,
      eqConst
    );
    mergeStats(allStats, bodyStats);
  }

  // 脚防具
  if (equipment.leg) {
    const legStats = calculateArmorStats(
      equipment.leg.data,
      equipment.leg.rank,
      equipment.leg.reinforcement,
      equipment.leg.tatakiCount || 0,
      eqConst
    );
    mergeStats(allStats, legStats);
  }

  // ネックレス
  if (equipment.necklace) {
    const necklaceStats = calculateAccessoryStats(
      equipment.necklace.data,
      equipment.necklace.rank,
      eqConst
    );
    mergeStats(allStats, necklaceStats);
  }

  // ブレスレット
  if (equipment.bracelet) {
    const braceletStats = calculateAccessoryStats(
      equipment.bracelet.data,
      equipment.bracelet.rank,
      eqConst
    );
    mergeStats(allStats, braceletStats);
  }

  // 紋章
  if (equipment.emblem) {
    const emblemStats = calculateEmblemStats(equipment.emblem);
    mergeStats(allStats, emblemStats);
  }

  // ルーンストーン
  if (equipment.runes && equipment.runes.length > 0) {
    const runeStats = calculateRuneStats(equipment.runes);
    mergeStats(allStats, runeStats);
  }

  // リング（未実装）
  if (equipment.ring) {
    const ringStats = calculateRingStats(equipment.ring);
    mergeStats(allStats, ringStats);
  }

  return allStats;
}
