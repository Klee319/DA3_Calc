/**
 * 最適化モジュール - 探索アルゴリズム
 */

import { EquipSlot } from '@/types';
import { EquipmentPool, CandidateEquipment } from '@/types/optimize';
import { EqConstData } from '@/types/data';
import { EvaluationContext, ScoredCombination, SimpleStatBlock } from './types';
import { EXHAUSTIVE_SEARCH_THRESHOLD } from './constants';
import { evaluateCombination, evaluateCombinationCached } from './evaluation';
import { calculateMinimumStatsProgress, calculateMinimumStatsDeficit } from './utils';

/**
 * 組み合わせ数を計算
 */
export function calculateCombinationCount(pool: EquipmentPool): number {
  const slots: EquipSlot[] = ['weapon', 'head', 'body', 'leg', 'accessory1', 'accessory2'];
  let count = 1;

  for (const slot of slots) {
    const candidates = pool[slot];
    if (candidates.length === 0) {
      continue;
    }

    let slotCount = 0;
    for (const candidate of candidates) {
      slotCount += candidate.configurations.length;
    }
    count *= Math.max(slotCount, 1);
  }

  return count;
}

/**
 * 全探索で最適解を探す（非同期版）
 */
export async function exhaustiveSearchAsync(
  pool: EquipmentPool,
  context: EvaluationContext,
  eqConst: EqConstData,
  maxResults: number = 10
): Promise<ScoredCombination[]> {
  const slots: EquipSlot[] = ['weapon', 'head', 'body', 'leg', 'accessory1', 'accessory2'];
  const solutions: ScoredCombination[] = [];

  const slotOptions: Array<Array<{ candidate: CandidateEquipment | null; configIndex: number }>> = [];

  for (const slot of slots) {
    const options: Array<{ candidate: CandidateEquipment | null; configIndex: number }> = [];
    const candidates = pool[slot];

    if (candidates.length === 0) {
      options.push({ candidate: null, configIndex: 0 });
    } else {
      for (const candidate of candidates) {
        for (let configIdx = 0; configIdx < candidate.configurations.length; configIdx++) {
          options.push({ candidate, configIndex: configIdx });
        }
      }
    }
    slotOptions.push(options);
  }

  const indices = new Array(6).fill(0);
  const maxIndices = slotOptions.map(opts => opts.length);

  let evaluationCount = 0;
  const maxEvaluations = EXHAUSTIVE_SEARCH_THRESHOLD;
  const YIELD_INTERVAL = 500;

  while (evaluationCount < maxEvaluations) {
    const combination: Record<EquipSlot, CandidateEquipment | null> = {
      weapon: null, head: null, body: null, leg: null, accessory1: null, accessory2: null,
    };
    const configIndices: Record<EquipSlot, number> = {
      weapon: 0, head: 0, body: 0, leg: 0, accessory1: 0, accessory2: 0,
    };

    for (let i = 0; i < 6; i++) {
      const opt = slotOptions[i][indices[i]];
      combination[slots[i]] = opt.candidate;
      configIndices[slots[i]] = opt.configIndex;
    }

    const { score, originalScore, stats, meetsMinimum } = evaluateCombination(combination, configIndices, context, eqConst);
    evaluationCount++;

    // スコアが0より大きい場合は結果に追加（制約を満たさなくても達成度に応じたスコアがある）
    if (score > 0) {
      solutions.push({
        equipmentSet: { ...combination },
        configIndices: { ...configIndices },
        score,
        originalScore,
        stats,
        meetsMinimum,
      });

      if (solutions.length > maxResults * 2) {
        solutions.sort((a, b) => b.score - a.score);
        solutions.length = maxResults;
      }
    }

    if (evaluationCount % YIELD_INTERVAL === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    let carry = true;
    for (let i = 5; i >= 0 && carry; i--) {
      indices[i]++;
      if (indices[i] >= maxIndices[i]) {
        indices[i] = 0;
      } else {
        carry = false;
      }
    }

    if (carry) break;
  }

  solutions.sort((a, b) => b.score - a.score);

  return solutions.slice(0, maxResults);
}

/**
 * 貪欲法で初期解を構築
 */
export function greedyInitialSolution(
  pool: EquipmentPool,
  context: EvaluationContext,
  eqConst: EqConstData
): ScoredCombination {
  const slots: EquipSlot[] = ['weapon', 'head', 'body', 'leg', 'accessory1', 'accessory2'];
  const combination: Record<EquipSlot, CandidateEquipment | null> = {
    weapon: null, head: null, body: null, leg: null, accessory1: null, accessory2: null,
  };
  const configIndices: Record<EquipSlot, number> = {
    weapon: 0, head: 0, body: 0, leg: 0, accessory1: 0, accessory2: 0,
  };

  for (const slot of slots) {
    const candidates = pool[slot];
    if (candidates.length === 0) continue;

    let bestCandidate: CandidateEquipment | null = null;
    let bestConfigIndex = 0;
    let bestScore = -Infinity;

    for (const candidate of candidates) {
      for (let configIdx = 0; configIdx < candidate.configurations.length; configIdx++) {
        const tempCombination = { ...combination, [slot]: candidate };
        const tempIndices = { ...configIndices, [slot]: configIdx };

        const { score } = evaluateCombination(tempCombination, tempIndices, context, eqConst);

        if (score > bestScore) {
          bestScore = score;
          bestCandidate = candidate;
          bestConfigIndex = configIdx;
        }
      }
    }

    if (bestCandidate) {
      combination[slot] = bestCandidate;
      configIndices[slot] = bestConfigIndex;
    }
  }

  const { score, originalScore, stats, meetsMinimum } = evaluateCombination(combination, configIndices, context, eqConst);

  return {
    equipmentSet: combination,
    configIndices,
    score,
    originalScore,
    stats,
    meetsMinimum,
  };
}

/**
 * 貪欲法で初期解を構築（非同期版）
 */
export async function greedyInitialSolutionAsync(
  pool: EquipmentPool,
  context: EvaluationContext,
  eqConst: EqConstData,
  contextKey: string = ''
): Promise<ScoredCombination> {
  const slots: EquipSlot[] = ['weapon', 'head', 'body', 'leg', 'accessory1', 'accessory2'];
  const combination: Record<EquipSlot, CandidateEquipment | null> = {
    weapon: null, head: null, body: null, leg: null, accessory1: null, accessory2: null,
  };
  const configIndices: Record<EquipSlot, number> = {
    weapon: 0, head: 0, body: 0, leg: 0, accessory1: 0, accessory2: 0,
  };

  let evalCount = 0;
  const YIELD_INTERVAL = 50;

  for (const slot of slots) {
    const candidates = pool[slot];
    if (candidates.length === 0) continue;

    let bestCandidate: CandidateEquipment | null = null;
    let bestConfigIndex = 0;
    let bestScore = -Infinity;

    for (const candidate of candidates) {
      for (let configIdx = 0; configIdx < candidate.configurations.length; configIdx++) {
        const tempCombination = { ...combination, [slot]: candidate };
        const tempIndices = { ...configIndices, [slot]: configIdx };

        const { score } = evaluateCombinationCached(tempCombination, tempIndices, context, eqConst, contextKey);
        evalCount++;

        if (score > bestScore) {
          bestScore = score;
          bestCandidate = candidate;
          bestConfigIndex = configIdx;
        }

        if (evalCount % YIELD_INTERVAL === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
    }

    if (bestCandidate) {
      combination[slot] = bestCandidate;
      configIndices[slot] = bestConfigIndex;
    }
  }

  const { score, originalScore, stats, meetsMinimum } = evaluateCombinationCached(combination, configIndices, context, eqConst, contextKey);

  return {
    equipmentSet: combination,
    configIndices,
    score,
    originalScore,
    stats,
    meetsMinimum,
  };
}

/**
 * 異なるスロット順序で貪欲法を実行
 */
export async function greedyWithSlotOrder(
  pool: EquipmentPool,
  context: EvaluationContext,
  eqConst: EqConstData,
  slotOrder: EquipSlot[],
  contextKey: string = ''
): Promise<ScoredCombination> {
  const combination: Record<EquipSlot, CandidateEquipment | null> = {
    weapon: null, head: null, body: null, leg: null, accessory1: null, accessory2: null,
  };
  const configIndices: Record<EquipSlot, number> = {
    weapon: 0, head: 0, body: 0, leg: 0, accessory1: 0, accessory2: 0,
  };

  let evalCount = 0;
  const YIELD_INTERVAL = 50;

  for (const slot of slotOrder) {
    const candidates = pool[slot];
    if (candidates.length === 0) continue;

    let bestCandidate: CandidateEquipment | null = null;
    let bestConfigIndex = 0;
    let bestScore = -Infinity;

    for (const candidate of candidates) {
      for (let configIdx = 0; configIdx < candidate.configurations.length; configIdx++) {
        const tempCombination = { ...combination, [slot]: candidate };
        const tempIndices = { ...configIndices, [slot]: configIdx };

        const { score } = evaluateCombinationCached(tempCombination, tempIndices, context, eqConst, contextKey);
        evalCount++;

        if (score > bestScore) {
          bestScore = score;
          bestCandidate = candidate;
          bestConfigIndex = configIdx;
        }

        if (evalCount % YIELD_INTERVAL === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
    }

    if (bestCandidate) {
      combination[slot] = bestCandidate;
      configIndices[slot] = bestConfigIndex;
    }
  }

  const { score, originalScore, stats, meetsMinimum } = evaluateCombinationCached(combination, configIndices, context, eqConst, contextKey);

  return {
    equipmentSet: combination,
    configIndices,
    score,
    originalScore,
    stats,
    meetsMinimum,
  };
}

/**
 * 最低必須ステータス優先のグリーディ探索
 */
export async function greedyWithMinimumStatsPriority(
  pool: EquipmentPool,
  context: EvaluationContext,
  eqConst: EqConstData,
  slotOrder: EquipSlot[],
  contextKey: string = ''
): Promise<ScoredCombination> {
  const combination: Record<EquipSlot, CandidateEquipment | null> = {
    weapon: null, head: null, body: null, leg: null, accessory1: null, accessory2: null,
  };
  const configIndices: Record<EquipSlot, number> = {
    weapon: 0, head: 0, body: 0, leg: 0, accessory1: 0, accessory2: 0,
  };

  let evalCount = 0;
  const YIELD_INTERVAL = 50;

  const hasMinimumStats = context.minimumStats &&
    Object.values(context.minimumStats).some(v => v !== undefined && v > 0);

  for (const slot of slotOrder) {
    const candidates = pool[slot];
    if (candidates.length === 0) continue;

    let bestCandidate: CandidateEquipment | null = null;
    let bestConfigIndex = 0;
    let bestCombinedScore = -Infinity;

    for (const candidate of candidates) {
      for (let configIdx = 0; configIdx < candidate.configurations.length; configIdx++) {
        const tempCombination = { ...combination, [slot]: candidate };
        const tempIndices = { ...configIndices, [slot]: configIdx };

        const { score, stats, meetsMinimum } = evaluateCombinationCached(tempCombination, tempIndices, context, eqConst, contextKey);
        evalCount++;

        let combinedScore: number;

        if (hasMinimumStats) {
          const progress = calculateMinimumStatsProgress(stats, context.minimumStats);
          const deficit = calculateMinimumStatsDeficit(stats, context.minimumStats);

          if (meetsMinimum) {
            combinedScore = 1000000 + score;
          } else {
            combinedScore = progress * 500000 - deficit * 100 + score * 0.001;
          }
        } else {
          combinedScore = score;
        }

        if (combinedScore > bestCombinedScore) {
          bestCombinedScore = combinedScore;
          bestCandidate = candidate;
          bestConfigIndex = configIdx;
        }

        if (evalCount % YIELD_INTERVAL === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
    }

    if (bestCandidate) {
      combination[slot] = bestCandidate;
      configIndices[slot] = bestConfigIndex;
    }
  }

  const { score, originalScore, stats, meetsMinimum } = evaluateCombinationCached(combination, configIndices, context, eqConst, contextKey);

  return {
    equipmentSet: combination,
    configIndices,
    score,
    originalScore,
    stats,
    meetsMinimum,
  };
}

/**
 * Crossover: 2つの解から各スロットを組み合わせた新しい解を生成
 */
export async function generateCrossoverSolutions(
  parents: ScoredCombination[],
  context: EvaluationContext,
  eqConst: EqConstData,
  contextKey: string
): Promise<ScoredCombination[]> {
  if (parents.length < 2) return [];

  const [parent1, parent2] = parents;
  const crossovers: ScoredCombination[] = [];

  const crossover1Combination: Record<EquipSlot, CandidateEquipment | null> = {
    weapon: parent1.equipmentSet.weapon,
    head: parent1.equipmentSet.head,
    body: parent1.equipmentSet.body,
    leg: parent2.equipmentSet.leg,
    accessory1: parent2.equipmentSet.accessory1,
    accessory2: parent2.equipmentSet.accessory2,
  };
  const crossover1Indices: Record<EquipSlot, number> = {
    weapon: parent1.configIndices.weapon,
    head: parent1.configIndices.head,
    body: parent1.configIndices.body,
    leg: parent2.configIndices.leg,
    accessory1: parent2.configIndices.accessory1,
    accessory2: parent2.configIndices.accessory2,
  };
  const result1 = evaluateCombinationCached(crossover1Combination, crossover1Indices, context, eqConst, contextKey);
  if (result1.score > 0) {
    crossovers.push({
      equipmentSet: crossover1Combination,
      configIndices: crossover1Indices,
      score: result1.score,
      originalScore: result1.originalScore,
      stats: result1.stats,
      meetsMinimum: result1.meetsMinimum,
    });
  }

  const crossover2Combination: Record<EquipSlot, CandidateEquipment | null> = {
    weapon: parent2.equipmentSet.weapon,
    head: parent2.equipmentSet.head,
    body: parent2.equipmentSet.body,
    leg: parent1.equipmentSet.leg,
    accessory1: parent1.equipmentSet.accessory1,
    accessory2: parent1.equipmentSet.accessory2,
  };
  const crossover2Indices: Record<EquipSlot, number> = {
    weapon: parent2.configIndices.weapon,
    head: parent2.configIndices.head,
    body: parent2.configIndices.body,
    leg: parent1.configIndices.leg,
    accessory1: parent1.configIndices.accessory1,
    accessory2: parent1.configIndices.accessory2,
  };
  const result2 = evaluateCombinationCached(crossover2Combination, crossover2Indices, context, eqConst, contextKey);
  if (result2.score > 0) {
    crossovers.push({
      equipmentSet: crossover2Combination,
      configIndices: crossover2Indices,
      score: result2.score,
      originalScore: result2.originalScore,
      stats: result2.stats,
      meetsMinimum: result2.meetsMinimum,
    });
  }

  const crossover3Combination: Record<EquipSlot, CandidateEquipment | null> = {
    weapon: parent1.equipmentSet.weapon,
    head: parent2.equipmentSet.head,
    body: parent2.equipmentSet.body,
    leg: parent2.equipmentSet.leg,
    accessory1: parent1.equipmentSet.accessory1,
    accessory2: parent1.equipmentSet.accessory2,
  };
  const crossover3Indices: Record<EquipSlot, number> = {
    weapon: parent1.configIndices.weapon,
    head: parent2.configIndices.head,
    body: parent2.configIndices.body,
    leg: parent2.configIndices.leg,
    accessory1: parent1.configIndices.accessory1,
    accessory2: parent1.configIndices.accessory2,
  };
  const result3 = evaluateCombinationCached(crossover3Combination, crossover3Indices, context, eqConst, contextKey);
  if (result3.score > 0) {
    crossovers.push({
      equipmentSet: crossover3Combination,
      configIndices: crossover3Indices,
      score: result3.score,
      originalScore: result3.originalScore,
      stats: result3.stats,
      meetsMinimum: result3.meetsMinimum,
    });
  }

  return crossovers;
}

/**
 * Multi-Start Greedy + Crossover
 */
/**
 * マルチスタート貪欲法による多様な解の生成
 * 10種類のストラテジーを使用して局所最適からの脱出を図る
 */
export async function multiStartGreedyAsync(
  pool: EquipmentPool,
  context: EvaluationContext,
  eqConst: EqConstData,
  contextKey: string = ''
): Promise<ScoredCombination[]> {
  const solutions: ScoredCombination[] = [];

  const hasMinimumStats = context.minimumStats &&
    Object.values(context.minimumStats).some(v => v !== undefined && v > 0);

  // ストラテジー1: 標準順序（武器優先）
  const defaultOrder: EquipSlot[] = ['weapon', 'head', 'body', 'leg', 'accessory1', 'accessory2'];
  const solution1 = await greedyWithSlotOrder(pool, context, eqConst, defaultOrder, contextKey);
  solutions.push(solution1);

  // ストラテジー2: 逆順序（アクセサリ優先）
  const reverseOrder: EquipSlot[] = ['accessory2', 'accessory1', 'leg', 'body', 'head', 'weapon'];
  const solution2 = await greedyWithSlotOrder(pool, context, eqConst, reverseOrder, contextKey);
  solutions.push(solution2);

  // ストラテジー3: アクセサリファースト（アクセサリ→武器→防具）
  const accessoryFirstOrder: EquipSlot[] = ['accessory1', 'accessory2', 'weapon', 'head', 'body', 'leg'];
  const solution3 = await greedyWithSlotOrder(pool, context, eqConst, accessoryFirstOrder, contextKey);
  solutions.push(solution3);

  // ストラテジー4: インターリーブ順序（武器と防具を交互）
  const interleavedOrder: EquipSlot[] = ['weapon', 'accessory1', 'head', 'accessory2', 'body', 'leg'];
  const solution4 = await greedyWithSlotOrder(pool, context, eqConst, interleavedOrder, contextKey);
  solutions.push(solution4);

  // ストラテジー5: ミドルアウト（体→頭→脚→武器→アクセサリ）
  const middleOutOrder: EquipSlot[] = ['body', 'head', 'leg', 'weapon', 'accessory1', 'accessory2'];
  const solution5 = await greedyWithSlotOrder(pool, context, eqConst, middleOutOrder, contextKey);
  solutions.push(solution5);

  // ストラテジー6: プールサイズ順（候補数が多いスロットを優先）
  const poolSizes = [
    { slot: 'weapon' as EquipSlot, size: pool.weapon.length },
    { slot: 'head' as EquipSlot, size: pool.head.length },
    { slot: 'body' as EquipSlot, size: pool.body.length },
    { slot: 'leg' as EquipSlot, size: pool.leg.length },
    { slot: 'accessory1' as EquipSlot, size: pool.accessory1.length },
    { slot: 'accessory2' as EquipSlot, size: pool.accessory2.length },
  ];
  poolSizes.sort((a, b) => b.size - a.size);
  const largestPoolFirstOrder = poolSizes.map(p => p.slot);
  const solution6 = await greedyWithSlotOrder(pool, context, eqConst, largestPoolFirstOrder, contextKey);
  solutions.push(solution6);

  // ストラテジー7: プールサイズ逆順（候補数が少ないスロットを優先）
  const smallestPoolFirstOrder = [...poolSizes].sort((a, b) => a.size - b.size).map(p => p.slot);
  const solution7 = await greedyWithSlotOrder(pool, context, eqConst, smallestPoolFirstOrder, contextKey);
  solutions.push(solution7);

  // 最小ステータス条件がある場合の追加ストラテジー
  if (hasMinimumStats) {
    // ストラテジー8: 防具ファースト（最小ステ重視）
    const armorFirstOrder: EquipSlot[] = ['head', 'body', 'leg', 'weapon', 'accessory1', 'accessory2'];
    const solution8 = await greedyWithMinimumStatsPriority(pool, context, eqConst, armorFirstOrder, contextKey);
    if (solution8.score > 0) {
      solutions.push(solution8);
    }

    // ストラテジー9: 逆防具順（最小ステ重視）
    const reverseArmorOrder: EquipSlot[] = ['accessory1', 'accessory2', 'leg', 'body', 'head', 'weapon'];
    const solution9 = await greedyWithMinimumStatsPriority(pool, context, eqConst, reverseArmorOrder, contextKey);
    if (solution9.score > 0) {
      solutions.push(solution9);
    }

    // ストラテジー10: 標準順序（最小ステ重視）
    const solution10 = await greedyWithMinimumStatsPriority(pool, context, eqConst, defaultOrder, contextKey);
    if (solution10.score > 0) {
      solutions.push(solution10);
    }
  }

  // クロスオーバーによる追加解生成（上位3解を使用）
  const topSolutions = solutions.slice(0, 3);
  if (topSolutions.length >= 2) {
    const crossoverSolutions = await generateCrossoverSolutions(
      topSolutions,
      context,
      eqConst,
      contextKey
    );
    solutions.push(...crossoverSolutions);
  }

  solutions.sort((a, b) => b.score - a.score);

  return solutions;
}
