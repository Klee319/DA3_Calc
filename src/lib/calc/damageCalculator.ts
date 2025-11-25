import * as mathjs from 'mathjs';
import {
  CalcResult,
  CalcError,
  DamageCalcInput,
  DamageResult,
  EnemyParams,
  DamageCalcOptions,
  WeaponType,
  StatBlock
} from '@/types/calc';
import {
  WeaponCalcData,
  SkillCalcData
} from '@/types/data';
import { loadWeaponCalc, loadSkillCalc } from '@/lib/data/yamlLoader';
import { mapUserStatsToVariables } from './placeholderMapping';
import { round, roundUp, roundDown, roundByType, roundMultiHitDamage } from '../calc/utils/mathUtils';

/**
 * 追撃（追加攻撃）の定義
 */
export interface AdditionalAttackDefinition {
  /** 追撃の種類 */
  type: 'percentage' | 'mp-based' | 'resistance-based' | 'speed-based';
  /** 倍率（%表記なので、22%は0.22） */
  multiplier: number;
  /** 基本回数 */
  baseCount?: number;
  /** 追撃計算式（高度な計算が必要な場合） */
  formula?: string;
  /** 防御貫通フラグ */
  ignoreDefense?: boolean;
  /** PvP時の回数変更 */
  pvpCount?: number;
}

/**
 * ダメージ計算のメイン関数
 * 基礎ダメージ → 職業補正 → 会心 → スキル倍率 → 最終ダメージの順で計算
 */
export function calculateDamage(
  input: DamageCalcInput,
  weaponCalc: WeaponCalcData,
  skillCalc?: SkillCalcData
): CalcResult<DamageResult> {
  try {
    // ダメージ補正の実際の値を計算
    const actualDamageCorrection = input.options.damageCorrectionMode === 'min' ? 0.8
                                : input.options.damageCorrectionMode === 'max' ? 1.2
                                : 1.0; // avg

    // 基礎ダメージ計算（職業補正による計算式上書きも考慮）
    const baseDamage = calculateBaseDamage(
      input.weaponType,
      input.weaponAttackPower,
      input.weaponCritRate,
      input.weaponCritDamage,
      input.damageCorrection,
      input.userStats.final,
      weaponCalc,
      input.options.damageCorrectionMode,
      input.jobName
    );

    // 職業補正（武器種指定の場合は基礎ダメージ計算で既に適用済み）
    // ここではBonusパターンのみ処理される
    let correctedDamage = baseDamage;
    if (input.jobName) {
      correctedDamage = applyJobCorrection(
        baseDamage,
        input.jobName,
        input.weaponType,
        input.userStats.final,
        weaponCalc
      );
    }

    // 会心ダメージの適用
    const critModeMap: Record<string, 'crit' | 'nocrit' | 'avg'> = {
      'always': 'crit',
      'never': 'nocrit',
      'expected': 'avg'
    };
    const critMode = critModeMap[input.options.critMode] || 'avg';
    
    const critResult = applyCritDamage(
      correctedDamage,
      input.weaponCritRate,
      input.weaponCritDamage,
      critMode
    );

    // スキルダメージ計算（スキルが指定されている場合）
    let skillMultiplier = 1;
    let hits = 1;
    let mp = 0;
    let ct = 0;

    if (input.options.skillName && skillCalc) {
      const skillResult = calculateSkillDamage(
        input.options.skillName,
        critResult, // critResultは数値
        input.userStats.final,
        input.weaponType,
        skillCalc,
        weaponCalc,
        {
          weaponAttackPower: input.weaponAttackPower,
          weaponCritRate: input.weaponCritRate,
          weaponCritDamage: input.weaponCritDamage,
          damageCorrection: actualDamageCorrection
        }
      );
      
      if (skillResult.success && skillResult.data) {
        skillMultiplier = skillResult.data.damage / critResult;
        hits = skillResult.data.hits;
        mp = skillResult.data.mp;
        ct = skillResult.data.ct;
      }
    }

    // 1ヒットダメージ
    const hitDamage = critResult * skillMultiplier;

    // 総ダメージ（多段ヒット考慮）
    const totalDamage = hitDamage * hits;

    // 追撃ダメージを計算
    // 武器名はinputに含まれないため、オプションとして追加する必要があるが、
    // 現時点では武器名が指定できる仕組みがないため、追撃を適用する場合は
    // 別途武器名を指定する必要がある
    let additionalDamage = 0;
    const weaponName = input.weaponName || ''; // inputに weaponName プロパティを追加予定

    if (weaponName) {
      // userStatsに必要なプロパティを渡す
      const additionalStats = {
        speed: (input.userStats.final as any).speed || (input.userStats.final as any).AGI || 0,
        mp: (input.userStats.final as any).mp || (input.userStats.final as any).MP || 0,
        waterResistance: (input.userStats.final as any).waterResistance || 0,
      };

      // 追撃の基準は「基礎ダメージ」（会心/スキル適用前）とする
      additionalDamage = calculateAdditionalAttacks(
        correctedDamage, // 職業補正適用後のダメージ
        weaponName,
        additionalStats,
        false // PvPモードは現時点でfalse固定
      );
    }

    // 最終ダメージ（敵防御・耐性適用）
    const finalDamageWithoutAdditional = calculateFinalDamage(totalDamage, input.enemy.defense || 0);
    const finalAdditionalDamage = calculateFinalDamage(additionalDamage, input.enemy.defense || 0);
    const finalDamage = finalDamageWithoutAdditional + finalAdditionalDamage;

    // 結果の構築
    const result: DamageResult = {
      baseDamage: baseDamage,
      critMultiplier: critResult / correctedDamage, // 倍率を計算
      skillMultiplier: skillMultiplier,
      hits: hits,
      hitDamage: hitDamage,
      totalDamage: totalDamage,
      additionalDamage: additionalDamage, // 追撃ダメージを追加
      finalDamage: finalDamage,
      mp: mp,
      ct: ct
    };

    // DPS計算（クールタイムがある場合）
    if (ct > 0) {
      result.dps = finalDamage / ct;
    }

    // TTK計算（敵HPがある場合）
    if (input.enemy.hp && input.enemy.hp > 0) {
      result.ttk = roundUp(input.enemy.hp / finalDamage);
    }

    // MP効率計算（MPがある場合）
    if (mp > 0) {
      result.mpEfficiency = finalDamage / mp;
    }

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'DAMAGE_CALC_ERROR',
        message: `ダメージ計算中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    };
  }
}

/**
 * 基礎ダメージ計算
 * 武器種別ごとの計算式を適用
 * 職業補正（武器種指定）がある場合はそちらの計算式を使用
 */
export function calculateBaseDamage(
  weaponType: WeaponType,
  weaponAttackPower: number,
  weaponCritRate: number,
  weaponCritDamage: number,
  damageCorrection: number,
  userStats: StatBlock,
  weaponCalc: WeaponCalcData,
  damageCorrectionMode: 'min' | 'max' | 'avg',
  jobName?: string
): number {
  // 武器種別を正規化（小文字に変換、最初を大文字に）
  const normalizedType = weaponType.toLowerCase();
  const formulaKey = normalizedType.charAt(0).toUpperCase() + normalizedType.slice(1);

  // 職業補正（武器種指定）がある場合はそちらの計算式を使用
  // JobCorrection.職業名.武器種 が存在する場合、BasedDamageの計算式の代わりに使用
  let baseDamageFormula: string | undefined;

  if (jobName && weaponCalc.JobCorrection?.[jobName]?.[formulaKey]) {
    // 職業補正の武器種指定計算式がある場合
    baseDamageFormula = weaponCalc.JobCorrection[jobName][formulaKey];
  } else {
    // デフォルトの基礎ダメージ計算式を使用
    baseDamageFormula = weaponCalc.BasedDamage?.[formulaKey];
  }

  if (!baseDamageFormula) {
    throw new Error(`武器種別 '${weaponType}' の計算式が見つかりません`);
  }

  // ダメージ補正の実際の値を計算
  const actualDamageCorrection = damageCorrectionMode === 'min' ? 0.8
                               : damageCorrectionMode === 'max' ? 1.2
                               : 1.0; // avg

  // 計算式の変数を準備（仕様書に従ったプレースホルダー名）
  const userVars = mapUserStatsToVariables(userStats);
  const variables: Record<string, number> = {
    // 武器ステータス
    WeaponAttackPower: weaponAttackPower,
    WeaponCritRate: weaponCritRate,
    WeaponCritDamage: weaponCritDamage,
    DamageCorrection: actualDamageCorrection,

    // ユーザーステータス（マッピング関数から取得）
    ...userVars,

    // 特殊変数
    ComboCorrection: 1 // フライパンのコンボ補正（現時点では1として扱う）
  };

  // 計算式の評価
  const result = evaluateFormulaString(baseDamageFormula, variables);

  return roundDown(result);
}

/**
 * 職業補正の適用
 * 武器種指定パターンはcalculateBaseDamageで処理済み
 * この関数はBonusパターン（最終ダメージに掛け算）を処理する
 */
export function applyJobCorrection(
  baseDamage: number,
  jobName: string,
  weaponType: WeaponType,
  userStats: StatBlock,
  weaponCalc: WeaponCalcData
): number {
  // 武器種指定の職業補正は calculateBaseDamage で既に処理済み
  // ここではBonusパターンのみを処理する
  // 注: 武器種指定の職業補正がある場合、Bonusは適用しない
  const normalizedType = weaponType.toLowerCase();
  const formulaKey = normalizedType.charAt(0).toUpperCase() + normalizedType.slice(1);
  const hasWeaponTypeCorrection = weaponCalc.JobCorrection?.[jobName]?.[formulaKey];

  if (hasWeaponTypeCorrection) {
    // 武器種指定の職業補正がある場合はBonusは適用しない
    return baseDamage;
  }

  // Bonusパターンの取得
  const bonusFormula = weaponCalc.JobCorrection?.[jobName]?.['Bonus'];

  if (!bonusFormula) {
    // Bonus補正がない場合は基礎ダメージをそのまま返す
    return baseDamage;
  }

  // 計算式の変数を準備（仕様書に従ったプレースホルダー名）
  const userVars = mapUserStatsToVariables(userStats);
  const variables: Record<string, number> = {
    BasedDamage: baseDamage,

    // ユーザーステータス（マッピング関数から取得）
    ...userVars
  };

  // Bonus計算式の評価（結果を基礎ダメージに掛け算）
  const bonusMultiplier = evaluateFormulaString(bonusFormula, variables);

  // Bonusは最終ダメージに掛け算
  return roundDown(baseDamage * bonusMultiplier);
}

/**
 * スキルダメージ計算
 */
export function calculateSkillDamage(
  skillId: string,
  baseDamage: number,
  userStats: StatBlock,
  weaponType: WeaponType,
  skillCalc: SkillCalcData,
  weaponCalc?: WeaponCalcData,
  weaponStats?: {
    weaponAttackPower: number;
    weaponCritRate: number;
    weaponCritDamage: number;
    damageCorrection?: number;
  }
): CalcResult<{damage: number; hits: number; mp: number; ct: number}> {
  try {
    const skillDefinition = findSkillDefinition(skillId, skillCalc);

    if (!skillDefinition) {
      return {
        success: false,
        error: {
          code: 'SKILL_NOT_FOUND',
          message: `スキル '${skillId}' が見つかりません`
        }
      };
    }
    
    // 計算用のコンテキストを作成（仕様書に従ったプレースホルダー名）
    const context: Record<string, number> = {
      ...mapUserStatsToVariables(userStats),
      // 武器ステータスを追加（BaseDamage計算用）
      WeaponAttackPower: weaponStats?.weaponAttackPower || 0,
      WeaponCritRate: weaponStats?.weaponCritRate || 0,
      WeaponCritDamage: weaponStats?.weaponCritDamage || 0,
      DamageCorrection: weaponStats?.damageCorrection || 1
    };

    // MP消費量の計算
    let mp = 0;
    if (skillDefinition.MP) {
      if (typeof skillDefinition.MP === 'string') {
        mp = evaluateFormulaString(skillDefinition.MP, context);
      } else if (typeof skillDefinition.MP === 'number') {
        mp = skillDefinition.MP;
      }
    }

    // クールタイムの計算
    let ct = 0;
    if (skillDefinition.CT) {
      if (typeof skillDefinition.CT === 'string') {
        ct = evaluateFormulaString(skillDefinition.CT, context);
      } else if (typeof skillDefinition.CT === 'number') {
        ct = skillDefinition.CT;
      }
    }

    // ダメージ倍率の計算
    let damage = baseDamage;
    if (skillDefinition.Damage) {
      if (typeof skillDefinition.Damage === 'string') {
        // BaseDamage.Sword のような参照を処理
        let damageFormula = skillDefinition.Damage as string;
        if (damageFormula.includes('BaseDamage.')) {
          // 特定の武器種の基礎ダメージを参照
          const weaponMatch = damageFormula.match(/BaseDamage\.(\w+)/);
          if (weaponMatch) {
            const weaponTypeForCalc = weaponMatch[1];
            const baseDamageFormulaKey = weaponCalc?.BasedDamage?.[weaponTypeForCalc];
            if (baseDamageFormulaKey) {
              // その武器種の基礎ダメージを計算
              const weaponBaseDamage = evaluateFormulaString(baseDamageFormulaKey, context);
              damageFormula = damageFormula.replace(`BaseDamage.${weaponTypeForCalc}`, weaponBaseDamage.toString());
            }
          }
        } else if (damageFormula.includes('BaseDamage')) {
          // 現在の武器種の基礎ダメージを使用
          damageFormula = damageFormula.replace('BaseDamage', baseDamage.toString());
        }
        
        damage = evaluateFormulaString(damageFormula, context);
      }
    }

    // ヒット数の計算
    const hits = parseHits(skillDefinition.Hits || 1, 'avg');

    return {
      success: true,
      data: {
        damage: damage,
        hits: hits,
        mp: mp,
        ct: ct
      }
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'SKILL_CALC_ERROR',
        message: `スキル計算中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    };
  }
}

/**
 * 会心ダメージの適用
 */
export function applyCritDamage(
  damage: number,
  critRate: number,
  critDamage: number,
  critMode: 'crit' | 'nocrit' | 'avg'
): number {
  if (critMode === 'crit') {
    return roundDown(damage * (1 + critDamage / 100));
  } else if (critMode === 'nocrit') {
    return damage;
  } else {
    // 平均値計算
    const critDamageValue = roundDown(damage * (1 + critDamage / 100));
    return roundDown(damage * (1 - critRate / 100) + critDamageValue * (critRate / 100));
  }
}

/**
 * ダメージ補正の適用
 */
export function applyDamageCorrection(
  damage: number,
  correctionMode: 'min' | 'max' | 'avg'
): number {
  const minCorrection = 0.8;
  const maxCorrection = 1.2;

  if (correctionMode === 'min') {
    return roundDown(damage * minCorrection);
  } else if (correctionMode === 'max') {
    return roundDown(damage * maxCorrection);
  } else {
    // 平均値
    return damage;
  }
}

/**
 * 追撃ダメージを計算
 * 仕様書 §3 に基づく
 *
 * @param baseDamage 元の攻撃ダメージ
 * @param weaponName 武器名
 * @param userStats ユーザーステータス
 * @param isPvP PvPモードかどうか
 * @returns 追撃の総ダメージ
 */
export function calculateAdditionalAttacks(
  baseDamage: number,
  weaponName: string,
  userStats: {
    speed?: number;
    mp?: number;
    waterResistance?: number;
  },
  isPvP: boolean = false
): number {
  // 武器名から追撃定義を取得
  const additionalAttackDef = getAdditionalAttackDefinition(weaponName);

  if (!additionalAttackDef) {
    return 0; // 追撃なし
  }

  let totalAdditionalDamage = 0;

  switch (additionalAttackDef.type) {
    case 'percentage': {
      // 基本パターン: 元の攻撃 × 倍率 × 回数
      const count = isPvP && additionalAttackDef.pvpCount !== undefined
        ? additionalAttackDef.pvpCount
        : (additionalAttackDef.baseCount || 1);

      totalAdditionalDamage = roundDown(
        baseDamage * additionalAttackDef.multiplier * count
      );
      break;
    }

    case 'speed-based': {
      // ゼクロ弓パターン: 元の攻撃 × 22% × (速度 × 0.011 + 2)
      const speedMultiplier = (userStats.speed || 0) * 0.011 + 2;
      totalAdditionalDamage = roundDown(
        baseDamage * additionalAttackDef.multiplier * speedMultiplier
      );
      break;
    }

    case 'resistance-based': {
      // 夏武器パターン: floor(水耐性 / 5) × 元の攻撃 × 22%
      const attackCount = roundDown((userStats.waterResistance || 0) / 5);
      totalAdditionalDamage = roundDown(
        baseDamage * additionalAttackDef.multiplier * attackCount
      );
      break;
    }

    case 'mp-based': {
      // 盗賊斧パターン: 現在MP × 0.2 × 回数
      const count = additionalAttackDef.baseCount || 1;
      totalAdditionalDamage = roundDown(
        (userStats.mp || 0) * additionalAttackDef.multiplier * count
      );
      break;
    }

    default:
      totalAdditionalDamage = 0;
  }

  return totalAdditionalDamage;
}

/**
 * 武器名から追撃定義を取得
 *
 * @param weaponName 武器名
 * @returns 追撃定義（追撃がない場合はnull）
 */
function getAdditionalAttackDefinition(
  weaponName: string
): AdditionalAttackDefinition | null {
  // 武器名と追撃定義のマッピング
  const additionalAttackMap: Record<string, AdditionalAttackDefinition> = {
    // 剣改: 元の攻撃 × 22% × 回数
    '剣改': {
      type: 'percentage',
      multiplier: 0.22,
      baseCount: 1, // 実際の回数はWeaponCalc.yamlから取得すべき
    },

    // ジェミニ: 元の攻撃 × 30%
    'ジェミニ': {
      type: 'percentage',
      multiplier: 0.30,
      baseCount: 1,
    },

    // 幻影大剣: 元の攻撃 × 30%
    '幻影大剣': {
      type: 'percentage',
      multiplier: 0.30,
      baseCount: 1,
    },

    // ゼクロ弓: 元の攻撃 × 22% × ({UserSpeed} * 0.011 + 2)
    'ゼクロ弓': {
      type: 'speed-based',
      multiplier: 0.22,
    },

    // 夏武器: floor(水耐性 / 5) × 元の攻撃 × 22%
    '夏武器': {
      type: 'resistance-based',
      multiplier: 0.22,
    },

    // ベス剣: 元の攻撃 × 10% × 4回 (PvP時は1回)
    'ベス剣': {
      type: 'percentage',
      multiplier: 0.10,
      baseCount: 4,
      pvpCount: 1,
    },

    // 盗賊斧: 現在MP × 0.2 × 回数
    '盗賊斧': {
      type: 'mp-based',
      multiplier: 0.2,
      baseCount: 1,
    },

    // 炎牙: 元の攻撃 × 5% × 回数（防御貫通）
    '炎牙': {
      type: 'percentage',
      multiplier: 0.05,
      baseCount: 1,
      ignoreDefense: true,
    },
  };

  return additionalAttackMap[weaponName] || null;
}

/**
 * 最終ダメージを計算（追撃を含む）
 *
 * @param baseDamage 基礎ダメージ
 * @param weaponName 武器名
 * @param userStats ユーザーステータス
 * @param isPvP PvPモードかどうか
 * @returns 基礎ダメージ、追撃ダメージ、総ダメージを含むオブジェクト
 */
export function calculateFinalDamageWithAdditional(
  baseDamage: number,
  weaponName: string,
  userStats: {
    speed?: number;
    mp?: number;
    waterResistance?: number;
  },
  isPvP: boolean = false
): {
  baseDamage: number;
  additionalDamage: number;
  totalDamage: number;
} {
  const additionalDamage = calculateAdditionalAttacks(
    baseDamage,
    weaponName,
    userStats,
    isPvP
  );

  return {
    baseDamage,
    additionalDamage,
    totalDamage: baseDamage + additionalDamage,
  };
}

/**
 * 最終ダメージの計算
 */
export function calculateFinalDamage(
  damage: number,
  enemyDefense: number
): number {
  // 簡易的な防御計算
  const defenseMitigation = Math.max(0, 1 - enemyDefense / 1000);
  return roundDown(damage * defenseMitigation);
}

/**
 * 計算式文字列の評価
 */
export function evaluateFormulaString(
  formula: string,
  context: Record<string, number>
): number {
  try {
    // 変数名を置換
    let evaluableFormula = formula;

    // ln関数をlog関数に変換（mathjsではlogが自然対数）
    evaluableFormula = evaluableFormula.replace(/\bln\(/g, 'log(');

    // <Level> などのパラメータを置換
    evaluableFormula = evaluableFormula.replace(/<Level>/g, (context.SkillLevel || context.Level || 1).toString());
    evaluableFormula = evaluableFormula.replace(/<AgilityFactor>/g, (context.Agility || 0).toString());
    evaluableFormula = evaluableFormula.replace(/<PowerFactor>/g, (context.Power || 0).toString());
    evaluableFormula = evaluableFormula.replace(/<MagicFactor>/g, (context.Magic || 0).toString());

    // 変数名を実際の値に置換
    Object.entries(context).forEach(([key, value]) => {
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      evaluableFormula = evaluableFormula.replace(regex, value.toString());
    });

    // mathjsで評価
    const result = mathjs.evaluate(evaluableFormula);
    
    if (typeof result === 'number') {
      return result;
    } else {
      return Number(result);
    }
  } catch (error) {
    console.error('Formula evaluation error:', error, formula);
    throw new Error(`計算式の評価に失敗しました: ${formula}`);
  }
}

/**
 * ヒット数の解析
 */
export function parseHits(
  hitsValue: string | number,
  mode: 'min' | 'max' | 'avg' = 'avg'
): number {
  if (typeof hitsValue === 'number') {
    return hitsValue;
  }

  // "5~6" のような範囲指定を解析
  const rangeMatch = hitsValue.match(/(\d+)~(\d+)/);
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1], 10);
    const max = parseInt(rangeMatch[2], 10);
    
    switch (mode) {
      case 'min':
        return min;
      case 'max':
        return max;
      case 'avg':
        return (min + max) / 2;
      default:
        return min;
    }
  }

  // 単純な数値文字列
  const parsed = parseInt(hitsValue, 10);
  return isNaN(parsed) ? 1 : parsed;
}

/**
 * スキル定義を探索
 */
function findSkillDefinition(
  skillName: string,
  skillCalc: SkillCalcData
): any {
  if (!skillCalc.SkillDefinition) {
    return null;
  }

  const skillDef = skillCalc.SkillDefinition as Record<string, any>;

  // SkillBook内を探索
  if (skillDef.SkillBook) {
    for (const weaponType of Object.keys(skillDef.SkillBook)) {
      const weaponSkills = skillDef.SkillBook[weaponType];
      if (weaponSkills[skillName]) {
        return weaponSkills[skillName];
      }
    }
  }

  // JobSkill内を探索
  if (skillDef.JobSkill) {
    for (const jobName of Object.keys(skillDef.JobSkill)) {
      const jobSkills = skillDef.JobSkill[jobName];
      if (jobSkills[skillName]) {
        return jobSkills[skillName];
      }
    }
  }

  return null;
}