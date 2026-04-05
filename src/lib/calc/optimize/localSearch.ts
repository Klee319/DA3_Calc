/**
 * 最適化モジュール - ローカルサーチ
 */

import { EquipSlot } from '@/types';
import { EquipmentPool, CandidateEquipment } from '@/types/optimize';
import { EqConstData } from '@/types/data';
import { EvaluationContext, ScoredCombination } from './types';
import { MAX_SOLUTIONS_IN_MEMORY } from './constants';
import { evaluateCombination, evaluateCombinationCached } from './evaluation';
import { greedyInitialSolutionAsync } from './search';

/**
 * ローカルサーチで解を改善（同期版）
 */
export function localSearch(
  initial: ScoredCombination,
  pool: EquipmentPool,
  context: EvaluationContext,
  eqConst: EqConstData,
  maxIterations: number = 100
): ScoredCombination {
  let current = { ...initial };
  const slots: EquipSlot[] = ['weapon', 'head', 'body', 'leg', 'accessory1', 'accessory2'];

  for (let iter = 0; iter < maxIterations; iter++) {
    let improved = false;

    for (const slot of slots) {
      const candidates = pool[slot];
      if (candidates.length === 0) continue;

      for (const candidate of candidates) {
        for (let configIdx = 0; configIdx < candidate.configurations.length; configIdx++) {
          if (
            current.equipmentSet[slot]?.id === candidate.id &&
            current.configIndices[slot] === configIdx
          ) {
            continue;
          }

          const tempCombination = { ...current.equipmentSet, [slot]: candidate };
          const tempIndices = { ...current.configIndices, [slot]: configIdx };

          const { score, originalScore, stats, meetsMinimum } = evaluateCombination(tempCombination, tempIndices, context, eqConst);

          if (score > current.score) {
            current = {
              equipmentSet: tempCombination,
              configIndices: tempIndices,
              score,
              originalScore,
              stats,
              meetsMinimum,
            };
            improved = true;
          }
        }
      }
    }

    if (!improved) {
      for (let i = 0; i < slots.length && !improved; i++) {
        for (let j = i + 1; j < slots.length && !improved; j++) {
          const slot1 = slots[i];
          const slot2 = slots[j];
          const candidates1 = pool[slot1];
          const candidates2 = pool[slot2];

          if (candidates1.length === 0 || candidates2.length === 0) continue;

          const sampled1 = candidates1.slice(0, 10);
          const sampled2 = candidates2.slice(0, 10);

          for (const cand1 of sampled1) {
            for (let cfg1 = 0; cfg1 < cand1.configurations.length; cfg1++) {
              for (const cand2 of sampled2) {
                for (let cfg2 = 0; cfg2 < cand2.configurations.length; cfg2++) {
                  if (
                    current.equipmentSet[slot1]?.id === cand1.id &&
                    current.configIndices[slot1] === cfg1 &&
                    current.equipmentSet[slot2]?.id === cand2.id &&
                    current.configIndices[slot2] === cfg2
                  ) {
                    continue;
                  }

                  const tempCombination = {
                    ...current.equipmentSet,
                    [slot1]: cand1,
                    [slot2]: cand2,
                  };
                  const tempIndices = {
                    ...current.configIndices,
                    [slot1]: cfg1,
                    [slot2]: cfg2,
                  };

                  const { score, originalScore, stats, meetsMinimum } = evaluateCombination(tempCombination, tempIndices, context, eqConst);

                  if (score > current.score) {
                    current = {
                      equipmentSet: tempCombination,
                      configIndices: tempIndices,
                      score,
                      originalScore,
                      stats,
                      meetsMinimum,
                    };
                    improved = true;
                  }
                }
              }
            }
          }
        }
      }
    }

    if (!improved) break;
  }

  return current;
}

/**
 * ローカルサーチで解を改善（非同期版）
 */
export async function localSearchAsync(
  initial: ScoredCombination,
  pool: EquipmentPool,
  context: EvaluationContext,
  eqConst: EqConstData,
  maxIterations: number = 50,
  contextKey: string = ''
): Promise<ScoredCombination> {
  let current = { ...initial };
  const slots: EquipSlot[] = ['weapon', 'head', 'body', 'leg', 'accessory1', 'accessory2'];
  let evalCount = 0;
  const YIELD_INTERVAL = 100;
  let stagnationCount = 0;
  const STAGNATION_THRESHOLD = 3;

  for (let iter = 0; iter < maxIterations; iter++) {
    let improved = false;

    for (const slot of slots) {
      const candidates = pool[slot];
      if (candidates.length === 0) continue;

      for (const candidate of candidates) {
        for (let configIdx = 0; configIdx < candidate.configurations.length; configIdx++) {
          if (
            current.equipmentSet[slot]?.id === candidate.id &&
            current.configIndices[slot] === configIdx
          ) {
            continue;
          }

          const tempCombination = { ...current.equipmentSet, [slot]: candidate };
          const tempIndices = { ...current.configIndices, [slot]: configIdx };

          const { score, originalScore, stats, meetsMinimum } = evaluateCombinationCached(tempCombination, tempIndices, context, eqConst, contextKey);
          evalCount++;

          if (score > current.score) {
            current = {
              equipmentSet: tempCombination,
              configIndices: tempIndices,
              score,
              originalScore,
              stats,
              meetsMinimum,
            };
            improved = true;
          }

          if (evalCount % YIELD_INTERVAL === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }
      }
    }

    if (!improved) {
      stagnationCount++;
      if (stagnationCount >= STAGNATION_THRESHOLD) {
        current = await adaptiveTwoOptAsync(current, pool, context, eqConst, contextKey);
        stagnationCount = 0;
      }
    } else {
      stagnationCount = 0;
    }

    if (!improved) break;
  }

  return current;
}

/**
 * 適応的2-opt（停滞時のみ発動）
 */
export async function adaptiveTwoOptAsync(
  current: ScoredCombination,
  pool: EquipmentPool,
  context: EvaluationContext,
  eqConst: EqConstData,
  contextKey: string
): Promise<ScoredCombination> {
  const slots: EquipSlot[] = ['weapon', 'head', 'body', 'leg', 'accessory1', 'accessory2'];
  let best = { ...current };
  let evalCount = 0;
  const YIELD_INTERVAL = 50;
  const MAX_2OPT_EVALS = 500;

  for (let i = 0; i < slots.length && evalCount < MAX_2OPT_EVALS; i++) {
    for (let j = i + 1; j < slots.length && evalCount < MAX_2OPT_EVALS; j++) {
      const slot1 = slots[i];
      const slot2 = slots[j];
      const candidates1 = pool[slot1];
      const candidates2 = pool[slot2];

      if (candidates1.length === 0 || candidates2.length === 0) continue;

      const sampled1 = candidates1.slice(0, 5);
      const sampled2 = candidates2.slice(0, 5);

      for (const cand1 of sampled1) {
        for (let cfg1 = 0; cfg1 < Math.min(cand1.configurations.length, 3); cfg1++) {
          for (const cand2 of sampled2) {
            for (let cfg2 = 0; cfg2 < Math.min(cand2.configurations.length, 3); cfg2++) {
              if (
                best.equipmentSet[slot1]?.id === cand1.id &&
                best.configIndices[slot1] === cfg1 &&
                best.equipmentSet[slot2]?.id === cand2.id &&
                best.configIndices[slot2] === cfg2
              ) {
                continue;
              }

              const tempCombination = {
                ...best.equipmentSet,
                [slot1]: cand1,
                [slot2]: cand2,
              };
              const tempIndices = {
                ...best.configIndices,
                [slot1]: cfg1,
                [slot2]: cfg2,
              };

              const { score, originalScore, stats, meetsMinimum } = evaluateCombinationCached(
                tempCombination, tempIndices, context, eqConst, contextKey
              );
              evalCount++;

              if (score > best.score) {
                best = {
                  equipmentSet: tempCombination,
                  configIndices: tempIndices,
                  score,
                  originalScore,
                  stats,
                  meetsMinimum,
                };
              }

              if (evalCount % YIELD_INTERVAL === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
              }
            }
          }
        }
      }
    }
  }

  return best;
}

/**
 * 多様な解を生成
 */
export async function generateDiverseSolutionsAsync(
  pool: EquipmentPool,
  context: EvaluationContext,
  eqConst: EqConstData,
  maxResults: number = 10
): Promise<ScoredCombination[]> {
  const solutions: ScoredCombination[] = [];
  const seenEquipmentSets = new Set<string>();

  const strategies: EquipSlot[][] = [
    ['weapon', 'head', 'body', 'leg', 'accessory1', 'accessory2'],
    ['accessory2', 'accessory1', 'leg', 'body', 'head', 'weapon'],
    ['head', 'body', 'leg', 'weapon', 'accessory1', 'accessory2'],
    ['weapon', 'accessory1', 'accessory2', 'head', 'body', 'leg'],
  ];

  let count = 0;
  for (const strategy of strategies) {
    if (solutions.length >= maxResults) break;

    const solution = await greedyInitialSolutionAsync(pool, context, eqConst, `diverse_${count}`);
    count++;

    const key = Object.values(solution.equipmentSet)
      .map(e => e?.id || 'null')
      .join('|');

    if (!seenEquipmentSets.has(key) && solution.score > 0) {
      seenEquipmentSets.add(key);
      solutions.push(solution);
    }

    if (count % 2 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  solutions.sort((a, b) => b.score - a.score);

  return solutions.slice(0, maxResults);
}
