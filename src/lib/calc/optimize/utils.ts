/**
 * 最適化モジュール - ユーティリティ関数
 */

import { StatBlock } from '@/types/calc';
import { EmblemData, ArmorData } from '@/types/data';
import { MinimumStatRequirements } from '@/types/optimize';
import { ArmorSmithingDistribution } from '../equipment/types';
import { RelevantStats } from '../skillAnalyzer';
import { SimpleStatBlock } from './types';

/**
 * 紋章から%ボーナスを抽出
 */
export function extractEmblemBonusPercent(emblem: EmblemData | null | undefined): StatBlock {
  if (!emblem) return {};
  return {
    Power: emblem['力（%不要）'] || 0,
    Magic: emblem['魔力（%不要）'] || 0,
    HP: emblem['体力（%不要）'] || 0,
    Mind: emblem['精神（%不要）'] || 0,
    Agility: emblem['素早さ（%不要）'] || 0,
    Dex: emblem['器用（%不要）'] || 0,
    CritDamage: emblem['撃力（%不要）'] || 0,
    Defense: emblem['守備力（%不要）'] || 0,
  };
}

/**
 * 最低必須ステータスを満たしているかチェック
 */
export function checkMinimumStats(
  stats: StatBlock | SimpleStatBlock,
  minimumStats: MinimumStatRequirements | undefined
): boolean {
  if (!minimumStats) return true;

  const statKeys = ['HP', 'Power', 'Magic', 'Defense', 'Mind', 'Agility', 'Dex', 'CritDamage'] as const;

  for (const stat of statKeys) {
    const minValue = minimumStats[stat];
    if (minValue !== undefined && minValue > 0) {
      const actualValue = (stats as Record<string, number>)[stat] || 0;
      if (actualValue < minValue) {
        return false;
      }
    }
  }
  return true;
}

/**
 * 最低必須ステータスへの達成度を計算（0.0〜1.0）
 */
export function calculateMinimumStatsProgress(
  stats: StatBlock | SimpleStatBlock,
  minimumStats: MinimumStatRequirements | undefined
): number {
  if (!minimumStats) return 1.0;

  const statKeys = ['HP', 'Power', 'Magic', 'Defense', 'Mind', 'Agility', 'Dex', 'CritDamage'] as const;
  let totalRequired = 0;
  let totalAchieved = 0;

  for (const stat of statKeys) {
    const minValue = minimumStats[stat];
    if (minValue !== undefined && minValue > 0) {
      totalRequired += minValue;
      const actualValue = (stats as Record<string, number>)[stat] || 0;
      totalAchieved += Math.min(actualValue, minValue);
    }
  }

  if (totalRequired === 0) return 1.0;
  return totalAchieved / totalRequired;
}

/**
 * 最低必須ステータスの不足分を計算
 */
export function calculateMinimumStatsDeficit(
  stats: StatBlock | SimpleStatBlock,
  minimumStats: MinimumStatRequirements | undefined
): number {
  if (!minimumStats) return 0;

  const statKeys = ['HP', 'Power', 'Magic', 'Defense', 'Mind', 'Agility', 'Dex', 'CritDamage'] as const;
  let totalDeficit = 0;

  for (const stat of statKeys) {
    const minValue = minimumStats[stat];
    if (minValue !== undefined && minValue > 0) {
      const actualValue = (stats as Record<string, number>)[stat] || 0;
      const deficit = Math.max(0, minValue - actualValue);
      totalDeficit += deficit;
    }
  }

  return totalDeficit;
}

/**
 * 武器叩き配分パターンを生成
 */
export function generateWeaponSmithingPatterns(maxCount: number): { attackPower: number; critRate: number; critDamage: number }[] {
  const patterns: { attackPower: number; critRate: number; critDamage: number }[] = [];

  patterns.push({ attackPower: maxCount, critRate: 0, critDamage: 0 });
  patterns.push({ attackPower: 0, critRate: maxCount, critDamage: 0 });
  patterns.push({ attackPower: 0, critRate: 0, critDamage: maxCount });

  const third = Math.floor(maxCount / 3);
  patterns.push({ attackPower: third, critRate: third, critDamage: maxCount - third * 2 });

  const half = Math.floor(maxCount / 2);
  patterns.push({ attackPower: half, critRate: maxCount - half, critDamage: 0 });
  patterns.push({ attackPower: half, critRate: 0, critDamage: maxCount - half });

  return patterns;
}

/**
 * 防具叩き配分を決定
 */
export function determineArmorSmithingDistribution(
  armor: ArmorData,
  relevantStats: RelevantStats | undefined,
  maxCount: number = 12,
  minimumStats?: MinimumStatRequirements
): ArmorSmithingDistribution {
  const availableStats: { key: keyof ArmorSmithingDistribution; csvKey: string; priority: number }[] = [];

  // 器用（Dex）は会心率に変換され100%キャップがあるため、叩き対象から除外
  // 会心率は武器からのみで十分なことが多い
  const statMapping = [
    { key: 'power' as const, csvKey: '力（初期値）', internalKey: 'Power' },
    { key: 'magic' as const, csvKey: '魔力（初期値）', internalKey: 'Magic' },
    { key: 'hp' as const, csvKey: '体力（初期値）', internalKey: 'HP' },
    { key: 'mind' as const, csvKey: '精神（初期値）', internalKey: 'Mind' },
    { key: 'speed' as const, csvKey: '素早さ（初期値）', internalKey: 'Agility' },
    // { key: 'dexterity' as const, csvKey: '器用（初期値）', internalKey: 'Dex' },  // 叩き除外
    { key: 'critDamage' as const, csvKey: '撃力（初期値）', internalKey: 'CritDamage' },
    { key: 'defense' as const, csvKey: '守備力（初期値）', internalKey: 'Defense' },
  ];

  for (const stat of statMapping) {
    const baseValue = armor[stat.csvKey as keyof ArmorData] as number || 0;
    if (baseValue > 0) {
      const hasMinimumRequirement = minimumStats?.[stat.internalKey as keyof MinimumStatRequirements] !== undefined &&
        (minimumStats[stat.internalKey as keyof MinimumStatRequirements] || 0) > 0;
      const isRelevant = relevantStats?.directStats?.has(stat.internalKey as any) || false;
      const isAttackStat = stat.key === 'power' || stat.key === 'magic' || stat.key === 'critDamage';

      const priority = hasMinimumRequirement ? 200 : (isRelevant ? 100 : (isAttackStat ? 50 : 10));
      availableStats.push({ key: stat.key, csvKey: stat.csvKey, priority });
    }
  }

  if (availableStats.length === 0) {
    return {};
  }

  availableStats.sort((a, b) => b.priority - a.priority);

  const distribution: ArmorSmithingDistribution = {};

  const highPriorityStats = availableStats.filter(s => s.priority === availableStats[0].priority);

  if (highPriorityStats.length === 1) {
    distribution[highPriorityStats[0].key] = maxCount;
  } else if (highPriorityStats.length === 2) {
    const half = Math.floor(maxCount / 2);
    distribution[highPriorityStats[0].key] = half;
    distribution[highPriorityStats[1].key] = maxCount - half;
  } else {
    const each = Math.floor(maxCount / highPriorityStats.length);
    let remaining = maxCount;
    for (let i = 0; i < highPriorityStats.length; i++) {
      if (i === highPriorityStats.length - 1) {
        distribution[highPriorityStats[i].key] = remaining;
      } else {
        distribution[highPriorityStats[i].key] = each;
        remaining -= each;
      }
    }
  }

  return distribution;
}

/**
 * 防具叩き回数パターンを生成
 */
export function generateArmorSmithingCounts(maxCount: number): number[] {
  return [maxCount];
}

/**
 * 防具の複数の叩き配分パターンを生成
 */
export function generateArmorSmithingPatterns(
  armor: ArmorData,
  relevantStats: RelevantStats | undefined,
  maxCount: number = 12,
  minimumStats?: MinimumStatRequirements
): ArmorSmithingDistribution[] {
  const patterns: ArmorSmithingDistribution[] = [];

  // 器用さ（Dex）はゲームシステムで叩き対象外のため除外
  const statMapping = [
    { key: 'power' as const, csvKey: '力（初期値）', internalKey: 'Power' },
    { key: 'magic' as const, csvKey: '魔力（初期値）', internalKey: 'Magic' },
    { key: 'hp' as const, csvKey: '体力（初期値）', internalKey: 'HP' },
    { key: 'mind' as const, csvKey: '精神（初期値）', internalKey: 'Mind' },
    { key: 'speed' as const, csvKey: '素早さ（初期値）', internalKey: 'Agility' },
    // { key: 'dexterity' as const, csvKey: '器用（初期値）', internalKey: 'Dex' },  // 叩き対象外
    { key: 'critDamage' as const, csvKey: '撃力（初期値）', internalKey: 'CritDamage' },
    { key: 'defense' as const, csvKey: '守備力（初期値）', internalKey: 'Defense' },
  ];

  const requiredStatKeys: (keyof ArmorSmithingDistribution)[] = [];
  if (minimumStats) {
    for (const stat of statMapping) {
      const minValue = minimumStats[stat.internalKey as keyof MinimumStatRequirements];
      if (minValue !== undefined && minValue > 0) {
        const baseValue = armor[stat.csvKey as keyof ArmorData] as number || 0;
        if (baseValue > 0) {
          requiredStatKeys.push(stat.key);
        }
      }
    }
  }

  const availableStats: { key: keyof ArmorSmithingDistribution; priority: number; isRequired: boolean }[] = [];

  for (const stat of statMapping) {
    const baseValue = armor[stat.csvKey as keyof ArmorData] as number || 0;
    if (baseValue > 0) {
      const coeff = relevantStats?.statCoefficients?.[stat.internalKey as keyof typeof relevantStats.statCoefficients] || 0;
      const isRelevant = relevantStats?.directStats?.has(stat.internalKey as any) || false;
      const isAttackStat = stat.key === 'power' || stat.key === 'magic' || stat.key === 'critDamage';
      const isRequired = requiredStatKeys.includes(stat.key);

      const priority = coeff > 0 ? coeff * 100 : (isRelevant ? 100 : (isAttackStat ? 50 : 10));
      availableStats.push({ key: stat.key, priority, isRequired });
    }
  }

  if (availableStats.length === 0) {
    return [{}];
  }

  availableStats.sort((a, b) => b.priority - a.priority);

  if (requiredStatKeys.length > 0) {
    for (const reqKey of requiredStatKeys) {
      const reqPattern: ArmorSmithingDistribution = {};
      reqPattern[reqKey] = maxCount;
      patterns.push(reqPattern);
    }

    const topDamageStat = availableStats.find(s => !s.isRequired);
    if (topDamageStat && requiredStatKeys.length === 1) {
      const mixPattern: ArmorSmithingDistribution = {};
      const half = Math.floor(maxCount / 2);
      mixPattern[requiredStatKeys[0]] = half;
      mixPattern[topDamageStat.key] = maxCount - half;
      patterns.push(mixPattern);

      const mix84Pattern: ArmorSmithingDistribution = {};
      mix84Pattern[requiredStatKeys[0]] = 8;
      mix84Pattern[topDamageStat.key] = 4;
      patterns.push(mix84Pattern);

      const mix48Pattern: ArmorSmithingDistribution = {};
      mix48Pattern[requiredStatKeys[0]] = 4;
      mix48Pattern[topDamageStat.key] = 8;
      patterns.push(mix48Pattern);
    }
  }

  const pattern1: ArmorSmithingDistribution = {};
  pattern1[availableStats[0].key] = maxCount;
  patterns.push(pattern1);

  if (availableStats.length >= 2) {
    const pattern2: ArmorSmithingDistribution = {};
    const half = Math.floor(maxCount / 2);
    pattern2[availableStats[0].key] = half;
    pattern2[availableStats[1].key] = maxCount - half;
    patterns.push(pattern2);
  }

  if (availableStats.length >= 2) {
    const pattern3: ArmorSmithingDistribution = {};
    pattern3[availableStats[0].key] = 8;
    pattern3[availableStats[1].key] = 4;
    patterns.push(pattern3);
  }

  if (availableStats.length >= 3) {
    const pattern4: ArmorSmithingDistribution = {};
    const each = Math.floor(maxCount / 3);
    pattern4[availableStats[0].key] = each;
    pattern4[availableStats[1].key] = each;
    pattern4[availableStats[2].key] = maxCount - each * 2;
    patterns.push(pattern4);
  }

  // P:Mバランス調整用: Power全振り、Magic全振りパターンを追加
  // (SpellRefactor等でP=Mが必要な場合に有効)
  const hasPower = availableStats.some(s => s.key === 'power');
  const hasMagic = availableStats.some(s => s.key === 'magic');
  if (hasPower && availableStats[0].key !== 'power') {
    const powerPattern: ArmorSmithingDistribution = { power: maxCount };
    patterns.push(powerPattern);
  }
  if (hasMagic && availableStats[0].key !== 'magic') {
    const magicPattern: ArmorSmithingDistribution = { magic: maxCount };
    patterns.push(magicPattern);
  }

  return patterns;
}

// ===== 二段階生成: 粗い候補・詳細化 =====

/**
 * 粗い武器叩きパターンを生成（Beam Search初期段階用）
 * 全パターンの代表3-5個のみを返す
 */
export function generateCoarseWeaponSmithingPatterns(
  maxCount: number
): { attackPower: number; critRate: number; critDamage: number }[] {
  return [
    { attackPower: maxCount, critRate: 0, critDamage: 0 },          // 攻撃全振り
    { attackPower: 0, critRate: 0, critDamage: maxCount },          // 会心ダメ全振り
    { attackPower: Math.floor(maxCount / 3), critRate: Math.floor(maxCount / 3), critDamage: maxCount - Math.floor(maxCount / 3) * 2 }, // 均等
    { attackPower: Math.floor(maxCount / 2), critRate: 0, critDamage: maxCount - Math.floor(maxCount / 2) }, // 攻撃+会心ダメ半々
    { attackPower: 0, critRate: maxCount, critDamage: 0 },          // 会心率全振り
  ];
}

/**
 * 粗い防具叩きパターンを生成（Beam Search初期段階用）
 */
export function generateCoarseArmorSmithingPatterns(
  armor: ArmorData,
  relevantStats: RelevantStats | undefined,
  maxCount: number = 12
): ArmorSmithingDistribution[] {
  const statMapping = [
    { key: 'power' as const, internalKey: 'Power', csvKey: '力（初期値）' },
    { key: 'magic' as const, internalKey: 'Magic', csvKey: '魔力（初期値）' },
    { key: 'critDamage' as const, internalKey: 'CritDamage', csvKey: '撃力（初期値）' },
    { key: 'hp' as const, internalKey: 'HP', csvKey: '体力（初期値）' },
    { key: 'mind' as const, internalKey: 'Mind', csvKey: '精神（初期値）' },
    { key: 'speed' as const, internalKey: 'Agility', csvKey: '素早さ（初期値）' },
    { key: 'defense' as const, internalKey: 'Defense', csvKey: '守備力（初期値）' },
  ];

  // 利用可能なステータスを重み順でソート
  const available = statMapping
    .filter(s => (armor[s.csvKey as keyof ArmorData] as number || 0) > 0)
    .map(s => ({
      ...s,
      weight: relevantStats?.statCoefficients?.[s.internalKey] ??
        (relevantStats?.directStats?.has(s.internalKey as any) ? 1 : 0),
    }))
    .sort((a, b) => b.weight - a.weight);

  if (available.length === 0) return [{}];

  const patterns: ArmorSmithingDistribution[] = [];

  // パターン1: 最重要ステ全振り
  patterns.push({ [available[0].key]: maxCount });

  // パターン2: 上位2ステ半々
  if (available.length >= 2) {
    const half = Math.floor(maxCount / 2);
    patterns.push({
      [available[0].key]: half,
      [available[1].key]: maxCount - half,
    });
  }

  // パターン3: 最重要ステ + 撃力（撃力が最重要でない場合）
  const critDamageStat = available.find(s => s.key === 'critDamage');
  if (critDamageStat && available[0].key !== 'critDamage') {
    patterns.push({
      [available[0].key]: Math.floor(maxCount * 2 / 3),
      critDamage: maxCount - Math.floor(maxCount * 2 / 3),
    });
  }

  return patterns;
}

/**
 * 叩き配分を局所探索で詳細化（Hill Climbing）
 * 近傍: ステータス間で1回ずつ移動
 */
export function refineSmithingPattern(
  currentPattern: Record<string, number>,
  evaluateFn: (pattern: Record<string, number>) => number,
  maxCount: number,
  maxIterations: number = 20,
): Record<string, number> {
  let best = { ...currentPattern };
  let bestScore = evaluateFn(best);
  const stats = Object.keys(best).filter(k => best[k] > 0 || k === 'power' || k === 'magic' || k === 'critDamage');

  for (let iter = 0; iter < maxIterations; iter++) {
    let improved = false;

    for (let i = 0; i < stats.length; i++) {
      for (let j = 0; j < stats.length; j++) {
        if (i === j) continue;
        if ((best[stats[i]] || 0) <= 0) continue;

        // stats[i] から stats[j] に1回移動
        const candidate = { ...best };
        candidate[stats[i]] = (candidate[stats[i]] || 0) - 1;
        candidate[stats[j]] = (candidate[stats[j]] || 0) + 1;

        // 合計がmaxCountを超えていないか確認
        const total = Object.values(candidate).reduce((sum, v) => sum + v, 0);
        if (total !== maxCount) continue;

        const score = evaluateFn(candidate);
        if (score > bestScore) {
          best = candidate;
          bestScore = score;
          improved = true;
        }
      }
    }

    if (!improved) break;
  }

  return best;
}

/**
 * 最低必須ステータスを考慮したEXパターンを生成
 */
export function generateEXPatternsForMinimumStats(
  relevantStats: RelevantStats | undefined,
  minimumStats: MinimumStatRequirements | undefined,
  equipmentType: 'armor' | 'accessory'
): { ex1: string; ex2: string }[] {
  const { getDiverseEXCombinations } = require('../skillAnalyzer');

  let exPatterns = relevantStats
    ? getDiverseEXCombinations(relevantStats, equipmentType).map((e: any) => ({
        ex1: e.combination.ex1,
        ex2: e.combination.ex2
      }))
    : [
        { ex1: 'Power', ex2: 'Magic' },
        { ex1: 'Power', ex2: 'CritDamage' },
        { ex1: 'CritDamage', ex2: 'CritDamage' }
      ];

  if (minimumStats) {
    const exTypeMapping: Record<string, string | undefined> = {
      'HP': 'HP',
      'Power': 'Power',
      'Magic': 'Magic',
      'Mind': 'Mind',
      'Agility': 'Speed',
      'Dex': 'Dex',
      'CritDamage': 'CritDamage',
      // Note: DefenseにはEXが存在しない。叩きで上げる必要がある
    };

    const requiredExPatterns: { ex1: string; ex2: string }[] = [];

    for (const [statKey, minValue] of Object.entries(minimumStats)) {
      if (minValue !== undefined && minValue > 0) {
        const exType = exTypeMapping[statKey];
        if (exType) {
          requiredExPatterns.push({ ex1: exType, ex2: exType });
          requiredExPatterns.push(
            { ex1: exType, ex2: 'Power' },
            { ex1: exType, ex2: 'Magic' },
            { ex1: exType, ex2: 'CritDamage' }
          );
        }
      }
    }

    for (const reqPattern of requiredExPatterns) {
      const exists = exPatterns.some(
        (p: { ex1: string; ex2: string }) => p.ex1 === reqPattern.ex1 && p.ex2 === reqPattern.ex2
      );
      if (!exists) {
        exPatterns.push(reqPattern);
      }
    }
  }

  return exPatterns;
}
