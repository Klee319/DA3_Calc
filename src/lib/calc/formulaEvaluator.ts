import { evaluate, round, floor, max, min, log } from 'mathjs';

/**
 * カスタム関数の定義
 */
const customFunctions = {
  ROUND: (value: number) => Math.round(value),
  ROUNDUP: (value: number) => Math.ceil(value),
  floor: (value: number) => Math.floor(value),
  max: (...values: number[]) => Math.max(...values),
  min: (...values: number[]) => Math.min(...values),
  ln: (value: number) => Math.log(value),
};

/**
 * 数式内の変数を実際の値に置換して評価
 * @param formula - 評価する数式文字列
 * @param variables - 変数名と値のマッピング
 * @returns 計算結果
 *
 * @example
 * evaluateFormula("(WeaponAttackPower+UserPower*1.6)*DamageCorrection", {
 *   WeaponAttackPower: 100,
 *   UserPower: 50,
 *   DamageCorrection: 1.2
 * })
 * // => (100 + 50 * 1.6) * 1.2 = 216
 */
export function evaluateFormula(formula: string, variables: Record<string, number>): number {
  try {
    // 数式文字列の準備
    let processedFormula = formula;

    // カスタム関数の置換
    // ROUND, ROUNDUP などを mathjs が理解できる形式に変換
    processedFormula = processedFormula
      .replace(/ROUND\(/g, 'round(')
      .replace(/ROUNDUP\(/g, 'ceil(')
      .replace(/ln\(/g, 'log(');

    // 変数を実際の値に置換
    // 変数名が長い順にソートして、部分一致を防ぐ
    const sortedVariables = Object.entries(variables)
      .sort(([a], [b]) => b.length - a.length);

    for (const [varName, value] of sortedVariables) {
      // 変数名を正規表現でエスケープ
      const escapedVarName = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // 単語境界を考慮して置換
      const regex = new RegExp(`\\b${escapedVarName}\\b`, 'g');
      processedFormula = processedFormula.replace(regex, String(value));
    }

    // mathjs で評価
    const result = evaluate(processedFormula);

    // 数値でない場合はエラー
    if (typeof result !== 'number' || isNaN(result)) {
      throw new Error(`Formula evaluation resulted in non-numeric value: ${result}`);
    }

    return result;
  } catch (error) {
    console.error('Formula evaluation error:', {
      formula,
      variables,
      error: error instanceof Error ? error.message : String(error)
    });
    throw new Error(`Failed to evaluate formula: ${formula}`);
  }
}

/**
 * 複数の数式を順番に評価（中間結果を次の式で使用可能）
 * @param formulas - 評価する数式の配列
 * @param initialVariables - 初期変数
 * @returns 最終的な計算結果
 */
export function evaluateFormulaChain(
  formulas: Array<{ name: string; formula: string }>,
  initialVariables: Record<string, number>
): Record<string, number> {
  const results: Record<string, number> = { ...initialVariables };

  for (const { name, formula } of formulas) {
    results[name] = evaluateFormula(formula, results);
  }

  return results;
}

/**
 * 条件付き数式評価
 * @param condition - 条件式
 * @param trueFormula - 条件が真の場合の数式
 * @param falseFormula - 条件が偽の場合の数式
 * @param variables - 変数
 * @returns 計算結果
 */
export function evaluateConditionalFormula(
  condition: string,
  trueFormula: string,
  falseFormula: string,
  variables: Record<string, number>
): number {
  const conditionResult = evaluateFormula(condition, variables);
  const formula = conditionResult > 0 ? trueFormula : falseFormula;
  return evaluateFormula(formula, variables);
}

/**
 * 安全な除算（ゼロ除算を防ぐ）
 * @param numerator - 分子
 * @param denominator - 分母
 * @param defaultValue - ゼロ除算時のデフォルト値
 * @returns 除算結果
 */
export function safeDivide(numerator: number, denominator: number, defaultValue = 0): number {
  if (denominator === 0) {
    return defaultValue;
  }
  return numerator / denominator;
}

/**
 * パーセンテージを乗数に変換
 * @param percentage - パーセンテージ値
 * @returns 乗数 (例: 50% -> 1.5)
 */
export function percentToMultiplier(percentage: number): number {
  return 1 + percentage / 100;
}

/**
 * 値を指定範囲内に制限
 * @param value - 制限する値
 * @param min - 最小値
 * @param max - 最大値
 * @returns 制限された値
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}