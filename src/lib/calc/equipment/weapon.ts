/**
 * 武器計算モジュール
 */

import {
  WeaponData,
  EqConstData,
  UserStatusCalcData,
} from '@/types/data';
import { evaluateFormula } from '../formulaEvaluator';
import { round, roundUp } from '../utils/mathUtils';
import { EquipmentStats, WeaponRank, WeaponSmithingCounts } from './types';
import { clampRank } from './rankHelpers';

/**
 * 武器のF基準値を逆算
 * 仕様書 §2.2.3: 最低ランク指定時のF基準逆算
 * 攻撃力は整数値に丸める
 */
function calculateWeaponFValue(
  csvValue: number,
  minRank: WeaponRank,
  statType: 'AttackP' | 'CritR' | 'CritD' | 'CoolT',
  eqConst: EqConstData
): number {
  const rankData = (eqConst.Weapon.Rank as any)[minRank];
  if (!rankData || !rankData.Bonus) {
    return csvValue;
  }

  const bonus = rankData.Bonus[statType] || 0;
  const fValue = csvValue - bonus;

  // 攻撃力は整数値に丸める
  if (statType === 'AttackP') {
    return Math.floor(fValue);
  }

  return fValue;
}

/**
 * 武器ステータス計算
 * 仕様書 §3.2, §2.3, §2.4, §2.5, §2.6 に基づく
 * UserStatusCalc.yamlのEquipmentStatusFormula.Weapon式を使用
 */
export function calculateWeaponStats(
  weapon: WeaponData,
  rank: WeaponRank,
  forgeCount: number,
  hammerCount: number | WeaponSmithingCounts,
  alchemyEnabled: boolean,
  eqConst: EqConstData,
  userStatusCalc?: UserStatusCalcData
): EquipmentStats {
  // 叩き回数を正規化（後方互換性のため単一数値もサポート）
  const smithingCounts: WeaponSmithingCounts = typeof hammerCount === 'number'
    ? { attackPower: hammerCount, critRate: hammerCount, critDamage: hammerCount }
    : hammerCount;

  const attackPowerSmithing = smithingCounts.attackPower || 0;
  const critRateSmithing = smithingCounts.critRate || 0;
  const critDamageSmithing = smithingCounts.critDamage || 0;

  // ランクを有効範囲にクランプ（無効なランクはエラーではなく自動調整）
  const validRank = clampRank(rank, weapon.最低ランク, weapon.最高ランク);
  rank = validRank;

  const maxReinforcement = eqConst.Weapon.Reinforcement?.MAX ?? 80;
  if (forgeCount < 0 || forgeCount > maxReinforcement) {
    throw new Error(`Reinforcement must be between 0 and ${maxReinforcement}`);
  }

  // F基準値の計算（最低ランク指定時）
  let baseAttackP = weapon['攻撃力（初期値）'];
  let baseCritR = weapon['会心率（初期値）'];
  let baseCritD = weapon['会心ダメージ（初期値）'];
  let baseCoolT = weapon['ct(初期値)'];

  if (weapon.最低ランク && weapon.最低ランク !== 'F') {
    baseAttackP = calculateWeaponFValue(baseAttackP, weapon.最低ランク as WeaponRank, 'AttackP', eqConst);
    baseCritR = calculateWeaponFValue(baseCritR, weapon.最低ランク as WeaponRank, 'CritR', eqConst);
    baseCritD = calculateWeaponFValue(baseCritD, weapon.最低ランク as WeaponRank, 'CritD', eqConst);
    baseCoolT = calculateWeaponFValue(baseCoolT, weapon.最低ランク as WeaponRank, 'CoolT', eqConst);
  }

  // ランクデータ取得
  const rankData = (eqConst.Weapon.Rank as any)[rank];
  if (!rankData) {
    throw new Error(`Rank data not found for ${rank}`);
  }

  const rankBonus = rankData.Bonus || {};
  const alchemyBonus = alchemyEnabled ? (rankData.Alchemy || {}) : {};

  // YAML式を取得
  const weaponFormulas = userStatusCalc?.EquipmentStatusFormula?.Weapon as Record<string, string> | undefined;

  let attackPower: number;
  let critRate: number;
  let critDamage: number;
  let coolTime: number;

  if (weaponFormulas) {
    // YAML式を使用した計算
    const variables: Record<string, number> = {
      // 初期値
      'Initial.AttackP': baseAttackP,
      'Initial.CritR': baseCritR,
      'Initial.CritD': baseCritD,
      'Initial.CoolT': baseCoolT,
      // ランクボーナス
      'Rank.Bonus.AttackP': rankBonus.AttackP || 0,
      'Rank.Bonus.CritR': rankBonus.CritR || 0,
      'Rank.Bonus.CritD': rankBonus.CritD || 0,
      'Rank.Bonus.CoolT': rankBonus.CoolT || 0,
      // 錬金ボーナス
      'Rank.Alchemy.AttackP': alchemyBonus.AttackP || 0,
      'Rank.Alchemy.CritR': alchemyBonus.CritR || 0,
      'Rank.Alchemy.CritD': alchemyBonus.CritD || 0,
      // 強化値
      'Reinforcement.AttackP': (eqConst.Weapon.Reinforcement as any)?.AttackP || 2,
      'Reinforcement.CritR': (eqConst.Weapon.Reinforcement as any)?.CritR || 0,
      'Reinforcement.CritD': (eqConst.Weapon.Reinforcement as any)?.CritD || 1,
      'ReinforcementLevel': forgeCount,
      // 叩き値
      'Forge.AttackP': eqConst.Weapon.Forge?.Other || 1,
      'Forge.CritR': eqConst.Weapon.Forge?.Other || 1,
      'Forge.CritD': eqConst.Weapon.Forge?.Other || 1,
      'ForgeAttackP': attackPowerSmithing,
      'ForgeCritR': critRateSmithing,
      'ForgeCritD': critDamageSmithing,
      // その他
      'AvailableLv': weapon.使用可能Lv,
      'Denominator': (eqConst.Weapon.Reinforcement as any)?.Denominator || 320,
    };

    try {
      // 攻撃力計算
      if (weaponFormulas.AttackP) {
        const rawAttackPower = evaluateFormula(weaponFormulas.AttackP, variables);
        attackPower = round(rawAttackPower);
      } else {
        const attackPowerBase = roundUp(baseAttackP + weapon.使用可能Lv * ((rankBonus.AttackP || 0) / variables.Denominator));
        attackPower = attackPowerBase +
          (alchemyBonus.AttackP || 0) +
          variables['Reinforcement.AttackP'] * forgeCount +
          variables['Forge.AttackP'] * attackPowerSmithing;
      }

      // 会心率計算
      if (weaponFormulas.CritR) {
        critRate = evaluateFormula(weaponFormulas.CritR, variables);
      } else {
        critRate = baseCritR +
          (rankBonus.CritR || 0) +
          (alchemyBonus.CritR || 0) +
          variables['Reinforcement.CritR'] * forgeCount +
          variables['Forge.CritR'] * critRateSmithing;
      }

      // 会心ダメージ計算
      if (weaponFormulas.CritD) {
        critDamage = evaluateFormula(weaponFormulas.CritD, variables);
      } else {
        critDamage = baseCritD +
          (rankBonus.CritD || 0) +
          (alchemyBonus.CritD || 0) +
          variables['Reinforcement.CritD'] * forgeCount +
          variables['Forge.CritD'] * critDamageSmithing;
      }

      // クールタイム計算
      if (weaponFormulas.CoolT) {
        coolTime = evaluateFormula(weaponFormulas.CoolT, variables);
      } else {
        coolTime = baseCoolT + (rankBonus.CoolT || 0);
      }
    } catch {
      // フォールバック: デフォルト計算
      const denominator = (eqConst.Weapon.Reinforcement as any)?.Denominator || 320;
      const attackPowerBase = roundUp(baseAttackP + weapon.使用可能Lv * ((rankBonus.AttackP || 0) / denominator));
      attackPower = attackPowerBase +
        (alchemyBonus.AttackP || 0) +
        ((eqConst.Weapon.Reinforcement as any)?.AttackP || 2) * forgeCount +
        (eqConst.Weapon.Forge?.Other || 1) * attackPowerSmithing;

      critRate = baseCritR +
        (rankBonus.CritR || 0) +
        (alchemyBonus.CritR || 0) +
        ((eqConst.Weapon.Reinforcement as any)?.CritR || 0) * forgeCount +
        (eqConst.Weapon.Forge?.Other || 1) * critRateSmithing;

      critDamage = baseCritD +
        (rankBonus.CritD || 0) +
        (alchemyBonus.CritD || 0) +
        ((eqConst.Weapon.Reinforcement as any)?.CritD || 1) * forgeCount +
        (eqConst.Weapon.Forge?.Other || 1) * critDamageSmithing;

      coolTime = baseCoolT + (rankBonus.CoolT || 0);
    }
  } else {
    // YAML式がない場合のデフォルト計算
    const denominator = (eqConst.Weapon.Reinforcement as any)?.Denominator || 320;
    const attackPowerBase = roundUp(baseAttackP + weapon.使用可能Lv * ((rankBonus.AttackP || 0) / denominator));
    attackPower = attackPowerBase +
      (alchemyBonus.AttackP || 0) +
      ((eqConst.Weapon.Reinforcement as any)?.AttackP || 2) * forgeCount +
      (eqConst.Weapon.Forge?.Other || 1) * attackPowerSmithing;

    critRate = baseCritR +
      (rankBonus.CritR || 0) +
      (alchemyBonus.CritR || 0) +
      ((eqConst.Weapon.Reinforcement as any)?.CritR || 0) * forgeCount +
      (eqConst.Weapon.Forge?.Other || 1) * critRateSmithing;

    critDamage = baseCritD +
      (rankBonus.CritD || 0) +
      (alchemyBonus.CritD || 0) +
      ((eqConst.Weapon.Reinforcement as any)?.CritD || 1) * forgeCount +
      (eqConst.Weapon.Forge?.Other || 1) * critDamageSmithing;

    coolTime = baseCoolT + (rankBonus.CoolT || 0);
  }

  // ダメージ補正は変わらない
  const damageCorrection = weapon['ダメージ補正（初期値）'];

  // 結果構築
  const result: EquipmentStats = {
    initial: {
      attackPower: baseAttackP,
      critRate: baseCritR,
      critDamage: baseCritD,
      coolTime: baseCoolT,
      damageCorrection,
    },
    rankBonus: {
      attackPower: rankBonus.AttackP || 0,
      critRate: rankBonus.CritR || 0,
      critDamage: rankBonus.CritD || 0,
      coolTime: rankBonus.CoolT || 0,
    },
    reinforcement: {
      attackPower: ((eqConst.Weapon.Reinforcement as any)?.AttackP || 2) * forgeCount,
      critRate: ((eqConst.Weapon.Reinforcement as any)?.CritR || 0) * forgeCount,
      critDamage: ((eqConst.Weapon.Reinforcement as any)?.CritD || 1) * forgeCount,
    },
    forge: {
      attackPower: (eqConst.Weapon.Forge?.Other || 1) * attackPowerSmithing,
      critRate: (eqConst.Weapon.Forge?.Other || 1) * critRateSmithing,
      critDamage: (eqConst.Weapon.Forge?.Other || 1) * critDamageSmithing,
    },
    alchemy: alchemyEnabled ? {
      attackPower: alchemyBonus.AttackP || 0,
      critRate: alchemyBonus.CritR || 0,
      critDamage: alchemyBonus.CritD || 0,
    } : {},
    final: {
      attackPower,
      critRate,
      critDamage,
      coolTime,
      damageCorrection,
    },
    attackPower,
    critRate,
    critDamage,
    coolTime,
    damageCorrection,
  };

  return result;
}
