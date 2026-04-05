/**
 * ステータス重みづけマッピング
 * 各職業・スキルのダメージに対するステータス依存度を事前計算
 *
 * 目的: 最適化時に動的な式解析を省略し、高速化を実現
 */

import type { InternalStatKey } from '@/types/calc';
import { AVAILABLE_EX_TYPES } from './optimize/constants';

// ===== 型定義 =====

/**
 * ステータスの重み情報
 */
export interface StatWeight {
  /** ステータス名 */
  stat: InternalStatKey;
  /** ダメージ式での係数（生値） */
  coefficient: number;
  /** 正規化された重み（0-1, 合計=1） */
  normalizedWeight: number;
  /** 依存元 */
  source: 'baseDamage' | 'skill' | 'buff' | 'jobBonus';
}

/**
 * スキルごとのステータス依存マッピング
 */
export interface SkillStatMapping {
  /** スキルID（内部識別子） */
  skillId: string;
  /** スキル名（表示用） */
  skillName: string;
  /** 依存する武器種 */
  baseDamageTypes: string[];
  /** ステータス重みリスト */
  weights: StatWeight[];
  /** ヒット数（固定値または式） */
  hits: number | string;
  /** MP消費 */
  mp?: number | string;
  /** クールタイム */
  coolTime?: number | string;
  /** バフ/デバフがあるか */
  hasBuff: boolean;
  /** ヒールスキルか */
  isHeal: boolean;
}

/**
 * 武器種ごとの基礎ダメージステータス依存
 */
export interface WeaponBaseDamageMapping {
  /** 武器種名 */
  weaponType: string;
  /** ステータス重みリスト */
  weights: StatWeight[];
  /** 武器攻撃力の基本係数 */
  attackPowerCoeff: number;
  /** 会心ダメージの基本係数 */
  critDamageCoeff: number;
}

/**
 * 職業ごとのスキルマッピング
 */
export interface JobSkillMapping {
  /** 職業名（YAML形式） */
  jobNameYaml: string;
  /** 職業名（日本語） */
  jobNameJa: string;
  /** 職業グレード */
  grade: 'Special' | 'First' | 'Second' | 'Third';
  /** 使用可能武器種 */
  availableWeapons: string[];
  /** 使用可能防具種 */
  availableArmors: string[];
  /** 職業固有のボーナス（SpellRefactor等） */
  jobBonus?: {
    description: string;
    affectedStats: InternalStatKey[];
  };
  /** 通常攻撃（武器種別） */
  basicAttack: Record<string, SkillStatMapping>;
  /** 職業スキル */
  skills: SkillStatMapping[];
}

/**
 * スキルブック（武器書籍）のスキルマッピング
 */
export interface SkillBookMapping {
  /** 武器種 */
  weaponType: string;
  /** スキルリスト */
  skills: SkillStatMapping[];
}

/**
 * 全体マッピングデータ
 */
export interface StatWeightMappingData {
  /** バージョン */
  version: string;
  /** 生成日時 */
  generatedAt: string;
  /** 武器基礎ダメージマッピング */
  weaponBaseDamage: WeaponBaseDamageMapping[];
  /** 職業スキルマッピング */
  jobMappings: JobSkillMapping[];
  /** スキルブックマッピング */
  skillBooks: SkillBookMapping[];
}

// ===== 武器種BaseDamageの係数定義（WeaponCalc.yamlから抽出） =====

/**
 * 武器種ごとのステータス係数（BaseDamage式から）
 * 形式: (WeaponAttackPower + UserStat1*coeff1 + ...) * DamageCorrection * (1 + CritDamageBonus)
 */
export const WEAPON_BASE_DAMAGE_COEFFICIENTS: Record<string, Record<InternalStatKey, number>> = {
  'Sword': {
    Power: 1.6,
    Magic: 0,
    HP: 0,
    Mind: 0,
    Agility: 0,
    Dex: 0,
    CritDamage: 0.005,
    CritRate: 0,
    Defense: 0,
  },
  'Wand': {
    Power: 0,
    Magic: 1.75,
    HP: 0,
    Mind: 0,
    Agility: 0,
    Dex: 0,
    CritDamage: 0.0016,
    CritRate: 0,
    Defense: 0,
  },
  'Bow': {
    Power: 1.75,
    Magic: 0,
    HP: 0,
    Mind: 0,
    Agility: 0,
    Dex: 0,
    CritDamage: 0.0016,
    CritRate: 0,
    Defense: 0,
  },
  'Axe': {
    Power: 1.5,
    Magic: 0,
    HP: 0,
    Mind: 2.5,
    Agility: 0,
    Dex: 0,
    CritDamage: 0.001,
    CritRate: 0,
    Defense: 0,
  },
  'GreatSword': {
    Power: 1.6,
    Magic: 0,
    HP: 3.1,
    Mind: 0,
    Agility: 0,
    Dex: 0,
    CritDamage: 0.001,
    CritRate: 0,
    Defense: 0,
  },
  'Dagger': {
    Power: 1.25,
    Magic: 0,
    HP: 0,
    Mind: 0,
    Agility: 3.5,
    Dex: 0,
    CritDamage: 0.0015,
    CritRate: 0,
    Defense: 0,
  },
  'Spear': {
    Power: 0.005,  // UserPower / 200
    Magic: 0,
    HP: 0,
    Mind: 0,
    Agility: 0,
    Dex: 1.0,       // (UserDex + 100) * ...
    CritDamage: 0.001 / 3,  // / 3 補正
    CritRate: 0,
    Defense: 0.027,  // UserDefense * 8 / 300
  },
  'Frypan': {
    Power: 1.6,
    Magic: 0,
    HP: 0,
    Mind: 0,
    Agility: 0,
    Dex: 0,
    CritDamage: 0.005,
    CritRate: 0,
    Defense: 0,
  },
};

/**
 * スキル式から追加される係数（主要スキルのみ事前定義）
 * スキルダメージ = (BaseDamage + UserStat*coeff) * skillMultiplier
 */
export const SKILL_ADDITIONAL_COEFFICIENTS: Record<string, Partial<Record<InternalStatKey, number>>> = {
  // Mage系（CritDamage依存）
  'イグナ': { CritDamage: 5 },
  'イグナム': { CritDamage: 5 },
  'イグナイト': { CritDamage: 5 },
  'イグナイト2': { CritDamage: 5 },
  'イグナイト3': { CritDamage: 5 },
  'イグナイト・改': { CritDamage: 5 },
  'イグナ2': { CritDamage: 5 },
  'イグナム2': { CritDamage: 5 },

  // Mage/Wizard系（Mind依存）
  'ウィンド': { Mind: 0.2 },
  'ウィンドラ': { Mind: 0.2 },
  'ウィンドバースト': { Mind: 0.2 },
  'ウィンドバースト2': { Mind: 0.2 },
  'ウィンドバースト3': { Mind: 0.2 },
  'ウィンドバースト・改': { Mind: 0.2 },
  'ウィンドバースト・改2': { Mind: 0.2 },
  'ウィンド2': { Mind: 0.2 },
  'ウィンドラ2': { Mind: 0.2 },

  // Wizard（Mind×2依存）
  'ノンエレメント・エクスプロード': { Mind: 2 },
  'ノンエレメント・エクスプロード2': { Mind: 2 },
  'ノンエレメント・エクスプロード・烈': { Mind: 10 },  // Mind*2*5

  // Hunter系（Speed依存）
  '疾風連撃': { Agility: 0.5 },
  '水流連撃': { Agility: 0.5 },
  '水流連撃2': { Agility: 0.5 },
  'サンライトスラッシュ': { Agility: 0.5 },

  // StellaShaft（Speed大依存）
  'シャイニングアロー': { Agility: 13 },
  'シャイニングアロー2': { Agility: 13 },

  // Ranger（Speed依存ヒット数）
  'マリーナ・レーン': { Agility: 0.6 },  // ヒット数にも影響
  'マリーナ・レーン2': { Agility: 0.6 },

  // Knight（Defense, HP, Power依存）
  '聖なる鉄槌': { Defense: 1.75, Power: 0.5, HP: 0.25 },
  '聖なる鉄槌2': { Defense: 1.925, Power: 0.55, HP: 0.275 },  // *1.1

  // Acolyte（HP, Magic, Mind依存）
  'ホーリーディメンション': { HP: 3, Mind: 2, Magic: 1 },

  // SkillBook Bow
  'ブラッドショット': { Agility: 40 },

  // SkillBook Dagger
  '連撃・覇': { Agility: 0.5 },
};

/**
 * 職業バフによる間接依存ステータス
 */
export const JOB_BUFF_DEPENDENCIES: Record<string, { stat: InternalStatKey; coefficient: number }[]> = {
  'SpellRefactor': [
    { stat: 'Magic', coefficient: 1.5 },
    { stat: 'Power', coefficient: 1.5 },
  ],
  'スペルリファクター': [
    { stat: 'Magic', coefficient: 1.5 },
    { stat: 'Power', coefficient: 1.5 },
  ],
  'Priest': [
    { stat: 'Mind', coefficient: 2.0 },
  ],
  'プリースト': [
    { stat: 'Mind', coefficient: 2.0 },
  ],
  'StellaShaft': [
    { stat: 'Agility', coefficient: 2.5 },
  ],
  'ステラシャフト': [
    { stat: 'Agility', coefficient: 2.5 },
  ],
  'Guardian': [
    { stat: 'Defense', coefficient: 2.0 },
  ],
  'ガーディアン': [
    { stat: 'Defense', coefficient: 2.0 },
  ],
};

// ===== ユーティリティ関数 =====

/**
 * 武器種のBaseDamage依存ステータスを取得
 */
export function getWeaponBaseDamageStats(weaponType: string): StatWeight[] {
  const coeffs = WEAPON_BASE_DAMAGE_COEFFICIENTS[weaponType];
  if (!coeffs) return [];

  const weights: StatWeight[] = [];
  let totalCoeff = 0;

  // 非ゼロ係数のみ収集
  for (const [stat, coeff] of Object.entries(coeffs)) {
    if (coeff > 0) {
      totalCoeff += coeff;
      weights.push({
        stat: stat as InternalStatKey,
        coefficient: coeff,
        normalizedWeight: 0,  // 後で計算
        source: 'baseDamage',
      });
    }
  }

  // 正規化
  for (const w of weights) {
    w.normalizedWeight = totalCoeff > 0 ? w.coefficient / totalCoeff : 0;
  }

  return weights;
}

/**
 * スキルの追加依存ステータスを取得
 */
export function getSkillAdditionalStats(skillName: string): StatWeight[] {
  const coeffs = SKILL_ADDITIONAL_COEFFICIENTS[skillName];
  if (!coeffs) return [];

  const weights: StatWeight[] = [];
  let totalCoeff = 0;

  for (const [stat, coeff] of Object.entries(coeffs)) {
    if (coeff > 0) {
      totalCoeff += coeff;
      weights.push({
        stat: stat as InternalStatKey,
        coefficient: coeff,
        normalizedWeight: 0,
        source: 'skill',
      });
    }
  }

  for (const w of weights) {
    w.normalizedWeight = totalCoeff > 0 ? w.coefficient / totalCoeff : 0;
  }

  return weights;
}

/**
 * 通常攻撃のステータス依存を取得
 * @param weaponType 武器種
 */
export function getBasicAttackWeights(weaponType: string): SkillStatMapping {
  const weights = getWeaponBaseDamageStats(weaponType);

  return {
    skillId: `basic_attack_${weaponType}`,
    skillName: '通常攻撃',
    baseDamageTypes: [weaponType],
    weights,
    hits: 1,
    hasBuff: false,
    isHeal: false,
  };
}

/**
 * 職業バフのステータス依存を取得
 */
export function getJobBuffWeights(jobName: string): StatWeight[] {
  const deps = JOB_BUFF_DEPENDENCIES[jobName];
  if (!deps) return [];

  let totalCoeff = 0;
  for (const d of deps) {
    totalCoeff += d.coefficient;
  }

  return deps.map(d => ({
    stat: d.stat,
    coefficient: d.coefficient,
    normalizedWeight: totalCoeff > 0 ? d.coefficient / totalCoeff : 0,
    source: 'jobBonus' as const,
  }));
}

/**
 * 複合的なステータス重みを計算
 * BaseDamage依存 + スキル追加依存 + 職業バフ依存を統合
 *
 * @param weaponType 武器種
 * @param skillName スキル名
 * @param jobName 職業名（オプション）
 */
export function getCombinedWeights(
  weaponType: string,
  skillName: string,
  jobName?: string
): StatWeight[] {
  const weightMap = new Map<InternalStatKey, StatWeight>();

  // 1. BaseDamage依存
  const baseWeights = getWeaponBaseDamageStats(weaponType);
  for (const w of baseWeights) {
    weightMap.set(w.stat, { ...w });
  }

  // 2. スキル追加依存
  const skillWeights = getSkillAdditionalStats(skillName);
  for (const w of skillWeights) {
    const existing = weightMap.get(w.stat);
    if (existing) {
      existing.coefficient += w.coefficient;
      existing.source = 'skill';  // スキル依存が優先
    } else {
      weightMap.set(w.stat, { ...w });
    }
  }

  // 3. 職業バフ依存
  if (jobName) {
    const jobWeights = getJobBuffWeights(jobName);
    for (const w of jobWeights) {
      const existing = weightMap.get(w.stat);
      if (existing) {
        existing.coefficient += w.coefficient;
      } else {
        weightMap.set(w.stat, { ...w });
      }
    }
  }

  // 再正規化
  const allWeights = Array.from(weightMap.values());
  let totalCoeff = 0;
  for (const w of allWeights) {
    totalCoeff += w.coefficient;
  }
  for (const w of allWeights) {
    w.normalizedWeight = totalCoeff > 0 ? w.coefficient / totalCoeff : 0;
  }

  // 係数順でソート
  allWeights.sort((a, b) => b.coefficient - a.coefficient);

  return allWeights;
}

/**
 * ステータスの感度分析（1ポイントあたりのダメージ寄与）
 *
 * @param weaponType 武器種
 * @param skillName スキル名
 * @param baseStats 基準ステータス（典型的な装備時の値）
 * @param skillMultiplier スキル倍率
 */
export function calculateStatSensitivity(
  weaponType: string,
  skillName: string,
  baseStats: Record<InternalStatKey, number>,
  skillMultiplier: number = 1.0
): Record<InternalStatKey, number> {
  const sensitivity: Record<InternalStatKey, number> = {} as any;

  // 武器係数
  const weaponCoeffs = WEAPON_BASE_DAMAGE_COEFFICIENTS[weaponType] || {};

  // スキル追加係数
  const skillCoeffs = SKILL_ADDITIONAL_COEFFICIENTS[skillName] || {};

  // 合計係数を計算
  const allStats: InternalStatKey[] = ['Power', 'Magic', 'HP', 'Mind', 'Agility', 'Dex', 'CritDamage', 'Defense'];

  for (const stat of allStats) {
    const weaponCoeff = weaponCoeffs[stat] || 0;
    const skillCoeff = skillCoeffs[stat] || 0;
    const totalCoeff = weaponCoeff + skillCoeff;

    // 感度 = 係数 × スキル倍率
    // CritDamageは会心率に依存するため、期待値として50%を仮定
    if (stat === 'CritDamage') {
      sensitivity[stat] = totalCoeff * skillMultiplier * 0.5;  // 期待値
    } else {
      sensitivity[stat] = totalCoeff * skillMultiplier;
    }
  }

  return sensitivity;
}

/**
 * EX選択の優先度を算出
 *
 * @param weights ステータス重みリスト
 * @param slotType 装備スロット種別
 */
export function getEXPriority(
  weights: StatWeight[],
  slotType: 'armor' | 'accessory'
): string[] {
  // EXで選択可能なステータス（定数から参照）
  const availableTypes = [...AVAILABLE_EX_TYPES];

  // InternalStatKey → EXタイプ名のマッピング
  const statToEx: Record<string, string> = {
    'Power': 'Power',
    'Magic': 'Magic',
    'HP': 'HP',
    'Mind': 'Mind',
    'Agility': 'Speed',
    'Dex': 'Dex',
    'CritDamage': 'CritDamage',
    'Defense': 'Defense',
  };

  // 重みでソート
  const prioritized: { exType: string; weight: number }[] = [];

  for (const exType of availableTypes) {
    // このEXに対応するステータスの重みを合計
    let totalWeight = 0;
    for (const w of weights) {
      if (statToEx[w.stat] === exType) {
        totalWeight += w.normalizedWeight;
      }
    }
    prioritized.push({ exType, weight: totalWeight });
  }

  // 重み順でソート
  prioritized.sort((a, b) => b.weight - a.weight);

  return prioritized.map(p => p.exType);
}
