/**
 * 最適化モジュール - SP自動最適化
 *
 * 全てのSP配分パターンを列挙し、依存ステの重み付きスコアが
 * 最大になる配分を選択する。ブランチのティア境界値のみを
 * 候補とするため、計算量は現実的（数千パターン程度）。
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

/** ブランチ別の有効SP値とそこまでの累積ステータスを構築 */
function buildBranchOptions(
  jobSPData: JobSPData[],
): Record<string, Array<{ sp: number; stats: Record<string, number> }>> {
  const branches: Record<string, Array<{ sp: number; tierStats: Record<string, number> }>> = {};
  const statKeys = Object.keys(JP_TO_INTERNAL) as (keyof JobSPData)[];

  for (const row of jobSPData) {
    const phase = row.解法段階;
    if (!phase) continue;
    const match = phase.match(/^([A-C])-(\d+)$/);
    if (!match) continue;

    const branch = match[1];
    const requiredSP = typeof row.必要SP === 'string' ? parseFloat(row.必要SP) || 0 : row.必要SP || 0;

    // このティアのステータス
    const tierStats: Record<string, number> = {};
    for (const jpKey of statKeys) {
      const value = row[jpKey];
      const numValue = typeof value === 'string' ? parseFloat(value) || 0 : (value as number) || 0;
      if (numValue > 0) {
        const internalKey = JP_TO_INTERNAL[jpKey as string];
        if (internalKey) tierStats[internalKey] = numValue;
      }
    }

    if (!branches[branch]) branches[branch] = [];
    branches[branch].push({ sp: requiredSP, tierStats });
  }

  // 各ブランチで累積ステータスを計算
  const result: Record<string, Array<{ sp: number; stats: Record<string, number> }>> = {};

  for (const [branch, tiers] of Object.entries(branches)) {
    tiers.sort((a, b) => a.sp - b.sp);

    const options: Array<{ sp: number; stats: Record<string, number> }> = [];
    // SP=0（何も取らない）
    options.push({ sp: 0, stats: {} });

    const cumStats: Record<string, number> = {};
    for (const tier of tiers) {
      for (const [key, value] of Object.entries(tier.tierStats)) {
        cumStats[key] = (cumStats[key] || 0) + value;
      }
      options.push({ sp: tier.sp, stats: { ...cumStats } });
    }

    result[branch] = options;
  }

  return result;
}

/**
 * 配分のスコアを計算
 * SpellRefactorの場合、P=Mバランスボーナスを考慮した
 * 実効ダメージ近似を使用
 */
function scoreAllocation(
  stats: Record<string, number>,
  relevantStats: RelevantStats | undefined,
  jobName?: string,
  equipmentStats?: Record<string, number>,
): number {
  // SpellRefactor: P=Mバランスが重要なのでダメージ近似式で直接スコアリング
  if (jobName === 'SpellRefactor' || jobName === 'スペルリファクター') {
    // 装備ステがあればそれも加算してP=Mバランスを正確に評価
    const power = (stats['Power'] || 0) + (equipmentStats?.['Power'] || 0);
    const magic = (stats['Magic'] || 0) + (equipmentStats?.['Magic'] || 0);
    const critDamage = (stats['CritDamage'] || 0) + (equipmentStats?.['CritDamage'] || 0);

    // BaseDamage近似 (Sword): Power * 1.6 + CritDamage * 0.005 * WeaponAttack
    // 会心期待値: 撃力は会心ダメージ倍率にも寄与（100%会心率前提で撃力1あたり+1%ダメージ）
    // 実効重み: 0.005*420 + baseDamage*0.01 ≈ 2.1 + ~15 = ~17
    const rawBaseDamage = power * 1.6;
    const critDamageContrib = critDamage * (0.005 * 420 + rawBaseDamage * 0.01);
    const baseDamage = rawBaseDamage + critDamageContrib;

    // SpellRefactorボーナス: 1.75 - 0.475 * ln(max(P,M)/min(P,M)) * 2
    let bonus = 1.75;
    if (power > 0 && magic > 0) {
      const ratio = Math.max(power, magic) / Math.min(power, magic);
      bonus = Math.max(0.1, 1.75 - 0.475 * Math.log(ratio) * 2);
    }

    return baseDamage * bonus;
  }

  // 通常の線形重みスコア
  let score = 0;
  for (const [stat, value] of Object.entries(stats)) {
    const coeff = relevantStats?.statCoefficients?.[stat] ?? 0;
    const isDirect = relevantStats?.directStats?.has(stat as any) ?? false;
    const weight = coeff > 0 ? coeff : (isDirect ? 1 : 0);
    score += value * weight;
  }
  return score;
}

/**
 * 全SP配分パターンを列挙し、最適な配分を選択
 */
export function optimizeRemainingSP(
  userAllocation: Record<string, number>,
  jobSPData: JobSPData[] | undefined,
  maxSP: number,
  relevantStats: RelevantStats | undefined,
  jobName?: string,
  equipmentStats?: Record<string, number>,
): SPOptimizeResult {
  const userUsed = Object.values(userAllocation).reduce((sum, v) => sum + (v || 0), 0);
  const available = Math.max(0, maxSP - userUsed);

  if (available === 0 || !jobSPData || jobSPData.length === 0) {
    return {
      allocation: { ...userAllocation },
      totalUsed: userUsed,
      remainingSP: available,
    };
  }

  const branchOptions = buildBranchOptions(jobSPData);
  const branchNames = Object.keys(branchOptions).sort(); // A, B, C

  if (branchNames.length === 0) {
    return { allocation: { ...userAllocation }, totalUsed: userUsed, remainingSP: available };
  }

  // ユーザの既存配分を考慮（既に振られているSPの下限）
  const minSP: Record<string, number> = {};
  for (const branch of branchNames) {
    minSP[branch] = (userAllocation[branch] || 0);
  }

  const topAllocations: Array<{ alloc: Record<string, number>; score: number }> = [];

  // A/B/Cの有効SP値の組み合わせを列挙
  const optA = branchOptions[branchNames[0]] || [{ sp: 0, stats: {} }];
  const optB = branchNames.length > 1 ? (branchOptions[branchNames[1]] || [{ sp: 0, stats: {} }]) : [{ sp: 0, stats: {} }];
  const optC = branchNames.length > 2 ? (branchOptions[branchNames[2]] || [{ sp: 0, stats: {} }]) : [{ sp: 0, stats: {} }];

  for (const a of optA) {
    if (a.sp < minSP[branchNames[0]]) continue;
    if (a.sp > available + userUsed) break; // 早期終了

    for (const b of optB) {
      if (branchNames.length > 1 && b.sp < minSP[branchNames[1]]) continue;
      const abSP = a.sp + b.sp;
      if (abSP > maxSP) break; // bが大きすぎ

      for (const c of optC) {
        if (branchNames.length > 2 && c.sp < minSP[branchNames[2]]) continue;
        const totalSP = abSP + c.sp;
        if (totalSP > maxSP) break; // cが大きすぎ

        // 合計ステータスを計算
        const combinedStats: Record<string, number> = {};
        for (const stats of [a.stats, b.stats, c.stats]) {
          for (const [key, value] of Object.entries(stats)) {
            combinedStats[key] = (combinedStats[key] || 0) + value;
          }
        }

        const score = scoreAllocation(combinedStats, relevantStats, jobName, equipmentStats);

        topAllocations.push({ alloc: {
          ...(branchNames[0] ? { [branchNames[0]]: a.sp } : {}),
          ...(branchNames[1] ? { [branchNames[1]]: b.sp } : {}),
          ...(branchNames[2] ? { [branchNames[2]]: c.sp } : {}),
        }, score });
      }
    }
  }

  // スコア降順ソート
  topAllocations.sort((a, b) => b.score - a.score);
  const finalBest = topAllocations[0]?.alloc || {};
  const totalUsed = Object.values(finalBest).reduce((sum, v) => sum + (v || 0), 0);

  return {
    allocation: finalBest,
    totalUsed,
    remainingSP: maxSP - totalUsed,
  };
}

/**
 * 上位N件のSP配分候補を返す（複数SP並行探索用）
 */
export function getTopSPAllocations(
  userAllocation: Record<string, number>,
  jobSPData: JobSPData[] | undefined,
  maxSP: number,
  relevantStats: RelevantStats | undefined,
  jobName?: string,
  topN: number = 3,
): Record<string, number>[] {
  if (!jobSPData || jobSPData.length === 0) return [{ ...userAllocation }];

  const branchOptions = buildBranchOptions(jobSPData);
  const branchNames = Object.keys(branchOptions).sort();
  if (branchNames.length === 0) return [{ ...userAllocation }];

  const allResults: Array<{ alloc: Record<string, number>; score: number }> = [];
  const optA = branchOptions[branchNames[0]] || [{ sp: 0, stats: {} }];
  const optB = branchNames.length > 1 ? (branchOptions[branchNames[1]] || [{ sp: 0, stats: {} }]) : [{ sp: 0, stats: {} }];
  const optC = branchNames.length > 2 ? (branchOptions[branchNames[2]] || [{ sp: 0, stats: {} }]) : [{ sp: 0, stats: {} }];

  for (const a of optA) {
    if (a.sp > maxSP) break;
    for (const b of optB) {
      if (a.sp + b.sp > maxSP) break;
      for (const c of optC) {
        if (a.sp + b.sp + c.sp > maxSP) break;
        const combinedStats: Record<string, number> = {};
        for (const s of [a.stats, b.stats, c.stats])
          for (const [k, v] of Object.entries(s))
            combinedStats[k] = (combinedStats[k] || 0) + v;
        const score = scoreAllocation(combinedStats, relevantStats, jobName);
        allResults.push({
          alloc: {
            ...(branchNames[0] ? { [branchNames[0]]: a.sp } : {}),
            ...(branchNames[1] ? { [branchNames[1]]: b.sp } : {}),
            ...(branchNames[2] ? { [branchNames[2]]: c.sp } : {}),
          }, score
        });
      }
    }
  }
  allResults.sort((a, b) => b.score - a.score);

  // 重複除去してトップN
  const seen = new Set<string>();
  const results: Record<string, number>[] = [];
  for (const r of allResults) {
    const key = JSON.stringify(r.alloc);
    if (!seen.has(key)) {
      seen.add(key);
      results.push(r.alloc);
      if (results.length >= topN) break;
    }
  }
  return results;
}
