import {
  WeaponStats,
  StatBlock,
  WeaponType
} from '@/types/calc';
import { WeaponCalcData } from '@/types/data';
import { evaluateFormula } from './formulaEvaluator';
import { getWeaponCalcKey } from './placeholderMapping';

/**
 * 武器基礎ダメージ計算
 * @param weaponType - 武器種別
 * @param weaponStats - 武器ステータス
 * @param userStats - ユーザーステータス
 * @param weaponCalc - 武器計算データ
 * @param damageCorrection - ダメージ補正（デフォルト: 1）
 * @param comboCorrection - コンボ補正（デフォルト: 1）
 * @returns 基礎ダメージ
 */
export function calcBaseDamage(
  weaponType: WeaponType,
  weaponStats: WeaponStats,
  userStats: StatBlock,
  weaponCalc: WeaponCalcData,
  damageCorrection: number = 1,
  comboCorrection: number = 1
): number {
  // 武器種別に対応する計算式を取得（getWeaponCalcKeyでYAMLキーに変換）
  const weaponTypeKey = getWeaponCalcKey(weaponType);
  const formula = weaponCalc.BasedDamage?.[weaponTypeKey];

  if (!formula) {
    console.warn(`No damage formula found for weapon type: ${weaponType}`);
    return 0;
  }

  // 変数の準備
  const variables: Record<string, number> = {
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
    UserCritDamage: userStats.HIT || 0,  // UIではCritDamage(撃力)がHITにマップされている
    UserHit: userStats.HIT || 0,
    UserFlee: userStats.FLEE || 0,

    // 補正値
    DamageCorrection: damageCorrection,
    ComboCorrection: comboCorrection
  };

  try {
    // デバッグログ
    console.log('[calcBaseDamage] weaponType:', weaponType, 'weaponTypeKey:', weaponTypeKey);
    console.log('[calcBaseDamage] Variables:', {
      WeaponAttackPower: variables.WeaponAttackPower,
      UserPower: variables.UserPower,
      WeaponCritDamage: variables.WeaponCritDamage,
      UserCritDamage: variables.UserCritDamage,
      DamageCorrection: variables.DamageCorrection,
      formula: formula
    });
    const damage = evaluateFormula(formula, variables);
    console.log('[calcBaseDamage] Result:', damage);
    return Math.max(0, Math.floor(damage));
  } catch (error) {
    console.error(`Failed to calculate base damage for ${weaponType}:`, error);
    return 0;
  }
}

/**
 * 職業補正を適用したダメージ計算
 * @param baseDamage - 基礎ダメージ
 * @param job - 職業名
 * @param weaponType - 武器種別
 * @param weaponStats - 武器ステータス
 * @param userStats - ユーザーステータス
 * @param weaponCalc - 武器計算データ
 * @param damageCorrection - ダメージ補正
 * @returns 職業補正適用後のダメージ
 */
export function applyJobCorrection(
  baseDamage: number,
  job: string,
  weaponType: WeaponType,
  weaponStats: WeaponStats,
  userStats: StatBlock,
  weaponCalc: WeaponCalcData,
  damageCorrection: number = 1
): number {
  // 職業による補正式があるか確認
  const jobCorrection = weaponCalc.JobCorrection?.[job];
  if (!jobCorrection) {
    return baseDamage; // 補正なし
  }

  const weaponTypeKey = getWeaponCalcKey(weaponType);
  const formula = jobCorrection[weaponTypeKey];

  if (!formula) {
    // Bonus式がある場合は基礎ダメージに係数を掛ける
    if (jobCorrection.Bonus) {
      const bonusFormula = jobCorrection.Bonus;
      const variables: Record<string, number> = {
        UserPower: userStats.ATK || 1,
        UserMagic: userStats.MATK || 1,
        UserDefense: userStats.DEF || 0,
        UserMind: userStats.MDEF || 0,
        UserHP: userStats.HP || 0,
        UserAgility: userStats.AGI || 0,
        UserDex: userStats.DEX || 0,
        UserCritDamage: userStats.HIT || 0,
      };

      try {
        const bonusMultiplier = evaluateFormula(bonusFormula, variables);
        return Math.floor(baseDamage * bonusMultiplier);
      } catch (error) {
        console.error(`Failed to apply ${job} bonus:`, error);
      }
    }

    return baseDamage;
  }

  // 職業補正式で再計算
  const variables: Record<string, number> = {
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
    UserCritDamage: userStats.HIT || 0,  // UIではCritDamage(撃力)がHITにマップされている
    UserHit: userStats.HIT || 0,
    UserFlee: userStats.FLEE || 0,

    // 補正値
    DamageCorrection: damageCorrection
  };

  try {
    const correctedDamage = evaluateFormula(formula, variables);
    return Math.max(0, Math.floor(correctedDamage));
  } catch (error) {
    console.error(`Failed to apply job correction for ${job}:`, error);
    return baseDamage;
  }
}

/** デフォルトの最終ダメージ計算式（YAMLから読み込めない場合のフォールバック） */
const DEFAULT_FINAL_DAMAGE_FORMULA = "(HitDamage-(EnemyDefence/2))*(1-(EnemyTypeResistance/100))*(1-(EnemyAttributeResistance/100))";

/**
 * 最終ダメージ計算（敵の防御・耐性考慮）
 * WeaponCalc.yamlのFinalDamage式を使用
 *
 * @param hitDamage - ヒットダメージ
 * @param enemyDefence - 敵の防御力
 * @param typeResist - タイプ耐性（%）
 * @param attrResist - 属性耐性（%）
 * @param weaponCalc - 武器計算データ（オプション、指定時はYAMLの式を使用）
 * @returns 最終ダメージ
 */
export function calcFinalDamage(
  hitDamage: number,
  enemyDefence: number,
  typeResist: number,
  attrResist: number,
  weaponCalc?: WeaponCalcData
): number {
  const variables = {
    HitDamage: hitDamage,
    EnemyDefence: enemyDefence,
    EnemyTypeResistance: typeResist,
    EnemyAttributeResistance: attrResist
  };

  // YAMLから式を取得、なければデフォルト式を使用
  const formula = weaponCalc?.FinalDamage || DEFAULT_FINAL_DAMAGE_FORMULA;

  try {
    const finalDamage = evaluateFormula(formula, variables);
    return Math.max(1, Math.floor(finalDamage)); // 最小1ダメージを保証
  } catch (error) {
    console.error('Failed to calculate final damage:', error);
    return 1;
  }
}

/**
 * 完全な武器ダメージ計算（基礎→職業補正→最終）
 * @param weaponType - 武器種別
 * @param weaponStats - 武器ステータス
 * @param userStats - ユーザーステータス
 * @param job - 職業名
 * @param enemyDefence - 敵の防御力
 * @param typeResist - タイプ耐性
 * @param attrResist - 属性耐性
 * @param weaponCalc - 武器計算データ
 * @param damageCorrection - ダメージ補正
 * @param comboCorrection - コンボ補正
 * @returns ダメージ計算結果
 */
export function calcWeaponDamage(
  weaponType: WeaponType,
  weaponStats: WeaponStats,
  userStats: StatBlock,
  job: string,
  enemyDefence: number,
  typeResist: number,
  attrResist: number,
  weaponCalc: WeaponCalcData,
  damageCorrection: number = 1,
  comboCorrection: number = 1
): {
  baseDamage: number;
  jobCorrectedDamage: number;
  finalDamage: number;
} {
  // 基礎ダメージ計算
  const baseDamage = calcBaseDamage(
    weaponType,
    weaponStats,
    userStats,
    weaponCalc,
    damageCorrection,
    comboCorrection
  );

  // 職業補正適用
  const jobCorrectedDamage = applyJobCorrection(
    baseDamage,
    job,
    weaponType,
    weaponStats,
    userStats,
    weaponCalc,
    damageCorrection
  );

  // 最終ダメージ計算（YAMLの式を使用）
  const finalDamage = calcFinalDamage(
    jobCorrectedDamage,
    enemyDefence,
    typeResist,
    attrResist,
    weaponCalc
  );

  return {
    baseDamage,
    jobCorrectedDamage,
    finalDamage
  };
}

/**
 * クリティカルダメージ計算
 * @param baseDamage - 基礎ダメージ
 * @param critRate - クリティカル率（%）
 * @param critDamageBonus - クリティカルダメージボーナス（%）
 * @returns クリティカル時のダメージ
 */
export function calcCriticalDamage(
  baseDamage: number,
  critRate: number,
  critDamageBonus: number
): {
  damage: number;
  isCritical: boolean;
} {
  // クリティカル判定（実装時にはランダム要素を追加）
  const randomValue = Math.random() * 100;
  const isCritical = randomValue < critRate;

  if (isCritical) {
    // クリティカル時は基礎ダメージにクリティカルダメージボーナスを適用
    const damage = Math.floor(baseDamage * (1.5 + critDamageBonus / 100));
    return { damage, isCritical };
  }

  return { damage: baseDamage, isCritical };
}

/**
 * 命中判定
 * @param userHit - ユーザーの命中
 * @param enemyFlee - 敵の回避
 * @returns 命中したかどうか
 */
export function checkHit(userHit: number, enemyFlee: number): boolean {
  // 命中率計算（簡易版）
  const hitRate = Math.max(5, Math.min(95, 80 + userHit - enemyFlee));
  const randomValue = Math.random() * 100;
  return randomValue < hitRate;
}