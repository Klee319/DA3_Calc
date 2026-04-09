/**
 * スキル依存ステータス分析モジュール
 * スキル式を解析し、ダメージに影響するステータスを特定する
 */

import type { InternalStatKey } from '@/types/calc';
import type { WeaponCalcData, SkillCalcData } from '@/types/data';
import {
  calculateDynamicWeights,
  getWeightsForSkill,
  JOB_SKILL_MAPPING,
  DEFAULT_STATS,
  DEFAULT_WEAPON_PARAMS,
  type WeightCalculationParams,
  type WeightResult,
} from './statWeightMappingV2';
import { WEAPON_STAT_COEFFICIENTS, AVAILABLE_EX_TYPES, JOB_AVAILABLE_WEAPONS } from './optimize/constants';

// ===== 型定義 =====

/** 武器固有ステータス */
export type WeaponStatKey = 'attackPower' | 'critRate' | 'critDamage';

/** 依存ステータスセット */
export interface RelevantStats {
  /** 直接依存ステータス（式中の変数） */
  directStats: Set<InternalStatKey>;
  /** 間接依存ステータス（%ボーナス対象） */
  indirectStats: Set<InternalStatKey>;
  /** 武器固有ステータス */
  weaponStats: Set<WeaponStatKey>;
  /** BaseDamageに含まれる武器種 */
  baseDamageTypes: string[];
  /** スキル式から抽出された係数（EX選択時に使用） */
  statCoefficients?: Record<string, number>;
}

/** ステータス変数名とInternalStatKeyのマッピング */
const STAT_VAR_MAPPING: Record<string, InternalStatKey> = {
  'UserPower': 'Power',
  'UserMagic': 'Magic',
  'UserHP': 'HP',
  'UserMind': 'Mind',
  'UserSpeed': 'Agility',
  'UserAgility': 'Agility',
  'UserDex': 'Dex',
  'UserCritDamage': 'CritDamage',
  'UserDefense': 'Defense',
};

/**
 * スキルIDを正規化する
 * job_JobName_SkillName → SkillName
 * book_WeaponType_SkillName → SkillName
 *
 * @example
 * normalizeSkillId('book_Bow_ブラッドショット') // => 'ブラッドショット'
 * normalizeSkillId('job_StellaShaft_シャイニングアロー2') // => 'シャイニングアロー2'
 * normalizeSkillId('通常攻撃') // => '通常攻撃'
 */
export function normalizeSkillId(skillId: string): string {
  // 通常攻撃のID正規化
  if (skillId === 'normal_attack' || skillId === 'basic_attack') {
    return '通常攻撃';
  }

  const jobMatch = skillId.match(/^job_[A-Za-z]+_(.+)$/);
  if (jobMatch) return jobMatch[1];

  const bookMatch = skillId.match(/^book_[A-Za-z]+_(.+)$/);
  if (bookMatch) return bookMatch[1];

  return skillId;
}

/**
 * 職業バフによる間接依存ステータスと係数
 * 職業のパッシブバフがダメージに影響するため、これらも依存ステータスとして扱う
 * coefficient: EX選択時の相対的重要度（BaseDamage係数と同等のスケール）
 */
const JOB_BUFF_DEPENDENCIES: Record<string, { stat: InternalStatKey; coefficient: number }[]> = {
  // スペルリファクター: Bonus倍率が力と魔力の比率に依存
  // Bonus式: 1.75 - 0.475 * ln(max(Power, Magic) / min(Power, Magic)) * 2
  // 力と魔力の差が小さいほど高倍率になるため、両方が同等に重要
  // 係数1.5は、Bonus倍率の最大値(1.75)を反映
  'SpellRefactor': [{ stat: 'Magic', coefficient: 1.5 }, { stat: 'Power', coefficient: 1.5 }],
  'スペルリファクター': [{ stat: 'Magic', coefficient: 1.5 }, { stat: 'Power', coefficient: 1.5 }],
  // プリースト: 精神に応じたバフ
  'Priest': [{ stat: 'Mind', coefficient: 2.0 }],
  'プリースト': [{ stat: 'Mind', coefficient: 2.0 }],
  // ステラシャフト: 素早さに応じたバフ（スキルにも直接依存する場合が多い）
  'StellaShaft': [{ stat: 'Agility', coefficient: 2.5 }],
  'ステラシャフト': [{ stat: 'Agility', coefficient: 2.5 }],
  // ガーディアン: 守備力に応じたバフ
  'Guardian': [{ stat: 'Defense', coefficient: 2.0 }],
  'ガーディアン': [{ stat: 'Defense', coefficient: 2.0 }],
};

/** 武器種ごとのBaseDamage式に含まれるステータス
 * 注: Dexは会心率経由で影響する（会心率100%まで有効）
 *     評価関数で会心率100%超過分のDexにペナルティを適用
 */
const BASE_DAMAGE_STATS: Record<string, InternalStatKey[]> = {
  // (WeaponAttackPower+UserPower*1.6)*DamageCorrection*(1+(WeaponCritDamage/100)+UserCritDamage*0.005)
  'Sword': ['Power', 'CritDamage', 'Dex'],
  // (WeaponAttackPower + UserMagic*1.75) * DamageCorrection * (1 + WeaponCritDamage/100 + UserCritDamage*0.0016)
  'Wand': ['Magic', 'CritDamage', 'Dex'],
  // (WeaponAttackPower + UserPower*1.75) * DamageCorrection * (1 + WeaponCritDamage/100 + UserCritDamage*0.0016)
  'Bow': ['Power', 'CritDamage', 'Dex'],
  // (WeaponAttackPower + UserPower*1.5 + UserMind*2.5) * DamageCorrection * (1 + WeaponCritDamage/100 + UserCritDamage*0.001)
  'Axe': ['Power', 'Mind', 'CritDamage', 'Dex'],
  // (WeaponAttackPower + UserPower*1.6 + UserHP*3.1) * DamageCorrection * (1 + WeaponCritDamage/100 + UserCritDamage*0.001)
  'GreatSword': ['Power', 'HP', 'CritDamage', 'Dex'],
  // (WeaponAttackPower + UserPower*1.25 + UserAgility*3.5) * DamageCorrection * (1 + WeaponCritDamage/100 + UserCritDamage*0.0015)
  'Dagger': ['Power', 'Agility', 'CritDamage', 'Dex'],
  // ((((UserDex + WeaponCritRate + 100) * UserDefense * 8 / 300) + (UserPower / 200) + WeaponAttackPower) * DamageCorrection * (1 + (WeaponCritDamage/100 + UserCritDamage*0.001) / 3))
  'Spear': ['Dex', 'Defense', 'Power', 'CritDamage'],
  // round((WeaponAttackPower + UserPower*1.6) * DamageCorrection * ComboCorrection * (1 + WeaponCritDamage/100 + UserCritDamage*0.005)) / 2
  'Frypan': ['Power', 'CritDamage', 'Dex'],
};

/** 武器種ごとの武器固有ステータス依存 */
const BASE_DAMAGE_WEAPON_STATS: Record<string, WeaponStatKey[]> = {
  'Sword': ['attackPower', 'critDamage'],
  'Wand': ['attackPower', 'critDamage'],
  'Bow': ['attackPower', 'critDamage'],
  'Axe': ['attackPower', 'critDamage'],
  'GreatSword': ['attackPower', 'critDamage'],
  'Dagger': ['attackPower', 'critDamage'],
  'Spear': ['attackPower', 'critRate', 'critDamage'],  // 槍は会心率もダメージに影響
  'Frypan': ['attackPower', 'critDamage'],
};

// ===== ユーティリティ関数 =====

/**
 * 式から変数名を抽出
 */
function extractVariablesFromFormula(formula: string): string[] {
  if (!formula || typeof formula !== 'string') return [];

  // User変数を抽出（UserPower, UserMagic, etc.）
  const userVarPattern = /User[A-Za-z]+/g;
  const matches = formula.match(userVarPattern) || [];

  return Array.from(new Set(matches));
}

/**
 * 式からBaseDamage参照を抽出
 */
function extractBaseDamageRefs(formula: string): string[] {
  if (!formula || typeof formula !== 'string') return [];

  // BaseDamage.WeaponType を抽出
  const bdPattern = /BaseDamage\.([A-Za-z]+)/g;
  const refs: string[] = [];
  let match;

  while ((match = bdPattern.exec(formula)) !== null) {
    refs.push(match[1]);
  }

  return Array.from(new Set(refs));
}

/**
 * 式から変数とその係数を抽出
 * 例: "UserSpeed*40" -> { UserSpeed: 40 }
 * 例: "BaseDamage.Bow + UserSpeed*40" -> { UserSpeed: 40 }
 */
function extractVariableCoefficients(formula: string): Record<string, number> {
  if (!formula || typeof formula !== 'string') return {};

  const result: Record<string, number> = {};

  // User変数と係数のパターン
  // パターン1: UserXxx*数値 or UserXxx * 数値
  const pattern1 = /User([A-Za-z]+)\s*\*\s*(\d+(?:\.\d+)?)/g;
  // パターン2: 数値*UserXxx or 数値 * UserXxx
  const pattern2 = /(\d+(?:\.\d+)?)\s*\*\s*User([A-Za-z]+)/g;

  let match;
  while ((match = pattern1.exec(formula)) !== null) {
    const varName = 'User' + match[1];
    const coeff = parseFloat(match[2]);
    result[varName] = Math.max(result[varName] || 0, coeff);
  }

  while ((match = pattern2.exec(formula)) !== null) {
    const varName = 'User' + match[2];
    const coeff = parseFloat(match[1]);
    result[varName] = Math.max(result[varName] || 0, coeff);
  }

  return result;
}

/**
 * 変数名をInternalStatKeyに変換
 */
function varToStatKey(varName: string): InternalStatKey | null {
  return STAT_VAR_MAPPING[varName] || null;
}

// ===== メイン分析関数 =====

/**
 * スキルの依存ステータスを分析
 * @param skillId スキルID（スキル名）
 * @param skillCalc スキル計算データ
 * @param weaponCalc 武器ダメージ計算データ（オプション）
 * @param jobName 職業名（職業バフ依存を考慮する場合に指定）
 * @returns 依存ステータスセット
 */
export function analyzeSkillDependencies(
  skillId: string,
  skillCalc: SkillCalcData | undefined,
  weaponCalc?: WeaponCalcData,
  jobName?: string
): RelevantStats {
  const result: RelevantStats = {
    directStats: new Set<InternalStatKey>(),
    indirectStats: new Set<InternalStatKey>(),
    weaponStats: new Set<WeaponStatKey>(),
    baseDamageTypes: [],
    statCoefficients: {},
  };

  // 職業バフ依存を追加（職業名が指定されている場合）
  if (jobName) {
    const buffDeps = JOB_BUFF_DEPENDENCIES[jobName];
    if (buffDeps) {
      for (const { stat, coefficient } of buffDeps) {
        result.indirectStats.add(stat);
        // 職業バフは直接ダメージに影響するので、directStatsにも追加
        result.directStats.add(stat);
        // 職業バフの係数も追加（EX選択時に使用）
        result.statCoefficients![stat] = Math.max(
          result.statCoefficients![stat] || 0,
          coefficient
        );
      }
    }
  }

  if (!skillCalc) {
    // データがない場合はデフォルト（全ステータスを考慮）
    result.directStats.add('Power');
    result.directStats.add('Magic');
    result.directStats.add('CritDamage');
    result.weaponStats.add('attackPower');
    result.weaponStats.add('critDamage');
    return result;
  }

  // 通常攻撃の特殊処理
  if (skillId === 'basic_attack' || skillId === 'normal_attack' || skillId === '通常攻撃') {
    // 通常攻撃は武器種に応じた基本ステータスのみ（デフォルトはSword）
    result.directStats.add('Power');
    result.directStats.add('CritDamage');
    result.weaponStats.add('attackPower');
    result.weaponStats.add('critDamage');
    result.baseDamageTypes = ['Sword'];
    return result;
  }

  // skillIdの正規化:
  // - job_JobName_SkillName 形式から SkillName を抽出
  //   例: job_SpellRefactor_ウィンドバースト・改 → ウィンドバースト・改
  // - book_WeaponType_SkillName 形式から SkillName を抽出
  //   例: book_Bow_ブラッドショット → ブラッドショット
  let normalizedSkillId = skillId;
  const jobSkillMatch = skillId.match(/^job_[A-Za-z]+_(.+)$/);
  const bookSkillMatch = skillId.match(/^book_[A-Za-z]+_(.+)$/);
  if (jobSkillMatch) {
    normalizedSkillId = jobSkillMatch[1];
  } else if (bookSkillMatch) {
    normalizedSkillId = bookSkillMatch[1];
  }

  // スキルデータを検索（SkillDefinition構造に対応）
  let skillData: any = null;
  const skillDef = (skillCalc as any).SkillDefinition;

  if (skillDef) {
    // SkillBook内を検索
    if (skillDef.SkillBook) {
      for (const weaponType of Object.keys(skillDef.SkillBook)) {
        const weaponSkills = skillDef.SkillBook[weaponType];
        if (weaponSkills && normalizedSkillId in weaponSkills) {
          skillData = weaponSkills[normalizedSkillId];
          break;
        }
      }
    }

    // JobSkill内を検索
    if (!skillData && skillDef.JobSkill) {
      for (const jobName of Object.keys(skillDef.JobSkill)) {
        const jobSkills = skillDef.JobSkill[jobName];
        if (jobSkills && normalizedSkillId in jobSkills) {
          skillData = jobSkills[normalizedSkillId];
          break;
        }
      }
    }
  }

  // フォールバック: 旧形式（トップレベルに職業名がある場合）
  if (!skillData) {
    const jobNames = Object.keys(skillCalc).filter(k => k !== 'SkillDefinition');
    for (const jobName of jobNames) {
      const jobSkills = (skillCalc as Record<string, any>)[jobName];
      if (jobSkills && typeof jobSkills === 'object' && normalizedSkillId in jobSkills) {
        skillData = jobSkills[normalizedSkillId];
        break;
      }
    }
  }

  if (!skillData) {
    // スキルが見つからない場合はデフォルト
    result.directStats.add('Power');
    result.directStats.add('Magic');
    result.directStats.add('CritDamage');
    result.weaponStats.add('attackPower');
    result.weaponStats.add('critDamage');
    return result;
  }

  // BaseDamageTypeを取得
  const baseDamageTypes: string[] = skillData.BaseDamageType || [];
  result.baseDamageTypes = baseDamageTypes;

  // Damage式を解析
  const damageFormula: string = skillData.Damage || '';

  // 1. Damage式から直接変数を抽出
  const directVars = extractVariablesFromFormula(damageFormula);

  for (const varName of directVars) {
    const statKey = varToStatKey(varName);
    if (statKey) {
      result.directStats.add(statKey);
    }
  }

  // 1.5. Damage式から係数を抽出（EX選択の優先度決定に使用）
  const varCoefficients = extractVariableCoefficients(damageFormula);

  for (const [varName, coeff] of Object.entries(varCoefficients)) {
    const statKey = varToStatKey(varName);
    if (statKey) {
      // スキル式の係数（スキル倍率を考慮して正規化）
      // 例: UserSpeed*40 でスキル倍率4.05だと 40*4.05 = 162
      result.statCoefficients![statKey] = Math.max(
        result.statCoefficients![statKey] || 0,
        coeff
      );
    }
  }

  // 2. BaseDamage参照を展開
  const bdRefs = extractBaseDamageRefs(damageFormula);
  for (const weaponType of bdRefs) {
    // BaseDamageに含まれるステータスを追加
    const stats = BASE_DAMAGE_STATS[weaponType];
    if (stats) {
      for (const stat of stats) {
        result.directStats.add(stat);
      }
    }
    // 武器固有ステータスを追加
    const weaponStats = BASE_DAMAGE_WEAPON_STATS[weaponType];
    if (weaponStats) {
      for (const wstat of weaponStats) {
        result.weaponStats.add(wstat);
      }
    }
  }

  // 3. BaseDamageTypeから武器種を取得（式に明示的にない場合）
  for (const weaponType of baseDamageTypes) {
    const stats = BASE_DAMAGE_STATS[weaponType];
    if (stats) {
      for (const stat of stats) {
        result.directStats.add(stat);
      }
    }
    const weaponStats = BASE_DAMAGE_WEAPON_STATS[weaponType];
    if (weaponStats) {
      for (const wstat of weaponStats) {
        result.weaponStats.add(wstat);
      }
    }
  }

  // 4. Heal式がある場合も解析
  const healFormula: string = skillData.Heal || '';
  if (healFormula) {
    const healVars = extractVariablesFromFormula(healFormula);
    for (const varName of healVars) {
      const statKey = varToStatKey(varName);
      if (statKey) {
        result.directStats.add(statKey);
      }
    }
    const healBdRefs = extractBaseDamageRefs(healFormula);
    for (const weaponType of healBdRefs) {
      const stats = BASE_DAMAGE_STATS[weaponType];
      if (stats) {
        for (const stat of stats) {
          result.directStats.add(stat);
        }
      }
    }
  }

  // 5. 間接依存（%ボーナス適用対象）は直接依存と同じ
  // 職業や紋章の%ボーナスは基礎値に適用されるため
  Array.from(result.directStats).forEach(stat => {
    result.indirectStats.add(stat);
  });

  // 6. 最低限、武器攻撃力は常に依存
  result.weaponStats.add('attackPower');

  // 7. ダメージ計算ではCritDamage（撃力）も常に依存
  // クリティカルダメージ倍率として間接的にダメージに影響するため
  if (damageFormula) {
    result.directStats.add('CritDamage');
    result.weaponStats.add('critDamage');
  }

  return result;
}

/**
 * 依存ステータスに基づいてEXタイプの優先度を決定
 * @param relevantStats 依存ステータス
 * @param slotType 装備タイプ（armor/accessory）
 * @returns 優先度順のEXタイプリスト
 */
export function prioritizeEXTypes(
  relevantStats: RelevantStats,
  slotType: 'armor' | 'accessory'
): string[] {
  // EXで選択可能なステータス（定数から参照）
  const availableTypes = [...AVAILABLE_EX_TYPES];

  // 依存ステータスに含まれるものを優先
  const prioritized: string[] = [];
  const remaining: string[] = [];

  // InternalStatKey → EXタイプ名のマッピング
  const statToEx: Partial<Record<InternalStatKey, string>> = {
    'Power': 'Power',
    'Magic': 'Magic',
    'HP': 'HP',
    'Mind': 'Mind',
    'Agility': 'Speed',
    'Dex': 'Dex',
    'CritDamage': 'CritDamage',
    'Defense': 'Defense',
  };

  for (let i = 0; i < availableTypes.length; i++) {
    const exType = availableTypes[i];
    // 直接依存に含まれるか確認
    let isRelevant = false;
    const directStatsArray = Array.from(relevantStats.directStats);
    for (let j = 0; j < directStatsArray.length; j++) {
      const stat = directStatsArray[j];
      if (statToEx[stat] === exType) {
        isRelevant = true;
        break;
      }
    }

    if (isRelevant) {
      prioritized.push(exType);
    } else {
      remaining.push(exType);
    }
  }

  return [...prioritized, ...remaining];
}

/** EX組み合わせ型 */
export interface EXCombination {
  ex1: string;
  ex2: string;
}

// 武器係数は定数ファイルから参照（Source: WeaponCalc.yaml）
// ローカルエイリアス（後方互換性のため）
const STAT_COEFFICIENTS = WEAPON_STAT_COEFFICIENTS;

/** EXタイプのデフォルト値（ランクSSS時の参考値） */
const DEFAULT_EX_VALUES: Record<string, number> = {
  Power: 150,
  Magic: 150,
  HP: 150,
  Mind: 150,
  Agility: 75,   // Speedと同じ
  Speed: 75,
  Dex: 75,
  CritDamage: 75,
  Defense: 75,
};

/**
 * EX組み合わせを全列挙（同一選択も含む）
 * @param slotType 装備タイプ（armor/accessory）
 * @returns 全EX組み合わせのリスト
 */
export function generateAllEXCombinations(slotType: 'armor' | 'accessory'): EXCombination[] {
  // EXで選択可能なステータス（定数から参照）
  const availableTypes = [...AVAILABLE_EX_TYPES];

  const combinations: EXCombination[] = [];

  // 全組み合わせを生成（同一選択も含む）
  for (let i = 0; i < availableTypes.length; i++) {
    for (let j = i; j < availableTypes.length; j++) {
      // ex1とex2の順序は関係ないので、i <= jのみ生成
      combinations.push({ ex1: availableTypes[i], ex2: availableTypes[j] });
      // 異なる組み合わせの場合は逆順も追加（ex1とex2を入れ替え）
      // ただし、実際のEX計算では順序は影響しないため、片方のみで十分
    }
  }

  return combinations;
}

/**
 * EX組み合わせのダメージ貢献度を計算
 * @param combination EX組み合わせ
 * @param relevantStats 依存ステータス
 * @param exValues 各EXタイプの実際の値（装備固有）
 * @param critRate 会心率（0-100）。CritDamage EXの価値は会心率に比例する
 * @returns 貢献度スコア
 */
export function evaluateEXCombinationScore(
  combination: EXCombination,
  relevantStats: RelevantStats,
  exValues?: Record<string, number>,
  critRate: number = 50  // デフォルト50%（武器が未確定の場合の想定値）
): number {
  const values = exValues || DEFAULT_EX_VALUES;

  // EXタイプ → InternalStatKeyのマッピング
  const exToStatKey: Record<string, string> = {
    'Power': 'Power',
    'Magic': 'Magic',
    'HP': 'HP',
    'Mind': 'Mind',
    'Speed': 'Agility',
    'Dex': 'Dex',
    'CritDamage': 'CritDamage',
    'Defense': 'Defense',
  };

  // 武器種ごとの係数を取得（複数武器種対応の場合は平均）
  let coefficients: Record<string, number> = {};
  if (relevantStats.baseDamageTypes.length > 0) {
    for (const weaponType of relevantStats.baseDamageTypes) {
      const weaponCoeffs = STAT_COEFFICIENTS[weaponType];
      if (weaponCoeffs) {
        for (const [stat, coeff] of Object.entries(weaponCoeffs)) {
          coefficients[stat] = Math.max(coefficients[stat] || 0, coeff);
        }
      }
    }
  } else {
    // デフォルト係数（Sword基準）
    coefficients = { Power: 1.6, CritDamage: 1.2 };
  }

  // スキル式から抽出された係数を追加
  // ただし、武器依存ステータス（Power/Magic）は武器係数を優先
  // これにより剣=力依存、杖=魔力依存が正しく反映される
  if (relevantStats.statCoefficients) {
    for (const [stat, coeff] of Object.entries(relevantStats.statCoefficients)) {
      // 武器依存ステータス（Power/Magic）は武器係数が既に設定されていれば上書きしない
      // Note: 0も有効な値（そのステータスを使わない意味）なので、undefinedでのみ上書き
      if ((stat === 'Power' || stat === 'Magic') && stat in coefficients) {
        continue;  // 武器係数を優先（0も含む）
      }
      // スキル係数はBaseDamage係数より大きい場合が多い（例: 40 vs 1.75）
      // 正規化のため、係数を10で割って比較可能にする
      const normalizedCoeff = coeff > 10 ? coeff / 10 : coeff;
      coefficients[stat] = Math.max(coefficients[stat] || 0, normalizedCoeff);
    }
  }

  // CritDamageの係数を会心率でスケーリング
  // 期待値計算: damage * (1 + critDamage * critRate / 10000)
  // CritDamageの価値は会心率に比例するため、係数を調整
  if (coefficients['CritDamage']) {
    coefficients['CritDamage'] *= (critRate / 100);
  }

  // スコア計算
  let score = 0;

  // EX1の貢献
  const stat1 = exToStatKey[combination.ex1];
  if (stat1 && relevantStats.directStats.has(stat1 as any)) {
    const value1 = values[combination.ex1] || 0;
    // Note: coefficients[stat]が0の場合は「使わない」意味なのでスコア0
    // undefinedの場合のみデフォルト1を使用
    const coeff1 = stat1 in coefficients ? coefficients[stat1] : 1;
    score += value1 * coeff1;
  } else if (stat1) {
    // 関連ステータスでなくても少しの価値はある
    const value1 = values[combination.ex1] || 0;
    score += value1 * 0.1;
  }

  // EX2の貢献
  const stat2 = exToStatKey[combination.ex2];
  if (stat2 && relevantStats.directStats.has(stat2 as any)) {
    const value2 = values[combination.ex2] || 0;
    const coeff2 = stat2 in coefficients ? coefficients[stat2] : 1;
    score += value2 * coeff2;
  } else if (stat2) {
    const value2 = values[combination.ex2] || 0;
    score += value2 * 0.1;
  }

  return score;
}

/**
 * 最適なEX選択を決定（全組み合わせ評価版）
 * @param relevantStats 依存ステータス
 * @param slotType 装備タイプ
 * @param exValues 各EXタイプの実際の値（装備固有、オプション）
 * @param critRate 会心率（0-100）
 * @returns EX1とEX2の選択
 */
export function selectOptimalEX(
  relevantStats: RelevantStats,
  slotType: 'armor' | 'accessory',
  exValues?: Record<string, number>,
  critRate: number = 50
): { ex1: string; ex2: string } {
  // 全組み合わせを生成
  const combinations = generateAllEXCombinations(slotType);

  // 各組み合わせのスコアを計算
  let bestCombination = combinations[0];
  let bestScore = -Infinity;

  for (const combination of combinations) {
    const score = evaluateEXCombinationScore(combination, relevantStats, exValues, critRate);
    if (score > bestScore) {
      bestScore = score;
      bestCombination = combination;
    }
  }

  return bestCombination;
}

/**
 * 上位N個のEX組み合わせを取得（デバッグ/比較用）
 * @param relevantStats 依存ステータス
 * @param slotType 装備タイプ
 * @param topN 取得する数
 * @param critRate 会心率（0-100）
 * @returns 上位N個の組み合わせとスコア
 */
export function getTopEXCombinations(
  relevantStats: RelevantStats,
  slotType: 'armor' | 'accessory',
  topN: number = 5,
  critRate: number = 50
): Array<{ combination: EXCombination; score: number }> {
  const combinations = generateAllEXCombinations(slotType);

  const scored = combinations.map(combination => ({
    combination,
    score: evaluateEXCombinationScore(combination, relevantStats, undefined, critRate),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topN);
}

/**
 * 多様なEXパターンを生成（装備全体でバリエーションを持たせるため）
 * 依存ステータスの全組み合わせを優先的に含め、V2重みを正しく反映する
 * @param relevantStats 依存ステータス
 * @param slotType 装備タイプ
 * @param critRate 会心率（0-100）
 * @returns 多様なEXパターンのリスト
 */
export function getDiverseEXCombinations(
  relevantStats: RelevantStats,
  slotType: 'armor' | 'accessory',
  critRate: number = 50
): Array<{ combination: EXCombination; score: number }> {
  const allCombinations = generateAllEXCombinations(slotType);

  // InternalStatKey → EXタイプのマッピング
  const statToEXType: Record<string, string> = {
    'Power': 'Power',
    'Magic': 'Magic',
    'HP': 'HP',
    'Mind': 'Mind',
    'Agility': 'Speed',  // InternalStatKeyはAgility, EXはSpeed
    'Dex': 'Dex',
    'CritDamage': 'CritDamage',
    'Defense': 'Defense',
  };

  // 依存ステータスをEXタイプに変換
  // 会心率100%以上の場合、Dex EXは無意味なので除外
  const relevantEXTypes: string[] = [];
  const directStatsArray = Array.from(relevantStats.directStats);
  for (const stat of directStatsArray) {
    // 会心率100%以上ならDexは除外（会心率キャップ済みで追加効果なし）
    if (stat === 'Dex' && critRate >= 100) {
      continue;
    }
    const exType = statToEXType[stat];
    if (exType) {
      relevantEXTypes.push(exType);
    }
  }

  // 依存ステータス間の全組み合わせを生成（重複込み: AA, AB, AC, BB, BC, CC）
  const relevantCombinations: EXCombination[] = [];
  for (let i = 0; i < relevantEXTypes.length; i++) {
    for (let j = i; j < relevantEXTypes.length; j++) {
      relevantCombinations.push({
        ex1: relevantEXTypes[i],
        ex2: relevantEXTypes[j],
      });
    }
  }

  // 依存ステータス組み合わせをスコア付きで評価
  const result: Array<{ combination: EXCombination; score: number }> = [];
  const usedPatterns = new Set<string>();

  // まず依存ステータスの組み合わせを全て追加
  for (const combination of relevantCombinations) {
    const score = evaluateEXCombinationScore(combination, relevantStats, undefined, critRate);
    const key1 = `${combination.ex1}-${combination.ex2}`;
    const key2 = `${combination.ex2}-${combination.ex1}`;

    if (!usedPatterns.has(key1) && !usedPatterns.has(key2)) {
      result.push({ combination, score });
      usedPatterns.add(key1);
      usedPatterns.add(key2);
    }
  }

  // 依存ステータス組み合わせが少ない場合、追加でスコア上位を含める
  if (result.length < 4) {
    const scored = allCombinations.map(combination => ({
      combination,
      score: evaluateEXCombinationScore(combination, relevantStats, undefined, critRate),
    }));
    scored.sort((a, b) => b.score - a.score);

    for (const s of scored) {
      if (result.length >= 6) break;  // 最大6パターン
      const key1 = `${s.combination.ex1}-${s.combination.ex2}`;
      const key2 = `${s.combination.ex2}-${s.combination.ex1}`;
      if (!usedPatterns.has(key1) && !usedPatterns.has(key2)) {
        result.push(s);
        usedPatterns.add(key1);
        usedPatterns.add(key2);
      }
    }
  }

  // スコア順でソート
  result.sort((a, b) => b.score - a.score);

  return result;
}

/**
 * 装備のステータスが関連ステータスに貢献するか判定
 * @param equipStats 装備のステータス
 * @param relevantStats 依存ステータス
 * @returns 貢献度スコア
 */
export function calculateRelevanceScore(
  equipStats: Record<string, number>,
  relevantStats: RelevantStats
): number {
  let score = 0;

  // InternalStatKey → equipStats のキーマッピング
  const statKeyMapping: Partial<Record<InternalStatKey, string>> = {
    'Power': 'Power',
    'Magic': 'Magic',
    'HP': 'HP',
    'Mind': 'Mind',
    'Agility': 'Agility',
    'Dex': 'Dex',
    'CritDamage': 'CritDamage',
    'Defense': 'Defense',
  };

  const directStatsArray = Array.from(relevantStats.directStats);
  for (let i = 0; i < directStatsArray.length; i++) {
    const stat = directStatsArray[i];
    const key = statKeyMapping[stat];
    if (key && equipStats[key]) {
      score += equipStats[key];
    }
  }

  // 武器固有ステータスも加算
  if (relevantStats.weaponStats.has('attackPower') && equipStats['WeaponAttackPower']) {
    score += equipStats['WeaponAttackPower'];
  }
  if (relevantStats.weaponStats.has('critRate') && equipStats['CritRate']) {
    score += equipStats['CritRate'] * 10;  // 会心率は重みづけ
  }
  if (relevantStats.weaponStats.has('critDamage') && equipStats['CritDamage']) {
    score += equipStats['CritDamage'];
  }

  return score;
}

/**
 * 支配関係（Dominance）による候補フィルタリング
 * 関連ステータスにおいて完全に劣る候補を除外
 * @param candidates 候補装備リスト
 * @param relevantStats 依存ステータス
 * @param getStats ステータス取得関数
 * @returns フィルタリング後の候補
 */
export function pruneByDominance<T>(
  candidates: T[],
  relevantStats: RelevantStats,
  getStats: (candidate: T) => Record<string, number>
): T[] {
  if (candidates.length <= 1) return candidates;

  const dominated = new Set<number>();

  // 全ペアで比較
  for (let i = 0; i < candidates.length; i++) {
    if (dominated.has(i)) continue;

    const statsI = getStats(candidates[i]);

    for (let j = i + 1; j < candidates.length; j++) {
      if (dominated.has(j)) continue;

      const statsJ = getStats(candidates[j]);

      // i が j を支配するか確認
      const iDominatesJ = isDominating(statsI, statsJ, relevantStats);
      // j が i を支配するか確認
      const jDominatesI = isDominating(statsJ, statsI, relevantStats);

      if (iDominatesJ && !jDominatesI) {
        dominated.add(j);
      } else if (jDominatesI && !iDominatesJ) {
        dominated.add(i);
      }
    }
  }

  return candidates.filter((_, idx) => !dominated.has(idx));
}

/**
 * stats1 が stats2 を支配するか判定
 * 全ての関連ステータスで stats1 >= stats2 かつ少なくとも1つで >
 */
function isDominating(
  stats1: Record<string, number>,
  stats2: Record<string, number>,
  relevantStats: RelevantStats
): boolean {
  let allGreaterOrEqual = true;
  let atLeastOneGreater = false;

  // 直接依存ステータスを比較
  const directStatsArray = Array.from(relevantStats.directStats);
  for (let i = 0; i < directStatsArray.length; i++) {
    const stat = directStatsArray[i];
    const v1 = stats1[stat] || 0;
    const v2 = stats2[stat] || 0;

    if (v1 < v2) {
      allGreaterOrEqual = false;
      break;
    }
    if (v1 > v2) {
      atLeastOneGreater = true;
    }
  }

  if (!allGreaterOrEqual) return false;

  // 武器固有ステータスも比較
  const weaponStatMapping: Record<WeaponStatKey, string> = {
    'attackPower': 'WeaponAttackPower',
    'critRate': 'CritRate',
    'critDamage': 'CritDamage',
  };

  const weaponStatsArray = Array.from(relevantStats.weaponStats);
  for (let i = 0; i < weaponStatsArray.length; i++) {
    const wstat = weaponStatsArray[i];
    const key = weaponStatMapping[wstat];
    const v1 = stats1[key] || 0;
    const v2 = stats2[key] || 0;

    if (v1 < v2) {
      allGreaterOrEqual = false;
      break;
    }
    if (v1 > v2) {
      atLeastOneGreater = true;
    }
  }

  return allGreaterOrEqual && atLeastOneGreater;
}

/**
 * デバッグ用：依存ステータスを文字列で表示
 */
export function formatRelevantStats(relevantStats: RelevantStats): string {
  const direct = Array.from(relevantStats.directStats).join(', ');
  const indirect = Array.from(relevantStats.indirectStats).join(', ');
  const weapon = Array.from(relevantStats.weaponStats).join(', ');
  const bdTypes = relevantStats.baseDamageTypes.join(', ');

  return `Direct: [${direct}] | Indirect: [${indirect}] | Weapon: [${weapon}] | BaseDamageTypes: [${bdTypes}]`;
}

// ===== V2統合 =====

/**
 * V2の動的重み計算を使用してRelevantStatsを生成
 * より正確な感度分析に基づいた重みを使用
 *
 * @param skillId スキルID
 * @param weaponType 武器種（例: 'Bow', 'Wand'）
 * @param params 計算パラメータ（省略時はデフォルト値を使用）
 * @returns RelevantStats（V2の重みから変換）
 */
export function analyzeSkillDependenciesV2(
  skillId: string,
  weaponType: string,
  params?: Partial<WeightCalculationParams>
): RelevantStats {
  // skillIdからスキル名を抽出（共通関数を使用）
  const normalized = normalizeSkillId(skillId);

  // 完全なパラメータを構築
  const fullParams: WeightCalculationParams = {
    currentStats: params?.currentStats || DEFAULT_STATS,
    weaponAttackPower: params?.weaponAttackPower ?? DEFAULT_WEAPON_PARAMS.weaponAttackPower,
    weaponCritDamage: params?.weaponCritDamage ?? DEFAULT_WEAPON_PARAMS.weaponCritDamage,
    critRate: params?.critRate ?? DEFAULT_WEAPON_PARAMS.critRate,
    jobName: params?.jobName,
  };

  // V2で動的重みを計算
  const weights = getWeightsForSkill(normalized, weaponType, fullParams);

  // RelevantStats形式に変換
  const result: RelevantStats = {
    directStats: new Set<InternalStatKey>(),
    indirectStats: new Set<InternalStatKey>(),
    weaponStats: new Set<WeaponStatKey>(),
    baseDamageTypes: [weaponType],
    statCoefficients: {},
  };

  // 武器固有ステータスを設定
  result.weaponStats.add('attackPower');
  result.weaponStats.add('critDamage');
  if (weaponType === 'Spear') {
    result.weaponStats.add('critRate');
  }

  // V2の重みをRelevantStatsに変換
  // Note: 武器係数0のフィルタリングはここではしない
  // - EXスコアリングはevaluateEXCombinationScoreでWEAPON_STAT_COEFFICIENTSを使用
  // - 装備選択（Pareto/叩き）はバランスボーナス、minimumStats、スキル依存を考慮すべき
  for (const weight of weights) {
    if (weight.normalizedWeight > 0.01) {  // 1%以上の重みを持つステータスのみ
      result.directStats.add(weight.stat);
      // 正規化重みを係数として保存（10倍してBaseDamage係数と同等のスケールに）
      result.statCoefficients![weight.stat] = weight.normalizedWeight * 10;
    }
  }

  // 間接依存ステータスを設定（紋章%ボーナス対象）
  const percentBonusStats: InternalStatKey[] = ['Power', 'Magic', 'HP', 'Mind', 'Agility', 'Dex', 'CritDamage', 'Defense'];
  for (const stat of percentBonusStats) {
    if (result.directStats.has(stat)) {
      result.indirectStats.add(stat);
    }
  }

  return result;
}

/**
 * V2の重みを使用して最適なEXを選択
 *
 * @param skillId スキルID
 * @param weaponType 武器種
 * @param slotType 装備タイプ（armor/accessory）
 * @param params 計算パラメータ
 * @returns 最適なEX組み合わせ
 */
export function selectOptimalEXV2(
  skillId: string,
  weaponType: string,
  slotType: 'armor' | 'accessory',
  params?: Partial<WeightCalculationParams>
): EXCombination {
  const relevantStats = analyzeSkillDependenciesV2(skillId, weaponType, params);
  return selectOptimalEX(relevantStats, slotType, undefined, params?.critRate);
}

/**
 * V2のEXスコア計算（感度分析ベース）
 */
export function evaluateEXCombinationScoreV2(
  combination: EXCombination,
  skillId: string,
  weaponType: string,
  params?: Partial<WeightCalculationParams>
): number {
  const relevantStats = analyzeSkillDependenciesV2(skillId, weaponType, params);
  return evaluateEXCombinationScore(
    combination,
    relevantStats,
    undefined,
    params?.critRate ?? DEFAULT_WEAPON_PARAMS.critRate
  );
}

/**
 * 職業のメインスキルを取得
 */
export function getJobMainSkills(jobName: string): string[] {
  const mapping = JOB_SKILL_MAPPING[jobName];
  return mapping?.skills || [];
}

/**
 * 職業の使用可能武器を取得
 * Source: JOB_AVAILABLE_WEAPONS (JobConst.yamlと同期)
 */
export function getJobWeapons(jobName: string): string[] {
  return JOB_AVAILABLE_WEAPONS[jobName] || [];
}

/**
 * V2重みを人間が読みやすい形式で出力
 */
export function formatWeightsV2(weights: WeightResult[]): string {
  return weights
    .map(w => `${w.stat}: ${(w.normalizedWeight * 100).toFixed(1)}%`)
    .join(', ');
}
