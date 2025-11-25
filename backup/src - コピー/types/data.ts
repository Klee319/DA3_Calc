// YAML構造の型定義
export interface EqConstData {
  Armor: {
    Forge: {
      Defence: number;
      Other: number;
    };
    Reinforcement: {
      MAX: number;
      Defence: number;
      Other: number;
    };
    Rank: Record<string, number>;
  };
  Accessory: {
    Rank: Record<string, number>;
  };
  Equipment_EX: {
    Rank: {
      CritR: Record<string, number>;
      Speed_CritD: Record<string, number>;
      Aspd: Record<string, number>;
    };
  };
  Weapon: {
    Forge: {
      Damage: number;
      Other: number;
    };
    Reinforcement: {
      MAX: number;
      Damage: number;
      Other: number;
    };
    Rank: Record<string, number>;
  };
}

export interface JobConstData {
  JobDefinition: Record<string, {
    MainWeapon: string[];
    SubWeapon?: string[];
    HP: number;
    STR?: number;
    INT?: number;
    MND?: number;
    VIT?: number;
    AGI?: number;
    DEX?: number;
    LUK?: number;
    JobCorrection?: Record<string, number>;
  }>;
}

export interface WeaponCalcData {
  BasedDamage?: Record<string, string>;
  JobCorrection?: Record<string, Record<string, string>>;
  FinalDamage?: string;
  [key: string]: unknown;
}

export interface UserStatusCalcData {
  UserStatusFormula: Record<string, string>;
  EquipmentStatusFormula: Record<string, string>;
}

export interface SkillCalcData {
  SkillDefinition?: Record<string, unknown>;
  [key: string]: unknown;
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
  制作: string;
  使用可能Lv: number;
  '守備力（初期値）': number;
  '物理耐性（初期値）': number;
  '魔法耐性（初期値）': number;
  'HP（初期値）': number;
  最低ランク?: string;
  最高ランク?: string;
}

export interface AccessoryData {
  アイテム名: string;
  制作: string;
  使用可能Lv: number;
  ステータス種類: string;
  'ステータス値（初期値）': number;
  最低ランク?: string;
  最高ランク?: string;
}

export interface EmblemData {
  アイテム名: string;
  タイプ: string;
  効果: string;
  数値: number;
  入手方法?: string;
}

export interface RunestoneData {
  アイテム名: string;
  タイプ: string;
  効果: string;
  数値: number;
  セット効果?: string;
  セット数値?: number;
}

export interface FoodData {
  アイテム名: string;
  効果1: string;
  数値1: number;
  効果2?: string;
  数値2?: number;
  持続時間: number;
  入手方法?: string;
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