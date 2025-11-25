import {
  WeaponData,
  WeaponStats,
  ArmorData,
  ArmorStats,
  AccessoryData,
  AccessoryStats,
  EXData,
  EXStats,
  ForgeConfig,
  EqConstData,
  StatBlock,
  EquipmentSet
} from '@/types/calc';
import { evaluateFormula } from './formulaEvaluator';

/**
 * 武器ステータス計算
 * @param weapon - 武器データ
 * @param rank - ランク (SSS, SS, S, A, B, C, D, E, F)
 * @param reinforcement - 強化レベル (0-40)
 * @param forge - 鍛冶設定
 * @param eqConst - 装備定数データ
 * @returns 計算された武器ステータス
 */
export function calcWeaponStats(
  weapon: WeaponData,
  rank: string,
  reinforcement: number,
  forge: ForgeConfig,
  eqConst: EqConstData
): WeaponStats {
  const stats: WeaponStats = { ...weapon.baseStats };

  // ランク係数を取得
  const rankMultiplier = eqConst.Weapon?.Rank?.[rank] || 0;

  // 基礎攻撃力の計算
  if (weapon.baseAttack) {
    const baseAttack = weapon.baseAttack;

    // 強化による攻撃力増加
    const reinforceAttack = reinforcement * (eqConst.Weapon?.Reinforcement?.Attack || 1);

    // 鍛冶による攻撃力増加
    let forgeAttack = 0;
    if (forge.level) {
      forgeAttack = forge.level * (eqConst.Weapon?.Forge?.Attack || 1);
    }

    // 鍛冶オプションによる追加
    if (forge.options) {
      forge.options.forEach(option => {
        if (option.stat === 'attack') {
          forgeAttack += option.value;
        }
      });
    }

    // 最終攻撃力 = (基礎攻撃力 + 強化 + 鍛冶) * ランク係数
    stats.attackPower = Math.floor((baseAttack + reinforceAttack + forgeAttack) * (1 + rankMultiplier / 100));
  }

  // 基礎魔法攻撃力の計算
  if (weapon.baseMagicAttack) {
    const baseMagic = weapon.baseMagicAttack;

    // 強化による魔法攻撃力増加
    const reinforceMagic = reinforcement * (eqConst.Weapon?.Reinforcement?.Other || 2);

    // 鍛冶による魔法攻撃力増加
    let forgeMagic = 0;
    if (forge.level) {
      forgeMagic = forge.level * (eqConst.Weapon?.Forge?.Other || 2);
    }

    stats.magicPower = Math.floor((baseMagic + reinforceMagic + forgeMagic) * (1 + rankMultiplier / 100));
  }

  // その他のステータスに強化・鍛冶・ランク効果を適用
  if (forge.options) {
    forge.options.forEach(option => {
      if (option.stat !== 'attack' && option.stat !== 'defence') {
        const statKey = option.stat as keyof WeaponStats;
        stats[statKey] = (stats[statKey] || 0) + option.value;
      }
    });
  }

  // ステータスにランク補正を適用
  Object.keys(stats).forEach(key => {
    if (key !== 'attackPower' && key !== 'magicPower') {
      const statKey = key as keyof WeaponStats;
      const baseValue = stats[statKey] || 0;
      const reinforceBonus = reinforcement * (eqConst.Weapon?.Reinforcement?.Other || 2);
      stats[statKey] = Math.floor((baseValue + reinforceBonus) * (1 + rankMultiplier / 100));
    }
  });

  return stats;
}

/**
 * 防具ステータス計算
 * @param armor - 防具データ
 * @param rank - ランク (SSS, SS, S, A, B, C, D, E, F)
 * @param reinforcement - 強化レベル (0-40)
 * @param forge - 鍛冶設定
 * @param eqConst - 装備定数データ
 * @returns 計算された防具ステータス
 */
export function calcArmorStats(
  armor: ArmorData,
  rank: string,
  reinforcement: number,
  forge: ForgeConfig,
  eqConst: EqConstData
): ArmorStats {
  const stats: ArmorStats = { ...armor.baseStats };

  // ランク係数を取得
  const rankMultiplier = eqConst.Armor?.Rank?.[rank] || 0;

  // 基礎防御力の計算
  if (armor.baseDefense) {
    const baseDefense = armor.baseDefense;

    // 強化による防御力増加
    const reinforceDefense = reinforcement * (eqConst.Armor?.Reinforcement?.Defence || 1);

    // 鍛冶による防御力増加
    let forgeDefense = 0;
    if (forge.level) {
      forgeDefense = forge.level * (eqConst.Armor?.Forge?.Defence || 1);
    }

    // 鍛冶オプションによる追加
    if (forge.options) {
      forge.options.forEach(option => {
        if (option.stat === 'defence') {
          forgeDefense += option.value;
        }
      });
    }

    // 最終防御力 = (基礎防御力 + 強化 + 鍛冶) * ランク係数
    stats.defense = Math.floor((baseDefense + reinforceDefense + forgeDefense) * (1 + rankMultiplier / 100));
  }

  // 基礎魔法防御力の計算
  if (armor.baseMagicDefense) {
    const baseMagicDef = armor.baseMagicDefense;

    // 強化による魔法防御力増加
    const reinforceMagicDef = reinforcement * (eqConst.Armor?.Reinforcement?.Other || 2);

    // 鍛冶による魔法防御力増加
    let forgeMagicDef = 0;
    if (forge.level) {
      forgeMagicDef = forge.level * (eqConst.Armor?.Forge?.Other || 2);
    }

    stats.magicDefense = Math.floor((baseMagicDef + reinforceMagicDef + forgeMagicDef) * (1 + rankMultiplier / 100));
  }

  // その他のステータスに強化・鍛冶・ランク効果を適用
  if (forge.options) {
    forge.options.forEach(option => {
      if (option.stat !== 'attack' && option.stat !== 'defence') {
        const statKey = option.stat as keyof ArmorStats;
        stats[statKey] = (stats[statKey] || 0) + option.value;
      }
    });
  }

  // ステータスにランク補正を適用
  Object.keys(stats).forEach(key => {
    if (key !== 'defense' && key !== 'magicDefense') {
      const statKey = key as keyof ArmorStats;
      const baseValue = stats[statKey] || 0;
      const reinforceBonus = reinforcement * (eqConst.Armor?.Reinforcement?.Other || 2);
      stats[statKey] = Math.floor((baseValue + reinforceBonus) * (1 + rankMultiplier / 100));
    }
  });

  return stats;
}

/**
 * アクセサリステータス計算
 * @param accessory - アクセサリデータ
 * @param rank - ランク (SSS, SS, S, A, B, C, D, E, F)
 * @param eqConst - 装備定数データ
 * @returns 計算されたアクセサリステータス
 */
export function calcAccessoryStats(
  accessory: AccessoryData,
  rank: string,
  eqConst: EqConstData
): AccessoryStats {
  const stats: AccessoryStats = { ...accessory.baseStats };

  // ランク係数を取得
  const rankBonus = eqConst.Accessory?.Rank?.[rank] || 0;

  // 各ステータスにランクボーナスを加算
  Object.keys(stats).forEach(key => {
    const statKey = key as keyof AccessoryStats;
    const baseValue = stats[statKey] || 0;
    // アクセサリのランクボーナスは加算値として扱う
    stats[statKey] = baseValue + rankBonus;
  });

  return stats;
}

/**
 * EX装備ステータス計算
 * @param ex - EX装備データ
 * @param rank - ランク (SSS, SS, S, A, B, C, D, E, F)
 * @param eqConst - 装備定数データ
 * @returns 計算されたEX装備ステータス
 */
export function calcEXStats(
  ex: EXData,
  rank: string,
  eqConst: EqConstData
): EXStats {
  const stats: EXStats = { ...ex.baseStats };

  // EX装備のタイプに応じてランク効果を適用
  if (ex.critRate !== undefined) {
    // クリティカル率タイプ
    const critRateBonus = eqConst.Equipment_EX?.Rank?.CritR?.[rank] || 0;
    stats.critRate = (ex.critRate || 0) + critRateBonus;
  }

  if (ex.critDamage !== undefined || ex.speed !== undefined) {
    // スピード/クリティカルダメージタイプ
    const speedCritBonus = eqConst.Equipment_EX?.Rank?.Speed_CritD?.[rank] || 0;

    if (ex.critDamage !== undefined) {
      stats.critDamage = (ex.critDamage || 0) + speedCritBonus;
    }

    if (ex.speed !== undefined) {
      stats.speed = (ex.speed || 0) + speedCritBonus;
    }
  }

  // その他のステータスにランク効果を適用
  const otherBonus = eqConst.Equipment_EX?.Rank?.Other?.[rank] || 0;
  Object.keys(stats).forEach(key => {
    if (key !== 'critRate' && key !== 'critDamage' && key !== 'speed') {
      const statKey = key as keyof EXStats;
      const baseValue = stats[statKey] || 0;
      stats[statKey] = baseValue + otherBonus;
    }
  });

  return stats;
}

/**
 * 装備セットの合計ステータスを計算
 * @param equipment - 装備セット
 * @returns 合計ステータス
 */
export function sumEquipmentStats(equipment: EquipmentSet): StatBlock {
  const totalStats: StatBlock = {};

  // 各装備のステータスを合計
  Object.values(equipment).forEach(equipStats => {
    if (equipStats) {
      Object.entries(equipStats).forEach(([stat, value]) => {
        if (typeof value === 'number') {
          totalStats[stat as keyof StatBlock] = (totalStats[stat as keyof StatBlock] || 0) + value;
        }
      });
    }
  });

  return totalStats;
}