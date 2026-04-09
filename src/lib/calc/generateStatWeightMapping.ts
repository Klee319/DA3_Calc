/**
 * ステータス重みづけマッピング生成
 *
 * YAMLファイルを解析し、全職業×スキルの依存ステータスと重みを事前計算
 * 最適化時に読み込んで使用することで高速化を実現
 */

import type { InternalStatKey } from '@/types/calc';
import type {
  StatWeight,
  SkillStatMapping,
  JobSkillMapping,
  SkillBookMapping,
  WeaponBaseDamageMapping,
  StatWeightMappingData,
} from './statWeightMapping';
import { AVAILABLE_EX_TYPES } from './optimize/constants';
import {
  WEAPON_BASE_DAMAGE_COEFFICIENTS,
  SKILL_ADDITIONAL_COEFFICIENTS,
  JOB_BUFF_DEPENDENCIES,
  getWeaponBaseDamageStats,
  getCombinedWeights,
} from './statWeightMapping';

// ===== 職業定義（JobConst.yamlから） =====

interface JobDefinition {
  MaxLevel: number;
  Grade: 'Special' | 'First' | 'Second' | 'Third';
  AvailableWeapons: string[];
  AvailableArmors: string[];
}

const JOB_DEFINITIONS: Record<string, JobDefinition> = {
  Novice: {
    MaxLevel: 220,
    Grade: 'Special',
    AvailableWeapons: ['All'],
    AvailableArmors: ['Cloth', 'Leather', 'Metal'],
  },
  Fighter: {
    MaxLevel: 100,
    Grade: 'First',
    AvailableWeapons: ['Sword'],
    AvailableArmors: ['Leather'],
  },
  Acolyte: {
    MaxLevel: 100,
    Grade: 'First',
    AvailableWeapons: ['Wand'],
    AvailableArmors: ['Cloth'],
  },
  Archer: {
    MaxLevel: 100,
    Grade: 'First',
    AvailableWeapons: ['Bow'],
    AvailableArmors: ['Leather'],
  },
  Mage: {
    MaxLevel: 100,
    Grade: 'First',
    AvailableWeapons: ['Wand'],
    AvailableArmors: ['Cloth'],
  },
  Cleric: {
    MaxLevel: 150,
    Grade: 'Second',
    AvailableWeapons: ['Wand'],
    AvailableArmors: ['Cloth'],
  },
  Hunter: {
    MaxLevel: 150,
    Grade: 'Second',
    AvailableWeapons: ['Dagger', 'Sword'],
    AvailableArmors: ['Leather'],
  },
  Ranger: {
    MaxLevel: 150,
    Grade: 'Second',
    AvailableWeapons: ['Bow'],
    AvailableArmors: ['Leather'],
  },
  Wizard: {
    MaxLevel: 150,
    Grade: 'Second',
    AvailableWeapons: ['Wand'],
    AvailableArmors: ['Cloth'],
  },
  Knight: {
    MaxLevel: 150,
    Grade: 'Second',
    AvailableWeapons: ['Sword'],
    AvailableArmors: ['Leather', 'Metal'],
  },
  Warrior: {
    MaxLevel: 150,
    Grade: 'Second',
    AvailableWeapons: ['Axe', 'GreatSword'],
    AvailableArmors: ['Leather', 'Metal'],
  },
  SpellRefactor: {
    MaxLevel: 180,
    Grade: 'Third',
    AvailableWeapons: ['Sword', 'Wand', 'Grimoire', 'Shield'],
    AvailableArmors: ['Leather', 'Metal'],
  },
  Guardian: {
    MaxLevel: 180,
    Grade: 'Third',
    AvailableWeapons: ['Sword', 'Spear'],
    AvailableArmors: ['Metal'],
  },
  Priest: {
    MaxLevel: 180,
    Grade: 'Third',
    AvailableWeapons: ['Wand'],
    AvailableArmors: ['Cloth'],
  },
  StellaShaft: {
    MaxLevel: 180,
    Grade: 'Third',
    AvailableWeapons: ['Bow'],
    AvailableArmors: ['Leather'],
  },
};

// ===== 職業名マッピング =====

const JOB_NAME_MAPPING: Record<string, string> = {
  Novice: '初心者',
  Fighter: 'ファイター',
  Acolyte: 'アコライト',
  Archer: 'アーチャー',
  Mage: 'メイジ',
  Cleric: 'クレリック',
  Hunter: 'ハンター',
  Ranger: 'レンジャー',
  Wizard: 'ウィザード',
  Knight: 'ナイト',
  Warrior: 'ウォーリア',
  SpellRefactor: 'スペルリファクター',
  Guardian: 'ガーディアン',
  Priest: 'プリースト',
  StellaShaft: 'ステラシャフト',
};

// ===== スキル定義（YAMLから抽出） =====

interface SkillDefinition {
  BaseDamageType: string[];
  Hits?: number | string;
  Damage?: string;
  Heal?: string;
  MP?: number | string;
  CT?: number | string;
  Buff?: Record<string, string>;
  Debuff?: Record<string, string>;
  Dot?: { Count: string; Damage: string };
  Duration?: number;
}

// 各職業のスキル定義
const JOB_SKILLS: Record<string, Record<string, SkillDefinition>> = {
  Fighter: {
    '烈刃の円斬撃': { BaseDamageType: ['Sword'], Hits: 5, Damage: 'BaseDamage.Sword * 0.4' },
    '常闇斬撃': { BaseDamageType: ['Sword'], Hits: 5.5, Damage: 'BaseDamage.Sword * 0.6' },
    'ファイアインパクト': { BaseDamageType: ['Sword'], Hits: 1, Damage: 'BaseDamage.Sword * 3.0' },
    'フックリターン': { BaseDamageType: [] },
    '鉄壁の心': { BaseDamageType: [], Buff: { HP: 'UserHP * 0.15' } },
    'リミット・ブレイク': { BaseDamageType: [], Buff: { Power: 'UserPower * 0.15', Dex: 'UserDex * 0.15', Defense: 'UserDefense * 0.15' } },
    '守護の鎧': { BaseDamageType: [], Buff: { Defense: 'UserDefense * 0.41' } },
  },
  Mage: {
    'イグナ': { BaseDamageType: ['Wand'], Hits: 2, Damage: '(BaseDamage.Wand + UserCritDamage * 5) * 0.5' },
    'イグナム': { BaseDamageType: ['Wand'], Hits: 2, Damage: '(BaseDamage.Wand + UserCritDamage * 5) * 0.4' },
    'イグナイト': { BaseDamageType: ['Wand'], Hits: 1, Damage: '(BaseDamage.Wand + UserCritDamage * 5) * 1.0' },
    'イグナイト2': { BaseDamageType: ['Wand'], Hits: 1, Damage: '(BaseDamage.Wand + UserCritDamage * 5) * 1.25' },
    'ウィンド': { BaseDamageType: ['Wand'], Hits: 3, Damage: '(BaseDamage.Wand + UserMind * 0.2) * 0.5' },
    'ウィンドラ': { BaseDamageType: ['Wand'], Hits: 5, Damage: '(BaseDamage.Wand + UserMind * 0.2) * 0.4' },
    'ウィンドバースト': { BaseDamageType: ['Wand'], Hits: 8, Damage: '(BaseDamage.Wand + UserMind * 0.2) * 0.4' },
    'ウィンドバースト2': { BaseDamageType: ['Wand'], Hits: 8, Damage: '(BaseDamage.Wand + UserMind * 0.2) * 0.65' },
    'アディショナル・スピリット': { BaseDamageType: [], Buff: { Mind: 'UserMind * 0.2 + 1' } },
  },
  Archer: {
    'アローレイン': { BaseDamageType: ['Bow'], Hits: 'variable', Damage: 'BaseDamage.Bow * 0.5' },
    '迅雷射': { BaseDamageType: ['Bow'], Hits: 12, Damage: 'BaseDamage.Bow * 0.4' },
    '迅雷射2': { BaseDamageType: ['Bow'], Hits: 14, Damage: 'BaseDamage.Bow * 0.4' },
    '剛腕の射手': { BaseDamageType: [], Buff: { CritPower: 'UserCritDamage * 0.4 + 1' } },
    'バレット・レーン': { BaseDamageType: ['Bow'], Hits: 5, Damage: 'BaseDamage.Bow * 0.6' },
    '足すくい': { BaseDamageType: [] },
    '鎧崩し': { BaseDamageType: [], Debuff: { Defense: 'TargetDefense * 0.2 + 1' } },
  },
  Acolyte: {
    'エリアヒール': { BaseDamageType: ['Wand'], Hits: 1, Heal: 'BaseDamage.Wand * 0.0675 + UserMagic*0.114 + UserHP*0.25' },
    'エリアヒール2': { BaseDamageType: ['Wand'], Hits: 1, Heal: '(BaseDamage.Wand * 0.0675 + UserMagic*0.114 + UserHP*0.25) * 1.2' },
    '守備の構え': { BaseDamageType: [], Buff: { PhysicalResist: '20' } },
    '守備の構え2': { BaseDamageType: [], Buff: { PhysicalResist: '20' } },
    '叡智の羽衣': { BaseDamageType: [], Buff: { Mind: 'UserMind * 0.2' } },
    'ホーリーディメンション': { BaseDamageType: ['Wand'], Hits: 1, Damage: 'BaseDamage.Wand * 3 + UserHP*3 + UserMind*2 + UserMagic*1' },
  },
  Warrior: {
    '烈刃の円斬撃3': { BaseDamageType: ['GreatSword', 'Axe'], Hits: 5, Damage: 'BaseDamage.GreatSword * 0.7' },
    '常闘斬撃2': { BaseDamageType: ['GreatSword', 'Axe'], Hits: 6, Damage: 'BaseDamage.GreatSword * 0.8' },
    '常闘斬撃4': { BaseDamageType: ['GreatSword', 'Axe'], Hits: 6, Damage: 'BaseDamage.GreatSword * 1.2' },
    '鎧崩し': { BaseDamageType: [], Debuff: { Defense: 'TargetDefense * 0.2 + 1' } },
    '鎧崩し2': { BaseDamageType: [], Debuff: { Defense: 'TargetDefense * 0.22 + 1' } },
    '鎧崩し4': { BaseDamageType: [], Debuff: { Defense: 'TargetDefense * 0.26 + 1' } },
    'フックリターン': { BaseDamageType: [] },
    '烈刃の円斬撃6': { BaseDamageType: ['GreatSword', 'Axe'], Hits: 5, Damage: 'BaseDamage.GreatSword * 1.15' },
    'アディショナル・スピリット8': { BaseDamageType: [], Buff: { Mind: 'UserMind * 0.55 + 1' } },
    'リミット・ブレイク2': { BaseDamageType: [], Buff: { Power: 'UserPower * 0.18', Dex: 'UserDex * 0.18', Defense: 'UserDefense * 0.18' } },
    '覇王の獄炎斬': { BaseDamageType: ['GreatSword', 'Axe'], Buff: { Power: 'UserPower * 0.157', Dex: 'UserDex * 0.157' } },
  },
  Knight: {
    '鉄壁の心3': { BaseDamageType: [], Hits: 1, Buff: { HP: 'UserHP * 0.19' } },
    'ナイトガード': { BaseDamageType: [] },
    '烈刃の円斬撃2': { BaseDamageType: ['Sword'], Hits: 5, Damage: 'BaseDamage.Sword * 0.55' },
    'セルフヒール2': { BaseDamageType: ['Bow'], Hits: 1, Heal: 'BaseDamage.Bow * 0.048 + UserHP*0.12 + UserMagic*0.08' },
    '烈刃の円斬撃3': { BaseDamageType: ['Sword'], Hits: 5, Damage: 'BaseDamage.Sword * 0.7' },
    '聖なる鉄槌': { BaseDamageType: ['Sword'], Hits: 5, Damage: 'BaseDamage.Sword * 0.5 + UserDefense*1.75 + UserPower*0.5 + UserHP*0.25' },
    'セルフヒール4': { BaseDamageType: ['Bow'], Hits: 1, Heal: '(BaseDamage.Bow * 0.048 + UserHP*0.12 + UserMagic*0.08) * 1.333' },
    '聖なる鉄槌2': { BaseDamageType: ['Sword'], Hits: 5, Damage: '(BaseDamage.Sword * 0.5 + UserDefense*1.75 + UserPower*0.5 + UserHP*0.25) * 1.1' },
  },
  Wizard: {
    'イグナ2': { BaseDamageType: ['Wand'], Hits: 2, Damage: '(BaseDamage.Wand + UserCritDamage * 5) * 0.65' },
    'イグナム2': { BaseDamageType: ['Wand'], Hits: 2, Damage: '(BaseDamage.Wand + UserCritDamage * 5) * 0.6' },
    'イグナイト2': { BaseDamageType: ['Wand'], Hits: 1, Damage: '(BaseDamage.Wand + UserCritDamage * 5) * 1.25' },
    'イグナイト3': { BaseDamageType: ['Wand'], Hits: 1, Damage: '(BaseDamage.Wand + UserCritDamage * 5) * 1.5' },
    'イグナイト・改': { BaseDamageType: ['Wand'], Hits: 1, Damage: '(BaseDamage.Wand + UserCritDamage * 5) * 2.5' },
    'ウィンド2': { BaseDamageType: ['Wand'], Hits: 3, Damage: '(BaseDamage.Wand + UserMind * 0.2) * 0.65' },
    'ウィンドラ2': { BaseDamageType: ['Wand'], Hits: 5, Damage: '(BaseDamage.Wand + UserMind * 0.2) * 0.6' },
    'ウィンドバースト2': { BaseDamageType: ['Wand'], Hits: 8, Damage: '(BaseDamage.Wand + UserMind * 0.2) * 0.65' },
    'ウィンドバースト3': { BaseDamageType: ['Wand'], Hits: 8, Damage: '(BaseDamage.Wand + UserMind * 0.2) * 0.9' },
    'ウィンドバースト・改': { BaseDamageType: ['Wand'], Hits: 8, Damage: '(BaseDamage.Wand + UserMind * 0.2) * 0.5' },
    'アディショナル・スピリット2': { BaseDamageType: [], Buff: { Mind: 'UserMind * 0.25 + 1' } },
    'アディショナル・スピリット3': { BaseDamageType: [], Buff: { Mind: 'UserMind * 0.3 + 1' } },
    'ノンエレメント・エクスプロード': { BaseDamageType: ['Wand'], Hits: 1, Damage: 'BaseDamage.Wand * UserMind*2 * 0.03115' },
    'ノンエレメント・エクスプロード2': { BaseDamageType: ['Wand'], Hits: 1, Damage: 'BaseDamage.Wand * UserMind*2 * 0.03185' },
    'ノンエレメント・エクスプロード・烈': { BaseDamageType: ['Wand'], Hits: 1, Damage: '(BaseDamage.Wand + UserMind * 2 * 5) * 3.2' },
  },
  Ranger: {
    'アローレイン2': { BaseDamageType: ['Bow'], Hits: 'variable', Damage: 'BaseDamage.Bow * 0.5' },
    '迅雷射3': { BaseDamageType: ['Bow'], Hits: 16, Damage: 'BaseDamage.Bow * 0.4' },
    '風神射': { BaseDamageType: ['Bow'], Hits: 12, Damage: 'BaseDamage.Bow * 0.45' },
    '風神射2': { BaseDamageType: ['Bow'], Hits: 14, Damage: 'BaseDamage.Bow * 0.45' },
    '剛腕の射手2': { BaseDamageType: [], Buff: { CritPower: 'UserCritDamage * 0.45 + 1' } },
    'バレット・レーン2': { BaseDamageType: ['Bow'], Hits: 7, Damage: 'BaseDamage.Bow * 0.6' },
    'マリーナ・レーン': { BaseDamageType: ['Bow'], Hits: '6 + floor(UserSpeed/50)', Damage: 'BaseDamage.Bow * 0.6' },
    'マリーナ・レーン2': { BaseDamageType: ['Bow'], Hits: '8 + floor(UserSpeed/50)', Damage: 'BaseDamage.Bow * 0.6' },
  },
  Hunter: {
    '疾風連撃': { BaseDamageType: ['Dagger'], Hits: 4, Damage: '(BaseDamage.Dagger + UserSpeed * 0.5) * 0.6' },
    '水流連撃': { BaseDamageType: ['Dagger'], Hits: 4, Damage: '(BaseDamage.Dagger + UserSpeed * 0.5) * 0.6' },
    '水流連撃2': { BaseDamageType: ['Dagger'], Hits: 4, Damage: '(BaseDamage.Dagger + UserSpeed * 0.5) * 0.65' },
    'サンライトスラッシュ': { BaseDamageType: ['Dagger'], Hits: 6, Damage: '(BaseDamage.Dagger + UserSpeed * 0.5) * 0.65' },
    '鎧崩し': { BaseDamageType: [], Debuff: { Defense: 'TargetDefense * 0.2 + 1' } },
    '鎧崩し2': { BaseDamageType: [], Debuff: { Defense: 'TargetDefense * 0.22 + 1' } },
    '鎧崩し4': { BaseDamageType: [], Debuff: { Defense: 'TargetDefense * 0.26 + 1' } },
    '疾風の舞3': { BaseDamageType: [], Buff: { Power: 'UserPower * 0.499 + 1', Speed: 'UserSpeed * 0.499 + 1', CritPower: 'UserCritDamage * 0.499 + 1' } },
  },
  SpellRefactor: {
    'ウィンドバースト・改': { BaseDamageType: ['Sword', 'Wand'], Hits: 8, Damage: '(BaseDamage.Sword + UserMind*0.2)*0.5' },
    'ウィンドバースト・改2': { BaseDamageType: ['Sword', 'Wand'], Hits: 8, Damage: '(BaseDamage.Sword + UserMind*0.2)*0.75' },
  },
  StellaShaft: {
    'シャイニングアロー': { BaseDamageType: ['Bow'], Hits: 5, Damage: 'Round(BaseDamage.Bow + UserSpeed*13,-1)' },
    'シャイニングアロー2': { BaseDamageType: ['Bow'], Hits: 5, Damage: 'Round((BaseDamage.Bow + UserSpeed*13)*1.25,-1)' },
  },
  Priest: {
    '女神の神弓': { BaseDamageType: ['Wand'], Hits: 11, Heal: 'Round(Round((BaseDamage.Wand / 65) + (UserMagic / 55) + (UserHP / 18)) * 2.05)' },
  },
  Novice: {
    '応急手当': { BaseDamageType: [], Hits: 1, Heal: 'UserHP * 0.3' },
    '戦闘態勢': { BaseDamageType: [], Buff: { HP: 'UserHP * 0.05', Power: 'UserPower * 0.05', Magic: 'UserMagic * 0.05' } },
    'なぎはらい': { BaseDamageType: ['Sword'], Hits: 1, Damage: 'BaseDamage.Sword * 1.3' },
    'ぶんまわし': { BaseDamageType: ['Bow'], Hits: 1, Damage: 'BaseDamage.Bow * 1.4' },
    'ファイア': { BaseDamageType: ['Sword', 'Bow', 'Wand', 'Spear'], Hits: 1, Damage: 'BaseDamage.Sword * 1.3' },
    'アイス': { BaseDamageType: ['Wand'], Hits: 1, Damage: 'BaseDamage.Wand * 1.3' },
  },
};

// スキルブック定義
const SKILL_BOOKS: Record<string, Record<string, SkillDefinition>> = {
  Sword: {
    '斬撃波': { BaseDamageType: ['Sword'], Hits: 1, Damage: 'BaseDamage.Sword * 1.0' },
    '火炎斬': { BaseDamageType: ['Sword'], Hits: 1, Damage: 'BaseDamage.Sword * 1.0' },
    '斬撃波・改': { BaseDamageType: ['Sword'], Hits: 1, Damage: 'BaseDamage.Sword * ((<Level> + 2) * 0.1)' },
  },
  Wand: {
    'フェアリースイフト': { BaseDamageType: ['Wand'], Hits: 1, Damage: 'BaseDamage.Wand * 1.0' },
    'ウォルタ': { BaseDamageType: ['Wand'], Hits: 1, Damage: 'BaseDamage.Wand * 1.0' },
  },
  Bow: {
    'ブラッドショット': { BaseDamageType: ['Bow'], Hits: 1, Damage: 'Round((BaseDamage.Bow + UserSpeed*40) * (2.05 + <Level> * 0.2),-1)' },
  },
  GreatSword: {
    '斬撃波(大剣)': { BaseDamageType: ['GreatSword'], Hits: 1, Damage: 'BaseDamage.GreatSword * ((<Level> + 2) * 0.1)' },
  },
  Dagger: {
    '連撃・覇': { BaseDamageType: ['Dagger'], Hits: 1, Damage: 'BaseDamage.Dagger * (<Level> + 13) * 0.05 + UserSpeed * 0.5' },
    '鏡喪斬': { BaseDamageType: ['Dagger'], Hits: 1, Damage: 'BaseDamage.Dagger * (<Level> + 39) * 0.02' },
  },
};

// ===== 式解析 =====

const STAT_VAR_MAPPING: Record<string, InternalStatKey> = {
  'UserPower': 'Power',
  'UserMagic': 'Magic',
  'UserHP': 'HP',
  'UserMind': 'Mind',
  'UserSpeed': 'Agility',
  'UserAgility': 'Agility',
  'UserDex': 'Dex',
  'UserCritDamage': 'CritDamage',
  'UserDefense': 'Defense',
};

/**
 * 式から変数と係数を抽出
 */
function extractCoefficientsFromFormula(formula: string): Record<InternalStatKey, number> {
  const result: Partial<Record<InternalStatKey, number>> = {};

  if (!formula || typeof formula !== 'string') return result as any;

  // パターン1: UserXxx*数値 or UserXxx * 数値
  const pattern1 = /User([A-Za-z]+)\s*\*\s*(\d+(?:\.\d+)?)/g;
  // パターン2: 数値*UserXxx or 数値 * UserXxx
  const pattern2 = /(\d+(?:\.\d+)?)\s*\*\s*User([A-Za-z]+)/g;

  let match;
  while ((match = pattern1.exec(formula)) !== null) {
    const varName = 'User' + match[1];
    const statKey = STAT_VAR_MAPPING[varName];
    if (statKey) {
      const coeff = parseFloat(match[2]);
      result[statKey] = Math.max(result[statKey] || 0, coeff);
    }
  }

  while ((match = pattern2.exec(formula)) !== null) {
    const varName = 'User' + match[2];
    const statKey = STAT_VAR_MAPPING[varName];
    if (statKey) {
      const coeff = parseFloat(match[1]);
      result[statKey] = Math.max(result[statKey] || 0, coeff);
    }
  }

  return result as any;
}

/**
 * スキル定義からSkillStatMappingを生成
 */
function createSkillStatMapping(
  skillName: string,
  def: SkillDefinition,
  jobName?: string
): SkillStatMapping {
  const weights: StatWeight[] = [];
  const coeffMap = new Map<InternalStatKey, number>();

  // 1. BaseDamage依存
  for (const weaponType of def.BaseDamageType) {
    const weaponCoeffs = WEAPON_BASE_DAMAGE_COEFFICIENTS[weaponType];
    if (weaponCoeffs) {
      for (const [stat, coeff] of Object.entries(weaponCoeffs)) {
        if (coeff > 0) {
          const current = coeffMap.get(stat as InternalStatKey) || 0;
          coeffMap.set(stat as InternalStatKey, Math.max(current, coeff));
        }
      }
    }
  }

  // 2. Damage式からの追加依存
  if (def.Damage) {
    const damageCoeffs = extractCoefficientsFromFormula(def.Damage);
    for (const [stat, coeff] of Object.entries(damageCoeffs)) {
      if (coeff > 0) {
        const current = coeffMap.get(stat as InternalStatKey) || 0;
        coeffMap.set(stat as InternalStatKey, current + coeff);
      }
    }
  }

  // 3. Heal式からの追加依存
  if (def.Heal) {
    const healCoeffs = extractCoefficientsFromFormula(def.Heal);
    for (const [stat, coeff] of Object.entries(healCoeffs)) {
      if (coeff > 0) {
        const current = coeffMap.get(stat as InternalStatKey) || 0;
        coeffMap.set(stat as InternalStatKey, current + coeff);
      }
    }
  }

  // 4. 職業バフ依存
  if (jobName && JOB_BUFF_DEPENDENCIES[jobName]) {
    for (const { stat, coefficient } of JOB_BUFF_DEPENDENCIES[jobName]) {
      const current = coeffMap.get(stat) || 0;
      coeffMap.set(stat, current + coefficient);
    }
  }

  // 正規化
  let totalCoeff = 0;
  coeffMap.forEach((coeff) => {
    totalCoeff += coeff;
  });

  coeffMap.forEach((coeff, stat) => {
    weights.push({
      stat,
      coefficient: coeff,
      normalizedWeight: totalCoeff > 0 ? coeff / totalCoeff : 0,
      source: def.Damage || def.Heal ? 'skill' : 'baseDamage',
    });
  });

  // 係数順でソート
  weights.sort((a, b) => b.coefficient - a.coefficient);

  return {
    skillId: skillName,
    skillName,
    baseDamageTypes: def.BaseDamageType,
    weights,
    hits: def.Hits ?? 1,
    mp: def.MP,
    coolTime: def.CT,
    hasBuff: !!(def.Buff || def.Debuff),
    isHeal: !!def.Heal,
  };
}

// ===== マッピングデータ生成 =====

/**
 * 全職業×スキルのマッピングデータを生成
 */
export function generateStatWeightMapping(): StatWeightMappingData {
  const weaponBaseDamage: WeaponBaseDamageMapping[] = [];
  const jobMappings: JobSkillMapping[] = [];
  const skillBooks: SkillBookMapping[] = [];

  // 1. 武器基礎ダメージマッピング
  for (const [weaponType, coeffs] of Object.entries(WEAPON_BASE_DAMAGE_COEFFICIENTS)) {
    const weights = getWeaponBaseDamageStats(weaponType);
    const critCoeff = coeffs.CritDamage || 0;

    weaponBaseDamage.push({
      weaponType,
      weights,
      attackPowerCoeff: 1.0,  // 武器攻撃力は常に1.0として扱う
      critDamageCoeff: critCoeff,
    });
  }

  // 2. 職業スキルマッピング
  for (const [jobNameYaml, jobDef] of Object.entries(JOB_DEFINITIONS)) {
    const skills: SkillStatMapping[] = [];
    const basicAttack: Record<string, SkillStatMapping> = {};

    // 利用可能武器を取得（'All'の場合は全武器種）
    const availableWeapons = jobDef.AvailableWeapons.includes('All')
      ? Object.keys(WEAPON_BASE_DAMAGE_COEFFICIENTS)
      : jobDef.AvailableWeapons;

    // 通常攻撃（武器種別）
    for (const weaponType of availableWeapons) {
      const weights = getWeaponBaseDamageStats(weaponType);

      // 職業バフ依存を追加
      if (JOB_BUFF_DEPENDENCIES[jobNameYaml]) {
        for (const { stat, coefficient } of JOB_BUFF_DEPENDENCIES[jobNameYaml]) {
          const existing = weights.find(w => w.stat === stat);
          if (existing) {
            existing.coefficient += coefficient;
          } else {
            weights.push({
              stat,
              coefficient,
              normalizedWeight: 0,
              source: 'jobBonus',
            });
          }
        }

        // 再正規化
        let totalCoeff = 0;
        for (const w of weights) {
          totalCoeff += w.coefficient;
        }
        for (const w of weights) {
          w.normalizedWeight = totalCoeff > 0 ? w.coefficient / totalCoeff : 0;
        }
        weights.sort((a, b) => b.coefficient - a.coefficient);
      }

      basicAttack[weaponType] = {
        skillId: `basic_attack_${weaponType}`,
        skillName: '通常攻撃',
        baseDamageTypes: [weaponType],
        weights,
        hits: 1,
        hasBuff: false,
        isHeal: false,
      };
    }

    // 職業スキル
    const jobSkillDefs = JOB_SKILLS[jobNameYaml] || {};
    for (const [skillName, skillDef] of Object.entries(jobSkillDefs)) {
      skills.push(createSkillStatMapping(skillName, skillDef, jobNameYaml));
    }

    // 職業ボーナス情報
    let jobBonus: JobSkillMapping['jobBonus'] | undefined;
    if (JOB_BUFF_DEPENDENCIES[jobNameYaml]) {
      const deps = JOB_BUFF_DEPENDENCIES[jobNameYaml];
      jobBonus = {
        description: jobNameYaml === 'SpellRefactor'
          ? '力と魔力の比率に応じたダメージボーナス'
          : `${deps.map(d => d.stat).join(', ')}に応じたボーナス`,
        affectedStats: deps.map(d => d.stat),
      };
    }

    jobMappings.push({
      jobNameYaml,
      jobNameJa: JOB_NAME_MAPPING[jobNameYaml] || jobNameYaml,
      grade: jobDef.Grade,
      availableWeapons: availableWeapons,
      availableArmors: jobDef.AvailableArmors,
      jobBonus,
      basicAttack,
      skills,
    });
  }

  // 3. スキルブックマッピング
  for (const [weaponType, skills] of Object.entries(SKILL_BOOKS)) {
    const skillMappings: SkillStatMapping[] = [];

    for (const [skillName, skillDef] of Object.entries(skills)) {
      skillMappings.push(createSkillStatMapping(skillName, skillDef));
    }

    skillBooks.push({
      weaponType,
      skills: skillMappings,
    });
  }

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    weaponBaseDamage,
    jobMappings,
    skillBooks,
  };
}

// ===== キャッシュとアクセサ =====

let cachedMapping: StatWeightMappingData | null = null;

/**
 * マッピングデータを取得（キャッシュ済み）
 */
export function getStatWeightMapping(): StatWeightMappingData {
  if (!cachedMapping) {
    cachedMapping = generateStatWeightMapping();
  }
  return cachedMapping;
}

/**
 * 職業のスキルマッピングを取得
 */
export function getJobSkillMapping(jobName: string): JobSkillMapping | undefined {
  const mapping = getStatWeightMapping();
  return mapping.jobMappings.find(
    jm => jm.jobNameYaml === jobName || jm.jobNameJa === jobName
  );
}

/**
 * スキルのステータス重みを取得
 * @param jobName 職業名
 * @param skillName スキル名
 * @param weaponType 武器種（通常攻撃の場合）
 */
export function getSkillWeights(
  jobName: string,
  skillName: string,
  weaponType?: string
): StatWeight[] {
  const jobMapping = getJobSkillMapping(jobName);
  if (!jobMapping) return [];

  // 通常攻撃
  if ((skillName === '通常攻撃' || skillName === 'basic_attack' || skillName === 'normal_attack') && weaponType) {
    const basicAttack = jobMapping.basicAttack[weaponType];
    return basicAttack?.weights || [];
  }

  // 職業スキル
  const skill = jobMapping.skills.find(s => s.skillName === skillName || s.skillId === skillName);
  if (skill) return skill.weights;

  // スキルブックから検索
  const mapping = getStatWeightMapping();
  for (const book of mapping.skillBooks) {
    const bookSkill = book.skills.find(s => s.skillName === skillName);
    if (bookSkill) return bookSkill.weights;
  }

  return [];
}

/**
 * EX選択の推奨順位を取得
 */
export function getRecommendedEXOrder(
  jobName: string,
  skillName: string,
  slotType: 'armor' | 'accessory',
  weaponType?: string
): string[] {
  const weights = getSkillWeights(jobName, skillName, weaponType);

  // EXで選択可能なステータス（定数から参照）
  const availableTypes = [...AVAILABLE_EX_TYPES];

  // ステータス → EXタイプ
  const statToEx: Record<string, string> = {
    'Power': 'Power',
    'Magic': 'Magic',
    'HP': 'HP',
    'Mind': 'Mind',
    'Agility': 'Speed',
    'Dex': 'Dex',
    'CritDamage': 'CritDamage',
    'Defense': 'Defense',
  };

  // 重みでソート
  const prioritized: { exType: string; weight: number }[] = availableTypes.map(exType => {
    let totalWeight = 0;
    for (const w of weights) {
      if (statToEx[w.stat] === exType) {
        totalWeight += w.normalizedWeight;
      }
    }
    return { exType, weight: totalWeight };
  });

  prioritized.sort((a, b) => b.weight - a.weight);

  return prioritized.map(p => p.exType);
}

// デバッグ用エクスポート
export { JOB_DEFINITIONS, JOB_SKILLS, SKILL_BOOKS };
