import {
  StatBlock,
  SkillResult,
  WeaponStats,
  WeaponType
} from '@/types/calc';
import { SkillCalcData } from '@/types/data';
import { evaluateFormula } from './formulaEvaluator';
import { calcBaseDamage } from './weaponDamage';

/**
 * スキルダメージ計算
 * @param skillName - スキル名
 * @param skillLevel - スキルレベル
 * @param baseDamage - 武器の基礎ダメージ
 * @param weaponStats - 武器ステータス
 * @param userStats - ユーザーステータス
 * @param skillCalc - スキル計算データ
 * @param weaponType - 武器種別（オプション）
 * @returns スキル計算結果
 */
export function calcSkillDamage(
  skillName: string,
  skillLevel: number,
  baseDamage: number,
  weaponStats: WeaponStats,
  userStats: StatBlock,
  skillCalc: SkillCalcData,
  weaponType?: WeaponType
): SkillResult {
  // スキルデータを検索（階層構造に対応）
  const skillData = findSkillData(skillCalc, skillName);

  if (!skillData) {
    console.warn(`Skill data not found for: ${skillName}`);
    return {
      damage: 0,
      hits: 1,
      totalDamage: 0,
      mp: 0,
      ct: 0
    };
  }

  // 変数の準備
  const variables: Record<string, number> = {
    // スキルレベル
    Level: skillLevel,

    // 基礎ダメージ（武器種別ごと）
    BaseDamage: baseDamage,
    'BaseDamage.Sword': baseDamage,
    'BaseDamage.GreatSword': baseDamage,
    'BaseDamage.Dagger': baseDamage,
    'BaseDamage.Axe': baseDamage,
    'BaseDamage.Spear': baseDamage,
    'BaseDamage.Bow': baseDamage,
    'BaseDamage.Wand': baseDamage,
    'BaseDamage.Mace': baseDamage,

    // 武器ステータス
    WeaponAttackPower: weaponStats.attackPower || 0,
    WeaponMagicPower: weaponStats.magicPower || 0,
    WeaponCritRate: (weaponStats as any).critRate || 0,
    WeaponCritDamage: (weaponStats as any).critDamage || 0,

    // ユーザーステータス
    UserPower: userStats.ATK || 0,
    UserMagic: userStats.MATK || 0,
    UserDefense: userStats.DEF || 0,
    UserMind: userStats.MDEF || 0,
    UserHP: userStats.HP || 0,
    UserMP: userStats.MP || 0,
    UserAgility: userStats.AGI || 0,
    UserDex: userStats.DEX || 0,
    UserLuck: userStats.LUK || 0,
    UserCritDamage: userStats.CRI || 0,
    UserHit: userStats.HIT || 0,
    UserFlee: userStats.FLEE || 0,

    // その他の要素（必要に応じて追加）
    AgilityFactor: 1.5 // デフォルト値
  };

  // ダメージ計算
  let damage = 0;
  if (skillData.Damage || skillData.damage) {
    const damageFormula = skillData.Damage || skillData.damage;
    if (damageFormula && damageFormula !== 'null') {
      try {
        damage = evaluateFormula(damageFormula, variables);
        damage = Math.max(0, Math.floor(damage));
      } catch (error) {
        console.error(`Failed to calculate damage for ${skillName}:`, error);
      }
    } else {
      // ダメージ式がない場合は基礎ダメージをそのまま使用
      damage = baseDamage;
    }
  } else if (skillData.Extra?.BleedDamage) {
    // 特殊ダメージ（BloodShot等）
    try {
      damage = evaluateFormula(skillData.Extra.BleedDamage, variables);
      damage = Math.max(0, Math.floor(damage));
    } catch (error) {
      console.error(`Failed to calculate special damage for ${skillName}:`, error);
    }
  } else {
    // ダメージ指定がない場合は基礎ダメージを使用
    damage = baseDamage;
  }

  // ヒット数計算
  let hits = 1;
  if (skillData.Hits || skillData.hits) {
    const hitsValue = skillData.Hits || skillData.hits;
    if (typeof hitsValue === 'string') {
      try {
        hits = Math.max(1, Math.floor(evaluateFormula(hitsValue, variables)));
      } catch {
        hits = 1;
      }
    } else if (typeof hitsValue === 'number') {
      hits = hitsValue;
    }
  }

  // MP消費計算
  let mp = 0;
  if (skillData.MP || skillData.mp) {
    const mpFormula = skillData.MP || skillData.mp;
    if (mpFormula && mpFormula !== 'null') {
      try {
        mp = Math.max(0, Math.floor(evaluateFormula(mpFormula, variables)));
      } catch (error) {
        console.error(`Failed to calculate MP cost for ${skillName}:`, error);
      }
    }
  }

  // クールタイム計算
  let ct = 0;
  if (skillData.CT || skillData.ct) {
    const ctFormula = skillData.CT || skillData.ct;
    if (ctFormula && ctFormula !== 'null') {
      try {
        ct = Math.max(0, evaluateFormula(ctFormula, variables));
      } catch (error) {
        console.error(`Failed to calculate cooldown for ${skillName}:`, error);
      }
    }
  }

  // 合計ダメージ
  const totalDamage = damage * hits;

  return {
    damage,
    hits,
    totalDamage,
    mp,
    ct
  };
}

/**
 * スキルデータを階層構造から検索
 * @param skillCalc - スキル計算データ
 * @param skillName - スキル名
 * @returns スキルデータ
 */
function findSkillData(skillCalc: SkillCalcData, skillName: string): any {
  // 直接検索（型アサーション使用）
  if ((skillCalc as any)[skillName]) {
    return (skillCalc as any)[skillName];
  }

  // SkillDefinition内を検索
  if (skillCalc.SkillDefinition) {
    const definition = skillCalc.SkillDefinition;

    // SkillBook内を検索
    if (definition.SkillBook) {
      for (const weaponCategory of Object.values(definition.SkillBook)) {
        if (weaponCategory[skillName]) {
          return weaponCategory[skillName];
        }
      }
    }

    // 他のカテゴリも検索（Job、Master等）
    for (const category of Object.values(definition)) {
      if (typeof category === 'object' && category !== null) {
        const cat = category as Record<string, unknown>;
        if (cat[skillName]) {
          return cat[skillName];
        }
        // さらに深い階層を検索
        for (const subCategory of Object.values(cat)) {
          if (typeof subCategory === 'object' && subCategory !== null) {
            const subCat = subCategory as Record<string, unknown>;
            if (subCat[skillName]) {
              return subCat[skillName];
            }
          }
        }
      }
    }
  }

  return null;
}

/**
 * スキルの詳細情報を取得
 * @param skillName - スキル名
 * @param skillLevel - スキルレベル
 * @param skillCalc - スキル計算データ
 * @returns スキルの詳細情報
 */
export function getSkillInfo(
  skillName: string,
  skillLevel: number,
  skillCalc: SkillCalcData
): {
  name: string;
  level: number;
  hasCustomDamage: boolean;
  hasMP: boolean;
  hasCT: boolean;
  category?: string;
  weaponType?: string;
} {
  const skillData = findSkillData(skillCalc, skillName);

  if (!skillData) {
    return {
      name: skillName,
      level: skillLevel,
      hasCustomDamage: false,
      hasMP: false,
      hasCT: false
    };
  }

  // カテゴリを特定
  let category: string | undefined;
  let weaponType: string | undefined;

  if (skillCalc.SkillDefinition?.SkillBook) {
    for (const [weapon, skills] of Object.entries(skillCalc.SkillDefinition.SkillBook)) {
      if (skills[skillName]) {
        category = 'SkillBook';
        weaponType = weapon;
        break;
      }
    }
  }

  return {
    name: skillName,
    level: skillLevel,
    hasCustomDamage: !!(skillData.Damage || skillData.damage || skillData.Extra?.BleedDamage),
    hasMP: !!(skillData.MP || skillData.mp),
    hasCT: !!(skillData.CT || skillData.ct),
    category,
    weaponType
  };
}

/**
 * 複数スキルの合計ダメージ計算
 * @param skills - スキル配列
 * @param baseDamage - 基礎ダメージ
 * @param weaponStats - 武器ステータス
 * @param userStats - ユーザーステータス
 * @param skillCalc - スキル計算データ
 * @returns 合計ダメージと消費MP
 */
export function calcMultiSkillDamage(
  skills: Array<{ name: string; level: number }>,
  baseDamage: number,
  weaponStats: WeaponStats,
  userStats: StatBlock,
  skillCalc: SkillCalcData
): {
  totalDamage: number;
  totalMP: number;
  details: SkillResult[];
} {
  let totalDamage = 0;
  let totalMP = 0;
  const details: SkillResult[] = [];

  for (const skill of skills) {
    const result = calcSkillDamage(
      skill.name,
      skill.level,
      baseDamage,
      weaponStats,
      userStats,
      skillCalc
    );

    totalDamage += result.totalDamage;
    totalMP += result.mp;
    details.push(result);
  }

  return {
    totalDamage,
    totalMP,
    details
  };
}

/**
 * スキルダメージの期待値計算（クリティカル考慮）
 * @param skillResult - スキル計算結果
 * @param critRate - クリティカル率（%）
 * @param critDamageBonus - クリティカルダメージボーナス（%）
 * @returns 期待ダメージ
 */
export function calcExpectedSkillDamage(
  skillResult: SkillResult,
  critRate: number,
  critDamageBonus: number
): number {
  const normalDamage = skillResult.totalDamage;
  const criticalDamage = normalDamage * (1.5 + critDamageBonus / 100);

  // 期待値 = 通常ダメージ * (1 - クリティカル率) + クリティカルダメージ * クリティカル率
  const critChance = Math.min(100, Math.max(0, critRate)) / 100;
  const expectedDamage = normalDamage * (1 - critChance) + criticalDamage * critChance;

  return Math.floor(expectedDamage);
}