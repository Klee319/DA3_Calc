/**
 * dominance.ts のテスト
 * Pareto優越性（支配関係）チェック機能のテスト
 */

import {
  weaponDominates,
  armorDominates,
  accessoryDominates,
  removeWeaponDominated,
  removeArmorDominated,
  removeAccessoryDominated,
  buildDominates,
  filterDominatedBuilds,
} from './dominance';
import { WeaponData, ArmorData, AccessoryData } from '@/types/data';
import { SimpleStatBlock } from './types';

// テスト用のモックデータ生成関数
function createMockWeapon(overrides: Partial<WeaponData>): WeaponData {
  return {
    名前: 'テスト武器',
    使用可能Lv: 1,
    '攻撃力（初期値）': 100,
    '会心率（初期値）': 10,
    '会心ダメージ（初期値）': 150,
    'ダメージ補正（初期値）': 1.0,
    ...overrides,
  } as WeaponData;
}

function createMockArmor(overrides: Partial<ArmorData>): ArmorData {
  return {
    名前: 'テスト防具',
    使用可能Lv: 1,
    '力（初期値）': 10,
    '魔力（初期値）': 10,
    '体力（初期値）': 10,
    '精神（初期値）': 10,
    '素早さ（初期値）': 10,
    '器用（初期値）': 10,
    '撃力（初期値）': 10,
    '守備力（初期値）': 10,
    ...overrides,
  } as ArmorData;
}

function createMockAccessory(overrides: Partial<AccessoryData>): AccessoryData {
  return {
    名前: 'テストアクセサリー',
    使用可能Lv: 1,
    '力（初期値）': 5,
    '魔力（初期値）': 5,
    '体力（初期値）': 5,
    '精神（初期値）': 5,
    '素早さ（初期値）': 5,
    '撃力（初期値）': 5,
    ...overrides,
  } as AccessoryData;
}

function createMockStats(overrides: Partial<SimpleStatBlock>): SimpleStatBlock {
  return {
    Power: 100,
    Magic: 100,
    HP: 100,
    Mind: 100,
    Agility: 100,
    Dex: 100,
    CritDamage: 150,
    Defense: 50,
    ...overrides,
  };
}

describe('weaponDominates', () => {
  it('全ステータスが高い武器は支配する', () => {
    const superior = createMockWeapon({
      '攻撃力（初期値）': 200,
      '会心率（初期値）': 20,
      '会心ダメージ（初期値）': 200,
      'ダメージ補正（初期値）': 1.2,
    });
    const inferior = createMockWeapon({
      '攻撃力（初期値）': 100,
      '会心率（初期値）': 10,
      '会心ダメージ（初期値）': 150,
      'ダメージ補正（初期値）': 1.0,
    });

    expect(weaponDominates(superior, inferior)).toBe(true);
  });

  it('全ステータスが同じ場合は支配しない', () => {
    const a = createMockWeapon({});
    const b = createMockWeapon({});

    expect(weaponDominates(a, b)).toBe(false);
  });

  it('一部のステータスが低い場合は支配しない', () => {
    const a = createMockWeapon({
      '攻撃力（初期値）': 200,
      '会心率（初期値）': 5, // 低い
    });
    const b = createMockWeapon({
      '攻撃力（初期値）': 100,
      '会心率（初期値）': 10,
    });

    expect(weaponDominates(a, b)).toBe(false);
  });

  it('必要レベルが高い場合は支配しない', () => {
    const highLevel = createMockWeapon({
      使用可能Lv: 50,
      '攻撃力（初期値）': 200,
    });
    const lowLevel = createMockWeapon({
      使用可能Lv: 1,
      '攻撃力（初期値）': 100,
    });

    expect(weaponDominates(highLevel, lowLevel)).toBe(false);
  });
});

describe('armorDominates', () => {
  it('全ステータスが高い防具は支配する', () => {
    const superior = createMockArmor({
      '力（初期値）': 20,
      '魔力（初期値）': 20,
      '体力（初期値）': 20,
      '精神（初期値）': 20,
      '素早さ（初期値）': 20,
      '器用（初期値）': 20,
      '撃力（初期値）': 20,
      '守備力（初期値）': 20,
    });
    const inferior = createMockArmor({});

    expect(armorDominates(superior, inferior)).toBe(true);
  });

  it('一部のステータスが低い場合は支配しない', () => {
    const a = createMockArmor({
      '力（初期値）': 20,
      '魔力（初期値）': 5, // 低い
    });
    const b = createMockArmor({});

    expect(armorDominates(a, b)).toBe(false);
  });
});

describe('accessoryDominates', () => {
  it('全ステータスが高いアクセサリーは支配する', () => {
    const superior = createMockAccessory({
      '力（初期値）': 15,
      '魔力（初期値）': 15,
      '体力（初期値）': 15,
      '精神（初期値）': 15,
      '素早さ（初期値）': 15,
      '撃力（初期値）': 15,
    });
    const inferior = createMockAccessory({});

    expect(accessoryDominates(superior, inferior)).toBe(true);
  });
});

describe('removeWeaponDominated', () => {
  it('被支配武器を除去する', () => {
    const weapons = [
      createMockWeapon({ 名前: 'A', '攻撃力（初期値）': 200 }),
      createMockWeapon({ 名前: 'B', '攻撃力（初期値）': 100 }), // Aに支配される
    ];

    const result = removeWeaponDominated(weapons);

    expect(result.length).toBe(1);
    expect(result[0].名前).toBe('A');
  });

  it('支配関係がない場合は全て残る', () => {
    const weapons = [
      createMockWeapon({ 名前: 'A', '攻撃力（初期値）': 200, '会心率（初期値）': 5 }),
      createMockWeapon({ 名前: 'B', '攻撃力（初期値）': 100, '会心率（初期値）': 20 }),
    ];

    const result = removeWeaponDominated(weapons);

    expect(result.length).toBe(2);
  });

  it('空の配列を処理できる', () => {
    const result = removeWeaponDominated([]);
    expect(result).toEqual([]);
  });
});

describe('removeArmorDominated', () => {
  it('被支配防具を除去する', () => {
    const armors = [
      createMockArmor({ 名前: 'Superior', '力（初期値）': 30, '魔力（初期値）': 30 }),
      createMockArmor({ 名前: 'Inferior', '力（初期値）': 10, '魔力（初期値）': 10 }),
    ];

    const result = removeArmorDominated(armors);

    expect(result.length).toBe(1);
    expect(result[0].名前).toBe('Superior');
  });
});

describe('removeAccessoryDominated', () => {
  it('被支配アクセサリーを除去する', () => {
    const accessories = [
      createMockAccessory({ 名前: 'Superior', '力（初期値）': 20 }),
      createMockAccessory({ 名前: 'Inferior', '力（初期値）': 5 }),
    ];

    const result = removeAccessoryDominated(accessories);

    expect(result.length).toBe(1);
    expect(result[0].名前).toBe('Superior');
  });
});

describe('buildDominates', () => {
  it('スコアが高く全ステータスが同等以上なら支配する', () => {
    const statsA = createMockStats({ Power: 150 });
    const statsB = createMockStats({ Power: 100 });

    expect(buildDominates(statsA, statsB, 1000, 800)).toBe(true);
  });

  it('スコアが低い場合は支配しない', () => {
    const statsA = createMockStats({ Power: 150 });
    const statsB = createMockStats({ Power: 100 });

    expect(buildDominates(statsA, statsB, 700, 800)).toBe(false);
  });

  it('一部のステータスが低い場合は支配しない', () => {
    const statsA = createMockStats({ Power: 150, Magic: 50 });
    const statsB = createMockStats({ Power: 100, Magic: 100 });

    expect(buildDominates(statsA, statsB, 1000, 800)).toBe(false);
  });
});

describe('filterDominatedBuilds', () => {
  it('被支配ビルドを除去する', () => {
    const solutions = [
      { score: 1000, stats: createMockStats({ Power: 150 }) },
      { score: 800, stats: createMockStats({ Power: 100 }) },
    ];

    const result = filterDominatedBuilds(solutions);

    expect(result.length).toBe(1);
    expect(result[0].score).toBe(1000);
  });

  it('Pareto最適解は全て残る', () => {
    const solutions = [
      { score: 1000, stats: createMockStats({ Power: 200, Magic: 50 }) },
      { score: 900, stats: createMockStats({ Power: 100, Magic: 200 }) },
    ];

    const result = filterDominatedBuilds(solutions);

    expect(result.length).toBe(2);
  });

  it('空の配列を処理できる', () => {
    const result = filterDominatedBuilds([]);
    expect(result).toEqual([]);
  });

  it('単一要素の配列はそのまま返す', () => {
    const solutions = [{ score: 1000, stats: createMockStats({}) }];
    const result = filterDominatedBuilds(solutions);
    expect(result).toEqual(solutions);
  });
});
