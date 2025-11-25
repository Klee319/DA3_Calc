import { create } from "zustand";
import type {
  CharacterBuild,
  Job,
  Equipment,
  EquipSlot,
  Buff,
  CalculatedStats,
  StatType,
  SPAllocation,
} from "@/types";

// 計算システムのインポート
import { calculateAllEquipmentStats, calculateWeaponStats } from "@/lib/calc/equipmentCalculator";
import { calculateAllJobStats } from "@/lib/calc/jobCalculator";
import { calculateStatus } from "@/lib/calc/statusCalculator";
import { convertJobNameToYAML } from "@/constants/jobMappings";
import type {
  EqConstData,
  JobSPData as CalcJobSPData,
  SelectedEquipment,
  StatusCalcInput,
  CalculatedStats as CalcSystemStats,
  StatBlock
} from "@/types/calc";
import type {
  EmblemData,
  RunestoneData,
  JobConstData,
  JobSPData,
  UserStatusCalcData
} from "@/types/data";

// 型変換ヘルパー関数
const convertToUIStats = (calcStats: CalcSystemStats): CalculatedStats => {
  const statMapping: Record<string, StatType> = {
    HP: 'HP',
    Power: 'ATK',
    Magic: 'MATK',
    Defense: 'DEF',
    Mind: 'MDEF',
    Dex: 'DEX',
    Agility: 'AGI',
    CritRate: 'CRI',
    // 他のステータスマッピングも追加
  };
  
  const convertStatBlock = (block: StatBlock): Record<StatType, number> => {
    const result = initialStats();
    for (const [key, value] of Object.entries(block)) {
      const mappedKey = statMapping[key];
      if (mappedKey && value) {
        result[mappedKey] = Math.floor(value);
      }
    }
    return result;
  };
  
  return {
    base: convertStatBlock(calcStats.base),
    fromEquipment: convertStatBlock(calcStats.breakdown?.equipment || {}),
    fromSkills: convertStatBlock(calcStats.breakdown?.jobSP || {}),
    fromBuffs: convertStatBlock({
      ...(calcStats.breakdown?.food || {}),
      ...(calcStats.breakdown?.userOption || {})
    }),
    total: convertStatBlock(calcStats.final)
  };
};

// 初期ステータス
const initialStats = (): Record<StatType, number> => ({
  HP: 0,
  MP: 0,
  ATK: 0,
  DEF: 0,
  MATK: 0,
  MDEF: 0,
  AGI: 0,
  DEX: 0,
  LUK: 0,
  CRI: 0,
  HIT: 0,
  FLEE: 0,
});

// 初期計算済みステータス
const initialCalculatedStats = (): CalculatedStats => ({
  base: initialStats(),
  fromEquipment: initialStats(),
  fromSkills: initialStats(),
  fromBuffs: initialStats(),
  total: initialStats(),
});

// 初期ビルド
const initialBuild = (): CharacterBuild => ({
  id: "default",
  name: "新規ビルド",
  job: null,
  level: 1,
  equipment: {},
  spAllocation: {},
  buffs: [],
});

// UserOptionの型定義
export interface UserOption {
  // 手動ステータス調整値
  manualStats: Partial<Record<StatType, number>>;
}

// RingOption の型定義
export interface RingOption {
  enabled: boolean;
  rings: Array<{
    type: 'attack' | 'magic' | 'defense' | 'special';
    level: number;
  }>;
}

// WeaponStats の型定義（計算済み武器ステータス）
export interface WeaponStats {
  attackPower: number;      // 攻撃力
  critRate: number;         // 会心率
  critDamage: number;       // 会心ダメージ
  damageCorrection: number; // ダメージ補正
  coolTime: number;         // クールタイム
  weaponType: string;       // 武器種
}

// Food の型定義
export interface Food {
  id: string;
  name: string;
  effects: Array<{
    stat: StatType;
    value: number;
    isPercent: boolean;
  }>;
  duration: number;
}

interface BuildState {
  // 現在のビルド
  currentBuild: CharacterBuild;
  // 計算済みステータス
  calculatedStats: CalculatedStats;
  // 計算済み武器ステータス
  weaponStats: WeaponStats | null;
  // 利用可能な職業リスト
  availableJobs: Job[];
  // 利用可能な装備リスト
  availableEquipment: Equipment[];
  // 利用可能なバフリスト
  availableBuffs: Buff[];
  // 利用可能な食べ物リスト
  availableFoods: Food[];

  // 計算用データ
  gameData: {
    eqConst?: EqConstData;
    jobConst?: JobConstData;
    jobSPData?: Map<string, JobSPData[]>;
    userStatusCalc?: UserStatusCalcData;
  };

  // 追加の設定
  userOption: UserOption;
  ringOption: RingOption;
  selectedFood: Food | null;
  foodEnabled: boolean;
  weaponSkillEnabled: boolean;

  // アクション
  setJob: (job: Job | null) => void;
  setLevel: (level: number) => void;
  setEquipment: (slot: EquipSlot, equipment: Equipment | null) => void;
  setSPAllocation: (allocation: SPAllocation) => void;
  toggleBuff: (buffId: string) => void;
  resetBuild: () => void;
  loadBuild: (build: CharacterBuild) => void;
  
  // 追加アクション
  setUserOption: (option: UserOption) => void;
  setRingOption: (option: RingOption) => void;
  setFood: (food: Food | null) => void;
  toggleFood: (enabled: boolean) => void;
  toggleWeaponSkill: (enabled: boolean) => void;

  // データ読み込み
  setAvailableJobs: (jobs: Job[]) => void;
  setAvailableEquipment: (equipment: Equipment[]) => void;
  setAvailableBuffs: (buffs: Buff[]) => void;
  setAvailableFoods: (foods: Food[]) => void;
  
  // ゲームデータ設定
  setGameData: (data: {
    eqConst?: EqConstData;
    jobConst?: JobConstData;
    jobSPData?: Map<string, JobSPData[]>;
    userStatusCalc?: UserStatusCalcData;
  }) => void;

  recalculateStats: () => void;
}

export const useBuildStore = create<BuildState>((set, get) => ({
  currentBuild: initialBuild(),
  calculatedStats: initialCalculatedStats(),
  weaponStats: null,
  availableJobs: [],
  availableEquipment: [],
  availableBuffs: [],
  availableFoods: [],
  gameData: {},
  userOption: {
    manualStats: {},
  },
  ringOption: {
    enabled: false,
    rings: [],
  },
  selectedFood: null,
  foodEnabled: false,
  weaponSkillEnabled: false,

  setJob: (job) => {
    const state = get();
    // 新しい職業のMaxLevelを取得
    let maxLevel = 100;
    if (job && state.gameData?.jobConst?.JobDefinition) {
      const yamlJobName = convertJobNameToYAML(job.id);
      maxLevel = state.gameData.jobConst.JobDefinition[yamlJobName]?.MaxLevel || 100;
    }

    // 現在のレベルがMaxLevelを超えている場合は調整
    const adjustedLevel = Math.min(state.currentBuild.level, maxLevel);

    set((state) => ({
      currentBuild: {
        ...state.currentBuild,
        job,
        level: adjustedLevel,
        spAllocation: {}
      },
    }));
    get().recalculateStats();
  },

  setLevel: (level) => {
    const state = get();
    // 現在の職業のMaxLevelを取得（jobConstがあればそこから、なければデフォルトの100）
    let maxLevel = 100;
    if (state.currentBuild.job && state.gameData?.jobConst?.JobDefinition) {
      // convertJobNameToYAML関数を使用して変換
      const yamlJobName = convertJobNameToYAML(state.currentBuild.job.id);
      maxLevel = state.gameData.jobConst.JobDefinition[yamlJobName]?.MaxLevel || 100;
    }

    set((state) => ({
      currentBuild: { ...state.currentBuild, level: Math.max(1, Math.min(maxLevel, level)) },
    }));
    get().recalculateStats();
  },

  setEquipment: (slot, equipment) => {
    set((state) => ({
      currentBuild: {
        ...state.currentBuild,
        equipment: { ...state.currentBuild.equipment, [slot]: equipment },
      },
    }));
    get().recalculateStats();
  },

  setSPAllocation: (allocation) => {
    set((state) => ({
      currentBuild: { ...state.currentBuild, spAllocation: allocation },
    }));
    get().recalculateStats();
  },

  toggleBuff: (buffId) => {
    set((state) => ({
      currentBuild: {
        ...state.currentBuild,
        buffs: state.currentBuild.buffs.map((b) =>
          b.id === buffId ? { ...b, isActive: !b.isActive } : b
        ),
      },
    }));
    get().recalculateStats();
  },

  resetBuild: () => {
    set({ currentBuild: initialBuild(), calculatedStats: initialCalculatedStats(), weaponStats: null });
  },

  loadBuild: (build) => {
    set({ currentBuild: build });
    get().recalculateStats();
  },

  setUserOption: (option) => {
    set({ userOption: option });
    get().recalculateStats();
  },
  
  setRingOption: (option) => {
    set({ ringOption: option });
    get().recalculateStats();
  },
  
  setFood: (food) => {
    set({ selectedFood: food });
    get().recalculateStats();
  },
  
  toggleFood: (enabled) => {
    set({ foodEnabled: enabled });
    get().recalculateStats();
  },
  
  toggleWeaponSkill: (enabled) => {
    set({ weaponSkillEnabled: enabled });
    get().recalculateStats();
  },

  setAvailableJobs: (jobs) => set({ availableJobs: jobs }),
  setAvailableEquipment: (equipment) => set({ availableEquipment: equipment }),
  setAvailableBuffs: (buffs) => set({ availableBuffs: buffs }),
  setAvailableFoods: (foods) => set({ availableFoods: foods }),
  
  setGameData: (data) => set({ gameData: data }),

  recalculateStats: () => {
    const state = get();
    const { currentBuild, userOption, ringOption, selectedFood, foodEnabled, gameData, weaponSkillEnabled } = state;

    // 必要なゲームデータがない場合は計算をスキップ
    if (!gameData.eqConst || !gameData.jobConst) {
      console.warn('計算に必要なゲームデータが不足しています');
      return;
    }

    // 職業が選択されていない場合は初期値を設定
    if (!currentBuild.job) {
      set({ calculatedStats: initialCalculatedStats(), weaponStats: null });
      return;
    }

    try {
      // 0. 武器ステータスを計算
      let calculatedWeaponStats: WeaponStats | null = null;
      let weaponCritRateValue = 0;

      const weaponEquipment = currentBuild.equipment.weapon;
      if (weaponEquipment && weaponEquipment.sourceData?.type === 'weapon') {
        const weaponData = weaponEquipment.sourceData.data;
        const rank = (weaponEquipment.rank || 'F') as import('@/lib/calc/equipmentCalculator').WeaponRank;
        const reinforcement = weaponEquipment.enhancementLevel || 0;
        // 武器の叩き回数は攻撃力用として取得（武器は通常攻撃力叩きのみ）
        const hammerCount = weaponEquipment.smithingCount || 0;
        const alchemyEnabled = weaponEquipment.alchemyEnabled || false;

        // 武器ステータスを計算
        const weaponStatsResult = calculateWeaponStats(
          weaponData,
          rank,
          reinforcement,
          hammerCount,
          alchemyEnabled,
          gameData.eqConst as import('@/types/data').EqConstData,
          gameData.userStatusCalc
        );

        // WeaponStats型に変換
        calculatedWeaponStats = {
          attackPower: weaponStatsResult.attackPower || 0,
          critRate: weaponStatsResult.critRate || 0,
          critDamage: weaponStatsResult.critDamage || 0,
          damageCorrection: weaponStatsResult.damageCorrection || 0,
          coolTime: weaponStatsResult.coolTime || 0,
          weaponType: weaponData.武器種
        };

        weaponCritRateValue = calculatedWeaponStats.critRate;
      }

      // 1. 装備ステータスを計算（新計算システム使用）
      const selectedEquipment: SelectedEquipment = {};

      // 装備データを新しい計算システム用に変換
      // 注: 現在の装備データ構造と新システムの要求する構造が異なるため、
      // 簡易的な変換を行います。実際の実装では詳細な変換が必要です。

      // 装備のステータス効果を直接StatBlockに変換
      const equipmentTotal: StatBlock = {};

      for (const [slot, equipment] of Object.entries(currentBuild.equipment)) {
        if (equipment) {
          for (const effect of equipment.baseStats) {
            // ステータス名のマッピング
            let statKey = '';
            switch(effect.stat) {
              case 'HP': statKey = 'HP'; break;
              case 'ATK': statKey = 'Power'; break;
              case 'MATK': statKey = 'Magic'; break;
              case 'DEF': statKey = 'Defense'; break;
              case 'MDEF': statKey = 'Mind'; break;
              case 'DEX': statKey = 'Dex'; break;
              case 'AGI': statKey = 'Agility'; break;
              case 'CRI': statKey = 'CritRate'; break;
              default: statKey = effect.stat;
            }

            if (effect.isPercent) {
              // パーセント補正は後で適用
              continue;
            } else {
              equipmentTotal[statKey as StatType] = (equipmentTotal[statKey as StatType] || 0) + effect.value;
            }
          }
        }
      }

      // 2. 職業ステータスを計算（新計算システム使用）
      // SPAllocationの形式に変換（branch, tier, spCostを持つ形式）
      // TODO: 現在のspAllocationはnodeId/levelの簡易形式だが、
      // calculateAllJobStatsはbranch/tier/spCost形式を期待している
      // 暫定的に空配列を渡して基礎ステータスのみ計算
      const spAllocationArray: any[] = [];

      // MapからJobに対応するJobSPData[]を取得
      const currentJobSPData = gameData.jobSPData?.get(currentBuild.job.id);

      // 日本語の職業名からYAML形式の職業名へ変換（共通マッピングを使用）
      const yamlJobName = convertJobNameToYAML(currentBuild.job.name || currentBuild.job.id);

      const jobStats = calculateAllJobStats(
        yamlJobName,
        currentBuild.level,
        spAllocationArray,
        gameData.jobConst,
        currentJobSPData
      );

      // 3. 最終ステータスを計算（新計算システム使用）
      const statusInput: StatusCalcInput = {
        equipmentTotal: equipmentTotal,
        jobStats: {
          initial: jobStats,
          sp: {},  // SPボーナスは既にjobStatsに含まれている
          bonusPercent: {}  // 職業のパーセントボーナス（必要に応じて追加）
        },
        food: foodEnabled && selectedFood ?
          selectedFood.effects.reduce((acc, effect) => {
            let statKey = '';
            switch(effect.stat) {
              case 'HP': statKey = 'HP'; break;
              case 'ATK': statKey = 'Power'; break;
              case 'MATK': statKey = 'Magic'; break;
              case 'DEF': statKey = 'Defense'; break;
              case 'MDEF': statKey = 'Mind'; break;
              case 'DEX': statKey = 'Dex'; break;
              case 'AGI': statKey = 'Agility'; break;
              default: statKey = effect.stat;
            }

            if (!effect.isPercent) {
              acc[statKey as keyof StatBlock] = (acc[statKey as keyof StatBlock] || 0) + effect.value;
            }
            return acc;
          }, {} as StatBlock) : {},
        userOption: Object.entries(userOption.manualStats || {}).reduce((acc, [key, value]) => {
          let statKey = '';
          switch(key) {
            case 'HP': statKey = 'HP'; break;
            case 'ATK': statKey = 'Power'; break;
            case 'MATK': statKey = 'Magic'; break;
            case 'DEF': statKey = 'Defense'; break;
            case 'MDEF': statKey = 'Mind'; break;
            case 'DEX': statKey = 'Dex'; break;
            case 'AGI': statKey = 'Agility'; break;
            default: statKey = key;
          }
          if (value) {
            acc[statKey as keyof StatBlock] = value;
          }
          return acc;
        }, {} as StatBlock),
        ring: ringOption.enabled ? {
          enabled: true,
          bonusPercent: {} // リングデータから計算（実装が必要）
        } : undefined,
        weaponCritRate: weaponCritRateValue,
        emblemBonusPercent: {} // 紋章ボーナス（実装が必要）
      };

      const result = calculateStatus(statusInput);

      if (result.success && result.data) {
        // CalcSystemStats型からCalculatedStats型への変換
        const convertedStats = convertToUIStats(result.data);
        set({ calculatedStats: convertedStats, weaponStats: calculatedWeaponStats });
      } else {
        console.error('ステータス計算エラー: result.success is false');
        set({ calculatedStats: initialCalculatedStats(), weaponStats: null });
      }
    } catch (error) {
      console.error('計算中にエラーが発生しました:', error);
      console.error('エラーの詳細:', {
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error,
        currentBuild: currentBuild,
        gameData: {
          hasEqConst: !!gameData.eqConst,
          hasJobConst: !!gameData.jobConst,
          hasJobSPData: !!gameData.jobSPData
        }
      });
      set({ calculatedStats: initialCalculatedStats(), weaponStats: null });
    }
  },
}));
