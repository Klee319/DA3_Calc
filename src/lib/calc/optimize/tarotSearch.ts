/**
 * 最適化モジュール - タロット探索
 *
 * タロットのサブオプション組み合わせから最適な候補を生成する。
 * 5枠のサブオプション（重複禁止、Lv5固定）の組み合わせを
 * 依存ステータス重みに基づいて貪欲法で効率的に探索する。
 */

import type { TarotCardDefinition, TarotCalcData } from '@/types/data';
import type { StatBlock } from '@/types/calc';
import type { TarotCandidate, OptimizeMode } from '@/types/optimize';
import type { RelevantStats } from '../skillAnalyzer';
import { BEAM_SEARCH_DEFAULTS, TAROT_EXCLUDED_TYPES } from './constants';

/** サブオプションのスコア付き情報 */
interface ScoredSubOption {
  id: string;
  name: string;
  type: string;
  isPercent: boolean;
  valuePerLevel: number;
  maxValue: number;       // valuePerLevel * maxLevel
  relevanceScore: number; // 依存ステへの寄与度スコア
}

/**
 * タロットサブオプションをスコアリング
 */
function scoreSubOptions(
  subOptions: Record<string, { Name: string; Type: string; IsPercent?: boolean; ValuePerLevel: number }>,
  relevantStats: RelevantStats | undefined,
  mode: OptimizeMode
): ScoredSubOption[] {
  const maxLevel = BEAM_SEARCH_DEFAULTS.tarotSubOptionMaxLevel;
  const scored: ScoredSubOption[] = [];

  // ステータスタイプ → InternalStatKeyのマッピング
  const typeToStatKey: Record<string, string> = {
    'Power': 'Power',
    'Magic': 'Magic',
    'HP': 'HP',
    'Mind': 'Mind',
    'Agility': 'Agility',
    'Dex': 'Dex',
    'Defense': 'Defense',
    'CritDamage': 'CritDamage',
  };

  for (const [optionId, def] of Object.entries(subOptions)) {
    // 火力無関係のオプションを除外
    if (TAROT_EXCLUDED_TYPES.includes(def.Type)) continue;

    const maxValue = def.ValuePerLevel * maxLevel;
    let relevanceScore = 0;

    const isPercent = def.IsPercent ?? false;

    if (isPercent) {
      // %ステータスボーナス — 依存ステに含まれるか確認
      const statKey = typeToStatKey[def.Type];
      if (statKey && relevantStats?.directStats?.has(statKey as any)) {
        // 直接依存ステ → 高スコア
        const coeff = relevantStats.statCoefficients?.[statKey] ?? 1;
        relevanceScore = maxValue * (coeff > 0 ? coeff : 1) * 10;
      } else if (statKey && relevantStats?.indirectStats?.has(statKey as any)) {
        relevanceScore = maxValue * 5;
      } else {
        relevanceScore = maxValue * 0.5;
      }
    } else {
      // 武器固定値・ダメージバフ
      switch (def.Type) {
        case 'CritR': // 会心率
          relevanceScore = maxValue * 8; // 会心率は常に重要
          break;
        case 'CritD': // 会心ダメージ
          relevanceScore = maxValue * 6;
          break;
        case 'AttackP': // 武器攻撃力
          relevanceScore = maxValue * 7;
          break;
        case 'DamageC': // ダメージ補正
          relevanceScore = maxValue * 5;
          break;
        case 'AllBuff': // 全ダメージバフ
          relevanceScore = maxValue * 9; // 全ダメバフは汎用的に強い
          break;
        default:
          if (def.Type.startsWith('AttackBuff.')) {
            relevanceScore = maxValue * 6;
          } else if (def.Type.startsWith('ElementBuff.')) {
            relevanceScore = maxValue * 4;
          } else {
            relevanceScore = maxValue * 1;
          }
      }
    }

    // ステータスモードでは対象ステの%ボーナスを最優先
    if (mode === 'stat') {
      const statKey = typeToStatKey[def.Type];
      if (statKey && isPercent) {
        relevanceScore *= 2;
      } else if (!isPercent) {
        relevanceScore *= 0.3; // 武器固定値はステモードでは低優先
      }
    }

    // DPSモードではダメージバフ系を少し優遇
    if (mode === 'dps' && (def.Type === 'AllBuff' || def.Type.startsWith('AttackBuff.'))) {
      relevanceScore *= 1.3;
    }

    scored.push({
      id: optionId,
      name: def.Name,
      type: def.Type,
      isPercent,
      valuePerLevel: def.ValuePerLevel,
      maxValue,
      relevanceScore,
    });
  }

  // スコア降順ソート
  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return scored;
}

/**
 * サブオプションの組み合わせからTarotCandidateのボーナスを計算
 */
function calculateTarotBonus(
  subOptions: ScoredSubOption[],
): { totalBonus: StatBlock; weaponBonus: Record<string, number>; damageBuffs: Record<string, number> } {
  const totalBonus: Record<string, number> = {};
  const weaponBonus: Record<string, number> = {};
  const damageBuffs: Record<string, number> = {};

  const typeToStatKey: Record<string, string> = {
    'Power': 'Power',
    'Magic': 'Magic',
    'HP': 'HP',
    'Mind': 'Mind',
    'Agility': 'Agility',
    'Dex': 'Dex',
    'Defense': 'Defense',
    'CritDamage': 'CritDamage',
  };

  for (const opt of subOptions) {
    if (opt.isPercent) {
      const statKey = typeToStatKey[opt.type];
      if (statKey) {
        totalBonus[statKey] = (totalBonus[statKey] || 0) + opt.maxValue;
      }
    } else {
      switch (opt.type) {
        case 'CritR':
        case 'CritD':
        case 'AttackP':
        case 'DamageC':
          weaponBonus[opt.type] = (weaponBonus[opt.type] || 0) + opt.maxValue;
          break;
        default:
          // ダメージバフ系
          damageBuffs[opt.type] = (damageBuffs[opt.type] || 0) + opt.maxValue;
          break;
      }
    }
  }

  return { totalBonus, weaponBonus, damageBuffs };
}

/**
 * 貪欲法 + k-best でタロット候補を生成
 *
 * @param scoredOptions スコア順のサブオプション
 * @param cardName カード名
 * @param topK 生成する候補数
 * @returns TarotCandidate配列
 */
function generateTopKCombinations(
  scoredOptions: ScoredSubOption[],
  cardName: string,
  topK: number
): TarotCandidate[] {
  const maxSlots = BEAM_SEARCH_DEFAULTS.maxTarotSubOptions;
  const candidates: TarotCandidate[] = [];

  // 有効なオプション（上位を優先的に使う）
  const available = scoredOptions.filter(o => o.relevanceScore > 0);
  if (available.length < maxSlots) {
    // オプション不足の場合は全オプションを使う
    const allAvailable = scoredOptions.slice(0, Math.max(maxSlots, scoredOptions.length));
    if (allAvailable.length >= maxSlots) {
      available.length = 0;
      available.push(...allAvailable);
    }
  }

  if (available.length < maxSlots) return candidates;

  // 1) 貪欲法: 上位5つを選択（ベースライン）
  const greedySelection = available.slice(0, maxSlots);
  const greedyBonus = calculateTarotBonus(greedySelection);
  candidates.push({
    id: `${cardName}_greedy`,
    cardName,
    subOptions: greedySelection.map(o => ({
      optionId: o.id,
      name: o.name,
      type: o.type,
      level: BEAM_SEARCH_DEFAULTS.tarotSubOptionMaxLevel,
      value: o.maxValue,
    })),
    ...greedyBonus,
  });

  // 2) k-best: 上位N個から5つ選ぶ組み合わせを列挙
  const searchRange = Math.min(available.length, 12); // 上位12個から探索
  const seen = new Set<string>();
  seen.add(greedySelection.map(o => o.id).sort().join(','));

  // 1つずつ入れ替えるバリエーション
  for (let replace = 0; replace < maxSlots; replace++) {
    for (let newIdx = maxSlots; newIdx < searchRange; newIdx++) {
      const variant = [...greedySelection];
      variant[replace] = available[newIdx];

      // 重複チェック
      const ids = variant.map(o => o.id);
      if (new Set(ids).size !== maxSlots) continue;

      const key = ids.sort().join(',');
      if (seen.has(key)) continue;
      seen.add(key);

      const bonus = calculateTarotBonus(variant);
      candidates.push({
        id: `${cardName}_v${candidates.length}`,
        cardName,
        subOptions: variant.map(o => ({
          optionId: o.id,
          name: o.name,
          type: o.type,
          level: BEAM_SEARCH_DEFAULTS.tarotSubOptionMaxLevel,
          value: o.maxValue,
        })),
        ...bonus,
      });

      if (candidates.length >= topK) return candidates;
    }
  }

  // 2つ入れ替えるバリエーション
  for (let r1 = 0; r1 < maxSlots - 1 && candidates.length < topK; r1++) {
    for (let r2 = r1 + 1; r2 < maxSlots && candidates.length < topK; r2++) {
      for (let n1 = maxSlots; n1 < searchRange - 1 && candidates.length < topK; n1++) {
        for (let n2 = n1 + 1; n2 < searchRange && candidates.length < topK; n2++) {
          const variant = [...greedySelection];
          variant[r1] = available[n1];
          variant[r2] = available[n2];

          const ids = variant.map(o => o.id);
          if (new Set(ids).size !== maxSlots) continue;

          const key = ids.sort().join(',');
          if (seen.has(key)) continue;
          seen.add(key);

          const bonus = calculateTarotBonus(variant);
          candidates.push({
            id: `${cardName}_v${candidates.length}`,
            cardName,
            subOptions: variant.map(o => ({
              optionId: o.id,
              name: o.name,
              type: o.type,
              level: BEAM_SEARCH_DEFAULTS.tarotSubOptionMaxLevel,
              value: o.maxValue,
            })),
            ...bonus,
          });
        }
      }
    }
  }

  return candidates;
}

/**
 * タロット候補を生成（メインエントリポイント）
 */
export function buildTarotCandidates(
  tarotCards: TarotCardDefinition[] | undefined,
  tarotCalcData: TarotCalcData | undefined,
  relevantStats: RelevantStats | undefined,
  mode: OptimizeMode = 'damage',
  topK: number = BEAM_SEARCH_DEFAULTS.tarotTopK
): TarotCandidate[] {
  if (!tarotCalcData?.SubOptions) return [];

  // サブオプションをスコアリング
  const scoredOptions = scoreSubOptions(tarotCalcData.SubOptions, relevantStats, mode);

  if (scoredOptions.length < BEAM_SEARCH_DEFAULTS.maxTarotSubOptions) return [];

  // タロットカードごとに候補を生成
  // メインステータスは全カード共通でサブオプションの選択のみが異なる
  // → カード名は代表として最初のカードを使用（メインステは最適化対象外）
  const cardName = tarotCards?.[0]?.name ?? 'タロット';
  const candidates = generateTopKCombinations(scoredOptions, cardName, topK);

  return candidates;
}

/**
 * タロット候補のPareto支配フィルタリング
 */
export function filterDominatedTarot(
  candidates: TarotCandidate[],
  relevantStats: RelevantStats | undefined
): TarotCandidate[] {
  if (candidates.length <= 1) return candidates;

  const directStats = relevantStats?.directStats
    ? Array.from(relevantStats.directStats)
    : ['Power', 'Magic', 'CritDamage'];

  const getRelevantValue = (c: TarotCandidate): number[] => {
    const values: number[] = [];
    for (const stat of directStats) {
      values.push((c.totalBonus as Record<string, number>)[stat] || 0);
    }
    // 武器ボーナスも考慮
    values.push(c.weaponBonus['AttackP'] || 0);
    values.push(c.weaponBonus['CritR'] || 0);
    values.push(c.weaponBonus['CritD'] || 0);
    // ダメージバフ
    values.push(c.damageBuffs['AllBuff'] || 0);
    return values;
  };

  const dominated = new Set<number>();

  for (let i = 0; i < candidates.length; i++) {
    if (dominated.has(i)) continue;
    const aVals = getRelevantValue(candidates[i]);

    for (let j = i + 1; j < candidates.length; j++) {
      if (dominated.has(j)) continue;
      const bVals = getRelevantValue(candidates[j]);

      // a が b を支配するか
      let aGE = true, aGT = false;
      let bGE = true, bGT = false;
      for (let k = 0; k < aVals.length; k++) {
        if (aVals[k] < bVals[k]) aGE = false;
        if (aVals[k] > bVals[k]) aGT = true;
        if (bVals[k] < aVals[k]) bGE = false;
        if (bVals[k] > aVals[k]) bGT = true;
      }
      if (aGE && aGT) dominated.add(j);
      else if (bGE && bGT) dominated.add(i);
    }
  }

  return candidates.filter((_, i) => !dominated.has(i));
}
