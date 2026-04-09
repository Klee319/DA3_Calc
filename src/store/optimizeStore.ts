import { create } from "zustand";
import type { EquipSlot } from "@/types";
import type { InternalStatKey, StatBlock } from "@/types/calc";
import type {
  OptimizeMode,
  OptimizeConstraints,
  OptimizeInput,
  OptimizeOutput,
  OptimizeProgress,
  OptimizeResultItem,
  EnemyParams,
  MinimumStatRequirements,
} from "@/types/optimize";
import {
  DEFAULT_CONSTRAINTS,
  OPTIMIZE_FIXED_VALUES,
  JOB_GRADE_MAX_LEVELS,
} from "@/types/optimize";
import { optimizeEquipment } from "@/lib/calc/optimize/engine";
import type { OptimizeGameData } from "@/lib/calc/optimize/engine";
import { convertJobNameToYAML, ACTUAL_WEAPON_TYPES } from "@/constants/jobMappings";

// ===== ストア状態の型定義 =====

/** スキルデータ（最適化用） */
interface SkillDataForOptimize {
  id: string;
  name: string;
  multiplier: number;    // ダメージ倍率
  hits: number;          // ヒット数
  coolTime: number;      // クールタイム
  baseDamageType: string[]; // 参照する基礎ダメージタイプ
}

interface OptimizeStoreState {
  // === 入力パラメータ ===
  // 職業設定
  selectedJobName: string | null;
  jobGrade: string | null;           // 職業グレード（Special/First/Second/Third）
  jobMaxLevel: number;               // 職業の最大レベル（グレードから自動設定）
  spAllocation: Record<string, number>;
  availableWeaponTypes: string[];    // 職業の使用可能武器種
  availableArmorTypes: string[];     // 職業の使用可能防具種
  selectedWeaponType: string | null; // 評価用の選択武器種（複数武器種職業用）

  // スキル設定
  selectedSkillId: string | null;
  skillLevel: number;
  selectedSkillData: SkillDataForOptimize | null; // 選択中スキルの詳細データ

  // 最適化設定
  optimizeMode: OptimizeMode;
  targetStat: InternalStatKey | null;

  // 制約条件（新しい構造）
  constraints: OptimizeConstraints;
  minimumStats: MinimumStatRequirements;  // 最低必須ステータス

  // 敵パラメータ
  enemyParams: EnemyParams;

  // 追加オプション
  userOption: StatBlock;
  ringOption: {
    enabled: boolean;
    ringType: 'power' | 'magic' | 'speed';
  };
  runestoneBonus: StatBlock;  // ルーンストーンボーナス（合計値）
  enableRunestoneSearch: boolean;  // ルーンストーン探索を有効化
  enableTarotSearch: boolean;      // タロット探索を有効化
  beamWidth: number;               // Beam Search のビーム幅

  // === 実行状態 ===
  isOptimizing: boolean;
  progress: OptimizeProgress | null;
  abortController: AbortController | null;

  // === 結果 ===
  output: OptimizeOutput | null;
  selectedResultIndex: number | null;

  // === エラー ===
  error: string | null;

  // === 履歴 ===
  history: OptimizeOutput[];
}

interface OptimizeStoreActions {
  // 入力設定アクション
  setSelectedJobName: (
    jobName: string | null,
    availableWeapons?: string[],
    availableArmors?: string[],
    grade?: string,
    maxLevel?: number
  ) => void;
  setSelectedWeaponType: (weaponType: string | null) => void;
  setSPAllocation: (allocation: Record<string, number>) => void;
  setSelectedSkillId: (skillId: string | null, skillData?: SkillDataForOptimize | null) => void;
  setSkillLevel: (level: number) => void;
  setOptimizeMode: (mode: OptimizeMode) => void;
  setTargetStat: (stat: InternalStatKey | null) => void;
  setConstraints: (constraints: Partial<OptimizeConstraints>) => void;
  setEnemyParams: (params: Partial<EnemyParams>) => void;
  setUserOption: (option: StatBlock) => void;
  setRingOption: (option: { enabled: boolean; ringType: 'power' | 'magic' | 'speed' }) => void;
  setRunestoneBonus: (bonus: StatBlock) => void;
  setEnableRunestoneSearch: (enabled: boolean) => void;
  setEnableTarotSearch: (enabled: boolean) => void;
  setBeamWidth: (width: number) => void;

  // 新しい制約条件アクション
  setMinimumStats: (stats: Partial<MinimumStatRequirements>) => void;
  setMinimumStat: (stat: keyof MinimumStatRequirements, value: number | undefined) => void;

  // 制約条件ショートカット
  setFixedEquipment: (slot: EquipSlot, equipmentId: string | null) => void;
  setTargetSlots: (slots: EquipSlot[]) => void;
  resetConstraints: () => void;

  // 実行アクション
  startOptimization: (gameData: OptimizeGameData) => Promise<void>;
  cancelOptimization: () => void;

  // 結果アクション
  selectResult: (index: number | null) => void;
  clearResults: () => void;
  clearError: () => void;

  // ユーティリティ
  getOptimizeInput: () => OptimizeInput | null;
  reset: () => void;
}

// ===== 初期状態 =====

const initialEnemyParams: EnemyParams = {
  name: 'デフォルト敵',
  level: 100,
  DEF: 0,  // デフォルトは敵防御なし（ビルドツールと同等の条件）
  MDEF: 0,
  element: undefined,
  race: undefined,
  size: undefined,
};

const initialState: OptimizeStoreState = {
  // 入力パラメータ
  selectedJobName: null,
  jobGrade: null,
  jobMaxLevel: 100,
  spAllocation: {},
  availableWeaponTypes: [],
  availableArmorTypes: [],
  selectedWeaponType: null,
  selectedSkillId: null,
  skillLevel: 1,
  selectedSkillData: null,
  optimizeMode: 'damage',
  targetStat: null,
  constraints: DEFAULT_CONSTRAINTS,
  minimumStats: {},
  enemyParams: initialEnemyParams,
  userOption: {},
  ringOption: { enabled: false, ringType: 'power' },
  runestoneBonus: {},
  enableRunestoneSearch: true,  // ルーンストーン探索をデフォルトで有効
  enableTarotSearch: true,      // タロット探索をデフォルトで有効
  beamWidth: 200,               // Beam Search デフォルトビーム幅

  // 実行状態
  isOptimizing: false,
  progress: null,
  abortController: null,

  // 結果
  output: null,
  selectedResultIndex: null,

  // エラー
  error: null,

  // 履歴
  history: [],
};

// ===== ストア作成 =====

export const useOptimizeStore = create<OptimizeStoreState & OptimizeStoreActions>((set, get) => ({
  ...initialState,

  // === 入力設定アクション ===

  setSelectedJobName: (jobName, availableWeapons = [], availableArmors = [], grade = 'First', jobMaxLevel?: number) => {
    // maxLevelが直接指定されていればそれを使用、なければグレードから取得
    const maxLevel = jobMaxLevel ?? (JOB_GRADE_MAX_LEVELS[grade] || 100);
    // 実際の武器種のみをフィルタリング（Grimoire, Shield などの副装備を除外）
    const actualWeapons = availableWeapons.filter(w => ACTUAL_WEAPON_TYPES.includes(w));
    // 武器種が1つの場合は自動選択、複数の場合はnull
    const autoSelectedWeapon = actualWeapons.length === 1 ? actualWeapons[0] : null;
    set({
      selectedJobName: jobName,
      jobGrade: grade,
      jobMaxLevel: maxLevel,
      spAllocation: {},
      availableWeaponTypes: actualWeapons,
      availableArmorTypes: availableArmors,
      selectedWeaponType: autoSelectedWeapon,
      // 職業が変わったらスキルもリセット
      selectedSkillId: null,
      selectedSkillData: null,
    });
  },

  setSPAllocation: (allocation) => {
    set({ spAllocation: allocation });
  },

  setSelectedWeaponType: (weaponType) => {
    set({ selectedWeaponType: weaponType });
  },

  setSelectedSkillId: (skillId, skillData = null) => {
    set({
      selectedSkillId: skillId,
      selectedSkillData: skillData,
    });
  },

  setSkillLevel: (level) => {
    set({ skillLevel: Math.max(1, Math.min(level, 10)) });
  },

  setOptimizeMode: (mode) => {
    set({ optimizeMode: mode });
  },

  setTargetStat: (stat) => {
    set({ targetStat: stat });
  },

  setConstraints: (constraints) => {
    set((state) => ({
      constraints: { ...state.constraints, ...constraints },
    }));
  },

  setEnemyParams: (params) => {
    set((state) => ({
      enemyParams: { ...state.enemyParams, ...params },
    }));
  },

  setUserOption: (option) => {
    set({ userOption: option });
  },

  setRingOption: (option) => {
    set({ ringOption: option });
  },

  setRunestoneBonus: (bonus) => {
    set({ runestoneBonus: bonus });
  },

  setEnableRunestoneSearch: (enabled) => {
    set({ enableRunestoneSearch: enabled });
  },

  setEnableTarotSearch: (enabled) => {
    set({ enableTarotSearch: enabled });
  },

  setBeamWidth: (width) => {
    set({ beamWidth: Math.max(50, Math.min(500, width)) });
  },

  // === 新しい制約条件アクション ===

  setMinimumStats: (stats) => {
    set((state) => ({
      minimumStats: { ...state.minimumStats, ...stats },
    }));
  },

  setMinimumStat: (stat, value) => {
    set((state) => {
      const newStats = { ...state.minimumStats };
      if (value === undefined) {
        delete newStats[stat];
      } else {
        newStats[stat] = value;
      }
      return { minimumStats: newStats };
    });
  },

  // === 制約条件ショートカット ===

  setFixedEquipment: (slot, equipmentId) => {
    set((state) => {
      const newFixed = { ...state.constraints.fixedEquipment };
      if (equipmentId === null) {
        delete newFixed[slot];
      } else {
        newFixed[slot] = equipmentId;
      }
      return {
        constraints: {
          ...state.constraints,
          fixedEquipment: newFixed,
        },
      };
    });
  },

  setTargetSlots: (slots) => {
    set((state) => ({
      constraints: { ...state.constraints, targetSlots: slots },
    }));
  },

  resetConstraints: () => {
    set({
      constraints: DEFAULT_CONSTRAINTS,
      minimumStats: {},
    });
  },

  // === 実行アクション ===

  startOptimization: async (gameData) => {
    const state = get();

    // 入力検証
    if (!state.selectedJobName) {
      set({ error: '職業を選択してください' });
      return;
    }

    if (state.optimizeMode !== 'stat' && !state.selectedSkillId) {
      set({ error: 'スキルを選択してください（ステータスモード以外）' });
      return;
    }

    if (state.optimizeMode === 'stat' && !state.targetStat) {
      set({ error: '最大化するステータスを選択してください' });
      return;
    }

    // AbortControllerを作成
    const abortController = new AbortController();

    set({
      isOptimizing: true,
      progress: {
        phase: 'initializing',
        current: 0,
        total: 0,
        percentage: 0,
        currentBest: 0,
        message: '初期化中...',
        elapsedTime: 0,
      },
      error: null,
      abortController,
    });

    try {
      const input = get().getOptimizeInput();
      if (!input) {
        throw new Error('入力パラメータが不正です');
      }

      // スキルデータから倍率・ヒット数・CTを取得（なければデフォルト値）
      const skillMultiplier = state.selectedSkillData?.multiplier ?? 1.0;
      const skillHits = state.selectedSkillData?.hits ?? 1;
      const skillCoolTime = state.selectedSkillData?.coolTime ?? 5;

      // 最適化実行
      const optimizeResult = await optimizeEquipment(
        {
          id: 'temp',
          name: 'Optimize Build',
          job: null,
          level: state.jobMaxLevel,  // 職業の最大レベルを使用
          equipment: {},
          spAllocation: state.spAllocation,
          buffs: [],
        },
        state.constraints.targetSlots,
        state.constraints,
        state.selectedSkillId || '',
        {
          defense: state.enemyParams.DEF,
          typeResistance: 0,
          attributeResistance: 0,
        },
        gameData,
        (progress) => {
          set({ progress });
        },
        {
          mode: state.optimizeMode,
          targetStat: state.targetStat || undefined,
          skillMultiplier,
          skillHits,
          skillCoolTime,
          availableWeaponTypes: state.availableWeaponTypes,
          availableArmorTypes: state.availableArmorTypes,
          selectedWeaponType: state.selectedWeaponType,
          // 新しい制約条件
          minimumStats: state.minimumStats,
          jobGrade: state.jobGrade || 'First',
          jobMaxLevel: state.jobMaxLevel,
          // 職業名（YAML形式）
          jobName: state.selectedJobName ? convertJobNameToYAML(state.selectedJobName) : undefined,
          // 職業名（日本語、SPデータ検索用）
          jobNameJP: state.selectedJobName || undefined,
          // SP振り分け（ユーザーの必須分）
          spAllocation: state.spAllocation,
          // ルーンストーンボーナス
          runestoneBonus: state.runestoneBonus,
          // ルーンストーン探索オプション
          enableRunestoneSearch: state.enableRunestoneSearch,
          // タロット探索オプション
          enableTarotSearch: state.enableTarotSearch,
          // Beam Search設定
          beamWidth: state.beamWidth,
        }
      );

      // 結果を抽出
      const { results, searchStats: returnedSearchStats, warnings } = optimizeResult;

      // 結果を変換
      const output: OptimizeOutput = {
        results: results.map((r, idx) => {
          // 装備セットを詳細形式に変換
          const equipmentSet: Record<string, any> = {};
          const slots = ['weapon', 'head', 'body', 'leg', 'accessory1', 'accessory2'];

          for (const slot of slots) {
            const eqData = (r.equipment as Record<string, any>)[slot];
            if (eqData) {
              equipmentSet[slot] = {
                slot,
                equipment: {
                  name: eqData.name,
                  type: eqData.type,
                  ...eqData.sourceData,
                },
                configuration: eqData.configuration,
                stats: eqData.stats || {},
              };
            }
          }

          return {
            rank: idx + 1,
            evaluationScore: r.expectedDamage,
            meetsMinimum: (r as any).meetsMinimum ?? true,
            equipmentSet,
            calculatedStats: r.calculatedStats as any,
            breakdown: {
              expectedDamage: r.expectedDamage,
              critDamage: r.damageDetails.critRate,
            },
            // 紋章とSPパターン情報を追加
            selectedEmblem: (r as any).selectedEmblem || null,
            spPattern: (r as any).spPattern || null,
            // ルーンストーン情報を追加
            selectedRunestones: (r as any).selectedRunestones || null,
            // タロット情報を追加
            selectedTarot: (r as any).selectedTarot || null,
          };
        }),
        searchStats: returnedSearchStats,
        warnings,  // 警告メッセージを追加
      };

      set({
        isOptimizing: false,
        progress: {
          phase: 'completed',
          current: 100,
          total: 100,
          percentage: 100,
          currentBest: output.results[0]?.evaluationScore || 0,
          message: '完了',
          elapsedTime: 0,
        },
        output,
        history: [...get().history, output].slice(-10), // 最新10件を保持
      });
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        set({
          isOptimizing: false,
          progress: {
            phase: 'cancelled',
            current: 0,
            total: 0,
            percentage: 0,
            currentBest: 0,
            message: 'キャンセルされました',
            elapsedTime: 0,
          },
        });
      } else {
        set({
          isOptimizing: false,
          error: (error as Error).message || '最適化中にエラーが発生しました',
          progress: {
            phase: 'error',
            current: 0,
            total: 0,
            percentage: 0,
            currentBest: 0,
            message: 'エラー',
            elapsedTime: 0,
          },
        });
      }
    }
  },

  cancelOptimization: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
    }
    set({
      isOptimizing: false,
      abortController: null,
    });
  },

  // === 結果アクション ===

  selectResult: (index) => {
    set({ selectedResultIndex: index });
  },

  clearResults: () => {
    set({
      output: null,
      selectedResultIndex: null,
      progress: null,
    });
  },

  clearError: () => {
    set({ error: null });
  },

  // === ユーティリティ ===

  getOptimizeInput: () => {
    const state = get();

    if (!state.selectedJobName) {
      return null;
    }

    return {
      jobName: state.selectedJobName,
      jobLevel: state.jobMaxLevel,  // 職業の最大レベルを使用
      spAllocation: state.spAllocation,
      targetSkillId: state.selectedSkillId || undefined,
      skillLevel: state.skillLevel,
      optimizeMode: state.optimizeMode,
      targetStat: state.targetStat || undefined,
      constraints: state.constraints,
      enemyParams: state.enemyParams,
      characterLevel: state.jobMaxLevel,  // 職業の最大レベルを使用
      userOption: state.userOption,
      ringOption: state.ringOption,
    };
  },

  reset: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
    }
    set(initialState);
  },
}));

// ===== セレクター（パフォーマンス最適化用） =====

export const selectIsReady = (state: OptimizeStoreState) => {
  if (!state.selectedJobName) return false;
  if (state.optimizeMode !== 'stat' && !state.selectedSkillId) return false;
  if (state.optimizeMode === 'stat' && !state.targetStat) return false;
  return true;
};

export const selectHasResults = (state: OptimizeStoreState) => {
  return state.output !== null && state.output.results.length > 0;
};

export const selectBestResult = (state: OptimizeStoreState): OptimizeResultItem | null => {
  return state.output?.results[0] || null;
};

export const selectSelectedResult = (state: OptimizeStoreState): OptimizeResultItem | null => {
  if (state.selectedResultIndex === null || !state.output) return null;
  return state.output.results[state.selectedResultIndex] || null;
};
