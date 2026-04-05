/**
 * 最適化モジュール - 型定義
 *
 * このファイルは装備最適化機能で使用するすべての型を定義します。
 * ビルドツールとの連携のため、既存の型も再エクスポートしています。
 */

import { CharacterBuild, EquipSlot, EquipmentRank } from './index';
import { EquipmentSet, StatBlock, InternalStatKey } from './calc';

// ===== 基本型定義 =====

/** 最適化モード */
export type OptimizeMode = 'damage' | 'stat' | 'dps';

/** 最適化モードのラベル */
export const OPTIMIZE_MODE_LABELS: Record<OptimizeMode, string> = {
  damage: '期待値',
  stat: 'ステータス',
  dps: 'DPS',
};

/** 職業グレードごとの最大レベル */
export const JOB_GRADE_MAX_LEVELS: Record<string, number> = {
  Novice: 10,
  Special: 50,
  First: 70,
  Second: 90,
  Third: 100,
};

/** 装備ランクの値マッピング */
export const RANK_VALUES: Record<string, number> = {
  '': 0,
  D: 1,
  C: 2,
  B: 3,
  A: 4,
  S: 5,
  SS: 6,
  SSS: 7,
};

// ===== 敵パラメータ =====

/** 敵パラメータ */
export interface EnemyParams {
  name: string;
  level: number;
  DEF: number;
  MDEF: number;
  element?: string;
  race?: string;
  size?: string;
}

// ===== 必須最低値・オプション値 =====

/** 必須最低ステータス要件 */
export interface MinimumStatRequirements {
  Power?: number;      // 力
  Magic?: number;      // 魔力
  HP?: number;         // 体力
  Mind?: number;       // 精神
  Agility?: number;    // 素早さ
  Dex?: number;        // 器用さ
  CritDamage?: number; // 撃力（会心ダメージ）
  Defense?: number;    // 守備力
  CritRate?: number;   // 会心率
}

/** オプションステータス（最終ステータスに加算される） */
export interface OptionStats {
  Power?: number;
  Magic?: number;
  HP?: number;
  Mind?: number;
  Agility?: number;
  Dex?: number;
  CritDamage?: number;
  Defense?: number;
}

// ===== 制約条件 =====

/** 探索制約条件 */
export interface OptimizeConstraints {
  weaponRankMin?: number;
  weaponRankMax?: number;
  armorRankMin?: number;
  armorRankMax?: number;
  accessoryRankMin?: number;
  accessoryRankMax?: number;
  fixedEquipment?: Partial<Record<EquipSlot, string>>;
  targetSlots: EquipSlot[];
  maxCombinations?: number;
  maxResults?: number;
  timeLimit?: number;          // 制限時間（ミリ秒）
  beamWidth?: number;          // Beam Search のビーム幅
  enableTwoStageGeneration?: boolean; // 二段階生成の有効化
}

/** デフォルト制約条件 */
export const DEFAULT_CONSTRAINTS: OptimizeConstraints = {
  targetSlots: ['weapon', 'head', 'body', 'leg', 'accessory1', 'accessory2'],
  maxCombinations: 100000,
  maxResults: 10,
  timeLimit: 60000,
  beamWidth: 100,
  enableTwoStageGeneration: true,
};

/** 最適化固定値（ゲームルール） */
export const OPTIMIZE_FIXED_VALUES = {
  // 新しい命名規則
  MAX_SMITHING_COUNT: 12,          // 最大叩き回数
  WEAPON_SMITHING_OPTIONS: 2,      // 武器の叩き箇所数
  ARMOR_SMITHING_OPTIONS: 3,       // 防具の叩き箇所数
  EX_SLOT_COUNT: 2,                // EXスロット数
  EMBLEM_RUNESTONE_SLOTS: 4,       // 紋章のルーンストーンスロット数
  TAROT_BUFF_SLOTS: 5,             // タロットのバフスロット数
  RUNESTONE_GRADES: ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS'] as const,

  // 旧命名規則（互換性のため）
  rank: 'SSS' as const,            // 装備ランク
  weaponEnhancement: 80,           // 武器強化値（最大80）
  armorEnhancement: 40,            // 防具強化値（最大40）
  maxSmithingCount: 12,            // 最大叩き回数（旧名）
  alchemyEnabled: true,            // 錬金有効
};

// ===== 装備候補 =====

/** 装備構成（叩き・EXの組み合わせ） */
export interface EquipmentConfiguration {
  // 基本情報
  rank?: string;                             // 装備ランク
  enhancement?: number;                      // 強化値
  alchemyEnabled?: boolean;                  // 錬金有効

  // 叩き配分
  smithingPattern?: Record<string, number>;  // 叩き配分 { ATK: 5, CritDamage: 5 }
  smithing?: {                               // 旧形式（互換性）
    attackPower?: number;
    critRate?: number;
    critDamage?: number;
    tatakiCount?: number;
  };

  // EXステータス
  exStats?: {
    ex1?: string;
    ex2?: string;
  };

  // 計算済みステータス（オプショナル - 評価時に計算）
  stats?: StatBlock;
}

/** 候補装備（バリアント展開済み） */
export interface CandidateEquipment {
  id: string;
  name: string;
  slot: EquipSlot;
  type: string;                           // 武器種・防具種
  rank?: EquipmentRank;                   // 装備ランク（オプショナル）
  baseStats?: StatBlock;                  // 基本ステータス（オプショナル）
  configurations: EquipmentConfiguration[]; // 取り得る構成一覧
  sourceData: unknown;                    // 元データ参照（WeaponData, ArmorData等）
  // メタ情報
  isCrafted?: boolean;                    // 制作装備かどうか
  canSmith?: boolean;                     // 叩き可能か
  relevantStatContribution?: number;      // 依存ステ寄与度（枝刈り用）
}

/** 装備プール（スロット別候補集合） */
export interface EquipmentPool {
  weapon: CandidateEquipment[];
  head: CandidateEquipment[];
  body: CandidateEquipment[];
  leg: CandidateEquipment[];
  accessory1: CandidateEquipment[];
  accessory2: CandidateEquipment[];
}

// ===== 紋章・ルーンストーン =====

/** ルーンストーン選択 */
export interface RunestoneSelection {
  slot: number;        // 0-3
  runestoneName: string;
  grade: string;
}

/** 紋章構成 */
export interface EmblemConfiguration {
  emblemId: string;
  emblemName: string;
  runestones: RunestoneSelection[];
  totalBonus: StatBlock;
}

// ===== タロット =====

/** タロットバフ選択 */
export interface TarotBuffSelection {
  slot: number;        // 0-4
  buffId: string;
  buffName: string;
}

/** タロット構成 */
export interface TarotConfiguration {
  tarotId: string;
  tarotName: string;
  selectedBuffs: TarotBuffSelection[];
  totalBonus: StatBlock;
}

// ===== 入力・出力 =====

/** 最適化入力パラメータ */
export interface OptimizeInput {
  // 職業設定
  jobName: string;
  jobLevel: number;
  jobGrade?: string;
  spAllocation: Record<string, number>;

  // スキル設定
  targetSkillId?: string;
  skillLevel: number;

  // 最適化設定
  optimizeMode: OptimizeMode;
  targetStat?: InternalStatKey;

  // 制約条件
  constraints: OptimizeConstraints;
  minimumStats?: MinimumStatRequirements;
  optionStats?: OptionStats;

  // 敵パラメータ
  enemyParams: EnemyParams;

  // キャラクターレベル
  characterLevel: number;

  // 追加オプション
  userOption?: StatBlock;
  ringOption?: {
    enabled: boolean;
    ringType: 'power' | 'magic' | 'speed';
  };

  // 紋章・タロット探索設定
  enableEmblemSearch?: boolean;
  enableTarotSearch?: boolean;
  fixedEmblemId?: string;
  fixedTarotId?: string;
}

/** 装備スロット詳細 */
export interface EquipmentSlotDetail {
  slot: EquipSlot;
  equipment: {
    name: string;
    type: string;
    rank?: string;
    [key: string]: unknown;
  };
  configuration?: EquipmentConfiguration;
  stats: StatBlock;
}

/** 最適化結果アイテム */
export interface OptimizeResultItem {
  rank: number;
  evaluationScore: number;
  meetsMinimum: boolean;

  // 装備セット
  equipmentSet: Record<string, EquipmentSlotDetail>;

  // 計算済みステータス
  calculatedStats: StatBlock & {
    ATK?: number;
    MATK?: number;
    CRI?: number;
    HIT?: number;
  };

  // ダメージ内訳
  breakdown: {
    expectedDamage: number;
    critDamage?: number;
    dps?: number;
    targetStatName?: string;
    targetStatValue?: number;
  };

  // 紋章・タロット
  selectedEmblem?: EmblemConfiguration | null;
  selectedTarot?: TarotConfiguration | null;
  selectedRunestones?: {
    runestones: Array<{ name: string; grade: string }>;
    totalBonus: StatBlock;
  } | null;

  // SP自動最適化結果
  spPattern?: Record<string, number> | null;

  // 差分情報（現在との比較）
  diff?: {
    scoreDiff: number;
    statDiffs?: Record<string, number>;
  };
}

/** 検索統計 */
export interface SearchStats {
  totalCandidates: number;
  evaluatedCombinations: number;
  prunedCombinations: number;
  elapsedTime: number;
  phase: string;
  // Beam Search統計
  beamWidth?: number;
  slotPhases?: string[];
  // 二段階生成統計
  coarseEvaluations?: number;
  fineEvaluations?: number;
}

/** 最適化出力 */
export interface OptimizeOutput {
  results: OptimizeResultItem[];
  searchStats: SearchStats;
  warnings?: string[];
}

// ===== プログレス =====

/** 探索フェーズ */
export type OptimizePhase =
  | 'initializing'
  | 'building_pool'
  | 'greedy'
  | 'local_search'
  | 'beam_search'
  | 'two_stage'
  | 'finalizing'
  | 'completed'
  | 'cancelled'
  | 'error';

/** 最適化プログレス情報 */
export interface OptimizeProgress {
  phase: OptimizePhase;
  current: number;
  total: number;
  percentage: number;
  currentBest: number;
  message: string;
  elapsedTime: number;

  // 暫定解の情報（進捗表示用）
  intermediateEquipment?: Record<string, string>;
  intermediateStats?: Record<string, number>;

  // Beam Search用
  currentSlot?: EquipSlot;
  beamSize?: number;
  prunedCount?: number;
}

// ===== 旧互換用（非推奨） =====

/** @deprecated OptimizeResultItem を使用してください */
export interface OptimizeResult {
  rank: number;
  build: CharacterBuild;
  equipment: EquipmentSet;
  expectedDamage: number;
  meetsMinimum?: boolean;
  calculatedStats: {
    ATK?: number;
    MATK?: number;
    CRI?: number;
    HIT?: number;
    [key: string]: unknown;
  };
  damageDetails: {
    baseDamage: number;
    critRate: number;
    hitRate: number;
    elementalBonus?: number;
    skillMultiplier?: number;
  };
  selectedEmblem?: unknown;
  selectedRunestones?: unknown;
}
