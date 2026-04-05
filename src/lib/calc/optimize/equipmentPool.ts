/**
 * 最適化モジュール - 装備プール構築
 */

import { EquipmentRank } from '@/types';
import {
  OptimizeConstraints,
  CandidateEquipment,
  EquipmentConfiguration,
  EquipmentPool,
  RANK_VALUES,
  OPTIMIZE_FIXED_VALUES,
  MinimumStatRequirements,
} from '@/types/optimize';
import { WeaponData, ArmorData, AccessoryData, EqConstData } from '@/types/data';
import { ArmorSmithingDistribution } from '../equipment/types';
import { RelevantStats } from '../skillAnalyzer';
import { WEAPON_TYPE_YAML_TO_CSV, ARMOR_TYPE_YAML_TO_CSV, EQUIPMENT_FILTER_CONFIG } from './constants';
import {
  generateWeaponSmithingPatterns,
  generateArmorSmithingCounts,
  generateArmorSmithingPatterns,
  generateEXPatternsForMinimumStats,
} from './utils';
import {
  removeWeaponDominated,
  removeArmorDominated,
  removeAccessoryDominated,
} from './dominance';
import { OptimizeGameData } from './engine';

/**
 * 武器候補プールを構築（固定値使用）
 */
export function buildWeaponPool(
  weapons: WeaponData[],
  constraints: OptimizeConstraints,
  availableWeaponTypes: string[],
  selectedWeaponType: string | null,
  eqConst: EqConstData
): CandidateEquipment[] {
  const pool: CandidateEquipment[] = [];

  const fixedRank: EquipmentRank = OPTIMIZE_FIXED_VALUES.rank;
  const fixedEnhancement = OPTIMIZE_FIXED_VALUES.weaponEnhancement;
  const maxSmithingCount = OPTIMIZE_FIXED_VALUES.maxSmithingCount;
  const alchemyEnabled = OPTIMIZE_FIXED_VALUES.alchemyEnabled;

  const targetWeaponTypes = selectedWeaponType
    ? [selectedWeaponType]
    : availableWeaponTypes;

  const expandedWeaponTypes = targetWeaponTypes.includes('All')
    ? ['Sword', 'GreatSword', 'Dagger', 'Axe', 'Spear', 'Bow', 'Wand']
    : targetWeaponTypes;

  const csvWeaponTypes = expandedWeaponTypes
    .map(type => WEAPON_TYPE_YAML_TO_CSV[type])
    .filter(Boolean);

  const smithingPatterns = generateWeaponSmithingPatterns(maxSmithingCount);

  const filteredWeapons = weapons.filter(weapon => {
    if (!weapon.アイテム名 || weapon.アイテム名.trim() === '') {
      return false;
    }
    // 検証武器を除外（会心ダメージ-90%固定の特殊武器）
    if (weapon.アイテム名.includes('検証')) {
      return false;
    }
    if (csvWeaponTypes.length > 0 && !csvWeaponTypes.includes(weapon.武器種)) {
      return false;
    }
    const minRank = weapon.最低ランク as EquipmentRank | undefined;
    const maxRank = weapon.最高ランク as EquipmentRank | undefined;
    if (minRank && RANK_VALUES[fixedRank] < RANK_VALUES[minRank]) return false;
    if (maxRank && RANK_VALUES[fixedRank] > RANK_VALUES[maxRank]) return false;
    if (weapon.使用可能Lv < EQUIPMENT_FILTER_CONFIG.minWeaponLevel) {
      return false;
    }
    return true;
  });

  filteredWeapons.sort((a, b) => b.使用可能Lv - a.使用可能Lv);
  const topWeapons = filteredWeapons.slice(0, EQUIPMENT_FILTER_CONFIG.maxWeaponCandidates);
  const prunedWeapons = removeWeaponDominated(topWeapons);

  for (const weapon of prunedWeapons) {
    // ドロップ武器（制作=FALSE）は叩きなし、制作武器（制作=TRUE）のみ叩きパターン適用
    const isCraftable = weapon.制作 === 'TRUE';
    const weaponSmithingPatterns = isCraftable
      ? smithingPatterns
      : [{ attackPower: 0, critRate: 0, critDamage: 0 }];

    const configurations: EquipmentConfiguration[] = weaponSmithingPatterns.map(pattern => ({
      rank: fixedRank,
      enhancement: fixedEnhancement,
      smithing: pattern as any,
      alchemyEnabled,
    }));

    pool.push({
      id: `weapon_${weapon.アイテム名}`,
      name: weapon.アイテム名,
      type: 'weapon',
      slot: 'weapon',
      sourceData: weapon,
      configurations,
    });
  }

  return pool;
}

/**
 * 防具候補プールを構築（固定値使用、EX・叩き配分パターン含む）
 */
export function buildArmorPool(
  armors: ArmorData[],
  slot: 'head' | 'body' | 'leg',
  constraints: OptimizeConstraints,
  availableArmorTypes: string[],
  eqConst: EqConstData,
  relevantStats?: RelevantStats,
  minimumStats?: MinimumStatRequirements
): CandidateEquipment[] {
  const pool: CandidateEquipment[] = [];

  const fixedRank: EquipmentRank = OPTIMIZE_FIXED_VALUES.rank;
  const fixedEnhancement = OPTIMIZE_FIXED_VALUES.armorEnhancement;
  const maxSmithingCount = OPTIMIZE_FIXED_VALUES.maxSmithingCount;

  const slotNameMap: Record<string, string> = {
    head: '頭',
    body: '胴',
    leg: '脚',
  };
  const targetSlotName = slotNameMap[slot];

  const csvArmorTypes = availableArmorTypes
    .map(type => ARMOR_TYPE_YAML_TO_CSV[type])
    .filter(Boolean);

  const filteredArmors = armors.filter(armor => {
    if (!armor.アイテム名 || armor.アイテム名.trim() === '') {
      return false;
    }
    if (armor.部位を選択 !== targetSlotName) return false;
    if (csvArmorTypes.length > 0 && !csvArmorTypes.includes(armor.タイプを選択)) {
      return false;
    }
    const minRank = armor.最低ランク as EquipmentRank | undefined;
    const maxRank = armor.最高ランク as EquipmentRank | undefined;
    if (minRank && RANK_VALUES[fixedRank] < RANK_VALUES[minRank]) return false;
    if (maxRank && RANK_VALUES[fixedRank] > RANK_VALUES[maxRank]) return false;
    if (armor.使用可能Lv < EQUIPMENT_FILTER_CONFIG.minArmorLevel) {
      return false;
    }
    return true;
  });

  // 守備力の最低値制約がある場合は、守備力の高い防具を優先
  // 注: filteredArmorsは既に職業のAvailableArmorsでフィルタリング済み
  if (minimumStats?.Defense && minimumStats.Defense > 0) {
    // 守備力の高い順にソート（着用可能な防具タイプの中から）
    filteredArmors.sort((a, b) => {
      const defA = (a['守備力（初期値）'] as number) || 0;
      const defB = (b['守備力（初期値）'] as number) || 0;
      if (defA !== defB) return defB - defA;  // 守備力降順
      return b.使用可能Lv - a.使用可能Lv;  // 次にレベル降順
    });
  } else {
    filteredArmors.sort((a, b) => b.使用可能Lv - a.使用可能Lv);
  }
  const topArmors = filteredArmors.slice(0, EQUIPMENT_FILTER_CONFIG.maxArmorCandidates);
  const prunedArmors = removeArmorDominated(topArmors);

  const exPatterns = generateEXPatternsForMinimumStats(relevantStats, minimumStats, 'armor');

  for (const armor of prunedArmors) {
    const smithingPatterns = generateArmorSmithingPatterns(armor, relevantStats, maxSmithingCount, minimumStats);
    const configurations: EquipmentConfiguration[] = [];

    for (const smithingDist of smithingPatterns) {
      for (const exPattern of exPatterns) {
        configurations.push({
          rank: fixedRank,
          enhancement: fixedEnhancement,
          smithing: { tatakiCount: maxSmithingCount, armorDistribution: smithingDist } as any,
          alchemyEnabled: false,
          exStats: { ex1: exPattern.ex1, ex2: exPattern.ex2 },
        });
      }
    }

    pool.push({
      id: `${slot}_${armor.アイテム名}`,
      name: armor.アイテム名,
      type: 'armor',
      slot,
      sourceData: armor,
      configurations,
    });
  }

  return pool;
}

/**
 * アクセサリー候補プールを構築（固定値使用、EXパターン含む）
 */
export function buildAccessoryPool(
  accessories: AccessoryData[],
  slot: 'accessory1' | 'accessory2',
  constraints: OptimizeConstraints,
  eqConst: EqConstData,
  relevantStats?: RelevantStats,
  minimumStats?: MinimumStatRequirements
): CandidateEquipment[] {
  const pool: CandidateEquipment[] = [];

  const fixedRank: EquipmentRank = OPTIMIZE_FIXED_VALUES.rank;
  const slotType = slot === 'accessory1' ? 'ネックレス' : 'ブレスレット';

  const exPatterns = generateEXPatternsForMinimumStats(relevantStats, minimumStats, 'accessory');

  const filteredAccessories = accessories.filter(accessory => {
    if (!accessory.アイテム名 || accessory.アイテム名.trim() === '') {
      return false;
    }
    if (accessory.タイプを選択 !== slotType) return false;
    const minRank = accessory.最低ランク as EquipmentRank | undefined;
    const maxRank = accessory.最高ランク as EquipmentRank | undefined;
    if (minRank && RANK_VALUES[fixedRank] < RANK_VALUES[minRank]) return false;
    if (maxRank && RANK_VALUES[fixedRank] > RANK_VALUES[maxRank]) return false;
    if (accessory.使用可能Lv < EQUIPMENT_FILTER_CONFIG.minAccessoryLevel) {
      return false;
    }
    return true;
  });

  filteredAccessories.sort((a, b) => b.使用可能Lv - a.使用可能Lv);
  const topAccessories = filteredAccessories.slice(0, EQUIPMENT_FILTER_CONFIG.maxAccessoryCandidates);
  const prunedAccessories = removeAccessoryDominated(topAccessories);

  for (const accessory of prunedAccessories) {
    const configurations: EquipmentConfiguration[] = exPatterns.map(exPattern => ({
      rank: fixedRank,
      enhancement: 0,
      smithing: {},
      alchemyEnabled: false,
      exStats: { ex1: exPattern.ex1, ex2: exPattern.ex2 },
    }));

    pool.push({
      id: `${slot}_${accessory.アイテム名}`,
      name: accessory.アイテム名,
      type: 'accessory',
      slot,
      sourceData: accessory,
      configurations,
    });
  }

  return pool;
}

/**
 * 装備プール全体を構築
 */
export function buildEquipmentPool(
  gameData: OptimizeGameData,
  constraints: OptimizeConstraints,
  availableWeaponTypes: string[],
  availableArmorTypes: string[],
  selectedWeaponType: string | null,
  relevantStats?: RelevantStats,
  minimumStats?: MinimumStatRequirements
): EquipmentPool {
  const eqConst = gameData.eqConst;

  return {
    weapon: constraints.targetSlots.includes('weapon')
      ? buildWeaponPool(gameData.weapons, constraints, availableWeaponTypes, selectedWeaponType, eqConst)
      : [],
    head: constraints.targetSlots.includes('head')
      ? buildArmorPool(gameData.armors, 'head', constraints, availableArmorTypes, eqConst, relevantStats, minimumStats)
      : [],
    body: constraints.targetSlots.includes('body')
      ? buildArmorPool(gameData.armors, 'body', constraints, availableArmorTypes, eqConst, relevantStats, minimumStats)
      : [],
    leg: constraints.targetSlots.includes('leg')
      ? buildArmorPool(gameData.armors, 'leg', constraints, availableArmorTypes, eqConst, relevantStats, minimumStats)
      : [],
    accessory1: constraints.targetSlots.includes('accessory1')
      ? buildAccessoryPool(gameData.accessories, 'accessory1', constraints, eqConst, relevantStats, minimumStats)
      : [],
    accessory2: constraints.targetSlots.includes('accessory2')
      ? buildAccessoryPool(gameData.accessories, 'accessory2', constraints, eqConst, relevantStats, minimumStats)
      : [],
  };
}
