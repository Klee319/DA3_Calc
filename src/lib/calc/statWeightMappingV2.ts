/**
 * ステータス重みづけマッピング V2
 *
 * 改善点:
 * 1. 実際のダメージ式に基づいた感度分析
 * 2. 装備条件による重みの変動を考慮
 * 3. 会心率によるCritDamageの価値変動
 * 4. SpellRefactorのBonus倍率
 * 5. 全スキル対応
 */

import type { InternalStatKey } from '@/types/calc';

// ===== 型定義 =====

/**
 * 動的な重み計算の入力パラメータ
 */
export interface WeightCalculationParams {
  /** 現在のステータス値 */
  currentStats: Partial<Record<InternalStatKey, number>>;
  /** 武器攻撃力 */
  weaponAttackPower: number;
  /** 武器会心ダメージ */
  weaponCritDamage: number;
  /** 会心率（0-100） */
  critRate: number;
  /** 職業名（SpellRefactor等の特殊処理用） */
  jobName?: string;
}

/**
 * 重み計算結果
 */
export interface WeightResult {
  stat: InternalStatKey;
  /** +1あたりのダメージ増加量 */
  sensitivity: number;
  /** 正規化重み（0-1） */
  normalizedWeight: number;
}

// ===== 武器基礎ダメージ式 =====
// 武器係数は定数ファイルから参照（Source: WeaponCalc.yaml）
import { WEAPON_DAMAGE_FORMULAS, AVAILABLE_EX_TYPES } from './optimize/constants';

// ローカルエイリアス（後方互換性のため）
const WEAPON_FORMULAS = WEAPON_DAMAGE_FORMULAS;

// ===== スキル追加係数 =====

/**
 * スキルごとの追加ステータス依存
 */
interface SkillAdditionalFormula {
  /** 追加ステータスと係数 */
  additionalStats: { stat: InternalStatKey; coeff: number }[];
  /** スキル倍率 */
  skillMultiplier: number;
  /** ヒット数（またはヒット数計算式） */
  hits: number | ((stats: Partial<Record<InternalStatKey, number>>) => number);
  /** 武器種（複数武器対応用） */
  weaponType?: string;
  /** 乗算式かどうか（ノンエレ等） */
  isMultiplicative?: boolean;
  /** 乗算係数 */
  multiplicativeCoeff?: number;
}

/**
 * 全スキルのフォーミュラ定義
 * YAMLファイルから抽出した計算式を元に定義
 */
const SKILL_FORMULAS: Record<string, SkillAdditionalFormula> = {
  // ========================================
  // Fighter（ファイター）
  // ========================================
  '烈刃の円斬撃': {
    additionalStats: [],
    skillMultiplier: 0.4,
    hits: 5,
  },
  '常闘斬撃': {
    additionalStats: [],
    skillMultiplier: 0.6,
    hits: 5,
  },
  'ファイアインパクト': {
    additionalStats: [],
    skillMultiplier: 3.0,
    hits: 1,
  },

  // ========================================
  // Mage（メイジ）
  // ========================================
  'イグナ': {
    additionalStats: [{ stat: 'CritDamage', coeff: 5 }],
    skillMultiplier: 0.5,
    hits: 2,
  },
  'イグナム': {
    additionalStats: [{ stat: 'CritDamage', coeff: 5 }],
    skillMultiplier: 0.4,
    hits: 2,
  },
  'イグナイト': {
    additionalStats: [{ stat: 'CritDamage', coeff: 5 }],
    skillMultiplier: 1.0,
    hits: 1,
  },
  'イグナイト2': {
    additionalStats: [{ stat: 'CritDamage', coeff: 5 }],
    skillMultiplier: 1.25,
    hits: 1,
  },
  'ウィンド': {
    additionalStats: [{ stat: 'Mind', coeff: 0.2 }],
    skillMultiplier: 0.5,
    hits: 3,
  },
  'ウィンドラ': {
    additionalStats: [{ stat: 'Mind', coeff: 0.2 }],
    skillMultiplier: 0.4,
    hits: 5,
  },
  'ウィンドバースト': {
    additionalStats: [{ stat: 'Mind', coeff: 0.2 }],
    skillMultiplier: 0.4,
    hits: 8,
  },
  'ウィンドバースト2': {
    additionalStats: [{ stat: 'Mind', coeff: 0.2 }],
    skillMultiplier: 0.65,
    hits: 8,
  },

  // ========================================
  // Archer（アーチャー）
  // ========================================
  'アローレイン': {
    additionalStats: [],
    skillMultiplier: 0.5,
    hits: 6, // 敵サイズ依存、平均6想定
  },
  '迅雷射': {
    additionalStats: [],
    skillMultiplier: 0.4,
    hits: 12,
  },
  '迅雷射2': {
    additionalStats: [],
    skillMultiplier: 0.4,
    hits: 14,
  },
  'バレット・レーン': {
    additionalStats: [],
    skillMultiplier: 0.6,
    hits: 5,
  },

  // ========================================
  // Acolyte（アコライト）
  // ========================================
  'ホーリーディメンション': {
    additionalStats: [
      { stat: 'HP', coeff: 3 },
      { stat: 'Mind', coeff: 2 },
      { stat: 'Magic', coeff: 1 },
    ],
    skillMultiplier: 3.0,
    hits: 1,
  },

  // ========================================
  // Warrior（ウォーリア）
  // ========================================
  '烈刃の円斬撃3': {
    additionalStats: [],
    skillMultiplier: 0.7,
    hits: 5,
  },
  '常闘斬撃2': {
    additionalStats: [],
    skillMultiplier: 0.8,
    hits: 6,
  },
  '常闘斬撃4': {
    additionalStats: [],
    skillMultiplier: 1.2,
    hits: 6,
  },
  '烈刃の円斬撃6': {
    additionalStats: [],
    skillMultiplier: 1.15,
    hits: 5,
  },

  // ========================================
  // Knight（ナイト）
  // ========================================
  '烈刃の円斬撃2': {
    additionalStats: [],
    skillMultiplier: 0.55,
    hits: 5,
    weaponType: 'Sword',
  },
  '聖なる鉄槌': {
    additionalStats: [
      { stat: 'Defense', coeff: 1.75 },
      { stat: 'Power', coeff: 0.5 },
      { stat: 'HP', coeff: 0.25 },
    ],
    skillMultiplier: 0.5,
    hits: 5,
  },
  '聖なる鉄槌2': {
    additionalStats: [
      { stat: 'Defense', coeff: 1.75 },
      { stat: 'Power', coeff: 0.5 },
      { stat: 'HP', coeff: 0.25 },
    ],
    skillMultiplier: 0.55, // 1.1倍
    hits: 5,
  },

  // ========================================
  // Wizard（ウィザード）
  // ========================================
  'イグナ2': {
    additionalStats: [{ stat: 'CritDamage', coeff: 5 }],
    skillMultiplier: 0.65,
    hits: 2,
  },
  'イグナム2': {
    additionalStats: [{ stat: 'CritDamage', coeff: 5 }],
    skillMultiplier: 0.6,
    hits: 2,
  },
  'イグナイト3': {
    additionalStats: [{ stat: 'CritDamage', coeff: 5 }],
    skillMultiplier: 1.5,
    hits: 1,
  },
  'イグナイト・改': {
    additionalStats: [{ stat: 'CritDamage', coeff: 5 }],
    skillMultiplier: 2.5,
    hits: 1,
  },
  'ウィンド2': {
    additionalStats: [{ stat: 'Mind', coeff: 0.2 }],
    skillMultiplier: 0.65,
    hits: 3,
  },
  'ウィンドラ2': {
    additionalStats: [{ stat: 'Mind', coeff: 0.2 }],
    skillMultiplier: 0.6,
    hits: 5,
  },
  'ウィンドバースト3': {
    additionalStats: [{ stat: 'Mind', coeff: 0.2 }],
    skillMultiplier: 0.9,
    hits: 8,
  },
  'ウィンドバースト・改': {
    additionalStats: [{ stat: 'Mind', coeff: 0.2 }],
    skillMultiplier: 0.5,
    hits: 8,
  },
  'ノンエレメント・エクスプロード': {
    additionalStats: [{ stat: 'Mind', coeff: 2 }],
    skillMultiplier: 0.03115,
    hits: 1,
    isMultiplicative: true,
  },
  'ノンエレメント・エクスプロード2': {
    additionalStats: [{ stat: 'Mind', coeff: 2 }],
    skillMultiplier: 0.03185,
    hits: 1,
    isMultiplicative: true,
  },
  'ノンエレメント・エクスプロード・烈': {
    additionalStats: [{ stat: 'Mind', coeff: 10 }], // Mind*2*5
    skillMultiplier: 3.2,
    hits: 1,
  },

  // ========================================
  // Ranger（レンジャー）
  // ========================================
  'アローレイン2': {
    additionalStats: [],
    skillMultiplier: 0.5,
    hits: 6,
  },
  '迅雷射3': {
    additionalStats: [],
    skillMultiplier: 0.4,
    hits: 16,
  },
  '風神射': {
    additionalStats: [],
    skillMultiplier: 0.45,
    hits: 12,
  },
  '風神射2': {
    additionalStats: [],
    skillMultiplier: 0.45,
    hits: 14,
  },
  'バレット・レーン2': {
    additionalStats: [],
    skillMultiplier: 0.6,
    hits: 7,
  },
  'マリーナ・レーン': {
    additionalStats: [],
    skillMultiplier: 0.6,
    hits: (stats) => 6 + Math.floor((stats.Agility || 0) / 50),
  },
  'マリーナ・レーン2': {
    additionalStats: [],
    skillMultiplier: 0.6,
    hits: (stats) => 8 + Math.floor((stats.Agility || 0) / 50),
  },

  // ========================================
  // Hunter（ハンター）
  // ========================================
  '疾風連撃': {
    additionalStats: [{ stat: 'Agility', coeff: 0.5 }],
    skillMultiplier: 0.6,
    hits: 4,
  },
  '水流連撃': {
    additionalStats: [{ stat: 'Agility', coeff: 0.5 }],
    skillMultiplier: 0.6,
    hits: 4,
  },
  '水流連撃2': {
    additionalStats: [{ stat: 'Agility', coeff: 0.5 }],
    skillMultiplier: 0.65,
    hits: 4,
  },
  'サンライトスラッシュ': {
    additionalStats: [{ stat: 'Agility', coeff: 0.5 }],
    skillMultiplier: 0.65,
    hits: 6,
  },

  // ========================================
  // SpellRefactor（スペルリファクター）
  // ========================================
  'ウィンドバースト・改_SR': {
    additionalStats: [{ stat: 'Mind', coeff: 0.2 }],
    skillMultiplier: 0.5,
    hits: 8,
  },
  'ウィンドバースト・改2': {
    additionalStats: [{ stat: 'Mind', coeff: 0.2 }],
    skillMultiplier: 0.75,
    hits: 8,
  },

  // ========================================
  // StellaShaft（ステラシャフト）
  // ========================================
  'シャイニングアロー': {
    additionalStats: [{ stat: 'Agility', coeff: 13 }],
    skillMultiplier: 1.0,
    hits: 5,
  },
  'シャイニングアロー2': {
    additionalStats: [{ stat: 'Agility', coeff: 13 }],
    skillMultiplier: 1.25,
    hits: 5,
  },

  // ========================================
  // SkillBook（スキルブック）
  // ========================================
  // Sword
  '斬撃波': {
    additionalStats: [],
    skillMultiplier: 1.0,
    hits: 1,
  },
  '火炎斬': {
    additionalStats: [],
    skillMultiplier: 1.0,
    hits: 1,
  },
  '斬撃波・改': {
    additionalStats: [],
    skillMultiplier: 1.0, // Level依存、最大1.2
    hits: 1,
  },

  // Wand
  'フェアリースイフト': {
    additionalStats: [],
    skillMultiplier: 1.0,
    hits: 1,
  },
  'ウォルタ': {
    additionalStats: [],
    skillMultiplier: 1.0,
    hits: 1,
  },

  // Bow
  'ブラッドショット': {
    additionalStats: [{ stat: 'Agility', coeff: 40 }],
    skillMultiplier: 4.05, // 2.05 + Level*0.2 (Level10想定)
    hits: 1,
  },

  // GreatSword
  '斬撃波(大剣)': {
    additionalStats: [],
    skillMultiplier: 1.2, // Level10想定
    hits: 1,
  },

  // Dagger
  '連撃・覇': {
    additionalStats: [{ stat: 'Agility', coeff: 0.5 }],
    skillMultiplier: 1.15, // (Level+13)*0.05 Level10想定
    hits: 1,
  },
  '鏡喪斬': {
    additionalStats: [],
    skillMultiplier: 0.98, // (Level+39)*0.02 Level10想定
    hits: 1,
  },

  // ========================================
  // Novice（ノービス）
  // ========================================
  'なぎはらい': {
    additionalStats: [],
    skillMultiplier: 1.3,
    hits: 1,
  },
  'ぶんまわし': {
    additionalStats: [],
    skillMultiplier: 1.4,
    hits: 1,
  },
  'ファイア': {
    additionalStats: [],
    skillMultiplier: 1.3,
    hits: 1,
  },
  'アイス': {
    additionalStats: [],
    skillMultiplier: 1.3,
    hits: 1,
  },
};

// ===== 職業とスキルのマッピング =====

import { JOB_AVAILABLE_WEAPONS } from './optimize/constants';

/**
 * 職業ごとのスキル一覧（武器はJOB_AVAILABLE_WEAPONSから取得）
 * スキル一覧は現状ハードコード（将来的にYAMLに移行予定）
 */
const JOB_SKILLS: Record<string, string[]> = {
  Fighter: ['烈刃の円斬撃', '常闘斬撃', 'ファイアインパクト'],
  Mage: ['イグナ', 'イグナム', 'イグナイト', 'イグナイト2', 'ウィンド', 'ウィンドラ', 'ウィンドバースト', 'ウィンドバースト2'],
  Archer: ['アローレイン', '迅雷射', '迅雷射2', 'バレット・レーン'],
  Acolyte: ['ホーリーディメンション'],
  Warrior: ['烈刃の円斬撃3', '常闘斬撃2', '常闘斬撃4', '烈刃の円斬撃6'],
  Knight: ['烈刃の円斬撃2', '聖なる鉄槌', '聖なる鉄槌2'],
  Wizard: ['イグナ2', 'イグナム2', 'イグナイト3', 'イグナイト・改', 'ウィンド2', 'ウィンドラ2', 'ウィンドバースト3', 'ウィンドバースト・改', 'ノンエレメント・エクスプロード', 'ノンエレメント・エクスプロード2', 'ノンエレメント・エクスプロード・烈'],
  Ranger: ['アローレイン2', '迅雷射3', '風神射', '風神射2', 'バレット・レーン2', 'マリーナ・レーン', 'マリーナ・レーン2'],
  Hunter: ['疾風連撃', '水流連撃', '水流連撃2', 'サンライトスラッシュ'],
  SpellRefactor: ['ウィンドバースト・改_SR', 'ウィンドバースト・改2'],
  StellaShaft: ['シャイニングアロー', 'シャイニングアロー2'],
  Novice: ['なぎはらい', 'ぶんまわし', 'ファイア', 'アイス'],
  // 以下は計算用スキル未定義の職業
  Cleric: [],
  Guardian: [],
  Priest: [],
};

/**
 * 職業ごとの利用可能スキルと武器種（後方互換性のため）
 * weapons部分はJOB_AVAILABLE_WEAPONSから動的に取得
 */
export const JOB_SKILL_MAPPING: Record<string, { skills: string[]; weapons: string[] }> = Object.fromEntries(
  Object.entries(JOB_SKILLS).map(([job, skills]) => [
    job,
    { skills, weapons: JOB_AVAILABLE_WEAPONS[job] || [] }
  ])
);

// ===== 動的重み計算 =====

/**
 * 武器BaseDamageを計算
 */
function calculateBaseDamage(
  weaponType: string,
  stats: Partial<Record<InternalStatKey, number>>,
  weaponAttackPower: number,
  weaponCritDamage: number,
  weaponCritRate: number = 0
): number {
  const formula = WEAPON_FORMULAS[weaponType];
  if (!formula) return 0;

  const critDamage = stats.CritDamage || 0;

  if (formula.isSpear) {
    // 槍特殊計算: ((Dex+WCR+100)*Defense*8/300 + Power/200 + WP) * (1 + (WCD/100 + CD*0.001)/3)
    const dex = stats.Dex || 0;
    const defense = stats.Defense || 0;
    const power = stats.Power || 0;
    const baseStat = ((dex + weaponCritRate + 100) * defense * 8 / 300) + (power / 200) + weaponAttackPower;
    const critBonus = 1 + (weaponCritDamage / 100 + critDamage * 0.001) / 3;
    return baseStat * critBonus;
  }

  const primaryValue = stats[formula.primaryStat] || 0;
  const secondaryValue = formula.secondaryStat ? (stats[formula.secondaryStat] || 0) : 0;

  const baseStat = weaponAttackPower +
    primaryValue * formula.primaryCoeff +
    secondaryValue * (formula.secondaryCoeff || 0);

  const critBonus = 1 + weaponCritDamage / 100 + critDamage * formula.critDamageCoeff;

  return baseStat * critBonus;
}

/**
 * スキルダメージを計算
 */
function calculateSkillDamage(
  skillName: string,
  weaponType: string,
  stats: Partial<Record<InternalStatKey, number>>,
  weaponAttackPower: number,
  weaponCritDamage: number,
  weaponCritRate: number = 0
): number {
  const baseDamage = calculateBaseDamage(weaponType, stats, weaponAttackPower, weaponCritDamage, weaponCritRate);
  const skillFormula = SKILL_FORMULAS[skillName];

  if (!skillFormula) {
    // デフォルト: BaseDamageそのまま
    return baseDamage;
  }

  // 乗算式（ノンエレ等）
  if (skillFormula.isMultiplicative) {
    let additionalValue = 0;
    for (const add of skillFormula.additionalStats) {
      additionalValue += (stats[add.stat] || 0) * add.coeff;
    }
    return baseDamage * additionalValue * skillFormula.skillMultiplier;
  }

  // 追加ステータスを加算
  let additionalDamage = 0;
  for (const add of skillFormula.additionalStats) {
    additionalDamage += (stats[add.stat] || 0) * add.coeff;
  }

  // ヒット数
  const hits = typeof skillFormula.hits === 'function'
    ? skillFormula.hits(stats)
    : skillFormula.hits;

  return (baseDamage + additionalDamage) * skillFormula.skillMultiplier * hits;
}

/**
 * 動的な重みを計算（感度分析ベース）
 *
 * @param skillName スキル名
 * @param weaponType 武器種
 * @param params 計算パラメータ
 * @returns ステータスごとの重み
 */
export function calculateDynamicWeights(
  skillName: string,
  weaponType: string,
  params: WeightCalculationParams
): WeightResult[] {
  const { currentStats, weaponAttackPower, weaponCritDamage, critRate, jobName } = params;

  // SpellRefactor特殊処理（英語・日本語両対応）
  if (jobName === 'SpellRefactor' || jobName === 'スペルリファクター') {
    return calculateSpellRefactorWeights(skillName, weaponType, params);
  }

  // 基準ダメージ
  const baseDamage = calculateSkillDamage(
    skillName, weaponType, currentStats, weaponAttackPower, weaponCritDamage
  );

  // 各ステータスの感度を計算
  const statsToCheck: InternalStatKey[] = [
    'Power', 'Magic', 'HP', 'Mind', 'Agility', 'Dex', 'CritDamage', 'Defense'
  ];

  const results: WeightResult[] = [];

  // 総合会心ダメージ（武器 + キャラクター撃力）を計算
  const userCritDamage = currentStats.CritDamage || 0;
  const totalCritDamage = weaponCritDamage + userCritDamage;

  for (const stat of statsToCheck) {
    // +1したときのダメージ
    const modifiedStats = { ...currentStats, [stat]: (currentStats[stat] || 0) + 1 };
    const newDamage = calculateSkillDamage(
      skillName, weaponType, modifiedStats, weaponAttackPower, weaponCritDamage
    );

    let sensitivity = newDamage - baseDamage;

    // CritDamageは会心率で期待値補正
    // （CritDamageは会心時のみ効果があるため）
    if (stat === 'CritDamage') {
      sensitivity *= (critRate / 100);
    }

    // 器用さ（Dex）は会心率への寄与を追加
    // ただし総合会心率（武器+器用さ*0.3）が100%未満の場合のみ
    if (stat === 'Dex') {
      const currentDex = currentStats.Dex || 0;
      const totalCritRate = critRate + currentDex * 0.3;
      if (totalCritRate < 100) {
        const critRateContribution = baseDamage * (totalCritDamage / 100) * 0.003;
        sensitivity += critRateContribution;
      }
    }

    if (sensitivity > 0.0001) {  // 有意な差がある場合のみ
      results.push({ stat, sensitivity, normalizedWeight: 0 });
    }
  }

  // 正規化
  const totalSensitivity = results.reduce((sum, r) => sum + r.sensitivity, 0);
  for (const r of results) {
    r.normalizedWeight = totalSensitivity > 0 ? r.sensitivity / totalSensitivity : 0;
  }

  // 感度順でソート
  results.sort((a, b) => b.sensitivity - a.sensitivity);

  return results;
}

/**
 * SpellRefactor専用の重み計算（装備実現可能範囲でのグリッドサーチ + 勾配法）
 *
 * 装備で実現可能なステータス配分を考慮：
 * - 装備には必ず力、魔力、撃力などが含まれる
 * - 「撃力100%」のような極端な配分は不可能
 * - 武器種によって力:魔力の実現可能な範囲が異なる
 *
 * 1. 装備で実現可能な力:魔力:撃力の比率をグリッドサーチ
 * 2. 最適比率のステータスで勾配法（+1感度分析）を実行
 */
function calculateSpellRefactorWeights(
  skillName: string,
  weaponType: string,
  params: WeightCalculationParams
): WeightResult[] {
  const { currentStats, weaponAttackPower, weaponCritDamage, critRate } = params;

  // SpellRefactorはP=Mが最適なので、現在のステータスから直接感度計算
  // (findOptimalEquipmentStatsの武器種制約がP:Mバランスを歪めるため使用しない)
  const currentPower = currentStats.Power || 0;
  const currentMagic = currentStats.Magic || 0;
  const currentBonus = calculateSpellRefactorBonus(currentPower, currentMagic);

  // 現在ステータスでの基準ダメージ
  const baseSkillDamage = calculateSkillDamage(
    skillName, weaponType, currentStats, weaponAttackPower, weaponCritDamage
  );
  const baseDamage = baseSkillDamage * currentBonus;

  const statsToCheck: InternalStatKey[] = [
    'Power', 'Magic', 'HP', 'Mind', 'Agility', 'Dex', 'CritDamage', 'Defense'
  ];

  const results: WeightResult[] = [];

  // 総合会心ダメージ（武器 + キャラクター撃力）を計算
  const userCritDamage = currentStats.CritDamage || 0;
  const totalCritDamage = weaponCritDamage + userCritDamage;

  // 勾配法: 各ステータス+1の感度を計算
  for (const stat of statsToCheck) {
    const modifiedStats = { ...currentStats, [stat]: (currentStats[stat] || 0) + 1 };

    const newSkillDamage = calculateSkillDamage(
      skillName, weaponType, modifiedStats, weaponAttackPower, weaponCritDamage
    );

    // 力または魔力を変更した場合、Bonusも再計算
    let newBonus = currentBonus;
    if (stat === 'Power' || stat === 'Magic') {
      const newPower = modifiedStats.Power || 0;
      const newMagic = modifiedStats.Magic || 0;
      newBonus = calculateSpellRefactorBonus(newPower, newMagic);
    }

    const newDamage = newSkillDamage * newBonus;
    let sensitivity = newDamage - baseDamage;

    if (stat === 'CritDamage') {
      sensitivity *= (critRate / 100);
    }

    // 器用さ（Dex）は会心率への寄与を追加
    // ただし総合会心率（武器+器用さ*0.3）が100%未満の場合のみ
    if (stat === 'Dex') {
      const currentDex = currentStats.Dex || 0;
      const totalCritRate = critRate + currentDex * 0.3;
      if (totalCritRate < 100) {
        const critRateContribution = baseDamage * (totalCritDamage / 100) * 0.003;
        sensitivity += critRateContribution;
      }
      // 100%以上なら感度は0のまま（baseDamageへの直接寄与もないため）
    }

    if (sensitivity > 0.0001) {
      results.push({ stat, sensitivity, normalizedWeight: 0 });
    }
  }

  // P:Mバランス補正: P<MならPower感度を1.2倍、P>MならMagic感度を1.2倍
  // (武器係数の影響でバランスが崩れやすいため、補正を入れる)
  const pmRatio = currentPower / (currentMagic || 1);
  for (const r of results) {
    if (r.stat === 'Power' && pmRatio < 0.95) {
      r.sensitivity *= 1.2;  // 力不足時は力の感度を上げる
    } else if (r.stat === 'Magic' && pmRatio > 1.05) {
      r.sensitivity *= 1.2;  // 魔力不足時は魔力の感度を上げる
    }
  }

  const totalSensitivity = results.reduce((sum, r) => sum + r.sensitivity, 0);
  for (const r of results) {
    r.normalizedWeight = totalSensitivity > 0 ? r.sensitivity / totalSensitivity : 0;
  }

  results.sort((a, b) => b.sensitivity - a.sensitivity);

  return results;
}

/**
 * 装備で実現可能なステータス配分の範囲
 * 武器種によって力:魔力の典型的な範囲が異なる
 */
const EQUIPMENT_STAT_RANGES: Record<string, {
  powerMin: number; powerMax: number;
  magicMin: number; magicMax: number;
  critDamageRatio: number; // 撃力は力+魔力に対する比率
}> = {
  // 杖装備: 魔力寄り（魔力40-70%, 力15-40%）
  Wand: { powerMin: 0.15, powerMax: 0.40, magicMin: 0.40, magicMax: 0.70, critDamageRatio: 0.25 },
  // 剣装備: 力寄り（力40-70%, 魔力15-40%）
  Sword: { powerMin: 0.40, powerMax: 0.70, magicMin: 0.15, magicMax: 0.40, critDamageRatio: 0.25 },
  // デフォルト: バランス型
  default: { powerMin: 0.25, powerMax: 0.55, magicMin: 0.25, magicMax: 0.55, critDamageRatio: 0.25 },
};

/**
 * 装備で実現可能な範囲でグリッドサーチし、最適なステータス配分を返す
 *
 * 力:魔力:撃力の比率を5%刻みで探索し、ダメージが最大となる配分を返す。
 */
function findOptimalEquipmentStats(
  skillName: string,
  weaponType: string,
  baseStats: Partial<Record<InternalStatKey, number>>,
  weaponAttackPower: number,
  weaponCritDamage: number
): Partial<Record<InternalStatKey, number>> {
  const range = EQUIPMENT_STAT_RANGES[weaponType] || EQUIPMENT_STAT_RANGES.default;

  // 総ステータスポイント（力+魔力+撃力）の合計を推定
  const totalMainStats = (baseStats.Power || 0) + (baseStats.Magic || 0) + (baseStats.CritDamage || 0);

  let bestStats = { ...baseStats };
  let maxDamage = 0;

  // 力の比率を5%刻みで探索（装備実現可能範囲内）
  for (let powerRatio = range.powerMin; powerRatio <= range.powerMax; powerRatio += 0.05) {
    // 魔力の比率を5%刻みで探索（装備実現可能範囲内）
    for (let magicRatio = range.magicMin; magicRatio <= range.magicMax; magicRatio += 0.05) {
      // 撃力の比率（残り）
      const critRatio = 1 - powerRatio - magicRatio;

      // 撃力が負または極端に小さい場合はスキップ
      if (critRatio < 0.10 || critRatio > 0.40) continue;

      // 比率の合計が1を大きく超える場合はスキップ
      if (powerRatio + magicRatio + critRatio > 1.05) continue;

      const power = Math.round(totalMainStats * powerRatio);
      const magic = Math.round(totalMainStats * magicRatio);
      const critDamage = Math.round(totalMainStats * critRatio);

      const testStats = {
        ...baseStats,
        Power: power,
        Magic: magic,
        CritDamage: critDamage,
      };

      const bonus = calculateSpellRefactorBonus(power, magic);
      const skillDamage = calculateSkillDamage(
        skillName, weaponType, testStats, weaponAttackPower, weaponCritDamage
      );

      // クリティカル込みのダメージ（期待値）
      const critMultiplier = 1 + (critDamage / 100) * 0.8; // critRate 80%想定
      const damage = skillDamage * bonus * critMultiplier;

      if (damage > maxDamage) {
        maxDamage = damage;
        bestStats = { ...testStats };
      }
    }
  }

  return bestStats;
}

// ===== SpellRefactor特殊処理 =====

/**
 * SpellRefactorのBonus倍率を計算
 */
export function calculateSpellRefactorBonus(power: number, magic: number): number {
  if (power <= 0 || magic <= 0) return 1.0;
  const ratio = Math.max(power, magic) / Math.min(power, magic);
  return Math.max(0, 1.75 - 0.475 * Math.log(ratio) * 2);
}

/**
 * SpellRefactorの最適な力/魔力配分を計算
 *
 * @param currentPower 現在の力
 * @param currentMagic 現在の魔力
 * @param additionalPoints 追加で振り分けるポイント
 * @returns 力に振る割合（0-1）
 */
export function calculateSpellRefactorOptimalAllocation(
  currentPower: number,
  currentMagic: number,
  additionalPoints: number
): number {
  let bestPowerRatio = 0.5;
  let bestBonus = 0;

  // 10%刻みで探索
  for (let ratio = 0; ratio <= 1; ratio += 0.1) {
    const newPower = currentPower + additionalPoints * ratio;
    const newMagic = currentMagic + additionalPoints * (1 - ratio);
    const bonus = calculateSpellRefactorBonus(newPower, newMagic);

    if (bonus > bestBonus) {
      bestBonus = bonus;
      bestPowerRatio = ratio;
    }
  }

  return bestPowerRatio;
}

// ===== マリーナ・レーン特殊処理 =====

/**
 * マリーナ・レーンのSpeed閾値効果を計算
 * Speed/50ごとにヒット数が増えるため、閾値近辺でのSpeed価値が高い
 */
export function calculateMarinaLaneSpeedValue(currentSpeed: number): {
  currentHits: number;
  nextThreshold: number;
  speedToNextHit: number;
} {
  const currentHits = 6 + Math.floor(currentSpeed / 50);
  const nextThreshold = (Math.floor(currentSpeed / 50) + 1) * 50;
  const speedToNextHit = nextThreshold - currentSpeed;

  return { currentHits, nextThreshold, speedToNextHit };
}

// ===== ユーティリティ関数 =====

/**
 * スキル名から重みを取得（キャッシュ対応）
 */
const weightCache = new Map<string, WeightResult[]>();

export function getWeightsForSkill(
  skillName: string,
  weaponType: string,
  params: WeightCalculationParams,
  useCache: boolean = true
): WeightResult[] {
  const cacheKey = `${skillName}_${weaponType}_${JSON.stringify(params)}`;

  if (useCache && weightCache.has(cacheKey)) {
    return weightCache.get(cacheKey)!;
  }

  const weights = calculateDynamicWeights(skillName, weaponType, params);

  if (useCache) {
    weightCache.set(cacheKey, weights);
  }

  return weights;
}

/**
 * キャッシュをクリア
 */
export function clearWeightCache(): void {
  weightCache.clear();
}

/**
 * 通常攻撃用の重みを取得
 */
export function getBasicAttackWeights(
  weaponType: string,
  params: WeightCalculationParams
): WeightResult[] {
  return calculateDynamicWeights('通常攻撃', weaponType, params);
}

/**
 * EX選択の推奨順位を取得
 */
export function getRecommendedEXOrder(
  skillName: string,
  weaponType: string,
  slotType: 'armor' | 'accessory',
  params: WeightCalculationParams
): string[] {
  const weights = getWeightsForSkill(skillName, weaponType, params);

  // EXで選択可能なステータス（定数から参照）
  const availableTypes = [...AVAILABLE_EX_TYPES];

  // ステータス → EXタイプ
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

  const prioritized: { exType: string; weight: number }[] = availableTypes.map(exType => {
    let totalWeight = 0;
    for (const w of weights) {
      if (statToEx[w.stat] === exType) {
        totalWeight += w.normalizedWeight;
      }
    }
    return { exType, weight: totalWeight };
  });

  prioritized.sort((a, b) => b.weight - a.weight);

  return prioritized.map(p => p.exType);
}

/**
 * 防具叩き配分の推奨を取得
 */
export function getRecommendedArmorSmithing(
  skillName: string,
  weaponType: string,
  maxCount: number,
  params: WeightCalculationParams
): Record<string, number> {
  const weights = getWeightsForSkill(skillName, weaponType, params);

  if (weights.length === 0) {
    return { Power: maxCount };
  }

  const distribution: Record<string, number> = {};
  let remaining = maxCount;

  const topStats = weights.slice(0, 3);

  for (let i = 0; i < topStats.length && remaining > 0; i++) {
    const stat = topStats[i];
    const allocation = i === topStats.length - 1
      ? remaining
      : Math.round(maxCount * stat.normalizedWeight);

    if (allocation > 0 && allocation <= remaining) {
      distribution[stat.stat] = allocation;
      remaining -= allocation;
    }
  }

  if (remaining > 0 && topStats.length > 0) {
    distribution[topStats[0].stat] = (distribution[topStats[0].stat] || 0) + remaining;
  }

  return distribution;
}

// ===== 典型的な重み（クイックリファレンス用） =====

/**
 * デフォルトのステータス値（初期値・フォールバック用）
 */
export const DEFAULT_STATS: Partial<Record<InternalStatKey, number>> = {
  Power: 300,
  Magic: 300,
  HP: 400,
  Mind: 200,
  Agility: 250,
  Dex: 150,
  CritDamage: 100,
  Defense: 150,
};

/**
 * 最適化中に動的に更新されるステータス
 * ベスト装備が更新されるたびに、その装備のステータスで上書きされる
 */
let currentOptimizationStats: Partial<Record<InternalStatKey, number>> | null = null;

/**
 * 最適化中のステータスを設定
 * @param stats 現在のベスト装備のステータス
 */
export function setCurrentOptimizationStats(stats: Partial<Record<InternalStatKey, number>>): void {
  currentOptimizationStats = { ...stats };
  // ステータスが変わったらキャッシュをクリア
  clearWeightCache();
}

/**
 * 最適化中のステータスをクリア（最適化終了時に呼び出す）
 */
export function clearCurrentOptimizationStats(): void {
  currentOptimizationStats = null;
}

/**
 * 現在の重み計算用ステータスを取得
 * 最適化中は動的ステータス、それ以外はDEFAULT_STATSを返す
 */
export function getCurrentStatsForWeightCalculation(): Partial<Record<InternalStatKey, number>> {
  return currentOptimizationStats || DEFAULT_STATS;
}

/**
 * デフォルトの武器パラメータ
 */
export const DEFAULT_WEAPON_PARAMS = {
  weaponAttackPower: 500,
  weaponCritDamage: 30,
  critRate: 80,
};

/**
 * 典型的な装備条件での静的重み（クイック参照用）
 */
export const TYPICAL_WEIGHTS: Record<string, Record<string, Record<InternalStatKey, number>>> = {
  'StellaShaft': {
    'シャイニングアロー': { Agility: 0.75, Power: 0.17, CritDamage: 0.08, HP: 0, Magic: 0, Mind: 0, Dex: 0, Defense: 0, CritRate: 0 },
    'シャイニングアロー2': { Agility: 0.75, Power: 0.17, CritDamage: 0.08, HP: 0, Magic: 0, Mind: 0, Dex: 0, Defense: 0, CritRate: 0 },
  },
  'Wizard': {
    'イグナイト・改': { CritDamage: 0.68, Magic: 0.32, HP: 0, Power: 0, Mind: 0, Agility: 0, Dex: 0, Defense: 0, CritRate: 0 },
    'イグナイト3': { CritDamage: 0.68, Magic: 0.32, HP: 0, Power: 0, Mind: 0, Agility: 0, Dex: 0, Defense: 0, CritRate: 0 },
  },
  'Hunter': {
    '疾風連撃': { Agility: 0.76, Power: 0.24, CritDamage: 0.00, HP: 0, Magic: 0, Mind: 0, Dex: 0, Defense: 0, CritRate: 0 },
    'サンライトスラッシュ': { Agility: 0.76, Power: 0.24, CritDamage: 0.00, HP: 0, Magic: 0, Mind: 0, Dex: 0, Defense: 0, CritRate: 0 },
  },
  'Warrior': {
    '通常攻撃_GreatSword': { HP: 0.66, Power: 0.34, CritDamage: 0.00, Magic: 0, Mind: 0, Agility: 0, Dex: 0, Defense: 0, CritRate: 0 },
    '通常攻撃_Axe': { Mind: 0.63, Power: 0.37, CritDamage: 0.00, HP: 0, Magic: 0, Agility: 0, Dex: 0, Defense: 0, CritRate: 0 },
  },
};

/**
 * 重みが変動する条件のサマリー
 */
export const WEIGHT_VARIATION_CONDITIONS = {
  common: [
    '装備のステータス値が高いほど、追加ステータスの相対的価値が変化',
    '武器会心ダメージが高いほど、CritDamageの効果が増大',
    '会心率が高いほど、CritDamageの期待値が増大',
  ],
  SpellRefactor: [
    '力と魔力の比率によってBonus倍率が変動（同値で最大1.75倍）',
    '片方だけ上げるより、両方バランスよく上げる方が効果的',
  ],
  Ranger: [
    'マリーナ・レーン: Speed/50ごとにヒット数+1（非線形）',
    'Speed=49→50で大幅にダメージ増加',
  ],
  StellaShaft: [
    'シャイニングアロー: Speed係数が13と非常に高い',
    '終盤装備では若干Power/CritDamageの重みが増す',
  ],
};
