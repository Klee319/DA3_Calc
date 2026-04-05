/**
 * 装備計算モジュール - メインエクスポート
 * 後方互換性を維持しつつ、モジュール分割を実現
 */

// 型のエクスポート
export type {
  EquipmentRank,
  WeaponRank,
  WeaponSmithingCounts,
  StatBlock,
  EquipmentStats,
  SelectedEquipment,
  RingData,
  ArmorSmithingDistribution,
} from './types';

export { RANK_ORDER } from './types';

// ランクヘルパーのエクスポート
export { validateRank, clampRank } from './rankHelpers';

// 武器計算のエクスポート
export { calculateWeaponStats } from './weapon';

// 防具計算のエクスポート
export {
  calculateArmorStats,
  calculateArmorEX,
  calculateAccessoryEX,
} from './armor';

// アクセサリー・紋章計算のエクスポート
export {
  calculateAccessoryStats,
  calculateEmblemStats,
} from './accessories';

// ルーン・リング計算のエクスポート
export {
  calculateRuneStats,
  calculateRingStats,
} from './runes';

// 統合関数のエクスポート
export { calculateAllEquipmentStats } from './merger';
