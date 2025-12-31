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

// localStorage キー
const PRESETS_STORAGE_KEY = 'da_calc_build_presets';

// 計算システムのインポート
import { calculateAllEquipmentStats, calculateWeaponStats, calculateArmorStats, calculateAccessoryStats } from "@/lib/calc/equipmentCalculator";
import type { EquipmentRank } from "@/lib/calc/equipmentCalculator";
import type { ArmorData, AccessoryData } from "@/types/data";
import { calculateAllJobStats, calculateBranchBonus, convertToSPTree } from "@/lib/calc/jobCalculator";
import { calculateStatus } from "@/lib/calc/statusCalculator";
import { convertJobNameToYAML } from "@/constants/jobMappings";
import type {
  JobSPData as CalcJobSPData,
  SelectedEquipment,
  StatusCalcInput,
  CalculatedStats as CalcSystemStats,
  StatBlock
} from "@/types/calc";
import type {
  EqConstData,
  EmblemData,
  RunestoneData,
  JobConstData,
  JobSPData,
  UserStatusCalcData,
  WeaponSkillCalcData,
  TarotCalcData,
  TarotCardDefinition,
  TarotSubOptionDefinition,
  SelectedTarot,
  TarotBonusStats
} from "@/types/data";
import type { DebugEmblemStats, DebugTarotStats } from "@/types";

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
    CritDamage: 'HIT',  // 撃力
    // 注: CritRate（会心率）は別途calculateStatusで計算される
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
  
  // 会心率は別途計算されるため、totalに追加
  const totalStats = convertStatBlock(calcStats.final);
  // 会心率（武器会心率 + 器用さ * 0.3）をCRIに設定
  if (calcStats.critRate !== undefined) {
    totalStats.CRI = Math.floor(calcStats.critRate);
  }

  // 基本値 = 職業初期値 + SP振り（calculateAllJobStatsで統合済み）
  // breakdown.jobInitialには職業の基礎ステータス（レベル成長含む）が入っている
  // breakdown.jobSPは現在空（SPは既にjobInitialに含まれている）
  const baseStats = convertStatBlock(calcStats.breakdown?.jobInitial || {});

  // 装備ステータス（ルーンストーンを含む）
  const equipmentStats = convertStatBlock(calcStats.breakdown?.equipment || {});
  // ルーンストーンのステータスを装備ステータスに加算
  const runestoneStats = convertStatBlock(calcStats.breakdown?.runestone || {});
  for (const key of Object.keys(runestoneStats) as StatType[]) {
    equipmentStats[key] = (equipmentStats[key] || 0) + (runestoneStats[key] || 0);
  }

  // SPボーナス（SP割り振りによるステータス増加）
  const skillStats = convertStatBlock(calcStats.breakdown?.jobSP || {});

  // バフ（食べ物 + ユーザー手動補正 + リング効果）
  const buffStats = convertStatBlock({
    ...(calcStats.breakdown?.food || {}),
    ...(calcStats.breakdown?.userOption || {}),
    ...(calcStats.ring?.delta || {})  // リング効果の変化量を含める
  });

  // %補正による増分を計算
  // base（%補正前）と bonusPercent.total から計算
  const percentStats = initialStats();
  if (calcStats.bonusPercent?.total && calcStats.base) {
    for (const [key, percentValue] of Object.entries(calcStats.bonusPercent.total)) {
      const mappedKey = statMapping[key];
      if (mappedKey && percentValue) {
        // base値（%補正前）を取得
        const baseValue = (calcStats.base as any)[key] || 0;
        // %補正による増分 = base値 × (補正%) / 100
        const increase = Math.floor(baseValue * (percentValue as number) / 100);
        percentStats[mappedKey] = increase;
      }
    }
  }

  return {
    base: baseStats,
    fromEquipment: equipmentStats,
    fromSkills: skillStats,
    fromBuffs: buffStats,
    fromPercent: percentStats,
    total: totalStats
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
  fromPercent: initialStats(),
  total: initialStats(),
});

// タロットステータス計算ヘルパー関数
// 仕様: タロットステータス変数は、該当のステータスの全ての和とする
interface TarotCalculationResult {
  percentBonuses: Record<string, number>;  // ステータス%ボーナス (Talot.Bonus.<Stat>)
  tarotBonusStats: TarotBonusStats;        // 全タロットステータス
}

// 初期タロットボーナスステータス
const initialTarotBonusStats = (): TarotBonusStats => ({
  Power: 0,
  Magic: 0,
  HP: 0,
  Mind: 0,
  Agility: 0,
  Dex: 0,
  Defense: 0,
  CritDamage: 0,
  CritR: 0,
  CritD: 0,
  DamageC: 0,
  AttackP: 0,
  AllBuff: 0,
  'AttackBuff.Physical': 0,
  'AttackBuff.Magic': 0,
  'ElementBuff.None': 0,
  'ElementBuff.Light': 0,
  'ElementBuff.Dark': 0,
  'ElementBuff.Wind': 0,
  'ElementBuff.Fire': 0,
  'ElementBuff.Water': 0,
  'ElementBuff.Thunder': 0,
});

const calculateTarotStats = (
  selectedTarot: SelectedTarot | null,
  tarotCards: TarotCardDefinition[] | null | undefined,
  tarotCalcData: TarotCalcData | null | undefined
): TarotCalculationResult => {
  const result: TarotCalculationResult = {
    percentBonuses: {},
    tarotBonusStats: initialTarotBonusStats(),
  };

  if (!selectedTarot || !tarotCards || !tarotCalcData) {
    return result;
  }

  // カード情報を取得
  const card = tarotCards.find(c => c.id === selectedTarot.cardId);
  if (!card) {
    return result;
  }

  const constants = tarotCalcData.TarotConstants || { TierInterval: 5, MaxLevel: 20, MaxSubOptionLevel: 5 };

  // メインステータスの値を計算（5レベルごとに上昇）
  // Lv0-4: tier0 = 1 * increasePerTier（初期値）
  // Lv5-9: tier1 = 2 * increasePerTier
  // ...
  // Lv20: tier4 = 5 * increasePerTier
  const tier = Math.floor(selectedTarot.level / constants.TierInterval);

  // メインステータスを適切なカテゴリに追加
  for (const mainStat of card.mainStats) {
    const mainStatValue = mainStat.increasePerTier * (tier + 1); // tier + 1 でLv0でも初期値が入る
    addTarotStatValue(result, mainStat.type, mainStatValue);
  }

  // サブオプションの値を計算
  if (tarotCalcData.SubOptions) {
    for (const subOption of selectedTarot.subOptions) {
      // undefinedチェック
      if (!subOption || !subOption.optionId) continue;

      const optionDef = tarotCalcData.SubOptions[subOption.optionId];
      if (!optionDef) continue;

      const subValue = optionDef.ValuePerLevel * subOption.level;
      addTarotStatValue(result, optionDef.Type, subValue);
    }
  }

  return result;
};

// タロットステータス値を適切なカテゴリに追加
const addTarotStatValue = (
  result: TarotCalculationResult,
  statType: string,
  value: number
): void => {
  // ダメージバフ系
  if (statType.startsWith('ElementBuff.') || statType.startsWith('AttackBuff.') || statType === 'AllBuff') {
    const key = statType as keyof TarotBonusStats;
    if (key in result.tarotBonusStats) {
      (result.tarotBonusStats[key] as number) += value;
    }
  }
  // 武器関連固定値
  else if (['CritR', 'CritD', 'DamageC', 'AttackP'].includes(statType)) {
    const key = statType as keyof TarotBonusStats;
    (result.tarotBonusStats[key] as number) += value;
  }
  // ステータス%ボーナス (Talot.Bonus.<Stat>)
  else {
    // 内部キー形式に統一
    const typeMapping: Record<string, string> = {
      'Power': 'Power',
      'Magic': 'Magic',
      'HP': 'HP',
      'Mind': 'Mind',
      'Agility': 'Agility',
      'Dex': 'Dex',
      'Defense': 'Defense',
      'CritDamage': 'CritDamage',
    };
    const mappedType = typeMapping[statType] || statType;
    if (mappedType in result.tarotBonusStats) {
      (result.tarotBonusStats[mappedType as keyof TarotBonusStats] as number) += value;
      result.percentBonuses[mappedType] = (result.percentBonuses[mappedType] || 0) + value;
    }
  }
};

// 初期ビルド
const initialBuild = (): CharacterBuild => ({
  id: "default",
  name: "新規ビルド",
  job: null,
  level: 100,  // デフォルトを最大レベル（100）に設定
  equipment: {},
  spAllocation: {},
  buffs: [],
});

// UserOptionの型定義
export interface UserOption {
  // 手動ステータス調整値（固定値）
  manualStats: Partial<Record<StatType, number>>;
  // ユーザー指定%ボーナス（職業・紋章補正とは別）
  percentBonus: Partial<Record<StatType, number>>;
}

// RingOption の型定義
// リングタイプ: power=力リング, magic=魔力リング, speed=素早さリング, none=なし
export type RingType = 'power' | 'magic' | 'speed' | 'none';

export interface RingOption {
  enabled: boolean;
  ringType: RingType;  // 選択中のリング種類（レベルの概念なし）
}

// 攻撃属性の型定義
export type AttackElement = 'None' | 'Light' | 'Dark' | 'Wind' | 'Fire' | 'Water' | 'Thunder';

// 敵パラメータの型定義
export interface EnemyStats {
  defense: number;           // 防御力
  attackResistance: number;  // 攻撃耐性（物/魔）（%）
  elementResistance: number; // 属性耐性（%）
}

// プリセット型定義
export interface BuildPreset {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  build: CharacterBuild;
  userOption: UserOption;
  ringOption: RingOption;
  selectedFoodId: string | null;
  foodEnabled: boolean;
  weaponSkillEnabled: boolean;
  selectedEmblemName: string | null;
  selectedRunestoneNames: string[];
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

// タロットダメージバフの型定義
export interface TarotDamageBuffs {
  allDamageBuff: number;       // 全ダメージバフ (%)
  physicalDamageBuff: number;  // 物理ダメージバフ (%)
  magicDamageBuff: number;     // 魔法ダメージバフ (%)
  elementDamageBuff: number;   // 属性ダメージバフ (%)
  critDamage: number;          // 会心ダメージ (固定値)
  damageCorrection: number;    // ダメージ補正 (固定値)
  critRate: number;            // 会心率 (固定値)
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
  // 利用可能な紋章リスト
  availableEmblems: EmblemData[];
  // 利用可能なルーンストーンリスト
  availableRunestones: RunestoneData[];

  // 計算用データ
  gameData: {
    eqConst?: EqConstData;
    jobConst?: JobConstData;
    jobSPData?: Map<string, JobSPData[]>;
    userStatusCalc?: UserStatusCalcData;
    yaml?: {
      weaponSkillCalc?: WeaponSkillCalcData;
    };
  };

  // 追加の設定
  userOption: UserOption;
  ringOption: RingOption;
  selectedFood: Food | null;
  foodEnabled: boolean;
  weaponSkillEnabled: boolean;

  // スキル計算用の選択状態
  selectedSkillId: string | null;
  skillLevel: number;
  customHits: number | undefined;

  // 敵パラメータ
  enemyStats: EnemyStats;

  // 攻撃属性（ダメージ計算用）
  attackElement: AttackElement;

  // 紋章・ルーンストーン選択
  selectedEmblem: EmblemData | null;
  selectedRunestones: RunestoneData[];

  // タロット関連
  tarotCards: TarotCardDefinition[] | null;
  tarotCalcData: TarotCalcData | null;
  selectedTarot: SelectedTarot | null;
  tarotBonusStats: TarotBonusStats;

  // デバッグ紋章
  debugEmblem: DebugEmblemStats | null;
  isDebugEmblem: boolean;

  // デバッグタロット
  debugTarot: DebugTarotStats | null;
  isDebugTarot: boolean;

  // プリセット
  presets: BuildPreset[];

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
  setEnemyStats: (stats: EnemyStats) => void;
  setAttackElement: (element: AttackElement) => void;

  // スキル選択アクション
  setSelectedSkillId: (skillId: string | null) => void;
  setSkillLevel: (level: number) => void;
  setCustomHits: (hits: number | undefined) => void;

  // データ読み込み
  setAvailableJobs: (jobs: Job[]) => void;
  setAvailableEquipment: (equipment: Equipment[]) => void;
  setAvailableBuffs: (buffs: Buff[]) => void;
  setAvailableFoods: (foods: Food[]) => void;
  setAvailableEmblems: (emblems: EmblemData[]) => void;
  setAvailableRunestones: (runestones: RunestoneData[]) => void;

  // 紋章・ルーンストーン設定
  setEmblem: (emblem: EmblemData | null) => void;
  setRunestones: (runestones: RunestoneData[]) => void;

  // タロット設定
  setTarotCards: (data: TarotCardDefinition[]) => void;
  setTarotCalcData: (data: TarotCalcData) => void;
  setSelectedTarot: (tarot: SelectedTarot | null) => void;

  // デバッグ紋章・タロット設定
  setDebugEmblem: (stats: DebugEmblemStats | null) => void;
  setIsDebugEmblem: (isDebug: boolean) => void;
  setDebugTarot: (stats: DebugTarotStats | null) => void;
  setIsDebugTarot: (isDebug: boolean) => void;

  // ゲームデータ設定
  setGameData: (data: {
    eqConst?: EqConstData;
    jobConst?: JobConstData;
    jobSPData?: Map<string, JobSPData[]>;
    userStatusCalc?: UserStatusCalcData;
    yaml?: {
      weaponSkillCalc?: WeaponSkillCalcData;
    };
  }) => void;

  recalculateStats: () => void;

  // プリセットアクション
  savePreset: (name: string) => void;
  loadPreset: (id: string) => void;
  deletePreset: (id: string) => void;
  updatePreset: (id: string, name?: string) => void;
  loadPresetsFromStorage: () => void;
}

export const useBuildStore = create<BuildState>((set, get) => ({
  currentBuild: initialBuild(),
  calculatedStats: initialCalculatedStats(),
  weaponStats: null,
  availableJobs: [],
  availableEquipment: [],
  availableBuffs: [],
  availableFoods: [],
  availableEmblems: [],
  availableRunestones: [],
  gameData: {},
  userOption: {
    manualStats: {},
    percentBonus: {},
  },
  ringOption: {
    enabled: false,
    ringType: 'none',
  },
  selectedFood: null,
  foodEnabled: false,
  weaponSkillEnabled: false,
  selectedSkillId: null,
  skillLevel: 1,
  customHits: undefined,
  enemyStats: {
    defense: 0,
    attackResistance: 0,
    elementResistance: 0,
  },
  attackElement: 'None',
  selectedEmblem: null,
  selectedRunestones: [],
  tarotCards: null,
  tarotCalcData: null,
  selectedTarot: null,
  tarotBonusStats: initialTarotBonusStats(),
  debugEmblem: null,
  isDebugEmblem: false,
  debugTarot: null,
  isDebugTarot: false,
  presets: [],

  setJob: (job) => {
    const state = get();
    // 新しい職業のMaxLevelを取得
    let maxLevel = 100;
    if (job && state.gameData?.jobConst?.JobDefinition) {
      const yamlJobName = convertJobNameToYAML(job.id);
      maxLevel = state.gameData.jobConst.JobDefinition[yamlJobName]?.MaxLevel || 100;
    }

    // 職業選択時はデフォルトでその職業の最大レベルに設定
    const newLevel = maxLevel;

    set((state) => ({
      currentBuild: {
        ...state.currentBuild,
        job,
        level: newLevel,
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

  // スキル選択アクション
  setSelectedSkillId: (skillId) => {
    set({ selectedSkillId: skillId });
  },

  setSkillLevel: (level) => {
    set({ skillLevel: level });
  },

  setCustomHits: (hits) => {
    set({ customHits: hits });
  },

  setEnemyStats: (stats) => {
    set({ enemyStats: stats });
  },

  setAttackElement: (element) => {
    set({ attackElement: element });
  },

  setAvailableJobs: (jobs) => set({ availableJobs: jobs }),
  setAvailableEquipment: (equipment) => set({ availableEquipment: equipment }),
  setAvailableBuffs: (buffs) => set({ availableBuffs: buffs }),
  setAvailableFoods: (foods) => set({ availableFoods: foods }),
  setAvailableEmblems: (emblems) => set({ availableEmblems: emblems }),
  setAvailableRunestones: (runestones) => set({ availableRunestones: runestones }),

  setEmblem: (emblem) => {
    set({ selectedEmblem: emblem });
    get().recalculateStats();
  },

  setRunestones: (runestones) => {
    set({ selectedRunestones: runestones });
    get().recalculateStats();
  },

  setTarotCards: (data) => {
    set({ tarotCards: data });
    get().recalculateStats();
  },

  setTarotCalcData: (data) => {
    set({ tarotCalcData: data });
    get().recalculateStats();
  },

  setSelectedTarot: (tarot) => {
    set({ selectedTarot: tarot });
    get().recalculateStats();
  },

  setGameData: (data) => set({ gameData: data }),

  setDebugEmblem: (stats) => {
    set({ debugEmblem: stats });
    get().recalculateStats();
  },
  setIsDebugEmblem: (isDebug) => {
    set({ isDebugEmblem: isDebug });
    if (!isDebug) set({ debugEmblem: null });
    get().recalculateStats();
  },
  setDebugTarot: (stats) => {
    set({ debugTarot: stats });
    get().recalculateStats();
  },
  setIsDebugTarot: (isDebug) => {
    set({ isDebugTarot: isDebug });
    if (!isDebug) set({ debugTarot: null });
    get().recalculateStats();
  },

  recalculateStats: () => {
    const state = get();
    const { currentBuild, userOption, ringOption, selectedFood, foodEnabled, gameData, weaponSkillEnabled, selectedEmblem, selectedRunestones, selectedTarot, tarotCards, tarotCalcData } = state;

    // 必要なゲームデータがない場合は計算をスキップ
    if (!gameData.eqConst || !gameData.jobConst) {
      console.warn('計算に必要なゲームデータが不足しています');
      return;
    }

    // 職業が選択されていない場合は初期値を設定
    if (!currentBuild.job) {
      set({
        calculatedStats: initialCalculatedStats(),
        weaponStats: null,
        tarotBonusStats: initialTarotBonusStats(),
      });
      return;
    }

    try {
      // 0. 武器ステータスを計算
      let calculatedWeaponStats: WeaponStats | null = null;
      let weaponCritRateValue = 0;

      const weaponEquipment = currentBuild.equipment.weapon;
      // デバッグ武器チェック
      if (weaponEquipment?.isDebug && weaponEquipment.debugWeaponStats) {
        calculatedWeaponStats = {
          attackPower: weaponEquipment.debugWeaponStats.attackPower,
          critRate: weaponEquipment.debugWeaponStats.critRate,
          critDamage: weaponEquipment.debugWeaponStats.critDamage,
          damageCorrection: weaponEquipment.debugWeaponStats.damageCorrection,
          coolTime: weaponEquipment.debugWeaponStats.coolTime,
          weaponType: 'debug'
        };
        weaponCritRateValue = calculatedWeaponStats.critRate;
      } else if (weaponEquipment && weaponEquipment.sourceData?.type === 'weapon') {
        const weaponData = weaponEquipment.sourceData.data;
        const rank = (weaponEquipment.rank || 'SSS') as import('@/lib/calc/equipmentCalculator').WeaponRank;
        const reinforcement = weaponEquipment.enhancementLevel || 0;
        // 武器の叩き回数（パラメータ別）
        const weaponSmithingCounts = weaponEquipment.smithingCounts || {};
        // 日本語キーから英語キーに変換
        const hammerCounts: import('@/lib/calc/equipmentCalculator').WeaponSmithingCounts = {
          attackPower: (weaponSmithingCounts as Record<string, number>)['攻撃力'] || 0,
          critRate: (weaponSmithingCounts as Record<string, number>)['会心率'] || 0,
          critDamage: (weaponSmithingCounts as Record<string, number>)['会心ダメージ'] || 0,
        };
        const alchemyEnabled = weaponEquipment.alchemyEnabled || false;

        // 武器ステータスを計算
        const weaponStatsResult = calculateWeaponStats(
          weaponData,
          rank,
          reinforcement,
          hammerCounts,
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

      // 装備のステータス効果を直接StatBlockに変換
      // 内部計算では文字列キー(Power, Defenseなど)を使用
      const equipmentTotal: Record<string, number> = {};

      // 装備タイプに応じた計算を実行
      for (const [slot, equipment] of Object.entries(currentBuild.equipment)) {
        if (!equipment) continue;

        // デバッグ装備チェック（防具/アクセサリー用）
        if (equipment.isDebug) {
          if (equipment.debugArmorStats) {
            // 防具デバッグ
            equipmentTotal['Power'] = (equipmentTotal['Power'] || 0) + equipment.debugArmorStats.power;
            equipmentTotal['Magic'] = (equipmentTotal['Magic'] || 0) + equipment.debugArmorStats.magic;
            equipmentTotal['HP'] = (equipmentTotal['HP'] || 0) + equipment.debugArmorStats.hp;
            equipmentTotal['Mind'] = (equipmentTotal['Mind'] || 0) + equipment.debugArmorStats.mind;
            equipmentTotal['Agility'] = (equipmentTotal['Agility'] || 0) + equipment.debugArmorStats.agility;
            equipmentTotal['Dex'] = (equipmentTotal['Dex'] || 0) + equipment.debugArmorStats.dex;
            equipmentTotal['CritDamage'] = (equipmentTotal['CritDamage'] || 0) + equipment.debugArmorStats.critDamage;
            equipmentTotal['Defense'] = (equipmentTotal['Defense'] || 0) + equipment.debugArmorStats.defense;
          } else if (equipment.debugAccessoryStats) {
            // アクセサリーデバッグ
            equipmentTotal['Power'] = (equipmentTotal['Power'] || 0) + equipment.debugAccessoryStats.power;
            equipmentTotal['Magic'] = (equipmentTotal['Magic'] || 0) + equipment.debugAccessoryStats.magic;
            equipmentTotal['HP'] = (equipmentTotal['HP'] || 0) + equipment.debugAccessoryStats.hp;
            equipmentTotal['Mind'] = (equipmentTotal['Mind'] || 0) + equipment.debugAccessoryStats.mind;
            equipmentTotal['Agility'] = (equipmentTotal['Agility'] || 0) + equipment.debugAccessoryStats.agility;
            equipmentTotal['CritDamage'] = (equipmentTotal['CritDamage'] || 0) + equipment.debugAccessoryStats.critDamage;
          }
          continue; // 通常計算をスキップ
        }

        if (equipment.sourceData) {
          const slotType = slot as EquipSlot;
          const rank = (equipment.rank || 'SSS') as EquipmentRank;
          const reinforcementCount = equipment.enhancementLevel || 0;

          // 計算機出力キーから統一内部フォーマットへのマッピング関数
          // calculateArmorStats: lowercase (power, magic, hp, mind, speed, dexterity, critDamage, defense)
          // calculateAccessoryStats: PascalCase (HP, Power, Magic, Mind, CritDamage, Speed)
          // 統一フォーマット: HP, Power, Magic, Defense, Mind, Dex, Agility, CritRate
          const mapCalcOutputKey = (stat: string): string => {
            const mapping: Record<string, string> = {
              // 防具出力キー（小文字）
              'power': 'Power',
              'magic': 'Magic',
              'hp': 'HP',
              'mind': 'Mind',
              'speed': 'Agility',
              'dexterity': 'Dex',
              'critDamage': 'CritDamage',  // 撃力 → CritDamage (HIT)
              'defense': 'Defense',
              // アクセサリー出力キー（PascalCase - すでに正しい形式のものもある）
              'HP': 'HP',
              'Power': 'Power',
              'Magic': 'Magic',
              'Mind': 'Mind',
              'CritDamage': 'CritDamage',  // 撃力 → CritDamage (HIT)
              'Speed': 'Agility',
              // UI形式からの変換（フォールバック用）
              'ATK': 'Power',
              'MATK': 'Magic',
              'DEF': 'Defense',
              'MDEF': 'Mind',
              'DEX': 'Dex',
              'AGI': 'Agility',
              'HIT': 'CritDamage',  // 撃力
              // 注: 'CRI'（会心率）は装備ステータスとしては使用しない
              // 会心率は別途 weaponCritRate + DEX * 0.3 で計算される
            };
            return mapping[stat] || stat;
          };

          // 武器は既に個別計算済み（calculatedWeaponStats）
          if (slotType === 'weapon') {
            // 武器の攻撃力（attackPower）はキャラクターの「力」ステータスには加算しない
            // 武器攻撃力は独立したステータスで、weaponStatsとして別途管理される
            // 武器会心率（critRate）はweaponCritRateとしてcalculateStatusに渡されるため、
            // equipmentTotalには追加しない（会心率 = 武器会心率 + 器用さ * 0.3 で計算される）
            // 武器の会心ダメージ（critDamage）もキャラクターの「撃力」には加算しない
            // 武器会心ダメージは独立したステータスで、weaponStatsとして別途管理される
            // （ダメージ計算時に参照される）
          }
          // 防具（頭、胴、脚）
          else if (['head', 'body', 'leg'].includes(slotType) && equipment.sourceData.type === 'armor') {
            try {
              const armorData = equipment.sourceData.data as ArmorData;
              // パラメータ別叩き回数を取得
              const smithingCounts = equipment.smithingCounts || {};

              // ランク値をEqConst.yamlから取得
              const eqConstArmor = gameData.eqConst?.Armor;
              const rankValue = eqConstArmor?.Rank?.[rank as keyof typeof eqConstArmor.Rank] || 0;
              const availableLv = armorData.使用可能Lv || 1;

              // 叩き・強化係数をEqConst.yamlから取得
              const forgeDefence = eqConstArmor?.Forge?.Defence ?? 1;
              const forgeOther = eqConstArmor?.Forge?.Other ?? 2;
              const reinforceDefence = eqConstArmor?.Reinforcement?.Defence ?? 2;
              const reinforceOther = eqConstArmor?.Reinforcement?.Other ?? 2;

              // ステータス定義（YAMLから取得した係数を使用）
              const armorStatDefs = [
                { csvKey: '守備力（初期値）', outputKey: 'Defense', smithingParam: '守備力', forgeMultiplier: forgeDefence, reinforceMultiplier: reinforceDefence },
                { csvKey: '体力（初期値）', outputKey: 'HP', smithingParam: '体力', forgeMultiplier: forgeOther, reinforceMultiplier: reinforceOther },
                { csvKey: '力（初期値）', outputKey: 'Power', smithingParam: '力', forgeMultiplier: forgeOther, reinforceMultiplier: reinforceOther },
                { csvKey: '魔力（初期値）', outputKey: 'Magic', smithingParam: '魔力', forgeMultiplier: forgeOther, reinforceMultiplier: reinforceOther },
                { csvKey: '精神（初期値）', outputKey: 'Mind', smithingParam: '精神', forgeMultiplier: forgeOther, reinforceMultiplier: reinforceOther },
                { csvKey: '素早さ（初期値）', outputKey: 'Agility', smithingParam: '素早さ', forgeMultiplier: forgeOther, reinforceMultiplier: reinforceOther },
                { csvKey: '器用（初期値）', outputKey: 'Dex', smithingParam: '器用', forgeMultiplier: forgeOther, reinforceMultiplier: reinforceOther },
                { csvKey: '撃力（初期値）', outputKey: 'CritDamage', smithingParam: '撃力', forgeMultiplier: forgeOther, reinforceMultiplier: reinforceOther },
              ];

              // 各ステータスを個別に計算（フロントエンドと同じ計算式）
              for (const statDef of armorStatDefs) {
                const baseValue = (armorData as any)[statDef.csvKey] || 0;
                if (baseValue === 0) continue; // 基礎値0のステータスはスキップ

                // パラメータ別叩き回数を取得
                const paramSmithingCount = (smithingCounts as any)[statDef.smithingParam] || 0;
                const smithingBonus = paramSmithingCount * statDef.forgeMultiplier;

                // 強化ボーナス
                const enhanceBonus = reinforcementCount * statDef.reinforceMultiplier;

                // ランク計算: round(baseWithTataki * (1 + baseWithTataki^0.2 * (rankValue / availableLv)))
                const baseWithTataki = baseValue + smithingBonus;
                const calculatedValue = Math.round(
                  baseWithTataki * (1 + Math.pow(baseWithTataki, 0.2) * (rankValue / availableLv))
                );

                // 最終値 = ランク計算後の値 + 強化ボーナス
                const finalValue = calculatedValue + enhanceBonus;

                equipmentTotal[statDef.outputKey] = (equipmentTotal[statDef.outputKey] || 0) + finalValue;
              }

              // EXステータスを加算（防具は2つまで）
              const exStats = equipment.exStats;
              if (exStats) {
                const exStatMapping: Record<string, string> = {
                  'power': 'Power',
                  'magic': 'Magic',
                  'hp': 'HP',
                  'mind': 'Mind',
                  'speed': 'Agility',
                  'dex': 'Dex',
                  'critDamage': 'CritDamage',
                  'defense': 'Defense',
                };
                // EX係数をEqConst.yamlから取得
                const eqConstEX = gameData.eqConst?.Equipment_EX?.Rank;
                const calculateExValue = (exType: string): number => {
                  const level = armorData.使用可能Lv || 1;
                  let coeff = 0;
                  if (exType === 'dex' && eqConstEX?.CritR) {
                    coeff = eqConstEX.CritR[rank as keyof typeof eqConstEX.CritR] || 0;
                  } else if ((exType === 'critDamage' || exType === 'speed') && eqConstEX?.Speed_CritD) {
                    coeff = eqConstEX.Speed_CritD[rank as keyof typeof eqConstEX.Speed_CritD] || 0;
                  } else if (eqConstEX?.Other) {
                    coeff = eqConstEX.Other[rank as keyof typeof eqConstEX.Other] || 0;
                  }
                  return Math.round(level * coeff + 1);
                };
                if (exStats.ex1) {
                  const mappedKey = exStatMapping[exStats.ex1];
                  if (mappedKey) {
                    equipmentTotal[mappedKey] = (equipmentTotal[mappedKey] || 0) + calculateExValue(exStats.ex1);
                  }
                }
                if (exStats.ex2) {
                  const mappedKey = exStatMapping[exStats.ex2];
                  if (mappedKey) {
                    equipmentTotal[mappedKey] = (equipmentTotal[mappedKey] || 0) + calculateExValue(exStats.ex2);
                  }
                }
              }
            } catch (error) {
              console.warn(`防具計算エラー (${slotType}):`, error);
              // フォールバック: baseStatsを使用
              for (const effect of equipment.baseStats) {
                if (!effect.isPercent) {
                  const statKey = mapCalcOutputKey(effect.stat);
                  equipmentTotal[statKey] = (equipmentTotal[statKey] || 0) + effect.value;
                }
              }
            }
          }
          // アクセサリー
          else if (['accessory1', 'accessory2'].includes(slotType) && equipment.sourceData.type === 'accessory') {
            try {
              const accessoryData = equipment.sourceData.data as AccessoryData;

              const accessoryStats = calculateAccessoryStats(
                accessoryData,
                rank,
                gameData.eqConst as EqConstData
              );

              // 計算済みステータスをequipmentTotalに追加
              if (accessoryStats.final) {
                for (const [statKey, value] of Object.entries(accessoryStats.final)) {
                  if (value && typeof value === 'number') {
                    const mappedKey = mapCalcOutputKey(statKey);
                    equipmentTotal[mappedKey] = (equipmentTotal[mappedKey] || 0) + value;
                  }
                }
              }

              // EXステータスを加算（アクセサリーは2つまで）
              const exStats = equipment.exStats;
              if (exStats) {
                const exStatMapping: Record<string, string> = {
                  'power': 'Power',
                  'magic': 'Magic',
                  'hp': 'HP',
                  'mind': 'Mind',
                  'speed': 'Agility',
                  'dex': 'Dex',
                  'critDamage': 'CritDamage',
                  // アクセサリーには守備力EXはない
                };
                // EX係数をEqConst.yamlから取得
                const eqConstEX = gameData.eqConst?.Equipment_EX?.Rank;
                const calculateExValue = (exType: string): number => {
                  const level = accessoryData.使用可能Lv || 1;
                  let coeff = 0;
                  if (exType === 'dex' && eqConstEX?.CritR) {
                    coeff = eqConstEX.CritR[rank as keyof typeof eqConstEX.CritR] || 0;
                  } else if ((exType === 'critDamage' || exType === 'speed') && eqConstEX?.Speed_CritD) {
                    coeff = eqConstEX.Speed_CritD[rank as keyof typeof eqConstEX.Speed_CritD] || 0;
                  } else if (eqConstEX?.Other) {
                    coeff = eqConstEX.Other[rank as keyof typeof eqConstEX.Other] || 0;
                  }
                  return Math.round(level * coeff + 1);
                };
                // EX1を加算
                if (exStats.ex1) {
                  const mappedKey = exStatMapping[exStats.ex1];
                  if (mappedKey) {
                    equipmentTotal[mappedKey] = (equipmentTotal[mappedKey] || 0) + calculateExValue(exStats.ex1);
                  }
                }
                // EX2を加算
                if (exStats.ex2) {
                  const mappedKey = exStatMapping[exStats.ex2];
                  if (mappedKey) {
                    equipmentTotal[mappedKey] = (equipmentTotal[mappedKey] || 0) + calculateExValue(exStats.ex2);
                  }
                }
              }
            } catch (error) {
              console.warn(`アクセサリー計算エラー (${slotType}):`, error);
              // フォールバック: baseStatsを使用
              for (const effect of equipment.baseStats) {
                if (!effect.isPercent) {
                  const statKey = mapCalcOutputKey(effect.stat);
                  equipmentTotal[statKey] = (equipmentTotal[statKey] || 0) + effect.value;
                }
              }
            }
          }
          // その他（フォールバック）
          else {
            for (const effect of equipment.baseStats) {
              if (!effect.isPercent) {
                const statKey = mapCalcOutputKey(effect.stat);
                equipmentTotal[statKey] = (equipmentTotal[statKey] || 0) + effect.value;
              }
            }
          }
        }
      }

      // 2. 職業ステータスを計算（新計算システム使用）
      // MapからJobに対応するJobSPData[]を取得
      const currentJobSPData = gameData.jobSPData?.get(currentBuild.job.id);

      // 日本語の職業名からYAML形式の職業名へ変換（共通マッピングを使用）
      const yamlJobName = convertJobNameToYAML(currentBuild.job.name || currentBuild.job.id);

      // 基礎職業ステータスを計算（SPボーナスなし）
      const jobStats = calculateAllJobStats(
        yamlJobName,
        currentBuild.level,
        [], // SPAllocation配列は空にして基礎値のみ取得
        gameData.jobConst,
        currentJobSPData
      );

      // SP割り振りからのステータスボーナスを計算
      let spBonusStats: StatBlock = {};
      // 職業%補正を取得（CSVから）
      let jobBonusPercent: StatBlock = {};

      if (currentJobSPData && currentJobSPData.length > 0) {
        // SPツリーデータを変換して職業補正を取得
        const spTree = convertToSPTree(currentJobSPData);

        // 職業補正(%)を取得（CSVの値は整数パーセント値）
        if (spTree.jobCorrection) {
          const correction = spTree.jobCorrection;
          // CSVの値をそのまま使用（4 → 4%）
          if (correction.HP !== undefined) jobBonusPercent['HP'] = correction.HP;
          if (correction.Power !== undefined) jobBonusPercent['Power'] = correction.Power;
          if (correction.Magic !== undefined) jobBonusPercent['Magic'] = correction.Magic;
          if (correction.Mind !== undefined) jobBonusPercent['Mind'] = correction.Mind;
          if (correction.Agility !== undefined) jobBonusPercent['Agility'] = correction.Agility;
          if (correction.Dex !== undefined) jobBonusPercent['Dex'] = correction.Dex;
          if (correction.CritDamage !== undefined) jobBonusPercent['CritDamage'] = correction.CritDamage;
          if (correction.Defense !== undefined) jobBonusPercent['Defense'] = correction.Defense;
        }

        if (currentBuild.spAllocation) {
          const spAllocation = {
            A: currentBuild.spAllocation.A || 0,
            B: currentBuild.spAllocation.B || 0,
            C: currentBuild.spAllocation.C || 0,
          };

          // 各ブランチのボーナスを計算
          const branchBonus = calculateBranchBonus(spAllocation, currentJobSPData);

          // 日本語キーを内部キーにマッピングして合算
          const jpToInternal: Record<string, string> = {
            '体力': 'HP',
            '力': 'Power',
            '魔力': 'Magic',
            '精神': 'Mind',
            '素早さ': 'Agility',
            '器用さ': 'Dex',
            '撃力': 'CritDamage',
            '守備力': 'Defense',
          };

          // 全ブランチのボーナスを合算
          (['A', 'B', 'C'] as const).forEach(branch => {
            const bonus = branchBonus[branch];
            Object.entries(bonus).forEach(([jpKey, value]) => {
              const internalKey = jpToInternal[jpKey];
              if (internalKey && value) {
                spBonusStats[internalKey as keyof StatBlock] =
                  ((spBonusStats[internalKey as keyof StatBlock] as number) || 0) + value;
              }
            });
          });
        }
      }

      // 3. タロットステータスを計算
      let tarotStats: TarotCalculationResult;
      if (state.isDebugTarot && state.debugTarot) {
        tarotStats = {
          percentBonuses: {
            Power: state.debugTarot.powerPercent,
            Magic: state.debugTarot.magicPercent,
            HP: state.debugTarot.hpPercent,
            Mind: state.debugTarot.mindPercent,
            Agility: state.debugTarot.agilityPercent,
            Dex: state.debugTarot.dexPercent,
            Defense: state.debugTarot.defensePercent,
            CritDamage: state.debugTarot.critDamagePercent,
          },
          tarotBonusStats: {
            Power: state.debugTarot.powerPercent,
            Magic: state.debugTarot.magicPercent,
            HP: state.debugTarot.hpPercent,
            Mind: state.debugTarot.mindPercent,
            Agility: state.debugTarot.agilityPercent,
            Dex: state.debugTarot.dexPercent,
            Defense: state.debugTarot.defensePercent,
            CritDamage: state.debugTarot.critDamagePercent,
            CritR: state.debugTarot.critRate,
            CritD: state.debugTarot.critDamage,
            DamageC: state.debugTarot.damageCorrection,
            AttackP: state.debugTarot.attackPower,
            AllBuff: state.debugTarot.allDamageBuff,
            'AttackBuff.Physical': state.debugTarot.physicalDamageBuff,
            'AttackBuff.Magic': state.debugTarot.magicDamageBuff,
            'ElementBuff.None': state.debugTarot.noneDamageBuff,
            'ElementBuff.Light': state.debugTarot.lightDamageBuff,
            'ElementBuff.Dark': state.debugTarot.darkDamageBuff,
            'ElementBuff.Wind': state.debugTarot.windDamageBuff,
            'ElementBuff.Fire': state.debugTarot.fireDamageBuff,
            'ElementBuff.Water': state.debugTarot.waterDamageBuff,
            'ElementBuff.Thunder': state.debugTarot.thunderDamageBuff,
          }
        };
      } else {
        tarotStats = calculateTarotStats(selectedTarot, tarotCards, tarotCalcData);
      }

      // 4. 最終ステータスを計算（新計算システム使用）
      const statusInput: StatusCalcInput = {
        equipmentTotal: equipmentTotal,
        jobStats: {
          initial: jobStats,
          sp: spBonusStats,  // SP割り振りによるボーナス
          bonusPercent: jobBonusPercent  // 職業のパーセントボーナス（CSVから取得）
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
              case 'HIT': statKey = 'CritDamage'; break;  // 撃力はCritDamageにマッピング
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
            case 'HIT': statKey = 'CritDamage'; break;  // 撃力
            default: statKey = key;
          }
          if (value) {
            acc[statKey as keyof StatBlock] = value;
          }
          return acc;
        }, {} as StatBlock),
        // リング収束計算用データ
        // YAMLの式: repeat( 40 + round(SumEquipment.<Stat>) * 0.1, until_converged )
        // 装備ステータスの10%を加算し続けて収束させる
        ring: ringOption.enabled && ringOption.ringType !== 'none' ? {
          enabled: true,
          ringType: ringOption.ringType,
          // 装備合計ステータスを渡す（収束計算の基準）
          equipmentTotal: equipmentTotal
        } : undefined,
        // 武器会心率 + タロットの会心率ボーナス
        weaponCritRate: weaponCritRateValue + (tarotStats.tarotBonusStats.CritR || 0),
        // ユーザー指定%ボーナス（職業・紋章補正とは別）+ タロット%ボーナス
        userPercentBonus: (() => {
          // ユーザー手動入力の%ボーナス
          const userBonus = Object.entries(userOption.percentBonus || {}).reduce((acc, [key, value]) => {
            let statKey = '';
            switch(key) {
              case 'HP': statKey = 'HP'; break;
              case 'ATK': statKey = 'Power'; break;
              case 'MATK': statKey = 'Magic'; break;
              case 'DEF': statKey = 'Defense'; break;
              case 'MDEF': statKey = 'Mind'; break;
              case 'DEX': statKey = 'Dex'; break;
              case 'AGI': statKey = 'Agility'; break;
              case 'HIT': statKey = 'CritDamage'; break;
              default: statKey = key;
            }
            if (value) {
              acc[statKey as keyof StatBlock] = value;
            }
            return acc;
          }, {} as StatBlock);

          // タロットの%ボーナスを加算
          for (const [statKey, value] of Object.entries(tarotStats.percentBonuses)) {
            userBonus[statKey as keyof StatBlock] = (userBonus[statKey as keyof StatBlock] || 0) + value;
          }

          return userBonus;
        })(),
        recursiveEnabled: false,
        // 紋章ボーナスを計算（%補正として適用）
        // 内部キー形式（Power, Magic, HP, Mind, Agility, Dex, CritDamage, Defense）を使用
        emblemBonusPercent: state.isDebugEmblem && state.debugEmblem ? {
          Power: state.debugEmblem.powerPercent,
          Magic: state.debugEmblem.magicPercent,
          HP: state.debugEmblem.hpPercent,
          Mind: state.debugEmblem.mindPercent,
          Agility: state.debugEmblem.agilityPercent,
          Dex: state.debugEmblem.dexPercent,
          CritDamage: state.debugEmblem.critDamagePercent,
          Defense: state.debugEmblem.defensePercent,
        } : selectedEmblem ? {
          Power: selectedEmblem['力（%不要）'] || 0,
          Magic: selectedEmblem['魔力（%不要）'] || 0,
          HP: selectedEmblem['体力（%不要）'] || 0,
          Mind: selectedEmblem['精神（%不要）'] || 0,
          Agility: selectedEmblem['素早さ（%不要）'] || 0,
          Dex: selectedEmblem['器用（%不要）'] || 0,
          CritDamage: selectedEmblem['撃力（%不要）'] || 0,  // 撃力はCritDamage
          Defense: selectedEmblem['守備力（%不要）'] || 0,
        } : {},
        // ルーンストーンボーナスを計算（固定値加算）
        // 内部キー形式（Power, Magic, HP, Mind, Agility, Dex, CritDamage, Defense）を使用
        runestoneBonus: selectedRunestones.reduce((acc, rune) => {
          if (rune.力) acc['Power'] = (acc['Power'] || 0) + rune.力;
          if (rune.魔力) acc['Magic'] = (acc['Magic'] || 0) + rune.魔力;
          if (rune.体力) acc['HP'] = (acc['HP'] || 0) + rune.体力;
          if (rune.精神) acc['Mind'] = (acc['Mind'] || 0) + rune.精神;
          if (rune.素早さ) acc['Agility'] = (acc['Agility'] || 0) + rune.素早さ;
          if (rune.器用) acc['Dex'] = (acc['Dex'] || 0) + rune.器用;
          if (rune.撃力) acc['CritDamage'] = (acc['CritDamage'] || 0) + rune.撃力;  // 撃力はCritDamage
          if (rune.守備力) acc['Defense'] = (acc['Defense'] || 0) + rune.守備力;
          return acc;
        }, {} as Record<string, number>),
      };

      const result = calculateStatus(statusInput);

      if (result.success && result.data) {
        // CalcSystemStats型からCalculatedStats型への変換
        const convertedStats = convertToUIStats(result.data);
        set({
          calculatedStats: convertedStats,
          weaponStats: calculatedWeaponStats,
          tarotBonusStats: tarotStats.tarotBonusStats,
        });
      } else {
        console.error('ステータス計算エラー: result.success is false');
        set({
          calculatedStats: initialCalculatedStats(),
          weaponStats: null,
          tarotBonusStats: initialTarotBonusStats(),
        });
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
      set({
        calculatedStats: initialCalculatedStats(),
        weaponStats: null,
        tarotBonusStats: initialTarotBonusStats(),
      });
    }
  },

  // プリセット機能
  savePreset: (name: string) => {
    const state = get();
    const now = Date.now();
    const id = `preset_${now}_${Math.random().toString(36).substr(2, 9)}`;

    const newPreset: BuildPreset = {
      id,
      name,
      createdAt: now,
      updatedAt: now,
      build: JSON.parse(JSON.stringify(state.currentBuild)), // Deep copy
      userOption: JSON.parse(JSON.stringify(state.userOption)),
      ringOption: JSON.parse(JSON.stringify(state.ringOption)),
      selectedFoodId: state.selectedFood?.id || null,
      foodEnabled: state.foodEnabled,
      weaponSkillEnabled: state.weaponSkillEnabled,
      selectedEmblemName: state.selectedEmblem?.name || null,
      selectedRunestoneNames: state.selectedRunestones.map(r => r.name),
    };

    const updatedPresets = [...state.presets, newPreset];
    set({ presets: updatedPresets });

    // localStorageに保存
    try {
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(updatedPresets));
    } catch (e) {
      console.error('プリセットの保存に失敗しました:', e);
    }
  },

  loadPreset: (id: string) => {
    const state = get();
    const preset = state.presets.find(p => p.id === id);
    if (!preset) {
      console.warn(`プリセット(${id})が見つかりません`);
      return;
    }

    // ビルドを復元
    set({
      currentBuild: JSON.parse(JSON.stringify(preset.build)),
      userOption: JSON.parse(JSON.stringify(preset.userOption)),
      ringOption: JSON.parse(JSON.stringify(preset.ringOption)),
      foodEnabled: preset.foodEnabled,
      weaponSkillEnabled: preset.weaponSkillEnabled,
    });

    // 食べ物を復元
    if (preset.selectedFoodId) {
      const food = state.availableFoods.find(f => f.id === preset.selectedFoodId);
      if (food) {
        set({ selectedFood: food });
      }
    } else {
      set({ selectedFood: null });
    }

    // 紋章を復元
    if (preset.selectedEmblemName) {
      const emblem = state.availableEmblems.find(e => e.name === preset.selectedEmblemName);
      if (emblem) {
        set({ selectedEmblem: emblem });
      }
    } else {
      set({ selectedEmblem: null });
    }

    // ルーンストーンを復元
    const runestones = preset.selectedRunestoneNames
      .map(name => state.availableRunestones.find(r => r.name === name))
      .filter((r): r is RunestoneData => r !== undefined);
    set({ selectedRunestones: runestones });

    // ステータス再計算
    get().recalculateStats();
  },

  deletePreset: (id: string) => {
    const state = get();
    const updatedPresets = state.presets.filter(p => p.id !== id);
    set({ presets: updatedPresets });

    // localStorageを更新
    try {
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(updatedPresets));
    } catch (e) {
      console.error('プリセットの削除に失敗しました:', e);
    }
  },

  updatePreset: (id: string, name?: string) => {
    const state = get();
    const presetIndex = state.presets.findIndex(p => p.id === id);
    if (presetIndex === -1) {
      console.warn(`プリセット(${id})が見つかりません`);
      return;
    }

    const now = Date.now();
    const updatedPreset: BuildPreset = {
      ...state.presets[presetIndex],
      name: name || state.presets[presetIndex].name,
      updatedAt: now,
      build: JSON.parse(JSON.stringify(state.currentBuild)),
      userOption: JSON.parse(JSON.stringify(state.userOption)),
      ringOption: JSON.parse(JSON.stringify(state.ringOption)),
      selectedFoodId: state.selectedFood?.id || null,
      foodEnabled: state.foodEnabled,
      weaponSkillEnabled: state.weaponSkillEnabled,
      selectedEmblemName: state.selectedEmblem?.name || null,
      selectedRunestoneNames: state.selectedRunestones.map(r => r.name),
    };

    const updatedPresets = [...state.presets];
    updatedPresets[presetIndex] = updatedPreset;
    set({ presets: updatedPresets });

    // localStorageを更新
    try {
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(updatedPresets));
    } catch (e) {
      console.error('プリセットの更新に失敗しました:', e);
    }
  },

  loadPresetsFromStorage: () => {
    try {
      const stored = localStorage.getItem(PRESETS_STORAGE_KEY);
      if (stored) {
        const presets = JSON.parse(stored) as BuildPreset[];
        set({ presets });
      }
    } catch (e) {
      console.error('プリセットの読み込みに失敗しました:', e);
    }
  },
}));
