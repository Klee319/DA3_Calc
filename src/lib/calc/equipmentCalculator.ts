/**
 * 装備システム計算モジュール
 * 仕様書: ref/product/design/03_装備システム.md
 * 設計書: ref/product/design/10_計算システム設計.md
 * UserStatusCalc.yamlおよびEqConst.yamlの計算式を使用
 */

import {
  WeaponData,
  ArmorData,
  AccessoryData,
  EmblemData,
  RunestoneData,
  EqConstData,
  UserStatusCalcData,
} from '@/types/data';
import { evaluateFormula } from './formulaEvaluator';
import { round, roundUp, roundDown } from './utils/mathUtils';

// ===== 型定義 =====

/**
 * 装備ランク
 */
export type EquipmentRank = 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

/**
 * 武器ランク（装備ランクのエイリアス）
 */
export type WeaponRank = EquipmentRank;

/**
 * 武器叩き回数（パラメータ別）
 */
export interface WeaponSmithingCounts {
  attackPower?: number;  // 攻撃力
  critRate?: number;     // 会心率
  critDamage?: number;   // 会心ダメージ
}

/**
 * ステータスブロック
 */
export interface StatBlock {
  [key: string]: number;
}

/**
 * 装備ステータス
 */
export interface EquipmentStats {
  // 基礎値
  initial: StatBlock;
  // 各種加算値
  rankBonus: StatBlock;
  reinforcement: StatBlock;
  forge: StatBlock;
  alchemy: StatBlock;
  // 最終値
  final: StatBlock;
  // 武器固有
  attackPower?: number;
  critRate?: number;
  critDamage?: number;
  damageCorrection?: number;
  coolTime?: number;
}

/**
 * 選択された装備
 */
export interface SelectedEquipment {
  weapon?: {
    data: WeaponData;
    rank: WeaponRank;
    reinforcement: number;
    hammerCount: number;
    alchemyEnabled: boolean;
  };
  head?: {
    data: ArmorData;
    rank: EquipmentRank;
    reinforcement: number;
    tatakiCount?: number;  // 叩き回数を追加
  };
  body?: {
    data: ArmorData;
    rank: EquipmentRank;
    reinforcement: number;
    tatakiCount?: number;  // 叩き回数を追加
  };
  leg?: {
    data: ArmorData;
    rank: EquipmentRank;
    reinforcement: number;
    tatakiCount?: number;  // 叩き回数を追加
  };
  necklace?: {
    data: AccessoryData;
    rank: EquipmentRank;
  };
  bracelet?: {
    data: AccessoryData;
    rank: EquipmentRank;
  };
  emblem?: EmblemData;
  runes?: RunestoneData[];
  ring?: any; // 未実装
}

/**
 * リングデータ（未実装）
 */
export interface RingData {
  // 将来実装予定
}

// ===== ユーティリティ関数 =====

// round, roundUp, roundDown は mathUtils からインポート済み

/**
 * ランクリスト
 */
const RANK_ORDER: EquipmentRank[] = ['SSS', 'SS', 'S', 'A', 'B', 'C', 'D', 'E', 'F'];

/**
 * ランクの妥当性チェック
 */
function validateRank(rank: EquipmentRank, minRank?: string, maxRank?: string): boolean {
  const rankIndex = RANK_ORDER.indexOf(rank);
  if (rankIndex === -1) return false;

  if (minRank) {
    const minIndex = RANK_ORDER.indexOf(minRank as EquipmentRank);
    if (minIndex !== -1 && rankIndex > minIndex) return false; // より低いランク
  }

  if (maxRank) {
    const maxIndex = RANK_ORDER.indexOf(maxRank as EquipmentRank);
    if (maxIndex !== -1 && rankIndex < maxIndex) return false; // より高いランク
  }

  return true;
}

/**
 * ランクを有効範囲にクランプする
 * 指定されたランクが範囲外の場合、有効な範囲内のランクを返す
 */
function clampRank(rank: EquipmentRank, minRank?: string, maxRank?: string): EquipmentRank {
  let rankIndex = RANK_ORDER.indexOf(rank);
  if (rankIndex === -1) rankIndex = 0; // デフォルトはSSS

  // 最高ランクより高い場合、最高ランクにクランプ
  if (maxRank) {
    const maxIndex = RANK_ORDER.indexOf(maxRank as EquipmentRank);
    if (maxIndex !== -1 && rankIndex < maxIndex) {
      rankIndex = maxIndex;
    }
  }

  // 最低ランクより低い場合、最低ランクにクランプ
  if (minRank) {
    const minIndex = RANK_ORDER.indexOf(minRank as EquipmentRank);
    if (minIndex !== -1 && rankIndex > minIndex) {
      rankIndex = minIndex;
    }
  }

  return RANK_ORDER[rankIndex];
}

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

// ===== 1. 武器計算 =====

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
  if (validRank !== rank) {
    console.warn(`Rank ${rank} clamped to ${validRank} for weapon ${weapon.アイテム名}`);
  }
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
      // YAML式では <ForgeAttackPAmount> が ForgeAttackP に変換される
      'ForgeAttackP': attackPowerSmithing,
      'ForgeCritR': critRateSmithing,
      'ForgeCritD': critDamageSmithing,
      // その他
      'AvailableLv': weapon.使用可能Lv,
      'Denominator': (eqConst.Weapon.Reinforcement as any)?.Denominator || 320,
    };

    try {
      // 攻撃力計算
      // 式: ROUNDUP( Initial.AttackP + AvailableLv * (Rank.Bonus.AttackP / Denominator) ) + Rank.Alchemy.AttackP + Reinforcement.AttackP * <ReinforcementLevel> + Forge.AttackP * <ForgeAttackPAmount>
      // Note: Rank.Bonus.AttackP は Denominator で割った項でのみ使用し、フラット加算はしない
      if (weaponFormulas.AttackP) {
        const rawAttackPower = evaluateFormula(weaponFormulas.AttackP, variables);
        attackPower = round(rawAttackPower);
      } else {
        // デフォルト計算
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
    } catch (error) {
      console.warn('Failed to evaluate weapon formulas, using default calculation', error);
      // フォールバック: デフォルト計算
      // 式: ROUNDUP( Initial.AttackP + AvailableLv * (Rank.Bonus.AttackP / Denominator) ) + Rank.Alchemy.AttackP + Reinforcement + Forge
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
    // 式: ROUNDUP( Initial.AttackP + AvailableLv * (Rank.Bonus.AttackP / Denominator) ) + Rank.Alchemy.AttackP + Reinforcement + Forge
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

// ===== 2. 防具計算 =====

/**
 * 防具ステータス計算
 * 仕様書 §3.2, §3.3 に基づく
 * UserStatusCalc.yamlのEquipmentStatusFormula.Armor式を使用
 */
export function calculateArmorStats(
  armor: ArmorData,
  rank: EquipmentRank,
  reinforcementCount: number,
  tatakiCount: number = 0,  // 叩き回数パラメータ (デフォルト0)
  eqConst: EqConstData,
  userStatusCalc?: UserStatusCalcData
): EquipmentStats {
  // バリデーション
  if (!validateRank(rank, armor.最低ランク, armor.最高ランク)) {
    throw new Error(`Invalid rank ${rank} for armor ${armor.アイテム名}`);
  }

  const maxArmorReinforcement = eqConst.Armor.Reinforcement?.MAX ?? 40;
  if (reinforcementCount < 0 || reinforcementCount > maxArmorReinforcement) {
    throw new Error(`Reinforcement must be between 0 and ${maxArmorReinforcement}`);
  }

  if (tatakiCount < 0 || tatakiCount > 12) {
    throw new Error('Tataki count must be between 0 and 12');
  }

  // ランク値取得 (SSS=8, SS=7, S=6, A=5, B=4, C=3, D=2, E=1, F=0)
  const rankValue = eqConst.Armor.Rank[rank] || 0;

  // YAML式を取得
  const armorFormula = (userStatusCalc?.EquipmentStatusFormula?.Armor as any)?.MainStatus as string | undefined;

  // ステータス定義
  const statNames = [
    { key: 'power', csvKey: '力（初期値）', tatakiMultiplier: 2 }, // 通常ステータス: 叩き回数×2
    { key: 'magic', csvKey: '魔力（初期値）', tatakiMultiplier: 2 },
    { key: 'hp', csvKey: '体力（初期値）', tatakiMultiplier: 2 },
    { key: 'mind', csvKey: '精神（初期値）', tatakiMultiplier: 2 },
    { key: 'speed', csvKey: '素早さ（初期値）', tatakiMultiplier: 2 },
    { key: 'dexterity', csvKey: '器用（初期値）', tatakiMultiplier: 2 },
    { key: 'critDamage', csvKey: '撃力（初期値）', tatakiMultiplier: 2 },
    { key: 'defense', csvKey: '守備力（初期値）', tatakiMultiplier: 1 }, // 守備力: 叩き回数×1
  ];

  // 結果格納用
  const result: EquipmentStats = {
    initial: {},
    rankBonus: {},
    reinforcement: {},
    forge: {},
    alchemy: {},
    final: {},
  };

  // 各ステータスに対して計算式を適用
  for (const stat of statNames) {
    // 基礎値取得（CSVのFランク値）
    const baseValue = armor[stat.csvKey as keyof ArmorData] as number || 0;

    // 基礎値が0の場合はスキップ（防具が持っていないステータスには強化・叩きを適用しない）
    if (baseValue === 0) {
      continue;
    }

    // 叩き値計算
    const forgeValue = stat.key === 'defense'
      ? eqConst.Armor.Forge?.Defence || 1
      : eqConst.Armor.Forge?.Other || 2;
    const tatakiValue = tatakiCount * forgeValue;

    // 強化による追加値
    const reinforcementValue = stat.key === 'defense'
      ? (eqConst.Armor.Reinforcement?.Defence || 1) * reinforcementCount
      : (eqConst.Armor.Reinforcement?.Other || 2) * reinforcementCount;

    let finalValue: number;

    if (armorFormula) {
      // YAML式を使用した計算
      const variables: Record<string, number> = {
        [`Initial.${stat.key}`]: baseValue,
        [`Forge.${stat.key}`]: forgeValue,
        'ForgeCount': tatakiCount,
        'Bonus.Rank': rankValue,
        'AvailableLv': armor.使用可能Lv,
        'ReinforcementLevel': reinforcementCount,
        [`Reinforcement.${stat.key}`]: reinforcementValue / reinforcementCount || 0,
      };

      // 計算式の<Stat>を実際のステータス名に置き換え
      const statFormula = armorFormula.replace(/<Stat>/g, stat.key);

      try {
        const calculatedValue = round(evaluateFormula(statFormula, variables));
        // 強化値を加算
        finalValue = calculatedValue + reinforcementValue;
      } catch (error) {
        console.warn(`Failed to evaluate armor formula for ${stat.key}, using default`, error);
        // フォールバック: デフォルト計算
        const baseWithTataki = baseValue + tatakiValue;
        const exponentPower = eqConst.Armor?.ExponentPower ?? 0.2;
        const calculatedValue = round(
          baseWithTataki * (1 + Math.pow(baseWithTataki, exponentPower) * (rankValue / armor.使用可能Lv))
        );
        finalValue = calculatedValue + reinforcementValue;
      }
    } else {
      // デフォルト計算
      const baseWithTataki = baseValue + tatakiValue;
      const exponentPower = eqConst.Armor?.ExponentPower ?? 0.2;
      const calculatedValue = round(
        baseWithTataki * (1 + Math.pow(baseWithTataki, exponentPower) * (rankValue / armor.使用可能Lv))
      );
      finalValue = calculatedValue + reinforcementValue;
    }

    // 結果格納
    result.initial[stat.key] = baseValue;
    result.forge[stat.key] = tatakiValue; // 叩き値をforgeに格納
    result.reinforcement[stat.key] = reinforcementValue;
    result.rankBonus[stat.key] = finalValue - baseValue - tatakiValue - reinforcementValue; // ランクによる増分
    result.final[stat.key] = finalValue;
  }

  // EX計算（仕様書§4: 防具には2種類のEXステータスが付与される）
  // EX値はUIで選択したものをbuildStore経由で計算するため、ここでは自動追加しない
  // UIからexStatsが渡された場合のみ加算する仕組みに変更

  return result;
}

/**
 * 防具EXステータス計算
 * 仕様書 §4.1 に基づく
 * @param level 使用可能レベル
 * @param rank 装備ランク
 * @param exStatType EXステータスの種類
 * @param eqConst 装備定数データ
 * @returns EX実数値
 */
function calculateArmorEXValue(
  level: number,
  rank: EquipmentRank,
  exStatType: 'Dex' | 'CritDamage' | 'Speed' | 'HP' | 'Power' | 'Magic' | 'Mind' | 'Defense',
  eqConst: EqConstData
): number {
  // エラーハンドリング：levelが0や負数の場合
  if (level <= 0) {
    return 1; // 最小値は1
  }

  // EqConst.yamlから係数を取得
  // Dex → CritR, CritDamage/Speed → Speed_CritD, その他 → Other
  const exRankCoeffs = eqConst.Equipment_EX.Rank;
  let coeff: number;

  if (exStatType === 'Dex') {
    coeff = exRankCoeffs.CritR[rank] ?? 0;
  } else if (exStatType === 'CritDamage' || exStatType === 'Speed') {
    coeff = exRankCoeffs.Speed_CritD[rank] ?? 0;
  } else {
    // HP, Power, Magic, Mind, Defense
    coeff = exRankCoeffs.Other[rank] ?? 0;
  }

  // EX実数値 = ROUND(Lv × ランクEX係数 + 1)
  return round(level * coeff + 1);
}

/**
 * 防具EXステータス2種を計算（仕様書§4では2種類付与される）
 * @param armor 防具データ
 * @param rank 装備ランク
 * @param ex1Type EX1の種類
 * @param ex2Type EX2の種類
 * @param eqConst 装備定数データ
 * @returns EX1とEX2の計算結果
 */
export function calculateArmorEX(
  armor: ArmorData,
  rank: EquipmentRank,
  ex1Type: 'Dex' | 'CritDamage' | 'Speed' | 'HP' | 'Power' | 'Magic' | 'Mind' | 'Defense',
  ex2Type: 'Dex' | 'CritDamage' | 'Speed' | 'HP' | 'Power' | 'Magic' | 'Mind' | 'Defense',
  eqConst: EqConstData
): { ex1: number; ex2: number; ex1Type: string; ex2Type: string } {
  const level = armor.使用可能Lv;

  return {
    ex1: calculateArmorEXValue(level, rank, ex1Type, eqConst),
    ex2: calculateArmorEXValue(level, rank, ex2Type, eqConst),
    ex1Type,
    ex2Type
  };
}

/**
 * アクセサリEXステータスを計算
 * 仕様書 §5.3 に基づく（防具EXと同様のルール）
 * @param accessory アクセサリデータ
 * @param rank 装備ランク
 * @param exType EXステータスの種類
 * @param eqConst 装備定数データ
 * @returns EX値とEXタイプ
 */
export function calculateAccessoryEX(
  accessory: AccessoryData,
  rank: EquipmentRank,
  exType: 'Dex' | 'CritDamage' | 'Speed' | 'HP' | 'Power' | 'Magic' | 'Mind',
  eqConst: EqConstData
): { exValue: number; exType: string } {
  const level = accessory.使用可能Lv;

  return {
    exValue: calculateArmorEXValue(level, rank, exType, eqConst),
    exType
  };
}

// ===== 3. アクセサリー計算 =====

/**
 * アクセサリーステータス計算
 * 仕様書 §3.4, §4.2 に基づく
 */
export function calculateAccessoryStats(
  accessory: AccessoryData,
  rank: EquipmentRank,
  eqConst: EqConstData
): EquipmentStats {
  // バリデーション
  if (!validateRank(rank, accessory.最低ランク, accessory.最高ランク)) {
    throw new Error(`Invalid rank ${rank} for accessory ${accessory.アイテム名}`);
  }

  // ランク補正係数をYAMLから取得（EqConst.yaml Accessory.Rank）
  // 計算式: 実数値 = ROUNDUP( 基礎値 + (使用可能Lv × ランク係数 / 550) )
  const rankBonus = eqConst.Accessory?.Rank?.[rank] || 0;

  // アクセサリーが持つ6つのステータス（仕様書 §5.1より）
  const statsMapping = [
    { key: 'HP', csvKey: '体力（初期値）' },
    { key: 'Power', csvKey: '力（初期値）' },
    { key: 'Magic', csvKey: '魔力（初期値）' },
    { key: 'Mind', csvKey: '精神（初期値）' },
    { key: 'CritDamage', csvKey: '撃力（初期値）' },
    { key: 'Speed', csvKey: '素早さ（初期値）' },
  ];

  // 結果構築
  const result: EquipmentStats = {
    initial: {},
    rankBonus: {},
    reinforcement: {},
    forge: {},
    alchemy: {},
    final: {},
  };

  // 各ステータスについて計算
  for (const stat of statsMapping) {
    // AccessoryDataから値を取得（型安全にアクセス）
    const baseValue = (accessory[stat.csvKey as keyof AccessoryData] as number) || 0;

    // 基礎値が0の場合はスキップ
    if (baseValue === 0) continue;

    let finalValue: number;

    if (rankBonus === 0) {
      // E/Fランク（係数0）は基礎値そのまま
      finalValue = baseValue;
    } else {
      // その他のランクは補正式を適用
      // 実数値 = ROUNDUP( 基礎値 + (使用可能Lv × ランク係数 / ScalingDivisor) )
      const scalingDivisor = eqConst.Accessory?.ScalingDivisor ?? 550;
      finalValue = Math.ceil(baseValue + (accessory.使用可能Lv * rankBonus / scalingDivisor));
    }

    // 結果に格納
    result.initial[stat.key] = baseValue;
    result.rankBonus[stat.key] = finalValue - baseValue;
    result.final[stat.key] = finalValue;
  }

  // アクセサリEXはUIで選択するため、ここでは自動追加しない
  // buildStore.tsで選択されたEXステータスが加算される

  return result;
}

// ===== 4. 紋章計算 =====

/**
 * 紋章ステータス計算
 * 仕様書 §3.5, §5.2 に基づく
 * CSVカラム: アイテム名,使用可能Lv,力（%不要）,魔力（%不要）,体力（%不要）,精神（%不要）,素早さ（%不要）,器用（%不要）,撃力（%不要）,守備力（%不要）
 */
export function calculateEmblemStats(emblem: EmblemData): EquipmentStats {
  // 紋章は%ボーナスとして扱う（CSVには%記号なしで記載）
  const finalStats: StatBlock = {};

  // 各ステータスフィールドをマッピング
  const statMapping: { [key: string]: string } = {
    '力（%不要）': 'power_percent',
    '魔力（%不要）': 'magic_percent',
    '体力（%不要）': 'health_percent',
    '精神（%不要）': 'spirit_percent',
    '素早さ（%不要）': 'speed_percent',
    '器用（%不要）': 'dex_percent',
    '撃力（%不要）': 'critDamage_percent',
    '守備力（%不要）': 'defence_percent',
  };

  // 各ステータス値を%ボーナスとして追加
  for (const [csvKey, statKey] of Object.entries(statMapping)) {
    const value = emblem[csvKey as keyof EmblemData] as number | undefined;
    if (value && value > 0) {
      finalStats[statKey] = value;
    }
  }

  // 結果構築（%ボーナスとして保存）
  const result: EquipmentStats = {
    initial: {},
    rankBonus: {},
    reinforcement: {},
    forge: {},
    alchemy: {},
    final: finalStats,
  };

  return result;
}

// ===== 5. ルーンストーン計算 =====

/**
 * ルーンストーンステータス計算
 * 仕様書 §3.6, §6.2 に基づく
 * CSVカラム: アイテム名（・<グレード>）は不要,グレード,力,魔力,体力,精神,素早さ,器用,撃力,守備力,耐性１,値(%除く),耐性２,値,...
 */
export function calculateRuneStats(runes: RunestoneData[]): EquipmentStats {
  // グレード重複チェック
  const grades = new Set<string>();
  for (const rune of runes) {
    if (grades.has(rune.グレード)) {
      throw new Error(`Duplicate rune grade: ${rune.グレード}`);
    }
    grades.add(rune.グレード);
  }

  // 各グレードから1個ずつまで（最大4種）
  if (runes.length > 4) {
    throw new Error('Maximum 4 runes allowed');
  }

  // ステータス合算
  const finalStats: StatBlock = {};

  // ステータスフィールドのマッピング
  const statMapping: { [key: string]: string } = {
    '力': 'power',
    '魔力': 'magic',
    '体力': 'health',
    '精神': 'spirit',
    '素早さ': 'speed',
    '器用': 'dex',
    '撃力': 'critDamage',
    '守備力': 'defence',
  };

  for (const rune of runes) {
    // 各ステータス値を合算
    for (const [csvKey, statKey] of Object.entries(statMapping)) {
      const value = rune[csvKey as keyof RunestoneData] as number | undefined;
      if (value && value > 0) {
        if (!finalStats[statKey]) {
          finalStats[statKey] = 0;
        }
        finalStats[statKey] += value;
      }
    }
  }

  // 結果構築
  const result: EquipmentStats = {
    initial: {},
    rankBonus: {},
    reinforcement: {},
    forge: {},
    alchemy: {},
    final: finalStats,
  };

  return result;
}

// ===== 6. リング計算 =====

/**
 * リングステータス計算（未実装）
 * 仕様書 §3.7, §7.2 に基づく
 */
export function calculateRingStats(ring: RingData | null): EquipmentStats {
  // 未実装なので空のステータスを返す
  const result: EquipmentStats = {
    initial: {},
    rankBonus: {},
    reinforcement: {},
    forge: {},
    alchemy: {},
    final: {},
  };

  return result;
}

// ===== 7. 統合関数 =====

/**
 * 全装備のステータスを合算
 */
export function calculateAllEquipmentStats(
  equipment: SelectedEquipment,
  eqConst: EqConstData
): EquipmentStats {
  const allStats: EquipmentStats = {
    initial: {},
    rankBonus: {},
    reinforcement: {},
    forge: {},
    alchemy: {},
    final: {},
  };

  // 各装備のステータスを計算して合算
  
  // 武器
  if (equipment.weapon) {
    const weaponStats = calculateWeaponStats(
      equipment.weapon.data,
      equipment.weapon.rank,
      equipment.weapon.reinforcement,
      equipment.weapon.hammerCount,
      equipment.weapon.alchemyEnabled,
      eqConst
    );
    mergeStats(allStats, weaponStats);
  }

  // 頭防具
  if (equipment.head) {
    const headStats = calculateArmorStats(
      equipment.head.data,
      equipment.head.rank,
      equipment.head.reinforcement,
      equipment.head.tatakiCount || 0,
      eqConst
    );
    mergeStats(allStats, headStats);
  }

  // 胴防具
  if (equipment.body) {
    const bodyStats = calculateArmorStats(
      equipment.body.data,
      equipment.body.rank,
      equipment.body.reinforcement,
      equipment.body.tatakiCount || 0,
      eqConst
    );
    mergeStats(allStats, bodyStats);
  }

  // 脚防具
  if (equipment.leg) {
    const legStats = calculateArmorStats(
      equipment.leg.data,
      equipment.leg.rank,
      equipment.leg.reinforcement,
      equipment.leg.tatakiCount || 0,
      eqConst
    );
    mergeStats(allStats, legStats);
  }

  // ネックレス
  if (equipment.necklace) {
    const necklaceStats = calculateAccessoryStats(
      equipment.necklace.data,
      equipment.necklace.rank,
      eqConst
    );
    mergeStats(allStats, necklaceStats);
  }

  // ブレスレット
  if (equipment.bracelet) {
    const braceletStats = calculateAccessoryStats(
      equipment.bracelet.data,
      equipment.bracelet.rank,
      eqConst
    );
    mergeStats(allStats, braceletStats);
  }

  // 紋章
  if (equipment.emblem) {
    const emblemStats = calculateEmblemStats(equipment.emblem);
    mergeStats(allStats, emblemStats);
  }

  // ルーンストーン
  if (equipment.runes && equipment.runes.length > 0) {
    const runeStats = calculateRuneStats(equipment.runes);
    mergeStats(allStats, runeStats);
  }

  // リング（未実装）
  if (equipment.ring) {
    const ringStats = calculateRingStats(equipment.ring);
    mergeStats(allStats, ringStats);
  }

  return allStats;
}

/**
 * ステータスをマージするヘルパー関数
 */
function mergeStats(target: EquipmentStats, source: EquipmentStats): void {
  // 各カテゴリをマージ
  mergeStatBlock(target.initial, source.initial);
  mergeStatBlock(target.rankBonus, source.rankBonus);
  mergeStatBlock(target.reinforcement, source.reinforcement);
  mergeStatBlock(target.forge, source.forge);
  mergeStatBlock(target.alchemy, source.alchemy);
  mergeStatBlock(target.final, source.final);

  // 武器固有値を保持
  if (source.attackPower !== undefined) target.attackPower = source.attackPower;
  if (source.critRate !== undefined) target.critRate = source.critRate;
  if (source.critDamage !== undefined) target.critDamage = source.critDamage;
  if (source.damageCorrection !== undefined) target.damageCorrection = source.damageCorrection;
  if (source.coolTime !== undefined) target.coolTime = source.coolTime;
}

/**
 * StatBlockをマージするヘルパー関数
 */
function mergeStatBlock(target: StatBlock, source: StatBlock): void {
  for (const [key, value] of Object.entries(source)) {
    if (target[key] === undefined) {
      target[key] = 0;
    }
    target[key] += value;
  }
}