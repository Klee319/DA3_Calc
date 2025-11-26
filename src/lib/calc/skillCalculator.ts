/**
 * スキル計算モジュール
 * YAMLから読み込んだスキル定義に基づいてダメージ・回復・バフ値を計算
 */

import { SkillDefinition, AvailableSkill, WeaponCalcData } from '@/types/data';
import { StatBlock, WeaponStats } from '@/types/calc';

/**
 * 式評価用のコンテキスト（変数マッピング）
 */
export interface FormulaContext {
  // BaseDamage値（武器種ごと）
  'BaseDamage.Sword'?: number;
  'BaseDamage.Wand'?: number;
  'BaseDamage.Bow'?: number;
  'BaseDamage.Axe'?: number;
  'BaseDamage.GreatSword'?: number;
  'BaseDamage.Dagger'?: number;
  'BaseDamage.Spear'?: number;
  'BaseDamage.Frypan'?: number;

  // ユーザーステータス
  UserPower: number;
  UserMagic: number;
  UserHP: number;
  UserMind: number;
  UserSpeed: number;
  UserAgility: number;
  UserDex: number;
  UserDefense: number;
  UserCritDamage: number;
  UserMP: number;

  // 武器ステータス
  WeaponAttackPower: number;
  WeaponCritRate: number;
  WeaponCritDamage: number;
  DamageCorrection: number;
  ComboCorrection: number;

  // スキルレベル（スキル本用）
  Level: number;
  SkillLevel: number;

  // 敵ステータス（デバフ計算用）
  TargetDefense?: number;

  // ヒット数（Dot計算用）
  Hits?: number;
  Damage?: number;
}

/**
 * スキル計算結果
 */
export interface SkillCalculationResult {
  /** スキル名 */
  skillName: string;
  /** スキルタイプ */
  type: AvailableSkill['type'];
  /** 1ヒットあたりのダメージ/回復量 */
  damagePerHit: number;
  /** ヒット数 */
  hits: number;
  /** 合計ダメージ/回復量 */
  totalDamage: number;
  /** MP消費 */
  mpCost: number;
  /** クールタイム（秒） */
  coolTime: number;
  /** バフ効果（ステータス名: 値） */
  buffEffects?: Record<string, number>;
  /** デバフ効果（ステータス名: 値） */
  debuffEffects?: Record<string, number>;
  /** DoT効果 */
  dotEffect?: {
    count: number;
    damagePerTick: number;
    totalDotDamage: number;
  };
  /** Extra効果（キー: 計算結果） */
  extraEffects?: Record<string, number>;
  /** 武器不一致ペナルティが適用されたか */
  weaponMismatchApplied: boolean;
  /** 武器不一致ペナルティ係数 */
  weaponMismatchPenalty: number;
  /** variableヒット（ユーザー入力が必要） */
  isVariableHits: boolean;
}

/**
 * Excel互換のROUND関数（負の桁指定に対応）
 * @param value - 丸める値
 * @param decimals - 小数点以下の桁数（負の値は10の位、100の位などで丸める）
 */
function customRound(value: number, decimals = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Excel互換のROUNDUP関数（負の桁指定に対応）
 */
function customRoundUp(value: number, decimals = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.ceil(value * factor) / factor;
}

/**
 * Excel互換のROUNDDOWN関数（負の桁指定に対応）
 */
function customRoundDown(value: number, decimals = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.floor(value * factor) / factor;
}

/**
 * ROUND/ROUNDUP/ROUNDDOWN関数呼び出しを処理する
 * 負の桁指定に対応するため、事前に評価して数値に置き換える
 */
function processRoundFunctions(formula: string): string {
  let result = formula;

  // 関数と対応する処理関数のマッピング
  const roundFunctions: Array<{ pattern: RegExp; fn: (value: number, decimals: number) => number }> = [
    { pattern: /ROUND\s*\(/gi, fn: customRound },
    { pattern: /ROUNDUP\s*\(/gi, fn: customRoundUp },
    { pattern: /ROUNDDOWN\s*\(/gi, fn: customRoundDown },
  ];

  for (const { pattern, fn } of roundFunctions) {
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;

    while ((match = pattern.exec(result)) !== null) {
      const startIndex = match.index;
      const funcEndIndex = match.index + match[0].length;

      // 対応する閉じ括弧を見つける
      let depth = 1;
      let endIndex = funcEndIndex;
      for (let i = funcEndIndex; i < result.length && depth > 0; i++) {
        if (result[i] === '(') depth++;
        if (result[i] === ')') depth--;
        if (depth === 0) {
          endIndex = i;
          break;
        }
      }

      // 引数部分を抽出
      const argsStr = result.substring(funcEndIndex, endIndex);

      // カンマで分割（ネストされた括弧内のカンマは無視）
      const args: string[] = [];
      let currentArg = '';
      let parenDepth = 0;
      for (const char of argsStr) {
        if (char === '(') parenDepth++;
        if (char === ')') parenDepth--;
        if (char === ',' && parenDepth === 0) {
          args.push(currentArg.trim());
          currentArg = '';
        } else {
          currentArg += char;
        }
      }
      args.push(currentArg.trim());

      // 第1引数（値）を評価
      let value: number;
      try {
        // ネストされたROUND関数を再帰的に処理
        const valueExpr = processRoundFunctions(args[0]);
        value = new Function(`return ${valueExpr}`)();
      } catch {
        pattern.lastIndex = endIndex + 1;
        continue;
      }

      // 第2引数（桁数、省略時は0）
      let decimals = 0;
      if (args.length > 1) {
        try {
          decimals = new Function(`return ${args[1]}`)();
        } catch {
          decimals = 0;
        }
      }

      // 丸め処理を実行
      const roundedValue = fn(value, decimals);

      // 関数呼び出しを結果に置き換え
      result = result.substring(0, startIndex) + String(roundedValue) + result.substring(endIndex + 1);

      // 正規表現のインデックスをリセット
      pattern.lastIndex = 0;
    }
  }

  return result;
}

/**
 * 安全な式評価関数
 * Math関数とコンテキスト変数のみをサポート
 * ROUND/ROUNDUP/ROUNDDOWN は負の桁指定に対応
 */
export function evaluateFormula(
  formula: string,
  context: FormulaContext
): number {
  if (!formula || typeof formula !== 'string') {
    return 0;
  }

  try {
    // 式をクリーンアップ
    let cleanFormula = formula.trim();

    // <Level>プレースホルダーを置換
    cleanFormula = cleanFormula.replace(/<Level>/g, String(context.Level || 1));

    // コンテキスト変数を数値に置換（長い名前から順に置換）
    const sortedKeys = Object.keys(context).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      const value = context[key as keyof FormulaContext];
      if (value !== undefined) {
        // ドット付きのキー（BaseDamage.Sword等）も正しく置換
        const escapedKey = key.replace(/\./g, '\\.');
        const regex = new RegExp(escapedKey, 'g');
        cleanFormula = cleanFormula.replace(regex, String(value));
      }
    }

    // ROUND/ROUNDUP/ROUNDDOWN関数を処理（負の桁指定に対応）
    cleanFormula = processRoundFunctions(cleanFormula);

    // その他のMath関数を置換
    cleanFormula = cleanFormula
      .replace(/round\(/gi, 'Math.round(')
      .replace(/floor\(/gi, 'Math.floor(')
      .replace(/ceil\(/gi, 'Math.ceil(')
      .replace(/max\(/gi, 'Math.max(')
      .replace(/min\(/gi, 'Math.min(')
      .replace(/abs\(/gi, 'Math.abs(')
      .replace(/sqrt\(/gi, 'Math.sqrt(')
      .replace(/pow\(/gi, 'Math.pow(')
      .replace(/ln\(/gi, 'Math.log(');

    // 安全でない文字がないかチェック
    const safePattern = /^[\d\s+\-*/().Math,roundfloorceimaxinabsqrtpowlog]+$/;
    if (!safePattern.test(cleanFormula)) {
      console.warn('Unsafe formula pattern detected:', cleanFormula);
      // 危険な文字を除去して再試行
      cleanFormula = cleanFormula.replace(/[^0-9\s+\-*/().]/g, '');
    }

    // evalの代わりにFunction constructorを使用
    const result = new Function(`return ${cleanFormula}`)();

    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      return result;
    }

    console.warn('Formula evaluation returned invalid result:', result, 'for formula:', formula);
    return 0;
  } catch (error) {
    console.error('Formula evaluation error:', error, 'Formula:', formula);
    return 0;
  }
}

/**
 * ヒット数を評価
 */
export function evaluateHits(
  hits: number | number[] | string | undefined,
  context: FormulaContext
): { hits: number; isVariable: boolean; minHits?: number; maxHits?: number } {
  if (hits === undefined || hits === null) {
    return { hits: 1, isVariable: false };
  }

  // 数値の場合
  if (typeof hits === 'number') {
    return { hits, isVariable: false };
  }

  // 配列の場合（[min, max]）
  if (Array.isArray(hits)) {
    const [min, max] = hits;
    // 平均値を使用
    return {
      hits: Math.floor((min + max) / 2),
      isVariable: false,
      minHits: min,
      maxHits: max
    };
  }

  // "variable"の場合
  if (hits === 'variable') {
    return { hits: 1, isVariable: true };
  }

  // 式の場合
  if (typeof hits === 'string') {
    const evaluatedHits = evaluateFormula(hits, context);
    return { hits: Math.floor(evaluatedHits), isVariable: false };
  }

  return { hits: 1, isVariable: false };
}

/**
 * MP消費を評価
 */
export function evaluateMP(
  mp: number | string | null | undefined,
  context: FormulaContext
): number {
  if (mp === null || mp === undefined) {
    return 0;
  }

  if (typeof mp === 'number') {
    return mp;
  }

  if (typeof mp === 'string') {
    return Math.floor(evaluateFormula(mp, context));
  }

  return 0;
}

/**
 * CT（クールタイム）を評価
 */
export function evaluateCT(
  ct: number | string | null | undefined,
  context: FormulaContext
): number {
  if (ct === null || ct === undefined) {
    return 0;
  }

  if (typeof ct === 'number') {
    return ct;
  }

  if (typeof ct === 'string') {
    return evaluateFormula(ct, context);
  }

  return 0;
}

/**
 * 武器不一致ペナルティを取得
 */
export function getWeaponMismatchPenalty(
  weaponCalcData: WeaponCalcData | null
): { enabled: boolean; penalty: number } {
  if (!weaponCalcData?.AdditionalAttacks) {
    return { enabled: false, penalty: 1.0 };
  }

  const mismatch = (weaponCalcData.AdditionalAttacks as any).WeaponMismatch;
  if (mismatch && mismatch.Enabled) {
    return {
      enabled: true,
      penalty: mismatch.Penalty || 0.2
    };
  }

  return { enabled: false, penalty: 1.0 };
}

/**
 * 武器種が一致するかチェック
 */
export function checkWeaponMatch(
  skillWeaponTypes: string[],
  currentWeaponType: string
): boolean {
  // 空配列（バフ・デバフスキル）は常に一致
  if (!skillWeaponTypes || skillWeaponTypes.length === 0) {
    return true;
  }

  return skillWeaponTypes.includes(currentWeaponType);
}

/**
 * スキルを計算
 */
export function calculateSkill(
  skill: AvailableSkill,
  context: FormulaContext,
  currentWeaponType: string,
  weaponCalcData: WeaponCalcData | null,
  customHits?: number // variableヒット時のユーザー入力
): SkillCalculationResult {
  const def = skill.definition;
  const { enabled: mismatchEnabled, penalty: mismatchPenalty } = getWeaponMismatchPenalty(weaponCalcData);

  // 武器一致チェック
  const isWeaponMatch = checkWeaponMatch(def.BaseDamageType, currentWeaponType);
  const weaponMismatchApplied = mismatchEnabled && !isWeaponMatch && skill.source === 'job';
  const finalPenalty = weaponMismatchApplied ? mismatchPenalty : 1.0;

  // ヒット数評価
  const hitsResult = evaluateHits(def.Hits, context);
  const actualHits = customHits !== undefined ? customHits : hitsResult.hits;

  // MP/CT評価
  const mpCost = evaluateMP(def.MP, context);
  const coolTime = evaluateCT(def.CT, context);

  // ダメージ計算
  let damagePerHit = 0;
  if (def.Damage) {
    damagePerHit = evaluateFormula(def.Damage, context);
    // 武器不一致ペナルティ適用
    damagePerHit = Math.floor(damagePerHit * finalPenalty);
  }

  // 回復量計算
  let healAmount = 0;
  if (def.Heal) {
    healAmount = evaluateFormula(def.Heal, context);
  }

  // バフ効果計算
  let buffEffects: Record<string, number> | undefined;
  if (def.Buff) {
    buffEffects = {};
    for (const [stat, formula] of Object.entries(def.Buff)) {
      buffEffects[stat] = evaluateFormula(formula, context);
    }
  }

  // デバフ効果計算
  let debuffEffects: Record<string, number> | undefined;
  if (def.Debuff) {
    debuffEffects = {};
    for (const [stat, formula] of Object.entries(def.Debuff)) {
      debuffEffects[stat] = evaluateFormula(formula, context);
    }
  }

  // DoT効果計算
  let dotEffect: SkillCalculationResult['dotEffect'];
  if (def.Dot) {
    // Dot計算のためにHitsとDamageをコンテキストに追加
    const dotContext = {
      ...context,
      Hits: actualHits,
      Damage: damagePerHit
    };
    const dotCount = evaluateFormula(def.Dot.Count, dotContext);
    const dotDamage = evaluateFormula(def.Dot.Damage, dotContext);
    dotEffect = {
      count: Math.floor(dotCount),
      damagePerTick: Math.floor(dotDamage),
      totalDotDamage: Math.floor(dotCount * dotDamage)
    };
  }

  // Extra効果計算
  let extraEffects: Record<string, number> | undefined;
  if (def.Extra) {
    extraEffects = {};
    for (const [key, formula] of Object.entries(def.Extra)) {
      extraEffects[key] = evaluateFormula(formula, context);
    }
  }

  // 最終値の決定
  const finalDamagePerHit = skill.type === 'heal' ? healAmount : damagePerHit;
  const totalDamage = finalDamagePerHit * actualHits;

  return {
    skillName: skill.name,
    type: skill.type,
    damagePerHit: Math.floor(finalDamagePerHit),
    hits: actualHits,
    totalDamage: Math.floor(totalDamage),
    mpCost,
    coolTime,
    buffEffects,
    debuffEffects,
    dotEffect,
    extraEffects,
    weaponMismatchApplied,
    weaponMismatchPenalty: finalPenalty,
    isVariableHits: hitsResult.isVariable && customHits === undefined,
  };
}

/**
 * 計算コンテキストを構築
 */
export function buildFormulaContext(
  baseDamages: Record<string, number>,
  userStats: StatBlock,
  weaponStats: WeaponStats,
  skillLevel: number = 1,
  targetDefense: number = 0
): FormulaContext {
  return {
    // BaseDamage値
    'BaseDamage.Sword': baseDamages['Sword'] || 0,
    'BaseDamage.Wand': baseDamages['Wand'] || 0,
    'BaseDamage.Bow': baseDamages['Bow'] || 0,
    'BaseDamage.Axe': baseDamages['Axe'] || 0,
    'BaseDamage.GreatSword': baseDamages['GreatSword'] || 0,
    'BaseDamage.Dagger': baseDamages['Dagger'] || 0,
    'BaseDamage.Spear': baseDamages['Spear'] || 0,
    'BaseDamage.Frypan': baseDamages['Frypan'] || 0,

    // ユーザーステータス
    UserPower: userStats.ATK || 0,
    UserMagic: userStats.MATK || 0,
    UserHP: userStats.HP || 0,
    UserMind: userStats.MDEF || 0, // 精神
    UserSpeed: userStats.AGI || 0,
    UserAgility: userStats.AGI || 0,
    UserDex: userStats.DEX || 0,
    UserDefense: userStats.DEF || 0,
    UserCritDamage: userStats.HIT || 0, // 撃力
    UserMP: 100, // MP固定（必要に応じて動的に）

    // 武器ステータス
    WeaponAttackPower: weaponStats.attackPower || 0,
    WeaponCritRate: weaponStats.critRate || 0,
    WeaponCritDamage: weaponStats.critDamage || 0,
    DamageCorrection: 1.0, // デフォルト100%
    ComboCorrection: 1.0,

    // スキルレベル
    Level: skillLevel,
    SkillLevel: skillLevel,

    // 敵ステータス
    TargetDefense: targetDefense,
  };
}
