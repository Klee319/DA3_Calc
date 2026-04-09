/**
 * 最適化モジュール - SP自動最適化
 *
 * ユーザの手動SP配分を尊重しつつ、余剰SPを
 * 依存ステータスの重みに基づいて自動配分する。
 */

import type { JobSPData } from '@/types/data';
import type { RelevantStats } from '../skillAnalyzer';

/** SP自動配分結果 */
export interface SPOptimizeResult {
  allocation: Record<string, number>;
  totalUsed: number;
  remainingSP: number;
}

/**
 * 余剰SPを依存ステータス重みで自動配分
 *
 * @param userAllocation ユーザの手動SP配分
 * @param jobSPData 職業のSPデータ（ブランチ定義）
 * @param maxSP 利用可能な最大SP
 * @param relevantStats 依存ステータス情報
 */
export function optimizeRemainingSP(
  userAllocation: Record<string, number>,
  jobSPData: JobSPData[] | undefined,
  maxSP: number,
  relevantStats: RelevantStats | undefined,
): SPOptimizeResult {
  // ユーザの手動配分の合計
  const userUsed = Object.values(userAllocation).reduce((sum, v) => sum + (v || 0), 0);
  const remaining = Math.max(0, maxSP - userUsed);

  if (remaining === 0 || !jobSPData || jobSPData.length === 0) {
    return {
      allocation: { ...userAllocation },
      totalUsed: userUsed,
      remainingSP: remaining,
    };
  }

  // 依存ステータスに寄与するSPブランチを特定
  const directStats = relevantStats?.directStats
    ? Array.from(relevantStats.directStats)
    : ['Power', 'Magic', 'CritDamage'];

  // SPブランチの名前→ステータスマッピング（ゲーム固有）
  const branchStatMapping: Record<string, string[]> = {
    'A': ['Power'],
    'B': ['Magic'],
    'C': ['HP', 'Defense'],
  };

  // 各ブランチへの重みを計算
  const branchWeights: Record<string, number> = {};
  let totalWeight = 0;

  for (const [branch, stats] of Object.entries(branchStatMapping)) {
    let weight = 0;
    for (const stat of stats) {
      if (directStats.includes(stat)) {
        const coeff = relevantStats?.statCoefficients?.[stat] ?? 1;
        weight += coeff > 0 ? coeff : 1;
      }
    }
    branchWeights[branch] = weight;
    totalWeight += weight;
  }

  // 重みがない場合は均等配分
  if (totalWeight === 0) {
    const branchCount = Object.keys(branchWeights).length;
    for (const branch of Object.keys(branchWeights)) {
      branchWeights[branch] = 1 / branchCount;
    }
    totalWeight = 1;
  }

  // 余剰SPを重みに基づいて配分
  const optimizedAllocation = { ...userAllocation };
  let allocated = 0;

  const sortedBranches = Object.entries(branchWeights)
    .sort(([, a], [, b]) => b - a);

  for (const [branch, weight] of sortedBranches) {
    const share = Math.floor((remaining * weight) / totalWeight);
    const currentValue = optimizedAllocation[branch] || 0;
    optimizedAllocation[branch] = currentValue + share;
    allocated += share;
  }

  // 端数を最重要ブランチに配分
  if (allocated < remaining && sortedBranches.length > 0) {
    const topBranch = sortedBranches[0][0];
    const currentValue = optimizedAllocation[topBranch] || 0;
    optimizedAllocation[topBranch] = currentValue + (remaining - allocated);
  }

  return {
    allocation: optimizedAllocation,
    totalUsed: userUsed + remaining,
    remainingSP: 0,
  };
}
