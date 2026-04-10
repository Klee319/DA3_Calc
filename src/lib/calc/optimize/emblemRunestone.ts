/**
 * 最適化モジュール - 紋章・ルーンストーン探索
 */

import { EmblemData, RunestoneData } from '@/types/data';
import { RelevantStats } from '../skillAnalyzer';
import { MinimumStatRequirements } from '@/types/optimize';

/** ルーンストーン組み合わせ型 */
export interface RunestoneCombination {
  runestones: RunestoneData[];
  totalBonus: Record<string, number>;
}

/**
 * 紋章のPareto支配フィルタリング
 * @param useStrictDominance true: 全ステータスで完全上位互換のみ除外（遅い）、false: 関連ステータスのみで比較（デフォルト）
 */
export function filterDominatedEmblems(
  emblems: EmblemData[],
  relevantStats?: RelevantStats,
  minimumStats?: MinimumStatRequirements,
  useStrictDominance: boolean = false
): EmblemData[] {
  if (!emblems || emblems.length <= 1) {
    return emblems;
  }

  const statKeyMapping: Record<string, string> = {
    'Power': '力（%不要）',
    'Magic': '魔力（%不要）',
    'HP': '体力（%不要）',
    'Mind': '精神（%不要）',
    'Agility': '素早さ（%不要）',
    'Dex': '器用（%不要）',
    'CritDamage': '撃力（%不要）',
    'Defense': '守備力（%不要）',
  };

  // 比較対象のキーを決定
  let compareKeys: string[];
  if (useStrictDominance) {
    // 全ステータスで比較（完全上位互換判定）
    compareKeys = Object.values(statKeyMapping);
  } else {
    // 関連ステータスのみで比較（デフォルト：高速）
    if (relevantStats && relevantStats.directStats.size > 0) {
      compareKeys = [];
      const directStatsArray = Array.from(relevantStats.directStats);
      for (const internalKey of directStatsArray) {
        const csvKey = statKeyMapping[internalKey];
        if (csvKey) {
          compareKeys.push(csvKey);
        }
      }
      if (!compareKeys.includes('撃力（%不要）')) {
        compareKeys.push('撃力（%不要）');
      }
      // minimumStatsで指定されたステータスも比較対象に追加
      if (minimumStats) {
        for (const statKey of Object.keys(minimumStats)) {
          const csvKey = statKeyMapping[statKey];
          if (csvKey && !compareKeys.includes(csvKey)) {
            compareKeys.push(csvKey);
          }
        }
      }
    } else {
      compareKeys = Object.values(statKeyMapping);
    }
  }

  const getStatValue = (emblem: EmblemData, key: string): number => {
    const value = (emblem as unknown as Record<string, unknown>)[key];
    return typeof value === 'number' ? value : 0;
  };

  const isDominated = (a: EmblemData, b: EmblemData): boolean => {
    let allLessOrEqual = true;
    let anyStrictlyLess = false;

    for (const key of compareKeys) {
      const aVal = getStatValue(a, key);
      const bVal = getStatValue(b, key);
      if (aVal > bVal) {
        allLessOrEqual = false;
        break;
      }
      if (aVal < bVal) {
        anyStrictlyLess = true;
      }
    }

    return allLessOrEqual && anyStrictlyLess;
  };

  const result: EmblemData[] = [];
  for (let i = 0; i < emblems.length; i++) {
    let dominated = false;
    for (let j = 0; j < emblems.length; j++) {
      if (i !== j && isDominated(emblems[i], emblems[j])) {
        dominated = true;
        break;
      }
    }
    if (!dominated) {
      result.push(emblems[i]);
    }
  }

  return result;
}

/**
 * ルーンストーンのステータスボーナスを計算
 * 内部キー形式（Power, Magic, HP, Mind, Agility, Dex, CritDamage, Defense）で返す
 */
export function calculateRunestoneBonus(runestones: RunestoneData[]): Record<string, number> {
  const bonus: Record<string, number> = {};

  for (const rune of runestones) {
    if (rune.力) bonus['Power'] = (bonus['Power'] || 0) + rune.力;
    if (rune.魔力) bonus['Magic'] = (bonus['Magic'] || 0) + rune.魔力;
    if (rune.体力) bonus['HP'] = (bonus['HP'] || 0) + rune.体力;
    if (rune.精神) bonus['Mind'] = (bonus['Mind'] || 0) + rune.精神;
    if (rune.素早さ) bonus['Agility'] = (bonus['Agility'] || 0) + rune.素早さ;
    if (rune.器用) bonus['Dex'] = (bonus['Dex'] || 0) + rune.器用;
    if (rune.撃力) bonus['CritDamage'] = (bonus['CritDamage'] || 0) + rune.撃力;
    if (rune.守備力) bonus['Defense'] = (bonus['Defense'] || 0) + rune.守備力;
  }

  return bonus;
}

/**
 * ルーンストーン組み合わせを生成
 * minimumStatsで指定されたステータスも比較対象に追加
 * 各グレード内で事前にPareto最適なルーンのみを選択して組み合わせ数を削減
 */
export function buildRunestoneCombinations(
  runestones: RunestoneData[],
  relevantStats?: RelevantStats,
  minimumStats?: MinimumStatRequirements
): RunestoneCombination[] {
  if (!runestones || runestones.length === 0) {
    return [{ runestones: [], totalBonus: {} }];
  }

  // 比較対象のステータスキーを構築
  const statKeyMapping: Record<string, string> = {
    'Power': '力',
    'Magic': '魔力',
    'HP': '体力',
    'Mind': '精神',
    'Agility': '素早さ',
    'Dex': '器用',
    'CritDamage': '撃力',
    'Defense': '守備力',
  };

  const compareKeys: string[] = [];
  if (relevantStats) {
    const directStatsArray = Array.from(relevantStats.directStats);
    for (const internalKey of directStatsArray) {
      const csvKey = statKeyMapping[internalKey];
      if (csvKey) {
        compareKeys.push(csvKey);
      }
    }
  }
  if (!compareKeys.includes('撃力')) {
    compareKeys.push('撃力');
  }
  // minimumStatsで指定されたステータスも比較対象に追加
  if (minimumStats) {
    for (const statKey of Object.keys(minimumStats)) {
      const csvKey = statKeyMapping[statKey];
      if (csvKey && !compareKeys.includes(csvKey)) {
        compareKeys.push(csvKey);
      }
    }
  }

  // 各グレードごとにルーンストーンをグループ化
  const grades = ['ノーマル', 'グレート', 'バスター', 'レプリカ'] as const;
  const byGrade: Map<string, RunestoneData[]> = new Map();
  for (const grade of grades) {
    byGrade.set(grade, []);
  }
  for (const rune of runestones) {
    const gradeList = byGrade.get(rune.グレード);
    if (gradeList) {
      gradeList.push(rune);
    }
  }

  // 各グレード内でPareto最適なルーンのみを選択（事前フィルタリング）
  const getStatValue = (rune: RunestoneData, key: string): number => {
    const runeAny = rune as unknown as Record<string, unknown>;
    const value = runeAny[key];
    return typeof value === 'number' ? value : 0;
  };

  const isDominatedRune = (a: RunestoneData, b: RunestoneData): boolean => {
    let allLessOrEqual = true;
    let anyStrictlyLess = false;
    for (const key of compareKeys) {
      const aVal = getStatValue(a, key);
      const bVal = getStatValue(b, key);
      if (aVal > bVal) {
        allLessOrEqual = false;
        break;
      }
      if (aVal < bVal) {
        anyStrictlyLess = true;
      }
    }
    return allLessOrEqual && anyStrictlyLess;
  };

  const filterDominatedInGrade = (runesInGrade: RunestoneData[]): RunestoneData[] => {
    if (runesInGrade.length <= 1) return runesInGrade;
    const result: RunestoneData[] = [];
    for (let i = 0; i < runesInGrade.length; i++) {
      let dominated = false;
      for (let j = 0; j < runesInGrade.length; j++) {
        if (i !== j && isDominatedRune(runesInGrade[i], runesInGrade[j])) {
          dominated = true;
          break;
        }
      }
      if (!dominated) {
        result.push(runesInGrade[i]);
      }
    }
    return result;
  };

  // 各グレードでPareto最適なルーンのみを選択（常に4つ選択）
  const gradeOptions: RunestoneData[][] = grades.map(grade => {
    const runesInGrade = byGrade.get(grade) || [];
    const filtered = filterDominatedInGrade(runesInGrade);
    // グレードにルーンストーンがない場合は空配列（そのグレードはスキップ）
    return filtered;
  });

  // 組み合わせを生成
  const combinations: RunestoneCombination[] = [];

  const generateCombinations = (
    gradeIndex: number,
    currentRunes: RunestoneData[]
  ): void => {
    if (gradeIndex >= gradeOptions.length) {
      const totalBonus = calculateRunestoneBonus(currentRunes);
      combinations.push({
        runestones: [...currentRunes],
        totalBonus,
      });
      return;
    }

    const options = gradeOptions[gradeIndex];
    if (options.length === 0) {
      // このグレードにルーンストーンがない場合はスキップ
      generateCombinations(gradeIndex + 1, currentRunes);
    } else {
      for (const option of options) {
        generateCombinations(gradeIndex + 1, [...currentRunes, option]);
      }
    }
  };

  generateCombinations(0, []);

  // 組み合わせレベルでもPareto枝刈り
  if (compareKeys.length > 0) {
    const getCombStatValue = (comb: RunestoneCombination, key: string): number => {
      return (comb.totalBonus as Record<string, number>)[key] || 0;
    };

    const isDominatedComb = (a: RunestoneCombination, b: RunestoneCombination): boolean => {
      let dominated = true;
      let strictlyWorse = false;

      for (const key of compareKeys) {
        const aVal = getCombStatValue(a, key);
        const bVal = getCombStatValue(b, key);
        if (aVal > bVal) {
          dominated = false;
          break;
        }
        if (aVal < bVal) {
          strictlyWorse = true;
        }
      }

      return dominated && strictlyWorse;
    };

    const nonDominated: RunestoneCombination[] = [];
    for (const comb of combinations) {
      let dominated = false;
      for (const other of combinations) {
        if (comb !== other && isDominatedComb(comb, other)) {
          dominated = true;
          break;
        }
      }
      if (!dominated) {
        nonDominated.push(comb);
      }
    }

    // 依存ステの重み付きスコアで降順ソート（Beam Searchが上位N件を使うため重要）
    if (relevantStats?.statCoefficients) {
      const coeffs = relevantStats.statCoefficients;
      nonDominated.sort((a, b) => {
        const scoreA = Object.entries(a.totalBonus).reduce((sum, [key, val]) => {
          const c = coeffs[key] ?? 0;
          return sum + (val as number) * (c > 0 ? c : 0);
        }, 0);
        const scoreB = Object.entries(b.totalBonus).reduce((sum, [key, val]) => {
          const c = coeffs[key] ?? 0;
          return sum + (val as number) * (c > 0 ? c : 0);
        }, 0);
        return scoreB - scoreA;
      });
    }

    return nonDominated;
  }

  // ソートなしPareto枝刈りなしの場合も重み付きソート
  if (relevantStats?.statCoefficients) {
    const coeffs = relevantStats.statCoefficients;
    combinations.sort((a, b) => {
      const scoreA = Object.entries(a.totalBonus).reduce((sum, [key, val]) => {
        const c = coeffs[key] ?? 0;
        return sum + (val as number) * (c > 0 ? c : 0);
      }, 0);
      const scoreB = Object.entries(b.totalBonus).reduce((sum, [key, val]) => {
        const c = coeffs[key] ?? 0;
        return sum + (val as number) * (c > 0 ? c : 0);
      }, 0);
      return scoreB - scoreA;
    });
  }

  return combinations;
}
