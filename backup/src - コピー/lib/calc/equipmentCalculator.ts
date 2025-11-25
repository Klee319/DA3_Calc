/**
 * 装備システム計算モジュール
 * 仕様書: ref/product/design/03_装備システム.md
 * 設計書: ref/product/design/10_計算システム設計.md
 */

import {
  WeaponData,
  ArmorData,
  AccessoryData,
  EmblemData,
  RunestoneData,
  EqConstData,
} from '@/types/data';

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
  };
  body?: {
    data: ArmorData;
    rank: EquipmentRank;
    reinforcement: number;
  };
  leg?: {
    data: ArmorData;
    rank: EquipmentRank;
    reinforcement: number;
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

/**
 * 四捨五入
 */
function round(value: number): number {
  return Math.round(value);
}

/**
 * 切り上げ
 */
function roundUp(value: number): number {
  return Math.ceil(value);
}

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
 * 武器のF基準値を逆算
 * 仕様書 §2.2.3: 最低ランク指定時のF基準逆算
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
  return csvValue - bonus;
}

// ===== 1. 武器計算 =====

/**
 * 武器ステータス計算
 * 仕様書 §3.2, §2.3, §2.4, §2.5, §2.6 に基づく
 */
export function calculateWeaponStats(
  weapon: WeaponData,
  rank: WeaponRank,
  forgeCount: number,
  hammerCount: number,
  alchemyEnabled: boolean,
  eqConst: EqConstData
): EquipmentStats {
  // バリデーション
  if (!validateRank(rank, weapon.最低ランク, weapon.最高ランク)) {
    throw new Error(`Invalid rank ${rank} for weapon ${weapon.アイテム名}`);
  }

  if (forgeCount < 0 || forgeCount > 80) {
    throw new Error('Reinforcement must be between 0 and 80');
  }

  if (hammerCount < 0 || hammerCount > 999) {
    throw new Error('Hammer count must be between 0 and 999');
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

  // 攻撃力計算
  // AttackP = ROUNDUP(Initial.AttackP + AvailableLv × (Rank.Bonus.AttackP / 320))
  //           + Rank.Bonus.AttackP + Rank.Alchemy.AttackP
  //           + Reinforcement.AttackP × forgeCount
  //           + Forge.AttackP × hammerCount
  const attackPowerBase = roundUp(
    baseAttackP + weapon.使用可能Lv * ((rankBonus.AttackP || 0) / ((eqConst.Weapon.Reinforcement as any)?.Denominator || 320))
  );
  const attackPower = attackPowerBase +
    (rankBonus.AttackP || 0) +
    (alchemyBonus.AttackP || 0) +
    ((eqConst.Weapon.Reinforcement as any)?.AttackP || 2) * forgeCount +
    (eqConst.Weapon.Forge?.Other || 1) * hammerCount;

  // 会心率計算
  const critRate = baseCritR +
    (rankBonus.CritR || 0) +
    (alchemyBonus.CritR || 0) +
    ((eqConst.Weapon.Reinforcement as any)?.CritR || 0) * forgeCount;

  // 会心ダメージ計算
  const critDamage = baseCritD +
    (rankBonus.CritD || 0) +
    (alchemyBonus.CritD || 0) +
    ((eqConst.Weapon.Reinforcement as any)?.CritD || 1) * forgeCount;

  // クールタイム計算
  const coolTime = baseCoolT + (rankBonus.CoolT || 0);

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
      attackPower: (eqConst.Weapon.Forge?.Other || 1) * hammerCount,
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
 */
export function calculateArmorStats(
  armor: ArmorData,
  rank: EquipmentRank,
  forgeCount: number,
  eqConst: EqConstData
): EquipmentStats {
  // バリデーション
  if (!validateRank(rank, armor.最低ランク, armor.最高ランク)) {
    throw new Error(`Invalid rank ${rank} for armor ${armor.アイテム名}`);
  }

  if (forgeCount < 0 || forgeCount > 40) {
    throw new Error('Reinforcement must be between 0 and 40');
  }

  // ランクボーナス取得
  const rankBonus = eqConst.Armor.Rank[rank] || 0;

  // 守備力計算
  // MainStatus = ROUND(
  //   (Initial.Stat + Forge.Stat × ForgeCount)
  //   × (1 + (Initial.Stat + Forge.Stat × ForgeCount)^0.2 × (Bonus.Rank / AvailableLv))
  // )
  const initialDefense = armor['守備力（初期値）'];
  const defenseWithForge = initialDefense + eqConst.Armor.Forge.Defence * forgeCount;
  const defense = round(
    defenseWithForge * (1 + Math.pow(defenseWithForge, 0.2) * (rankBonus / armor.使用可能Lv))
  );

  // HP計算
  const initialHP = armor['HP（初期値）'] || 0;
  const hpWithForge = initialHP + eqConst.Armor.Forge.Other * forgeCount;
  const hp = round(
    hpWithForge * (1 + Math.pow(hpWithForge, 0.2) * (rankBonus / armor.使用可能Lv))
  );

  // 物理耐性計算
  const initialPhysicalResist = armor['物理耐性（初期値）'] || 0;
  const physicalResistWithForge = initialPhysicalResist + eqConst.Armor.Forge.Other * forgeCount;
  const physicalResist = round(
    physicalResistWithForge * (1 + Math.pow(physicalResistWithForge, 0.2) * (rankBonus / armor.使用可能Lv))
  );

  // 魔法耐性計算
  const initialMagicResist = armor['魔法耐性（初期値）'] || 0;
  const magicResistWithForge = initialMagicResist + eqConst.Armor.Forge.Other * forgeCount;
  const magicResist = round(
    magicResistWithForge * (1 + Math.pow(magicResistWithForge, 0.2) * (rankBonus / armor.使用可能Lv))
  );

  // 結果構築
  const result: EquipmentStats = {
    initial: {
      defense: initialDefense,
      hp: initialHP,
      physicalResist: initialPhysicalResist,
      magicResist: initialMagicResist,
    },
    rankBonus: {
      defense: defense - initialDefense - eqConst.Armor.Reinforcement.Defence * forgeCount,
      hp: hp - initialHP - eqConst.Armor.Reinforcement.Other * forgeCount,
      physicalResist: physicalResist - initialPhysicalResist,
      magicResist: magicResist - initialMagicResist,
    },
    reinforcement: {
      defense: eqConst.Armor.Reinforcement.Defence * forgeCount,
      hp: eqConst.Armor.Reinforcement.Other * forgeCount,
    },
    forge: {
      defense: eqConst.Armor.Forge.Defence * forgeCount,
      hp: eqConst.Armor.Forge.Other * forgeCount,
      physicalResist: eqConst.Armor.Forge.Other * forgeCount,
      magicResist: eqConst.Armor.Forge.Other * forgeCount,
    },
    alchemy: {},
    final: {
      defense,
      hp,
      physicalResist,
      magicResist,
    },
  };

  return result;
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

  // ランクボーナス取得
  const rankBonus = eqConst.Accessory.Rank[rank] || 0;

  // メインステータス計算
  // MainStatus = ROUNDUP(Initial.Stat + AvailableLv × Rank.Stat / 550)
  const initialStat = accessory['ステータス値（初期値）'];
  const statValue = roundUp(initialStat + accessory.使用可能Lv * rankBonus / 550);

  // ステータス種類を取得
  const statType = accessory.ステータス種類;

  // 結果構築
  const result: EquipmentStats = {
    initial: {
      [statType]: initialStat,
    },
    rankBonus: {
      [statType]: statValue - initialStat,
    },
    reinforcement: {},
    forge: {},
    alchemy: {},
    final: {
      [statType]: statValue,
    },
  };

  return result;
}

// ===== 4. 紋章計算 =====

/**
 * 紋章ステータス計算
 * 仕様書 §3.5, §5.2 に基づく
 */
export function calculateEmblemStats(emblem: EmblemData): EquipmentStats {
  // 紋章は%ボーナスとして扱う
  // CSVの「効果」フィールドがステータスタイプ
  const statType = emblem.効果;
  const bonusValue = emblem.数値;

  // 結果構築（%ボーナスとして保存）
  const result: EquipmentStats = {
    initial: {},
    rankBonus: {},
    reinforcement: {},
    forge: {},
    alchemy: {},
    final: {
      [`${statType}_percent`]: bonusValue, // %補正として保存
    },
  };

  return result;
}

// ===== 5. ルーンストーン計算 =====

/**
 * ルーンストーンステータス計算
 * 仕様書 §3.6, §6.2 に基づく
 */
export function calculateRuneStats(runes: RunestoneData[]): EquipmentStats {
  // グレード重複チェック
  const grades = new Set<string>();
  for (const rune of runes) {
    if (grades.has(rune.タイプ)) {
      throw new Error(`Duplicate rune grade: ${rune.タイプ}`);
    }
    grades.add(rune.タイプ);
  }

  // 各グレードから1個ずつまで
  const validGrades = ['ノーマル', 'グレート', 'バスター', 'レプリカ'];
  if (runes.length > 4) {
    throw new Error('Maximum 4 runes allowed');
  }

  // ステータス合算
  const finalStats: StatBlock = {};
  for (const rune of runes) {
    // 効果フィールドがステータスタイプ
    const statType = rune.効果;
    const statValue = rune.数値;
    
    if (!finalStats[statType]) {
      finalStats[statType] = 0;
    }
    finalStats[statType] += statValue;

    // セット効果があれば追加
    if (rune.セット効果 && rune.セット数値) {
      const setStatType = rune.セット効果;
      const setStatValue = rune.セット数値;
      
      if (!finalStats[setStatType]) {
        finalStats[setStatType] = 0;
      }
      finalStats[setStatType] += setStatValue;
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