/**
 * プレースホルダーマッピング定義
 *
 * 仕様書（spec-placeholder-mapping.md）に基づく変数名の統一管理
 * YAMLの計算式で使用される変数名と内部変数名のマッピング
 */

import { StatBlock, WeaponType } from '@/types/calc';

/**
 * 日本語武器種名 → 英語WeaponTypeのマッピング
 */
export const JAPANESE_WEAPON_TYPE_MAP: Record<string, WeaponType> = {
  '剣': 'sword',
  '大剣': 'greatsword',
  '短剣': 'dagger',
  '斧': 'axe',
  '槍': 'spear',
  '弓': 'bow',
  '杖': 'staff',
  'フライパン': 'mace',  // フライパンはmaceとして扱う
  'ダイス': 'mace',      // ダイスもmaceとして扱う（ダメージ0）
};

/**
 * WeaponType → WeaponCalc.yamlのキーマッピング
 */
export const WEAPON_TYPE_TO_CALC_KEY: Record<WeaponType, string> = {
  'sword': 'Sword',
  'greatsword': 'GreatSword',
  'dagger': 'Dagger',
  'axe': 'Axe',
  'spear': 'Spear',
  'bow': 'Bow',
  'staff': 'Wand',      // 杖はWandとして定義されている
  'mace': 'Frypan',     // メイス/フライパン
  'katana': 'Sword',    // 刀は剣と同じ扱い
  'fist': 'Sword',      // 拳は剣と同じ扱い（仮）
};

/**
 * 日本語武器種名からWeaponTypeに変換
 * @param japaneseType 日本語武器種名（例：「剣」「大剣」）
 * @returns WeaponType（見つからない場合は'sword'をデフォルトとして返す）
 */
export function convertJapaneseWeaponType(japaneseType: string): WeaponType {
  return JAPANESE_WEAPON_TYPE_MAP[japaneseType] || 'sword';
}

/**
 * WeaponTypeからWeaponCalc.yamlで使用されるキーに変換
 * @param weaponType WeaponType（小文字またはPascalCase）
 * @returns YAMLキー（例：'Sword', 'GreatSword'）
 */
export function getWeaponCalcKey(weaponType: WeaponType | string): string {
  // 小文字に変換してマッピングを検索
  const lowerType = weaponType.toLowerCase() as WeaponType;

  // まず直接マッピングを試す
  if (WEAPON_TYPE_TO_CALC_KEY[weaponType as WeaponType]) {
    return WEAPON_TYPE_TO_CALC_KEY[weaponType as WeaponType];
  }

  // 小文字で検索
  if (WEAPON_TYPE_TO_CALC_KEY[lowerType]) {
    return WEAPON_TYPE_TO_CALC_KEY[lowerType];
  }

  // PascalCaseで渡された場合、直接そのまま返す（YAMLキーとして使用）
  // 例: 'Bow' → 'Bow', 'Sword' → 'Sword'
  if (weaponType.charAt(0) === weaponType.charAt(0).toUpperCase()) {
    return weaponType;
  }

  return 'Sword';
}

/**
 * ユーザーステータスを正規化された変数名にマッピング
 *
 * @param userStats ユーザーステータス（様々な形式の可能性がある）
 * @returns 正規化された変数マッピング
 */
export function mapUserStatsToVariables(userStats: StatBlock): Record<string, number> {
  const stats = userStats as any;

  return {
    // ユーザー最終ステータス（正式名）
    UserHP: stats.UserHP || stats.HP || stats.hp || stats.体力 || 0,
    UserMP: stats.UserMP || stats.MP || stats.mp || 0,
    UserBP: stats.UserBP || stats.BP || stats.bp || 0,
    UserPower: stats.UserPower || stats.Power || stats.power || stats.ATK || stats.atk || stats.力 || 0,
    UserMagic: stats.UserMagic || stats.Magic || stats.magic || stats.MATK || stats.matk || stats.魔力 || 0,
    UserMind: stats.UserMind || stats.Mind || stats.mind || stats.MDEF || stats.mdef || stats.精神 || 0,
    UserSpeed: stats.UserSpeed || stats.Speed || stats.speed || stats.Agility || stats.agility || stats.AGI || stats.agi || stats.素早さ || 0,
    UserCritRate: stats.UserCritRate || stats.CritRate || stats.critRate || stats.Dexterity || stats.dexterity || stats.Dex || stats.dex || stats.DEX || stats.器用 || stats.器用さ || 0,
    UserCritDamage: stats.UserCritDamage || stats.CritDamage || stats.critDamage || stats.CriticalDamage || stats.criticalDamage || stats.撃力 || 0,
    UserDefense: stats.UserDefense || stats.Defense || stats.defense || stats.DEF || stats.def || stats.守備力 || 0,

    // 後方互換性のためのエイリアス（非推奨）
    UserDex: stats.UserCritRate || stats.CritRate || stats.critRate || stats.Dexterity || stats.dexterity || stats.Dex || stats.dex || stats.DEX || stats.器用 || stats.器用さ || 0,
    UserAgility: stats.UserSpeed || stats.Speed || stats.speed || stats.Agility || stats.agility || stats.AGI || stats.agi || stats.素早さ || 0,

    // 短縮形のエイリアス（後方互換性のため）
    Power: stats.UserPower || stats.Power || stats.power || stats.ATK || stats.atk || stats.力 || 0,
    Magic: stats.UserMagic || stats.Magic || stats.magic || stats.MATK || stats.matk || stats.魔力 || 0,
    Mind: stats.UserMind || stats.Mind || stats.mind || stats.MDEF || stats.mdef || stats.精神 || 0,
    HP: stats.UserHP || stats.HP || stats.hp || stats.体力 || 0,
    MP: stats.UserMP || stats.MP || stats.mp || 0,
    BP: stats.UserBP || stats.BP || stats.bp || 0,
    Agility: stats.UserSpeed || stats.Speed || stats.speed || stats.Agility || stats.agility || stats.AGI || stats.agi || stats.素早さ || 0,
    Dex: stats.UserCritRate || stats.CritRate || stats.critRate || stats.Dexterity || stats.dexterity || stats.Dex || stats.dex || stats.DEX || stats.器用 || stats.器用さ || 0,
    Dexterity: stats.UserCritRate || stats.CritRate || stats.critRate || stats.Dexterity || stats.dexterity || stats.Dex || stats.dex || stats.DEX || stats.器用 || stats.器用さ || 0,
    DEX: stats.UserCritRate || stats.CritRate || stats.critRate || stats.Dexterity || stats.dexterity || stats.Dex || stats.dex || stats.DEX || stats.器用 || stats.器用さ || 0,
    Defense: stats.UserDefense || stats.Defense || stats.defense || stats.DEF || stats.def || stats.守備力 || 0,
    CritDamage: stats.UserCritDamage || stats.CritDamage || stats.critDamage || stats.CriticalDamage || stats.criticalDamage || stats.撃力 || 0,
    CriticalDamage: stats.UserCritDamage || stats.CritDamage || stats.critDamage || stats.CriticalDamage || stats.criticalDamage || stats.撃力 || 0
  };
}

/**
 * 武器ステータスを正規化された変数名にマッピング
 *
 * @param weaponStats 武器ステータス
 * @returns 正規化された変数マッピング
 */
export function mapWeaponStatsToVariables(weaponStats: {
  attackPower: number;
  critRate: number;
  critDamage: number;
  coolTime?: number;
  damageCorrection?: number;
}): Record<string, number> {
  return {
    WeaponAttackPower: weaponStats.attackPower,
    WeaponCritRate: weaponStats.critRate,
    WeaponCritDamage: weaponStats.critDamage,
    WeaponCoolTime: weaponStats.coolTime || 0,
    DamageCorrection: weaponStats.damageCorrection || 1
  };
}

/**
 * 完全な変数マッピングを作成
 *
 * @param userStats ユーザーステータス
 * @param weaponStats 武器ステータス（オプション）
 * @param additionalVars 追加変数（オプション）
 * @returns 統合された変数マッピング
 */
export function createVariableMapping(
  userStats: StatBlock,
  weaponStats?: {
    attackPower: number;
    critRate: number;
    critDamage: number;
    coolTime?: number;
    damageCorrection?: number;
  },
  additionalVars?: Record<string, number>
): Record<string, number> {
  const userVars = mapUserStatsToVariables(userStats);
  const weaponVars = weaponStats ? mapWeaponStatsToVariables(weaponStats) : {};

  return {
    ...userVars,
    ...weaponVars,
    ...(additionalVars || {})
  };
}