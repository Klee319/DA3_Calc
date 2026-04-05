/**
 * ルーンストーン・リング計算モジュール
 */

import { RunestoneData } from '@/types/data';
import { EquipmentStats, StatBlock, RingData } from './types';

/**
 * ルーンストーンステータス計算
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

  if (runes.length > 4) {
    throw new Error('Maximum 4 runes allowed');
  }

  const finalStats: StatBlock = {};

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

  return {
    initial: {},
    rankBonus: {},
    reinforcement: {},
    forge: {},
    alchemy: {},
    final: finalStats,
  };
}

/**
 * リングステータス計算（未実装）
 */
export function calculateRingStats(_ring: RingData | null): EquipmentStats {
  return {
    initial: {},
    rankBonus: {},
    reinforcement: {},
    forge: {},
    alchemy: {},
    final: {},
  };
}
