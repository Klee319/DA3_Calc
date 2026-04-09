/**
 * 最適化モジュール - メインエクスポート
 */

// 型のエクスポート
export type {
  SimpleStatBlock,
  EvaluationContext,
  ScoredCombination,
  ArmorEXType,
  AccessoryEXType,
  SlotOrderStrategy,
  RunestoneCombination as RunestoneCombinationType,
  OptimizeOptions,
  SearchStats,
  OptimizeResultWithStats,
} from './types';

// 定数のエクスポート
export {
  WEAPON_TYPE_YAML_TO_CSV,
  ARMOR_TYPE_YAML_TO_CSV,
  CSV_WEAPON_TO_TYPE,
  EQUIPMENT_FILTER_CONFIG,
  EX_TYPE_TO_STAT_KEY,
  EXHAUSTIVE_SEARCH_THRESHOLD,
  MAX_SOLUTIONS_IN_MEMORY,
} from './constants';

// ユーティリティ関数のエクスポート
export {
  extractEmblemBonusPercent,
  checkMinimumStats,
  calculateMinimumStatsProgress,
  calculateMinimumStatsDeficit,
  generateWeaponSmithingPatterns,
  determineArmorSmithingDistribution,
  generateArmorSmithingCounts,
  generateArmorSmithingPatterns,
  generateEXPatternsForMinimumStats,
} from './utils';

// 支配性関数のエクスポート
export {
  weaponDominates,
  armorDominates,
  accessoryDominates,
  removeWeaponDominated,
  removeArmorDominated,
  removeAccessoryDominated,
  buildDominates,
  filterDominatedBuilds,
} from './dominance';

// 装備プール構築のエクスポート
export {
  buildWeaponPool,
  buildArmorPool,
  buildAccessoryPool,
  buildEquipmentPool,
} from './equipmentPool';

// 評価関数のエクスポート
export {
  clearEvaluationCache,
  generateCacheKey,
  calculateEquipmentStatsFn,
  evaluateCombination,
  evaluateCombinationCached,
} from './evaluation';

// 探索アルゴリズムのエクスポート
export {
  calculateCombinationCount,
  exhaustiveSearchAsync,
  greedyInitialSolution,
  greedyInitialSolutionAsync,
  greedyWithSlotOrder,
  greedyWithMinimumStatsPriority,
  generateCrossoverSolutions,
  multiStartGreedyAsync,
} from './search';

// ローカルサーチのエクスポート
export {
  localSearch,
  localSearchAsync,
  adaptiveTwoOptAsync,
  generateDiverseSolutionsAsync,
} from './localSearch';

// 紋章・ルーンストーンのエクスポート
export {
  filterDominatedEmblems,
  calculateRunestoneBonus,
  buildRunestoneCombinations,
  type RunestoneCombination,
} from './emblemRunestone';

// Beam Search エクスポート
export { beamSearchOptimize } from './beamSearch';

// タロット探索エクスポート
export {
  buildTarotCandidates,
  filterDominatedTarot,
} from './tarotSearch';

// SP最適化エクスポート
export { optimizeRemainingSP } from './spOptimizer';

// メインエンジンのエクスポート
export type { OptimizeGameData } from './engine';
export {
  optimizeEquipment,
  generateOptimizeResultCSV,
} from './engine';
