/**
 * RPGステータス・ダメージ計算ライブラリ
 * 各種計算関数をエクスポート
 */

// 数式評価
export {
  evaluateFormula,
  evaluateFormulaChain,
  evaluateConditionalFormula,
  safeDivide,
  percentToMultiplier,
  clamp
} from './formulaEvaluator';

// プレースホルダーマッピング
export {
  mapUserStatsToVariables,
  mapWeaponStatsToVariables,
  createVariableMapping,
  convertJapaneseWeaponType,
  getWeaponCalcKey,
  JAPANESE_WEAPON_TYPE_MAP,
  WEAPON_TYPE_TO_CALC_KEY
} from './placeholderMapping';

// 装備ステータス計算
export {
  calcWeaponStats,
  calcArmorStats,
  calcAccessoryStats,
  calcEXStats,
  sumEquipmentStats
} from './equipmentStatus';

// ユーザーステータス計算
export {
  calcJobStats,
  calcBaseStatus,
  applyRingOption,
  calcFinalStatus,
  calcStatusDetails
} from './userStatus';

// 武器ダメージ計算
export {
  calcBaseDamage,
  applyJobCorrection,
  calcFinalDamage,
  calcWeaponDamage,
  calcCriticalDamage,
  checkHit
} from './weaponDamage';

// スキルダメージ計算
export {
  calcSkillDamage,
  getSkillInfo,
  calcMultiSkillDamage,
  calcExpectedSkillDamage
} from './skillDamage';

// ステータス計算（統合）
export {
  calculateStatus,
  calculateBaseStatus,
  applyPercentBonus,
  applyRingConvergence,
  calculateCritRate
} from './statusCalculator';

// ダメージ計算（統合）
export {
  calculateDamage,
  calculateBaseDamage,
  // applyJobCorrection, // weaponDamageからエクスポート済み
  applyCritDamage,
  applyDamageCorrection,
  calculateFinalDamage,
  calculateSkillDamage,
  evaluateFormulaString,
  parseHits
} from './damageCalculator';

// 型定義のエクスポート
export type {
  StatBlock,
  WeaponData,
  WeaponStats,
  ArmorData,
  ArmorStats,
  AccessoryData,
  AccessoryStats,
  EXData,
  EXStats,
  ForgeConfig,
  EqConstData,
  EquipmentSet,
  SPAllocation,
  JobSPData,
  RingOption,
  CalcResult,
  CalcError,
  StatusCalcInput,
  CalculatedStats,
  DamageCalcInput,
  DamageResult,
  EnemyParams,
  DamageCalcOptions,
  SkillResult,
  WeaponType
} from '@/types/calc';