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