/**
 * 最適化モジュール - 支配性枝刈り（Dominance Pruning）
 */

import { WeaponData, ArmorData, AccessoryData } from '@/types/data';
import { SimpleStatBlock } from './types';

/**
 * 武器Aが武器Bを支配（完全上位互換）しているかチェック
 */
export function weaponDominates(a: WeaponData, b: WeaponData): boolean {
  if (a.使用可能Lv > b.使用可能Lv) {
    return false;
  }

  const statsA = {
    attack: a['攻撃力（初期値）'] || 0,
    critRate: a['会心率（初期値）'] || 0,
    critDamage: a['会心ダメージ（初期値）'] || 0,
    damageCorr: a['ダメージ補正（初期値）'] || 1,
  };
  const statsB = {
    attack: b['攻撃力（初期値）'] || 0,
    critRate: b['会心率（初期値）'] || 0,
    critDamage: b['会心ダメージ（初期値）'] || 0,
    damageCorr: b['ダメージ補正（初期値）'] || 1,
  };

  const allGE = statsA.attack >= statsB.attack &&
                statsA.critRate >= statsB.critRate &&
                statsA.critDamage >= statsB.critDamage &&
                statsA.damageCorr >= statsB.damageCorr;

  if (!allGE) return false;

  const anyGT = statsA.attack > statsB.attack ||
                statsA.critRate > statsB.critRate ||
                statsA.critDamage > statsB.critDamage ||
                statsA.damageCorr > statsB.damageCorr;

  return anyGT;
}

/**
 * 防具Aが防具Bを支配（完全上位互換）しているかチェック
 */
export function armorDominates(a: ArmorData, b: ArmorData): boolean {
  if (a.使用可能Lv > b.使用可能Lv) {
    return false;
  }

  const statKeys = [
    '力（初期値）', '魔力（初期値）', '体力（初期値）', '精神（初期値）',
    '素早さ（初期値）', '器用（初期値）', '撃力（初期値）', '守備力（初期値）'
  ] as const;

  let allGE = true;
  let anyGT = false;

  for (const key of statKeys) {
    const valA = (a[key] as number) || 0;
    const valB = (b[key] as number) || 0;

    if (valA < valB) {
      allGE = false;
      break;
    }
    if (valA > valB) {
      anyGT = true;
    }
  }

  return allGE && anyGT;
}

/**
 * アクセサリーAがアクセサリーBを支配（完全上位互換）しているかチェック
 */
export function accessoryDominates(a: AccessoryData, b: AccessoryData): boolean {
  if (a.使用可能Lv > b.使用可能Lv) {
    return false;
  }

  const statKeys = [
    '力（初期値）', '魔力（初期値）', '体力（初期値）', '精神（初期値）',
    '素早さ（初期値）', '撃力（初期値）'
  ] as const;

  let allGE = true;
  let anyGT = false;

  for (const key of statKeys) {
    const valA = (a[key] as number) || 0;
    const valB = (b[key] as number) || 0;

    if (valA < valB) {
      allGE = false;
      break;
    }
    if (valA > valB) {
      anyGT = true;
    }
  }

  return allGE && anyGT;
}

/**
 * 武器リストから被支配（下位互換）装備を除去
 */
export function removeWeaponDominated(weapons: WeaponData[]): WeaponData[] {
  const dominated = new Set<number>();

  for (let i = 0; i < weapons.length; i++) {
    if (dominated.has(i)) continue;

    for (let j = 0; j < weapons.length; j++) {
      if (i === j || dominated.has(j)) continue;

      if (weaponDominates(weapons[i], weapons[j])) {
        dominated.add(j);
      }
    }
  }

  return weapons.filter((_, idx) => !dominated.has(idx));
}

/**
 * 防具リストから被支配（下位互換）装備を除去
 */
export function removeArmorDominated(armors: ArmorData[]): ArmorData[] {
  const dominated = new Set<number>();

  for (let i = 0; i < armors.length; i++) {
    if (dominated.has(i)) continue;

    for (let j = 0; j < armors.length; j++) {
      if (i === j || dominated.has(j)) continue;

      if (armorDominates(armors[i], armors[j])) {
        dominated.add(j);
      }
    }
  }

  return armors.filter((_, idx) => !dominated.has(idx));
}

/**
 * アクセサリーリストから被支配（下位互換）装備を除去
 */
export function removeAccessoryDominated(accessories: AccessoryData[]): AccessoryData[] {
  const dominated = new Set<number>();

  for (let i = 0; i < accessories.length; i++) {
    if (dominated.has(i)) continue;

    for (let j = 0; j < accessories.length; j++) {
      if (i === j || dominated.has(j)) continue;

      if (accessoryDominates(accessories[i], accessories[j])) {
        dominated.add(j);
      }
    }
  }

  return accessories.filter((_, idx) => !dominated.has(idx));
}

/**
 * ビルドAがビルドBを支配（完全上位互換）しているかチェック
 */
export function buildDominates(statsA: SimpleStatBlock, statsB: SimpleStatBlock, scoreA: number, scoreB: number): boolean {
  if (scoreA < scoreB) {
    return false;
  }

  const statKeys = ['Power', 'Magic', 'HP', 'Mind', 'Agility', 'Dex', 'CritDamage', 'Defense'] as const;

  let allGE = true;
  let anyGT = false;

  for (const key of statKeys) {
    const valA = (statsA[key] as number) || 0;
    const valB = (statsB[key] as number) || 0;

    if (valA < valB) {
      allGE = false;
      break;
    }
    if (valA > valB) {
      anyGT = true;
    }
  }

  if (scoreA > scoreB && allGE) {
    return true;
  }

  return allGE && anyGT;
}

/**
 * 結果リストから被支配ビルドを除去
 */
export function filterDominatedBuilds<T extends { score: number; stats: SimpleStatBlock }>(solutions: T[]): T[] {
  if (solutions.length <= 1) return solutions;

  const dominated = new Set<number>();

  for (let i = 0; i < solutions.length; i++) {
    if (dominated.has(i)) continue;

    for (let j = i + 1; j < solutions.length; j++) {
      if (dominated.has(j)) continue;

      if (buildDominates(solutions[i].stats, solutions[j].stats, solutions[i].score, solutions[j].score)) {
        dominated.add(j);
      }
      else if (buildDominates(solutions[j].stats, solutions[i].stats, solutions[j].score, solutions[i].score)) {
        dominated.add(i);
        break;
      }
    }
  }

  return solutions.filter((_, idx) => !dominated.has(idx));
}
