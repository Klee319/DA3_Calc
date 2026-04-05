/**
 * utils.ts のテスト
 * 最適化ユーティリティ関数のテスト
 */

import {
  extractEmblemBonusPercent,
  checkMinimumStats,
  calculateMinimumStatsProgress,
  calculateMinimumStatsDeficit,
  generateWeaponSmithingPatterns,
  generateArmorSmithingCounts,
} from './utils';
import { EmblemData } from '@/types/data';
import { MinimumStatRequirements } from '@/types/optimize';
import { SimpleStatBlock } from './types';

describe('extractEmblemBonusPercent', () => {
  it('紋章から%ボーナスを正しく抽出する', () => {
    const emblem: Partial<EmblemData> = {
      '力（%不要）': 10,
      '魔力（%不要）': 5,
      '体力（%不要）': 20,
      '精神（%不要）': 0,
      '素早さ（%不要）': 15,
      '器用（%不要）': 8,
      '撃力（%不要）': 12,
      '守備力（%不要）': 3,
    };

    const result = extractEmblemBonusPercent(emblem as EmblemData);

    expect(result.Power).toBe(10);
    expect(result.Magic).toBe(5);
    expect(result.HP).toBe(20);
    expect(result.Mind).toBe(0);
    expect(result.Agility).toBe(15);
    expect(result.Dex).toBe(8);
    expect(result.CritDamage).toBe(12);
    expect(result.Defense).toBe(3);
  });

  it('nullの場合は空オブジェクトを返す', () => {
    const result = extractEmblemBonusPercent(null);
    expect(result).toEqual({});
  });

  it('undefinedの場合は空オブジェクトを返す', () => {
    const result = extractEmblemBonusPercent(undefined);
    expect(result).toEqual({});
  });

  it('未定義の値は0として扱う', () => {
    const emblem: Partial<EmblemData> = {
      '力（%不要）': 10,
    };

    const result = extractEmblemBonusPercent(emblem as EmblemData);

    expect(result.Power).toBe(10);
    expect(result.Magic).toBe(0);
  });
});

describe('checkMinimumStats', () => {
  const createStats = (overrides: Partial<SimpleStatBlock>): SimpleStatBlock => ({
    Power: 100,
    Magic: 100,
    HP: 1000,
    Mind: 100,
    Agility: 100,
    Dex: 100,
    CritDamage: 150,
    Defense: 50,
    ...overrides,
  });

  it('最低ステータスを全て満たす場合はtrueを返す', () => {
    const stats = createStats({});
    const minimumStats: MinimumStatRequirements = {
      HP: 500,
      Power: 50,
    };

    expect(checkMinimumStats(stats, minimumStats)).toBe(true);
  });

  it('最低ステータスを満たさない場合はfalseを返す', () => {
    const stats = createStats({ HP: 400 });
    const minimumStats: MinimumStatRequirements = {
      HP: 500,
    };

    expect(checkMinimumStats(stats, minimumStats)).toBe(false);
  });

  it('最低ステータスがundefinedの場合はtrueを返す', () => {
    const stats = createStats({});
    expect(checkMinimumStats(stats, undefined)).toBe(true);
  });

  it('最低ステータスが0の場合は無視する', () => {
    const stats = createStats({ HP: 0 });
    const minimumStats: MinimumStatRequirements = {
      HP: 0,
    };

    expect(checkMinimumStats(stats, minimumStats)).toBe(true);
  });
});

describe('calculateMinimumStatsProgress', () => {
  const createStats = (overrides: Partial<SimpleStatBlock>): SimpleStatBlock => ({
    Power: 100,
    Magic: 100,
    HP: 1000,
    Mind: 100,
    Agility: 100,
    Dex: 100,
    CritDamage: 150,
    Defense: 50,
    ...overrides,
  });

  it('全て達成している場合は1.0を返す', () => {
    const stats = createStats({});
    const minimumStats: MinimumStatRequirements = {
      HP: 500,
      Power: 50,
    };

    expect(calculateMinimumStatsProgress(stats, minimumStats)).toBe(1.0);
  });

  it('半分達成している場合は0.5を返す', () => {
    const stats = createStats({ HP: 250, Power: 25 });
    const minimumStats: MinimumStatRequirements = {
      HP: 500,
      Power: 50,
    };

    expect(calculateMinimumStatsProgress(stats, minimumStats)).toBe(0.5);
  });

  it('最低ステータスがundefinedの場合は1.0を返す', () => {
    const stats = createStats({});
    expect(calculateMinimumStatsProgress(stats, undefined)).toBe(1.0);
  });

  it('最低ステータスが全て0の場合は1.0を返す', () => {
    const stats = createStats({});
    const minimumStats: MinimumStatRequirements = {
      HP: 0,
    };

    expect(calculateMinimumStatsProgress(stats, minimumStats)).toBe(1.0);
  });
});

describe('calculateMinimumStatsDeficit', () => {
  const createStats = (overrides: Partial<SimpleStatBlock>): SimpleStatBlock => ({
    Power: 100,
    Magic: 100,
    HP: 1000,
    Mind: 100,
    Agility: 100,
    Dex: 100,
    CritDamage: 150,
    Defense: 50,
    ...overrides,
  });

  it('全て達成している場合は0を返す', () => {
    const stats = createStats({});
    const minimumStats: MinimumStatRequirements = {
      HP: 500,
      Power: 50,
    };

    expect(calculateMinimumStatsDeficit(stats, minimumStats)).toBe(0);
  });

  it('不足分を正しく計算する', () => {
    const stats = createStats({ HP: 400, Power: 40 });
    const minimumStats: MinimumStatRequirements = {
      HP: 500, // 100不足
      Power: 50, // 10不足
    };

    expect(calculateMinimumStatsDeficit(stats, minimumStats)).toBe(110);
  });

  it('最低ステータスがundefinedの場合は0を返す', () => {
    const stats = createStats({});
    expect(calculateMinimumStatsDeficit(stats, undefined)).toBe(0);
  });
});

describe('generateWeaponSmithingPatterns', () => {
  it('正しいパターン数を生成する', () => {
    const patterns = generateWeaponSmithingPatterns(12);

    expect(patterns.length).toBe(6);
  });

  it('各パターンの合計がmaxCountになる', () => {
    const maxCount = 12;
    const patterns = generateWeaponSmithingPatterns(maxCount);

    for (const pattern of patterns) {
      const total = pattern.attackPower + pattern.critRate + pattern.critDamage;
      expect(total).toBe(maxCount);
    }
  });

  it('全振りパターンが含まれる', () => {
    const maxCount = 12;
    const patterns = generateWeaponSmithingPatterns(maxCount);

    expect(patterns).toContainEqual({ attackPower: maxCount, critRate: 0, critDamage: 0 });
    expect(patterns).toContainEqual({ attackPower: 0, critRate: maxCount, critDamage: 0 });
    expect(patterns).toContainEqual({ attackPower: 0, critRate: 0, critDamage: maxCount });
  });

  it('maxCount=0の場合も正しく処理する', () => {
    const patterns = generateWeaponSmithingPatterns(0);

    expect(patterns.length).toBe(6);
    for (const pattern of patterns) {
      const total = pattern.attackPower + pattern.critRate + pattern.critDamage;
      expect(total).toBe(0);
    }
  });
});

describe('generateArmorSmithingCounts', () => {
  it('maxCountのみを含む配列を返す', () => {
    const result = generateArmorSmithingCounts(12);
    expect(result).toEqual([12]);
  });

  it('0の場合は[0]を返す', () => {
    const result = generateArmorSmithingCounts(0);
    expect(result).toEqual([0]);
  });
});
