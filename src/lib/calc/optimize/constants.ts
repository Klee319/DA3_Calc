/**
 * 最適化モジュール - 定数
 *
 * Note: 武器係数はWeaponCalc.yamlのBasedDamageから抽出
 * YAMLを変更した場合はここも同期する必要がある
 */

import type { WeaponType, InternalStatKey } from '@/types/calc';

// ===== 武器ダメージ計算式の係数 =====
// Source: public/data/formula/WeaponCalc.yaml - BasedDamage

/** 武器種別のダメージ計算式係数 */
export interface WeaponDamageFormula {
  /** 主要ステータス（Sword→Power, Wand→Magic等） */
  primaryStat: InternalStatKey;
  /** 主要ステータス係数 */
  primaryCoeff: number;
  /** 副次ステータス（大剣のHP等） */
  secondaryStat?: InternalStatKey;
  /** 副次ステータス係数 */
  secondaryCoeff?: number;
  /** CritDamage係数 */
  critDamageCoeff: number;
  /** 特殊計算（槍用） */
  isSpear?: boolean;
}

/**
 * 武器種別のダメージ計算式係数
 * Source: WeaponCalc.yaml - BasedDamage
 */
export const WEAPON_DAMAGE_FORMULAS: Record<string, WeaponDamageFormula> = {
  Sword: { primaryStat: 'Power', primaryCoeff: 1.6, critDamageCoeff: 0.005 },
  Wand: { primaryStat: 'Magic', primaryCoeff: 1.75, critDamageCoeff: 0.0016 },
  Bow: { primaryStat: 'Power', primaryCoeff: 1.75, critDamageCoeff: 0.0016 },
  Axe: { primaryStat: 'Power', primaryCoeff: 1.5, secondaryStat: 'Mind', secondaryCoeff: 2.5, critDamageCoeff: 0.001 },
  GreatSword: { primaryStat: 'Power', primaryCoeff: 1.6, secondaryStat: 'HP', secondaryCoeff: 3.1, critDamageCoeff: 0.001 },
  Dagger: { primaryStat: 'Power', primaryCoeff: 1.25, secondaryStat: 'Agility', secondaryCoeff: 3.5, critDamageCoeff: 0.0015 },
  Spear: { primaryStat: 'Dex', primaryCoeff: 1.0, secondaryStat: 'Defense', secondaryCoeff: 0.027, critDamageCoeff: 0.001 / 3, isSpear: true },
  Frypan: { primaryStat: 'Power', primaryCoeff: 1.6, critDamageCoeff: 0.005 },
};

/**
 * 武器種別のEXスコア計算用係数
 * WEAPON_DAMAGE_FORMULASから導出（EX選択の優先度決定用）
 *
 * Note:
 * - 使用しないステータスは0を明示的に設定（statCoefficientsからの上書き防止）
 * - Dexは会心率に依存するため除外（critRate < 100%の場合、statCoefficientsから動的に取得）
 * - EXステータス: Power, Magic, HP, Mind, Agility(Speed), CritDamage
 */
export const WEAPON_STAT_COEFFICIENTS: Record<string, Record<string, number>> = {
  'Sword': { Power: 1.6, Magic: 0, HP: 0, Mind: 0, Agility: 0, CritDamage: 1.2 },
  'Wand': { Power: 0, Magic: 1.75, HP: 0, Mind: 0, Agility: 0, CritDamage: 1.0 },
  'Bow': { Power: 1.75, Magic: 0, HP: 0, Mind: 0, Agility: 0, CritDamage: 1.2 },
  'Axe': { Power: 1.5, Magic: 0, HP: 0, Mind: 2.5, Agility: 0, CritDamage: 1.0 },
  'GreatSword': { Power: 1.6, Magic: 0, HP: 3.1, Mind: 0, Agility: 0, CritDamage: 1.0 },
  'Dagger': { Power: 1.25, Magic: 0, HP: 0, Mind: 0, Agility: 3.5, CritDamage: 1.5 },
  'Spear': { Power: 0.5, Magic: 0, HP: 0, Mind: 0, Agility: 0, Dex: 1.0, CritDamage: 0.8, Defense: 0.5 },
  'Frypan': { Power: 1.6, Magic: 0, HP: 0, Mind: 0, Agility: 0, CritDamage: 1.2 },
};

/** YAML武器種名 → CSV武器種名（日本語） */
export const WEAPON_TYPE_YAML_TO_CSV: Record<string, string> = {
  'Sword': '剣',
  'GreatSword': '大剣',
  'Dagger': '短剣',
  'Axe': '斧',
  'Spear': '槍',
  'Bow': '弓',
  'Wand': '杖',
  'Grimoire': '杖',
  'Staff': '杖',
};

/** YAML防具タイプ → CSV防具タイプ（日本語） */
export const ARMOR_TYPE_YAML_TO_CSV: Record<string, string> = {
  'Cloth': '布',
  'Leather': '革',
  'Metal': '金属',
};

/** CSV武器種 → WeaponType（英語小文字） */
export const CSV_WEAPON_TO_TYPE: Record<string, WeaponType> = {
  '剣': 'sword',
  '大剣': 'greatsword',
  '短剣': 'dagger',
  '斧': 'axe',
  '槍': 'spear',
  '弓': 'bow',
  '杖': 'wand',
};

/** 装備フィルタリング設定 */
export const EQUIPMENT_FILTER_CONFIG = {
  minWeaponLevel: 80,
  minArmorLevel: 60,
  minAccessoryLevel: 60,
  maxWeaponCandidates: 30,
  maxArmorCandidates: 25,
  maxAccessoryCandidates: 20,
};

/** EXタイプ → ステータスキーのマッピング */
export const EX_TYPE_TO_STAT_KEY: Record<string, string> = {
  'Power': 'Power',
  'Magic': 'Magic',
  'HP': 'HP',
  'Mind': 'Mind',
  'Speed': 'Agility',
  'Dex': 'Dex',
  'CritDamage': 'CritDamage',
};

/**
 * EXで選択可能なタイプ（防具・アクセサリー共通）
 * Note: DefenseはEXタイプに存在しない（叩きで上げる必要がある）
 */
export const AVAILABLE_EX_TYPES = ['Dex', 'CritDamage', 'Speed', 'HP', 'Power', 'Magic', 'Mind'] as const;

/** EXタイプの型 */
export type EXType = typeof AVAILABLE_EX_TYPES[number];

/** 全数探索を実行する組み合わせ数の閾値 */
export const EXHAUSTIVE_SEARCH_THRESHOLD = 10000;

/** メモリ内に保持する最大解数 */
export const MAX_SOLUTIONS_IN_MEMORY = 200;

// ===== 評価関数の定数 =====

/** 器用さから会心率への変換係数 (1 DEX = 0.3% crit rate) */
export const DEX_TO_CRIT_RATE = 0.3;

/** 会心率の最大値 */
export const MAX_CRIT_RATE = 100;

/** 最小制約達成時のペナルティ係数 */
export const CONSTRAINT_PENALTY_FACTOR = 0.001;

/** キャッシュサイズ上限 */
export const MAX_EVALUATION_CACHE_SIZE = 50000;
export const MAX_EQUIPMENT_STATS_CACHE_SIZE = 10000;
export const MAX_JOB_STATS_CACHE_SIZE = 100;

// ===== 職業別武器一覧 =====
// Source: public/data/formula/JobConst.yaml - AvailableWeapons
// YAMLを変更した場合はここも同期する必要がある

/**
 * 職業別の使用可能武器一覧
 * Note: 'All'は全武器種を意味する（Novice用）
 */
export const JOB_AVAILABLE_WEAPONS: Record<string, string[]> = {
  Novice: ['Sword', 'Bow', 'Wand', 'Axe', 'GreatSword', 'Dagger', 'Spear', 'Frypan'],
  Fighter: ['Sword'],
  Acolyte: ['Wand'],
  Archer: ['Bow'],
  Mage: ['Wand'],
  Cleric: ['Wand'],
  Hunter: ['Dagger', 'Sword'],
  Ranger: ['Bow'],
  Wizard: ['Wand'],
  Knight: ['Sword'],
  Warrior: ['Axe', 'GreatSword'],
  SpellRefactor: ['Sword', 'Wand'],  // Grimoire, Shieldは攻撃用武器ではないため除外
  Guardian: ['Sword', 'Spear'],
  Priest: ['Wand'],
  StellaShaft: ['Bow'],
};
