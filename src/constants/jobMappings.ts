/**
 * 職業名マッピング定数
 * UI表示名（日本語） ⇔ YAML定義名（英語） の対応表
 */

/**
 * 日本語職業名 → YAML職業名
 */
export const JOB_NAME_JP_TO_YAML: Record<string, string> = {
  'ノービス': 'Novice',
  'ファイター': 'Fighter',
  'アコライト': 'Acolyte',
  'アーチャー': 'Archer',
  'メイジ': 'Mage',
  'クレリック': 'Cleric',
  'ハンター': 'Hunter',
  'レンジャー': 'Ranger',
  'ウィザード': 'Wizard',
  'ナイト': 'Knight',
  'ウォーリアー': 'Warrior',
  'スペルリファクター': 'SpellRefactor',
  'ガーディアン': 'Guardian',
  'プリースト': 'Priest',
  'ステラシャフト': 'StellaShaft',
};

/**
 * YAML職業名 → 日本語職業名
 */
export const JOB_NAME_YAML_TO_JP: Record<string, string> = {
  'Novice': 'ノービス',
  'Fighter': 'ファイター',
  'Acolyte': 'アコライト',
  'Archer': 'アーチャー',
  'Mage': 'メイジ',
  'Cleric': 'クレリック',
  'Hunter': 'ハンター',
  'Ranger': 'レンジャー',
  'Wizard': 'ウィザード',
  'Knight': 'ナイト',
  'Warrior': 'ウォーリアー',
  'SpellRefactor': 'スペルリファクター',
  'Guardian': 'ガーディアン',
  'Priest': 'プリースト',
  'StellaShaft': 'ステラシャフト',
};

/**
 * CSV武器種名 → YAML武器種名
 */
export const WEAPON_TYPE_CSV_TO_YAML: Record<string, string[]> = {
  '剣': ['Sword'],
  '大剣': ['GreatSword'],
  '短剣': ['Dagger'],
  '斧': ['Axe'],
  '槍': ['Spear'],
  '弓': ['Bow'],
  '杖': ['Wand', 'Grimoire', 'Staff'],  // 杖は複数のYAML名に対応
};

/**
 * CSV防具タイプ → YAML防具タイプ
 */
export const ARMOR_TYPE_CSV_TO_YAML: Record<string, string> = {
  '布': 'Cloth',
  '革': 'Leather',
  '金属': 'Metal',
};

/**
 * ヘルパー関数: 日本語職業名をYAML名に変換
 */
export function convertJobNameToYAML(jpName: string): string {
  return JOB_NAME_JP_TO_YAML[jpName] || jpName;
}

/**
 * ヘルパー関数: YAML職業名を日本語名に変換
 */
export function convertJobNameToJP(yamlName: string): string {
  return JOB_NAME_YAML_TO_JP[yamlName] || yamlName;
}

/**
 * ヘルパー関数: CSV武器種名をYAML名配列に変換
 */
export function convertWeaponTypeToYAML(csvName: string): string[] {
  return WEAPON_TYPE_CSV_TO_YAML[csvName] || [];
}

/**
 * ヘルパー関数: CSV防具タイプをYAML名に変換
 */
export function convertArmorTypeToYAML(csvName: string): string {
  return ARMOR_TYPE_CSV_TO_YAML[csvName] || 'Cloth';
}