/**
 * 最適化モジュール - SP自動最適化
 *
 * ユーザの手動SP配分を尊重しつつ、余剰SPを
 * 依存ステータスの重みに基づいて自動配分する。
 * ブランチ→ステータスのマッピングはjobSPDataから動的に取得。
 */

import type { JobSPData } from '@/types/data';
import type { RelevantStats } from '../skillAnalyzer';

/** SP自動配分結果 */
export interface SPOptimizeResult {
  allocation: Record<string, number>;
  totalUsed: number;
  remainingSP: number;
}

/** 日本語ステータス名→内部キーのマッピング */
const JP_TO_INTERNAL: Record<string, string> = {
  '体力': 'HP',
  '力': 'Power',
  '魔力': 'Magic',
  '精神': 'Mind',
  '素早さ': 'Agility',
  '器用さ': 'Dex',
  '撃力': 'CritDamage',
  '守備力': 'Defense',
};

/**
 * jobSPDataからブランチ→ステータスのマッピングを動的に構築
 * 各ブランチ(A,B,C)の行を調べ、非0のステータスカラムを特定する
 */
function buildBranchStatMapping(
  jobSPData: JobSPData[],
): Record<string, string[]> {
  const mapping: Record<string, Set<string>> = {};
  const statKeys = Object.keys(JP_TO_INTERNAL) as (keyof JobSPData)[];

  for (const row of jobSPData) {
    const phase = row.解法段階;
    if (!phase) continue;

    const branch = phase.split('-')[0]; // 'A', 'B', or 'C'
    if (!branch || !['A', 'B', 'C'].includes(branch)) continue;

    if (!mapping[branch]) mapping[branch] = new Set();

    for (const jpKey of statKeys) {
      const value = row[jpKey];
      const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value || 0;
      if (numValue > 0) {
        const internalKey = JP_TO_INTERNAL[jpKey as string];
        if (internalKey) mapping[branch].add(internalKey);
      }
    }
  }

  const result: Record<string, string[]> = {};
  for (const [branch, stats] of Object.entries(mapping)) {
    result[branch] = Array.from(stats);
  }

  // マッピングが空の場合のフォールバック
  if (Object.keys(result).length === 0) {
    return { 'A': ['Power'], 'B': ['Magic'], 'C': ['HP', 'Defense'] };
  }

  return result;
}

/**
 * jobSPDataからブランチの最大SP上限を取得
 */
function getBranchMaxSP(
  jobSPData: JobSPData[],
): Record<string, number> {
  const maxSP: Record<string, number> = {};

  for (const row of jobSPData) {
    const phase = row.解法段階;
    if (!phase) continue;

    const branch = phase.split('-')[0];
    if (!branch || !['A', 'B', 'C'].includes(branch)) continue;

    const requiredSP = typeof row.必要SP === 'string'
      ? parseFloat(row.必要SP) || 0
      : row.必要SP || 0;

    maxSP[branch] = Math.max(maxSP[branch] || 0, requiredSP);
  }

  return maxSP;
}

/**
 * 余剰SPを依存ステータス重みで自動配分
 */
export function optimizeRemainingSP(
  userAllocation: Record<string, number>,
  jobSPData: JobSPData[] | undefined,
  maxSP: number,
  relevantStats: RelevantStats | undefined,
): SPOptimizeResult {
  const userUsed = Object.values(userAllocation).reduce((sum, v) => sum + (v || 0), 0);
  const remaining = Math.max(0, maxSP - userUsed);

  if (remaining === 0 || !jobSPData || jobSPData.length === 0) {
    return {
      allocation: { ...userAllocation },
      totalUsed: userUsed,
      remainingSP: remaining,
    };
  }

  const directStats = relevantStats?.directStats
    ? Array.from(relevantStats.directStats)
    : ['Power', 'Magic', 'CritDamage'];

  // jobSPDataからブランチ→ステータスを動的取得
  const branchStatMapping = buildBranchStatMapping(jobSPData);
  const branchMaxSP = getBranchMaxSP(jobSPData);

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

  // 余剰SPをブランチ上限を考慮しつつ重みに基づいて配分
  const optimizedAllocation = { ...userAllocation };
  let allocated = 0;
  let remainingToAllocate = remaining;

  const sortedBranches = Object.entries(branchWeights)
    .sort(([, a], [, b]) => b - a);

  // 1パス目: 重みに基づいて配分（上限チェック付き）
  for (const [branch, weight] of sortedBranches) {
    const currentValue = optimizedAllocation[branch] || 0;
    const maxForBranch = branchMaxSP[branch] || Infinity;
    const headroom = Math.max(0, maxForBranch - currentValue);

    const idealShare = Math.floor((remaining * weight) / totalWeight);
    const actualShare = Math.min(idealShare, headroom);

    optimizedAllocation[branch] = currentValue + actualShare;
    allocated += actualShare;
  }

  // 2パス目: 端数・上限超過分を空きのあるブランチに配分
  remainingToAllocate = remaining - allocated;
  if (remainingToAllocate > 0) {
    for (const [branch] of sortedBranches) {
      if (remainingToAllocate <= 0) break;
      const currentValue = optimizedAllocation[branch] || 0;
      const maxForBranch = branchMaxSP[branch] || Infinity;
      const headroom = Math.max(0, maxForBranch - currentValue);

      const extra = Math.min(remainingToAllocate, headroom);
      optimizedAllocation[branch] = currentValue + extra;
      remainingToAllocate -= extra;
    }
  }

  return {
    allocation: optimizedAllocation,
    totalUsed: userUsed + remaining - remainingToAllocate,
    remainingSP: remainingToAllocate,
  };
}
