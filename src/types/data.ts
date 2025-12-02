// YAML構造の型定義
export interface EqConstData {
  Armor: {
    TatakiMultiplier: {
      Defense: number;
      Others: number;
    };
    Forge: {
      Defence: number;
      Other: number;
      MaxTotal?: number;  // 叩き回数の合計上限
    };
    Reinforcement: {
      MAX: number;
      Defence: number;
      Other: number;
    };
    Rank: Record<string, number>;
    ExponentPower?: number;  // Used in armor calculation formula: baseWithTataki^0.2
  };
  Accessory: {
    Rank: Record<string, number>;
    ScalingDivisor?: number;  // Used in accessory formula: (level * rankBonus / 550)
  };
  Equipment_EX: {
    Rank: {
      CritR: Record<string, number>;
      Speed_CritD: Record<string, number>;
      Other: Record<string, number>;
    };
  };
  Weapon: {
    Rank: {
      Coeff: Record<string, number>;
      [key: string]: any;  // 各ランクのBonus/Alchemyデータ
    };
    Forge: {
      Other: number;
    };
    Reinforcement: {
      Denominator: number;
      MAX: number;
      MaxSmithingCount?: number;  // 武器叩き回数の合計上限
      AttackP: number;
      CritD: number;
      CritR: number;
    };
  };
}

export interface JobConstData {
  JobDefinition: Record<string, {
    MaxLevel: number;
    AvailableWeapons: string[];  // MainWeapon → 修正
    AvailableArmors: string[];   // 新規追加
    HP?: number;
    STR?: number;
    INT?: number;
    MND?: number;
    VIT?: number;
    AGI?: number;
    DEX?: number;
    LUK?: number;
    JobCorrection?: Record<string, number>;
    [key: string]: any;  // その他のフィールド対応
  }>;
}

export interface AdditionalAttackDefinition {
  type: 'percentage' | 'mp-based' | 'resistance-based' | 'speed-based';
  multiplier: number;
  baseCount?: number;
  pvpCount?: number;
  ignoreDefense?: boolean;
}

export interface WeaponCalcData {
  BasedDamage?: Record<string, string>;
  JobCorrection?: Record<string, Record<string, string>>;
  FinalDamage?: string;
  AdditionalAttacks?: Record<string, AdditionalAttackDefinition>;
  [key: string]: unknown;
}

export interface UserStatusCalcData {
  UserStatusFormula: Record<string, string>;
  EquipmentStatusFormula: Record<string, string>;
  RingConvergence?: {
    BaseValue: number;
    Multiplier: number;
    Description?: string;
  };
}

export interface SkillCalcData {
  SkillDefinition?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * 武器スキルの定義（武器名一致で有効化）
 * 1つのスキルで複数のステータスにバフをかけられる
 */
export interface WeaponSkillDefinition {
  /** スキル名（表示用） */
  Name: string;
  /** 対象武器名リスト（部分一致判定） */
  WeaponNames: string[];
  /** バフ効果（ステータス名: 計算式） */
  Buffs: Record<string, string>;
  /** 最大レベル */
  MaxLevel: number;
}

/**
 * 職業スキルの定義（特定スキル解放で有効化）
 * 1つのスキルで複数のステータスにバフをかけられる
 */
export interface JobSkillBuffDefinition {
  /** スキル名（表示用） */
  Name: string;
  /** 対象職業名 */
  JobName: string;
  /** 解放必須スキル名リスト（これらのスキルを解放している場合に有効） */
  RequiredSkills: string[];
  /** バフ効果（ステータス名: 計算式） */
  Buffs: Record<string, string>;
  /** 最大レベル */
  MaxLevel: number;
}

/**
 * 指輪バフの定義（収束計算用）
 */
export interface RingBuffDefinition {
  /** バフ名（表示用） */
  Name: string;
  /** 対象ステータス */
  TargetStat: string;
  /** 計算式（FinalStatus参照を含む） */
  BaseFormula: string;
}

/**
 * 武器スキルバフのYAMLデータ型
 */
export interface WeaponSkillCalcData {
  /** 武器スキル（武器名一致で有効化） */
  WeaponSkills?: Record<string, WeaponSkillDefinition>;
  /** 職業スキル（特定スキル解放で有効化） */
  JobSkills?: Record<string, JobSkillBuffDefinition>;
  /** 指輪バフ（収束計算用） */
  RingBuffs?: Record<string, RingBuffDefinition>;
}

/**
 * スキル定義の型（YAMLから読み込まれる各スキルの定義）
 */
export interface SkillDefinition {
  /** 対応する武器種（空配列の場合はバフ・デバフ系） */
  BaseDamageType: string[];
  /** MP消費量（数値または式） */
  MP?: number | string | null;
  /** クールタイム（数値または式） */
  CT?: number | string | null;
  /** ヒット数（数値、配列[min,max]、式、または"variable"） */
  Hits?: number | number[] | string;
  /** ダメージ計算式 */
  Damage?: string | null;
  /** 回復量計算式 */
  Heal?: string | null;
  /** バフ効果（ステータス名: 計算式） */
  Buff?: Record<string, string>;
  /** デバフ効果（ステータス名: 計算式） */
  Debuff?: Record<string, string>;
  /** DoT（継続ダメージ）効果 */
  Dot?: {
    Count: string;
    Damage: string;
  };
  /** 効果時間（秒） */
  Duration?: number;
  /** 追加効果（キー: 計算式の形式で表示用） */
  Extra?: Record<string, string>;
}

/**
 * スキル本のデータ型（武器種ごとにスキルが定義）
 */
export interface SkillBookData {
  [weaponType: string]: Record<string, SkillDefinition>;
}

/**
 * 職業スキルのデータ型（職業名ごとにスキルが定義）
 */
export interface JobSkillData {
  [jobName: string]: Record<string, SkillDefinition>;
}

/**
 * 全スキルデータの統合型
 */
export interface AllSkillCalcData {
  /** スキル本（武器種ベース） */
  skillBook: SkillBookData;
  /** 特殊職スキル */
  specialJob: JobSkillData;
  /** 1次職スキル */
  firstJob: JobSkillData;
  /** 2次職スキル */
  secondJob: JobSkillData;
  /** 3次職スキル */
  thirdJob: JobSkillData;
}

/**
 * UI表示用のスキル情報
 */
export interface AvailableSkill {
  /** スキルID（一意識別子） */
  id: string;
  /** スキル名 */
  name: string;
  /** スキルソース（'book' | 'job'） */
  source: 'book' | 'job';
  /** 職業名（jobスキルの場合） */
  jobName?: string;
  /** 対応武器種 */
  weaponTypes: string[];
  /** スキル定義データ */
  definition: SkillDefinition;
  /** スキルタイプ */
  type: 'damage' | 'heal' | 'buff' | 'debuff' | 'utility';
}

// CSV構造の型定義
export interface WeaponData {
  アイテム名: string;
  制作: string;
  武器種: string;
  使用可能Lv: number;
  '攻撃力（初期値）': number;
  '会心率（初期値）': number;
  '会心ダメージ（初期値）': number;
  'ダメージ補正（初期値）': number;
  'ct(初期値)': number;
  最低ランク?: string;
  最高ランク?: string;
}

export interface ArmorData {
  アイテム名: string;
  使用可能Lv: number;
  部位を選択: string;
  タイプを選択: string;
  '力（初期値）': number;
  '魔力（初期値）': number;
  '体力（初期値）': number;
  '精神（初期値）': number;
  '素早さ（初期値）': number;
  '器用（初期値）': number;
  '撃力（初期値）': number;
  '守備力（初期値）': number;
  最低ランク?: string;
  最高ランク?: string;
}

export interface AccessoryData {
  アイテム名: string;
  使用可能Lv: number;
  タイプを選択: string;
  '体力（初期値）': number;
  '力（初期値）': number;
  '魔力（初期値）': number;
  '精神（初期値）': number;
  '撃力（初期値）': number;
  '素早さ（初期値）': number;
  最低ランク?: string;
  最高ランク?: string;
}

/**
 * 紋章データ型定義
 * CSVカラム: アイテム名,使用可能Lv,力（%不要）,魔力（%不要）,体力（%不要）,精神（%不要）,素早さ（%不要）,器用（%不要）,撃力（%不要）,守備力（%不要）
 * 注: 各ステータスは%補正として扱う（CSVには%記号なしで記載されているが実際は%補正）
 */
export interface EmblemData {
  /** アクセス用の名前プロパティ（プリセット保存・復元用） */
  name: string;
  アイテム名: string;
  使用可能Lv: number;
  '力（%不要）'?: number;
  '魔力（%不要）'?: number;
  '体力（%不要）'?: number;
  '精神（%不要）'?: number;
  '素早さ（%不要）'?: number;
  '器用（%不要）'?: number;
  '撃力（%不要）'?: number;
  '守備力（%不要）'?: number;
}

/**
 * ルーンストーン耐性データ型定義
 */
export interface RunestoneResistance {
  type: string;
  value: number;
}

/**
 * ルーンストーンのグレード型定義
 */
export type RunestoneGrade = 'ノーマル' | 'グレート' | 'バスター' | 'レプリカ';

/**
 * ルーンストーンデータ型定義
 * CSVカラム: アイテム名（・<グレード>）は不要,グレード,力,魔力,体力,精神,素早さ,器用,撃力,守備力,耐性１,値(%除く),耐性２,値,耐性３,値,耐性４,値,耐性５,値,耐性６,値
 * 注: 同グレードは1つまで装備可能
 */
export interface RunestoneData {
  /** アクセス用の名前プロパティ（CSVカラム名からコピー） */
  name: string;
  'アイテム名（・<グレード>）は不要': string;
  グレード: RunestoneGrade;
  力?: number;
  魔力?: number;
  体力?: number;
  精神?: number;
  素早さ?: number;
  器用?: number;
  撃力?: number;
  守備力?: number;
  耐性1?: RunestoneResistance;
  耐性2?: RunestoneResistance;
  耐性3?: RunestoneResistance;
  耐性4?: RunestoneResistance;
  耐性5?: RunestoneResistance;
  耐性6?: RunestoneResistance;
}

/**
 * 食べ物の耐性データ型定義
 */
export interface FoodResistance {
  type: string;
  value: number;
}

/**
 * 食べ物データ型定義
 * CSVカラム: アイテム名,力,魔力,体力,精神,素早さ,器用,撃力,守備力,耐性１,値(%除く),耐性２,値,...
 * 注: 各ステータスは固定値として加算される
 */
export interface FoodData {
  アイテム名: string;
  力?: number;
  魔力?: number;
  体力?: number;
  精神?: number;
  素早さ?: number;
  器用?: number;
  撃力?: number;
  守備力?: number;
  耐性1?: FoodResistance;
  耐性2?: FoodResistance;
  耐性3?: FoodResistance;
  耐性4?: FoodResistance;
  耐性5?: FoodResistance;
  耐性6?: FoodResistance;
  耐性7?: FoodResistance;
  耐性8?: FoodResistance;
}

export interface JobSPData {
  解法段階: string;
  必要SP: number | string;
  解法スキル名?: string;
  体力?: number | string;
  力?: number | string;
  魔力?: number | string;
  精神?: number | string;
  素早さ?: number | string;
  器用さ?: number | string;
  撃力?: number | string;
  守備力?: number | string;
  物理耐性?: number | string;
  魔耐性?: number | string;
  無耐性?: number | string;
  炎耐性?: number | string;
  水耐性?: number | string;
  風耐性?: number | string;
  雷耐性?: number | string;
  闇耐性?: number | string;
  光耐性?: number | string;
}

// 初期化時にロードされる全データの型
export interface GameData {
  yaml: {
    eqConst: EqConstData;
    jobConst: JobConstData;
    weaponCalc: WeaponCalcData;
    userStatusCalc: UserStatusCalcData;
    skillCalc: SkillCalcData;
    weaponSkillCalc?: WeaponSkillCalcData;
  };
  csv: {
    weapons: WeaponData[];
    armors: ArmorData[];
    accessories: AccessoryData[];
    emblems: EmblemData[];
    runestones: RunestoneData[];
    foods: FoodData[];
    jobs: Map<string, JobSPData[]>;
  };
}