/**
 * 最適化モジュール - SP自動最適化
 *
 * 各ティアのSP効率（SPあたりの依存ステ寄与）を計算し、
 * 効率の高いティアから貪欲に取得する。
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

/** ティアの情報 */
interface TierInfo {
  branch: string;
  tier: number;
  requiredSP: number;    // このティアまでの累積必要SP
  incrementalSP: number; // 前ティアからの追加必要SP
  statGain: Record<string, number>; // このティアで得られるステータス
  efficiency: number;    // SP効率（依存ステ重み付き合計 / 追加SP）
}

/**
 * 全ティアの情報を解析し、SP効率を計算
 */
function analyzeTiers(
  jobSPData: JobSPData[],
  relevantStats: RelevantStats | undefined,
): TierInfo[] {
  const tiers: TierInfo[] = [];
  const statKeys = Object.keys(JP_TO_INTERNAL) as (keyof JobSPData)[];
  const prevSP: Record<string, number> = {};

  for (const row of jobSPData) {
    const phase = row.解法段階;
    if (!phase || phase === '初期値' || phase.startsWith('職業補正')) continue;

    const match = phase.match(/^([A-C])-(\d+)$/);
    if (!match) continue;

    const branch = match[1];
    const tier = parseInt(match[2]);
    const requiredSP = typeof row.必要SP === 'string' ? parseFloat(row.必要SP) || 0 : row.必要SP || 0;
    const incrementalSP = requiredSP - (prevSP[branch] || 0);
    prevSP[branch] = requiredSP;

    if (incrementalSP <= 0) continue;

    // このティアで得られるステータス
    const statGain: Record<string, number> = {};
    let weightedGain = 0;

    for (const jpKey of statKeys) {
      const value = row[jpKey];
      const numValue = typeof value === 'string' ? parseFloat(value) || 0 : (value as number) || 0;
      if (numValue > 0) {
        const internalKey = JP_TO_INTERNAL[jpKey as string];
        if (internalKey) {
          statGain[internalKey] = numValue;

          // 依存ステの重みで効率を計算
          const coeff = relevantStats?.statCoefficients?.[internalKey] ?? 0;
          const isDirect = relevantStats?.directStats?.has(internalKey as any) ?? false;
          const weight = coeff > 0 ? coeff : (isDirect ? 1 : 0);
          weightedGain += numValue * weight;
        }
      }
    }

    tiers.push({
      branch,
      tier,
      requiredSP,
      incrementalSP,
      statGain,
      efficiency: weightedGain / incrementalSP,
    });
  }

  return tiers;
}

/**
 * 余剰SPを貪欲法で最適配分
 *
 * 各ティアのSP効率（依存ステ重み付き合計 / 追加SP）を計算し、
 * 効率の高いティアから順に取得する。
 * ティアは順序依存（A-3を取るにはA-1,A-2が必要）なので、
 * 各ブランチの現在到達ティアを追跡して次に取れるティアのみを候補にする。
 */
export function optimizeRemainingSP(
  userAllocation: Record<string, number>,
  jobSPData: JobSPData[] | undefined,
  maxSP: number,
  relevantStats: RelevantStats | undefined,
): SPOptimizeResult {
  const userUsed = Object.values(userAllocation).reduce((sum, v) => sum + (v || 0), 0);
  let remaining = Math.max(0, maxSP - userUsed);

  if (remaining === 0 || !jobSPData || jobSPData.length === 0) {
    return {
      allocation: { ...userAllocation },
      totalUsed: userUsed,
      remainingSP: remaining,
    };
  }

  // 全ティアを解析
  const allTiers = analyzeTiers(jobSPData, relevantStats);

  // ブランチ別にティアをソート（ティア番号順）
  const branchTiers: Record<string, TierInfo[]> = {};
  for (const tier of allTiers) {
    if (!branchTiers[tier.branch]) branchTiers[tier.branch] = [];
    branchTiers[tier.branch].push(tier);
  }
  for (const branch of Object.keys(branchTiers)) {
    branchTiers[branch].sort((a, b) => a.tier - b.tier);
  }

  // 現在の到達ティアを初期化（ユーザ配分から）
  const currentSP: Record<string, number> = { ...userAllocation };
  const allocation: Record<string, number> = { ...userAllocation };

  // 貪欲法: 次に取得可能なティアの中で最も効率の良いものを選ぶ
  let improved = true;
  while (remaining > 0 && improved) {
    improved = false;
    let bestTier: TierInfo | null = null;
    let bestBranch: string | null = null;

    for (const [branch, tiers] of Object.entries(branchTiers)) {
      const currentBranchSP = currentSP[branch] || 0;

      // このブランチで次に取得可能なティアを見つける
      const nextTier = tiers.find(t => t.requiredSP > currentBranchSP);
      if (!nextTier) continue;

      // 取得に必要な追加SP
      const additionalSP = nextTier.requiredSP - currentBranchSP;
      if (additionalSP > remaining) continue;

      // 効率比較
      if (!bestTier || nextTier.efficiency > bestTier.efficiency) {
        bestTier = nextTier;
        bestBranch = branch;
      }
    }

    if (bestTier && bestBranch) {
      const additionalSP = bestTier.requiredSP - (currentSP[bestBranch] || 0);
      currentSP[bestBranch] = bestTier.requiredSP;
      allocation[bestBranch] = bestTier.requiredSP;
      remaining -= additionalSP;
      improved = true;
    }
  }

  // 残りSPがあれば、次に効率の良いティアに端数を振る
  // （ティアの途中まで振ることはできないので、残りは未使用）

  const totalUsed = Object.values(allocation).reduce((sum, v) => sum + (v || 0), 0);

  return {
    allocation,
    totalUsed,
    remainingSP: maxSP - totalUsed,
  };
}
