import { StatType } from './index';

// 内部計算用ステータスキー（Power, Magic等の形式）
export type InternalStatKey =
  | 'HP'
  | 'Power'
  | 'Magic'
  | 'Defense'
  | 'Mind'
  | 'Agility'
  | 'Dex'
  | 'CritDamage'
  | 'CritRate';

// ステータスブロック（各ステータスの値を保持）
// UI形式（ATK, MATK等）と内部形式（Power, Magic等）の両方を許容
export type StatBlock = Partial<Record<StatType | InternalStatKey, number>>;

// equipmentCalculatorから型を再エクスポート
export type { SelectedEquipment } from '@/lib/calc/equipmentCalculator';

// 武器データ
export interface WeaponData {
  name: string;
  type: string;
  baseAttack?: number;
  baseMagicAttack?: number;
  baseStats?: StatBlock;
  [key: string]: any;
}

// 武器ステータス（計算後）
export interface WeaponStats extends StatBlock {
  attackPower?: number;
  magicPower?: number;
  critRate?: number;    // 会心率
  critDamage?: number;  // 会心ダメージ
}

// 防具データ
export interface ArmorData {
  name: string;
  type: 'head' | 'body' | 'arm' | 'leg';
  baseDefense?: number;
  baseMagicDefense?: number;
  baseStats?: StatBlock;
  [key: string]: any;
}

// 防具ステータス（計算後）
export interface ArmorStats extends StatBlock {
  defense?: number;
  magicDefense?: number;
}

// アクセサリデータ
export interface AccessoryData {
  name: string;
  baseStats?: StatBlock;
  [key: string]: any;
}

// アクセサリステータス（計算後）
export type AccessoryStats = StatBlock;

// EX装備データ
export interface EXData {
  name: string;
  type: string;
  baseStats?: StatBlock;
  critRate?: number;
  critDamage?: number;
  speed?: number;
  [key: string]: any;
}

// EX装備ステータス（計算後）
export interface EXStats extends StatBlock {
  critRate?: number;
  critDamage?: number;
  speed?: number;
}

// 鍛冶設定
export interface ForgeConfig {
  level?: number;
  options?: Array<{
    stat: StatType | 'defence' | 'attack';
    value: number;
  }>;
}

// 装備定数データ
export interface EqConstData {
  Armor?: {
    Forge?: {
      Defence?: number;
      Other?: number;
    };
    Reinforcement?: {
      MAX?: number;
      Defence?: number;
      Other?: number;
    };
    Rank?: Record<string, number>;
  };
  Weapon?: {
    Forge?: {
      Attack?: number;
      Other?: number;
    };
    Reinforcement?: {
      MAX?: number;
      Attack?: number;
      Other?: number;
    };
    Rank?: Record<string, number>;
  };
  Accessory?: {
    Rank?: Record<string, number>;
  };
  Equipment_EX?: {
    Rank?: {
      CritR?: Record<string, number>;
      Speed_CritD?: Record<string, number>;
      Other?: Record<string, number>;
    };
  };
}

// 装備セット（計算用）
export interface EquipmentSet {
  weapon?: WeaponStats;
  head?: ArmorStats;
  body?: ArmorStats;
  arm?: ArmorStats;
  leg?: ArmorStats;
  accessory1?: AccessoryStats;
  accessory2?: AccessoryStats;
  ex?: EXStats;
}

// SP割り振りデータ
export interface SPAllocation {
  [skillName: string]: number;
}

// 職業SPデータ
export interface JobSPData {
  name: string;
  stats: StatBlock;
  spCost: number;
}

// リングオプション
export interface RingOption {
  enabled: boolean;
  stats: StatBlock;
  iterations?: number;
}



// スキル計算結果
export interface SkillResult {
  damage: number;
  hits: number;
  totalDamage: number;
  mp: number;
  ct: number;
}

// 武器タイプ
export type WeaponType =
  | 'sword'
  | 'greatsword'
  | 'dagger'
  | 'axe'
  | 'spear'
  | 'bow'
  | 'staff'
  | 'mace'
  | 'katana'
  | 'fist'
  | string;

// ===== 計算結果型 =====

/**
 * 計算結果型（成功または失敗）
 */
export type CalcResult<T> =
  | { success: true; data: T }
  | { success: false; error: CalcError };

/**
 * 計算エラー
 */
export interface CalcError {
  code: string;
  message: string;
  context?: Record<string, unknown>;
}

// ===== ステータス計算関連型 =====

/**
 * ステータス計算入力
 */
export interface StatusCalcInput {
  // 職業ステータス
  jobStats: {
    initial: StatBlock;     // 初期値 × レベル
    sp: StatBlock;          // SP由来
    bonusPercent: StatBlock; // %補正
  };

  // レベル情報
  jobLevel?: number;

  // 装備ステータス
  equipmentTotal: StatBlock;

  // 紋章%補正
  emblemBonusPercent: StatBlock;

  // ルーンストーンボーナス（固定値加算）
  runestoneBonus?: StatBlock;

  // 食べ物
  food?: StatBlock;

  // 高度設定（固定値加算）
  userOption?: StatBlock;

  // ユーザー指定%ボーナス（職業・紋章補正とは別）
  userPercentBonus?: StatBlock;

  // 再帰収束計算ON/OFF
  recursiveEnabled?: boolean;

  // リング設定
  ring?: {
    enabled: boolean;
    bonusPercent: StatBlock;
  };

  // 武器会心率（会心率計算用）
  weaponCritRate?: number;
}

/**
 * 計算済みステータス
 */
export interface CalculatedStats {
  // 各要素の内訳
  breakdown: {
    equipment: StatBlock;      // 装備合計
    jobInitial: StatBlock;     // 職業初期値 × レベル
    jobSP: StatBlock;          // SP由来
    food: StatBlock;           // 食べ物
    userOption: StatBlock;     // 高度設定
    runestone?: StatBlock;     // ルーンストーン
  };

  // 基礎ステータス（%補正前）
  base: StatBlock;

  // %補正
  bonusPercent: {
    job: StatBlock;
    emblem: StatBlock;
    total: StatBlock;
  };

  // リング収束（有効な場合）
  ring?: {
    iterations: number;
    delta: StatBlock;
  };

  // 最終ステータス
  final: StatBlock;

  // 会心率（特別計算）
  critRate: number;
}

// ===== ダメージ計算関連型 =====

/**
 * ダメージ計算入力
 */
export interface DamageCalcInput {
  // ユーザーステータス
  userStats: CalculatedStats;

  // 武器情報
  weaponType: WeaponType;
  weaponAttackPower: number;
  weaponCritRate: number;
  weaponCritDamage: number;
  damageCorrection: number;
  weaponName?: string;  // 追撃計算用の武器名

  // 敵パラメータ
  enemy: EnemyParams;

  // オプション
  options: DamageCalcOptions;

  // 職業名（職業補正用）
  jobName?: string;
}

/**
 * 敵パラメータ
 */
export interface EnemyParams {
  defense: number;
  typeResistance: number;    // 種族耐性（%）
  attributeResistance: number; // 属性耐性（%）
  hp?: number;  // 敵HP（TTK計算用）
}

/**
 * ダメージ計算オプション
 */
export interface DamageCalcOptions {
  critMode: 'always' | 'never' | 'expected';  // 会心モード
  damageCorrectionMode: 'min' | 'max' | 'avg'; // ダメージ補正モード
  skillLevel?: number;  // スキルレベル（1-10）
  skillName?: string;   // スキル名
}

/**
 * ダメージ計算結果
 */
export interface DamageResult {
  // 基礎ダメージ
  baseDamage: number;

  // 会心補正
  critMultiplier: number;

  // スキル倍率
  skillMultiplier: number;

  // ヒット数
  hits: number;

  // 1ヒットダメージ
  hitDamage: number;

  // 総ダメージ
  totalDamage: number;

  // 追撃ダメージ
  additionalDamage?: number;

  // 敵防御後のダメージ
  finalDamage: number;

  // その他指標
  dps?: number;  // DPS（クールタイムがある場合）
  ttk?: number;  // Time to Kill（敵HPがある場合）
  mpEfficiency?: number; // MP効率（スキルの場合）
  mp?: number;  // MP消費
  ct?: number;  // クールタイム
}