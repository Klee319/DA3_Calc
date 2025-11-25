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
export type ArmorType = "head" | "body" | "arm" | "leg" | "accessory";

// 装備スロット
export type EquipSlot = "weapon" | "head" | "body" | "arm" | "leg" | "accessory1" | "accessory2";

// ステータス効果
export interface StatEffect {
  stat: StatType;
  value: number;
  isPercent?: boolean;
}

// 装備ランク
export type EquipmentRank = 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

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
  smithingCount?: number;
  alchemyEnabled?: boolean;
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
  defense: number;
  speciesResistance: number; // 種族耐性 (%)
  elementResistance: number; // 属性耐性 (%)
}

// ダメージ計算の詳細情報
export interface DamageCalculationDetails {
  baseDamage: number;        // 基礎ダメージ
  skillMultiplier: number;   // スキル倍率
  jobCorrected: number;      // 職業補正適用後
  enemyDefReduction: number; // 防御力による減少
  typeResistance: number;    // 種族耐性による減少率
  elementResistance: number; // 属性耐性による減少率
  finalDamage: number;       // 最終ダメージ
}

// 計算済みステータス
export interface CalculatedStats {
  base: Record<StatType, number>;
  fromEquipment: Record<StatType, number>;
  fromSkills: Record<StatType, number>;
  fromBuffs: Record<StatType, number>;
  total: Record<StatType, number>;
}
