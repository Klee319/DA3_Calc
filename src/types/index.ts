// ステータス種別
export type StatType =
  | "HP"
  | "MP"
  | "ATK"
  | "DEF"
  | "MATK"
  | "MDEF"
  | "AGI"
  | "DEX"
  | "LUK"
  | "CRI"
  | "HIT"
  | "FLEE";

// 武器種別
export type WeaponType =
  | "sword"
  | "greatsword"
  | "dagger"
  | "axe"
  | "spear"
  | "bow"
  | "staff"
  | "mace"
  | "katana"
  | "fist";

// 防具種別
export type ArmorType = "head" | "body" | "leg" | "accessory";

// 装備スロット
export type EquipSlot = "weapon" | "head" | "body" | "leg" | "accessory1" | "accessory2";

// ステータス効果
export interface StatEffect {
  stat: StatType;
  value: number;
  isPercent?: boolean;
}

// 装備ランク
export type EquipmentRank = 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

// 叩きパラメータ種別（防具用）
export type SmithingParamType = '力' | '魔力' | '体力' | '精神' | '素早さ' | '器用' | '撃力' | '守備力';

// 叩き回数（パラメータ別）
export type SmithingCounts = Partial<Record<SmithingParamType, number>>;

// 装備の元データ参照（CSVデータへの参照）
export type EquipmentSourceData =
  | { type: 'weapon'; data: import('@/types/data').WeaponData }
  | { type: 'armor'; data: import('@/types/data').ArmorData }
  | { type: 'accessory'; data: import('@/types/data').AccessoryData };

// EXステータス設定（防具・アクセサリー用）
export interface ExStats {
  ex1?: string;  // EXステータス1の種類
  ex2?: string;  // EXステータス2の種類
}

// デバッグ用武器ステータス
export interface DebugWeaponStats {
  attackPower: number;      // 攻撃力
  critRate: number;         // 会心率
  critDamage: number;       // 会心ダメージ
  damageCorrection: number; // ダメージ補正
  coolTime: number;         // CT
}

// デバッグ用防具ステータス
export interface DebugArmorStats {
  power: number;      // 力
  magic: number;      // 魔力
  hp: number;         // 体力
  mind: number;       // 精神
  agility: number;    // 素早さ
  dex: number;        // 器用
  critDamage: number; // 撃力
  defense: number;    // 守備力
}

// デバッグ用アクセサリーステータス
export interface DebugAccessoryStats {
  power: number;      // 力
  magic: number;      // 魔力
  hp: number;         // 体力
  mind: number;       // 精神
  agility: number;    // 素早さ
  critDamage: number; // 撃力
}

// デバッグ用紋章ステータス（%補正）
export interface DebugEmblemStats {
  powerPercent: number;      // 力%
  magicPercent: number;      // 魔力%
  hpPercent: number;         // 体力%
  mindPercent: number;       // 精神%
  agilityPercent: number;    // 素早さ%
  dexPercent: number;        // 器用%
  critDamagePercent: number; // 撃力%
  defensePercent: number;    // 守備力%
}

// デバッグ用タロットステータス
export interface DebugTarotStats {
  // ステータス%ボーナス
  powerPercent: number;
  magicPercent: number;
  hpPercent: number;
  mindPercent: number;
  agilityPercent: number;
  dexPercent: number;
  defensePercent: number;
  critDamagePercent: number;
  // 武器関連固定値
  critRate: number;
  critDamage: number;
  damageCorrection: number;
  attackPower: number;
  // ダメージバフ
  allDamageBuff: number;
  physicalDamageBuff: number;
  magicDamageBuff: number;
  // 属性ダメージバフ
  noneDamageBuff: number;
  lightDamageBuff: number;
  darkDamageBuff: number;
  windDamageBuff: number;
  fireDamageBuff: number;
  waterDamageBuff: number;
  thunderDamageBuff: number;
}

// 装備
export interface Equipment {
  id: string;
  name: string;
  slot: EquipSlot;
  weaponType?: WeaponType;
  armorType?: ArmorType;
  baseStats: StatEffect[];
  requiredLevel?: number;
  requiredJob?: string[];
  description?: string;
  // カスタマイズプロパティ
  rank?: EquipmentRank;
  enhancementLevel?: number;
  /** @deprecated smithingCountsを使用してください */
  smithingCount?: number;
  // パラメータ別叩き回数
  smithingCounts?: SmithingCounts;
  alchemyEnabled?: boolean;
  // EXステータス（防具・アクセサリー用）
  exStats?: ExStats;
  // 元データへの参照（計算システム用）
  sourceData?: EquipmentSourceData;
  // デバッグ装備フラグ
  isDebug?: boolean;
  // デバッグ用ステータス（isDebug=trueの場合に使用）
  debugWeaponStats?: DebugWeaponStats;
  debugArmorStats?: DebugArmorStats;
  debugAccessoryStats?: DebugAccessoryStats;
}

// スキル
export interface Skill {
  id: string;
  name: string;
  description?: string;
  spCost?: number;
  maxLevel?: number;
  effects?: Record<number, StatEffect[]>;
  type?: string;
  element?: string;
  mpCost?: number;
  cooldown?: number;
  hits?: number;
  damage?: string;
  job?: string;
  weapon?: string;
  category?: string;
  range?: string;
  [key: string]: unknown;
}

// 職業
export interface Job {
  id: string;
  name: string;
  baseStats: Record<StatType, number>;
  statGrowth: Record<StatType, number>;
  availableWeapons: WeaponType[];
  skills: Skill[];
  maxLevel: number;
}

// バフ効果
export interface Buff {
  id: string;
  name: string;
  effects: StatEffect[];
  isActive: boolean;
}

// 装備セット
export type EquipmentSet = Partial<Record<EquipSlot, Equipment | null>>;

// SP配分
export type SPAllocation = Record<string, number>;

// キャラクタービルド
export interface CharacterBuild {
  id: string;
  name: string;
  job: Job | null;
  level: number;
  equipment: EquipmentSet;
  spAllocation: SPAllocation;
  buffs: Buff[];
}

// 敵ステータス定義
export interface EnemyStats {
  defense: number;           // 守備力
  attackResistance: number;  // 攻撃耐性（物/魔） (%)
  elementResistance: number; // 属性耐性 (%)
}

// ダメージ計算の詳細情報
export interface DamageCalculationDetails {
  baseDamage: number;          // 基礎ダメージ
  skillMultiplier: number;     // スキル倍率
  jobCorrected: number;        // 職業補正適用後
  enemyDefReduction: number;   // 守備力による減少（守備力/2）
  attackResistance: number;    // 攻撃耐性（物/魔）による減少率
  elementResistance: number;   // 属性耐性による減少率
  finalDamage: number;         // 最終ダメージ
}

// 耐性種別
export type AttackResistType = 'physical' | 'magic';
export type ElementResistType = 'fire' | 'water' | 'thunder' | 'wind' | 'none' | 'dark' | 'light';
export type ResistType = AttackResistType | ElementResistType;

// 耐性値（各ソースから）
export interface ResistanceBreakdown {
  fromSP: number;           // SP割り当てから
  fromRunestone: number;    // ルーンストーンから
  fromFood: number;         // 食べ物から
  total: number;            // 合計
}

// 全耐性データ
export interface ResistanceData {
  // 攻撃耐性
  physical: ResistanceBreakdown;  // 物理耐性
  magic: ResistanceBreakdown;     // 魔耐性
  // 属性耐性
  fire: ResistanceBreakdown;      // 炎耐性
  water: ResistanceBreakdown;     // 水耐性
  thunder: ResistanceBreakdown;   // 雷耐性
  wind: ResistanceBreakdown;      // 風耐性
  none: ResistanceBreakdown;      // 無耐性
  dark: ResistanceBreakdown;      // 闇耐性
  light: ResistanceBreakdown;     // 光耐性
}

// 計算済みステータス
export interface CalculatedStats {
  base: Record<StatType, number>;
  fromEquipment: Record<StatType, number>;
  fromSkills: Record<StatType, number>;  // SP割り当てによる増分
  fromBuffs: Record<StatType, number>;
  fromPercent: Record<StatType, number>; // %補正（紋章・職業）による増分
  total: Record<StatType, number>;
}
