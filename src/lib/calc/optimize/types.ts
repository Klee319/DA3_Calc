/**
 * 最適化モジュール - 型定義
 */

import { EquipSlot, EquipmentRank } from '@/types';
import {
  OptimizeMode,
  CandidateEquipment,
  MinimumStatRequirements,
} from '@/types/optimize';
import { StatBlock, InternalStatKey } from '@/types/calc';
import { EmblemData, JobConstData, JobSPData, WeaponCalcData, SkillCalcData } from '@/types/data';
import { RelevantStats } from '../skillAnalyzer';

/** シンプルなステータスブロック型（最適化用） */
export type SimpleStatBlock = Record<string, number>;

/** 評価コンテキスト */
export interface EvaluationContext {
  mode: OptimizeMode;
  targetStat?: InternalStatKey;
  skillId: string;
  skillMultiplier: number;
  hits: number;
  coolTime: number;
  enemyDefense: number;
  enemyTypeResistance: number;
  enemyAttributeResistance: number;
  jobMaxLevel?: number;
  jobName?: string;
  jobConst?: JobConstData;
  jobSPData?: JobSPData[];
  jobBonusPercent?: StatBlock;
  spAllocation?: Record<string, number>;
  emblem?: EmblemData | null;
  minimumStats?: MinimumStatRequirements;
  weaponCalc?: WeaponCalcData;
  skillCalc?: SkillCalcData;
  relevantStats?: RelevantStats;
  runestoneBonus?: StatBlock;
  userOption?: StatBlock;
  food?: StatBlock;
  tarotBonusPercent?: StatBlock;
  tarotWeaponBonus?: Record<string, number>;
}

/** スコア付き組み合わせ */
export interface ScoredCombination {
  equipmentSet: Record<EquipSlot, CandidateEquipment | null>;
  configIndices: Record<EquipSlot, number>;
  score: number;           // ソート・比較用スコア（制約未達時は減衰）
  originalScore: number;   // 表示用スコア（元のダメージ期待値）
  stats: SimpleStatBlock;
  meetsMinimum: boolean;
}

/** EXタイプ定義（防具用） */
export type ArmorEXType = 'Dex' | 'CritDamage' | 'Speed' | 'HP' | 'Power' | 'Magic' | 'Mind';

/** EXタイプ定義（アクセサリー用） */
export type AccessoryEXType = 'Dex' | 'CritDamage' | 'Speed' | 'HP' | 'Power' | 'Magic' | 'Mind';

/** スロット順序戦略 */
export type SlotOrderStrategy = 'default' | 'reverse' | 'random' | 'weapon_first' | 'accessory_first';

/** ルーンストーン組み合わせ */
export interface RunestoneCombination {
  runestones: string[];
  stats: SimpleStatBlock;
  score: number;
}

/** 最適化オプション */
export interface OptimizeOptions {
  mode: OptimizeMode;
  targetStat?: InternalStatKey;
  skillId: string;
  skillMultiplier: number;
  hits: number;
  coolTime: number;
  enemyDefense: number;
  enemyTypeResistance: number;
  enemyAttributeResistance: number;
  jobMaxLevel?: number;
  jobName?: string;
  selectedWeaponType?: string | null;
  selectedEmblems?: EmblemData[];
  selectedRunestones?: string[];
  spAllocation?: Record<string, number>;
  minimumStats?: MinimumStatRequirements;
  maxResults?: number;
  timeLimit?: number;
  onProgress?: (progress: number) => void;
  userOption?: StatBlock;
  food?: StatBlock;
}

/** 検索統計 */
export interface SearchStats {
  totalCombinations: number;
  evaluatedCombinations: number;
  prunedCombinations: number;
  searchTimeMs: number;
  strategy: string;
  cacheHits: number;
  cacheMisses: number;
}

/** 統計付き最適化結果 */
export interface OptimizeResultWithStats {
  results: import('@/types/optimize').OptimizeResult[];
  stats: SearchStats;
}
