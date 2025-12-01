import { evaluate, round, floor, max, min, log } from 'mathjs';

/**
 * Excel互換のROUND関数（負の桁指定に対応）
 * @param value - 丸める値
 * @param decimals - 小数点以下の桁数（負の値は10の位、100の位などで丸める）
 * @returns 丸められた値
 *
 * @example
 * customRound(123.456, 0)  // => 123
 * customRound(123.456, 1)  // => 123.5
 * customRound(123.456, 2)  // => 123.46
 * customRound(1234, -1)    // => 1230
 * customRound(1234, -2)    // => 1200
 */
function customRound(value: number, decimals = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Excel互換のROUNDUP関数（負の桁指定に対応）
 * @param value - 切り上げる値
 * @param decimals - 小数点以下の桁数（負の値は10の位、100の位などで丸める）
 * @returns 切り上げられた値
 */
function customRoundUp(value: number, decimals = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.ceil(value * factor) / factor;
}

/**
 * Excel互換のROUNDDOWN関数（負の桁指定に対応）
 * @param value - 切り捨てる値
 * @param decimals - 小数点以下の桁数（負の値は10の位、100の位などで丸める）
 * @returns 切り捨てられた値
 */
function customRoundDown(value: number, decimals = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.floor(value * factor) / factor;
}

/**
 * カスタム関数の定義
 */
const customFunctions = {
  ROUND: customRound,
  ROUNDUP: customRoundUp,
  ROUNDDOWN: customRoundDown,
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
/**
 * カスタム丸め関数呼び出しを処理する
 * ROUND(expr, decimals), ROUNDUP(expr, decimals), ROUNDDOWN(expr, decimals) を
 * 事前に評価して数値に置き換える
 *
 * @param formula - 処理する数式
 * @param variables - 変数
 * @returns 丸め関数を処理済みの数式
 */
function processCustomRoundFunctions(formula: string, variables: Record<string, number>): string {
  let result = formula;

  // 関数と対応する処理関数のマッピング
  const roundFunctions: Array<{ pattern: RegExp; fn: (value: number, decimals: number) => number }> = [
    { pattern: /ROUND\s*\(/gi, fn: customRound },
    { pattern: /ROUNDUP\s*\(/gi, fn: customRoundUp },
    { pattern: /ROUNDDOWN\s*\(/gi, fn: customRoundDown },
  ];

  for (const { pattern, fn } of roundFunctions) {
    // 関数呼び出しを検出して処理
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

      // カンマで分割（ただしネストされた括弧内のカンマは無視）
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
        // 変数を置換してから評価
        let valueExpr = args[0];
        const sortedVariables = Object.entries(variables).sort(([a], [b]) => b.length - a.length);
        for (const [varName, varValue] of sortedVariables) {
          const escapedVarName = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          // ドット記法の変数（Initial.AttackP等）は単語境界が効かないため、
          // 前後の文字が英数字またはドットでないことを確認する
          const regex = new RegExp(`(?<![a-zA-Z0-9._])${escapedVarName}(?![a-zA-Z0-9._])`, 'g');
          valueExpr = valueExpr.replace(regex, String(varValue));
        }
        // ネストされたROUND関数を再帰的に処理
        valueExpr = processCustomRoundFunctions(valueExpr, variables);
        value = evaluate(valueExpr.replace(/ln\(/g, 'log('));
      } catch {
        // 評価できない場合はスキップ（後でmathjsに任せる）
        pattern.lastIndex = endIndex + 1;
        continue;
      }

      // 第2引数（桁数、省略時は0）
      let decimals = 0;
      if (args.length > 1) {
        try {
          let decExpr = args[1];
          const sortedVariables = Object.entries(variables).sort(([a], [b]) => b.length - a.length);
          for (const [varName, varValue] of sortedVariables) {
            const escapedVarName = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // ドット記法の変数対応
            const regex = new RegExp(`(?<![a-zA-Z0-9._])${escapedVarName}(?![a-zA-Z0-9._])`, 'g');
            decExpr = decExpr.replace(regex, String(varValue));
          }
          decimals = evaluate(decExpr);
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

export function evaluateFormula(formula: string, variables: Record<string, number>): number {
  try {
    // 数式文字列の準備
    let processedFormula = formula;

    // 変数を実際の値に置換
    // 変数名が長い順にソートして、部分一致を防ぐ
    const sortedVariables = Object.entries(variables)
      .sort(([a], [b]) => b.length - a.length);

    for (const [varName, value] of sortedVariables) {
      // 変数名を正規表現でエスケープ
      const escapedVarName = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // ドット記法の変数（Initial.AttackP等）は単語境界が効かないため、
      // 前後の文字が英数字またはドットでないことを確認する
      // (?<![a-zA-Z0-9._]) は後読みアサーション、(?![a-zA-Z0-9._]) は先読みアサーション
      const regex = new RegExp(`(?<![a-zA-Z0-9._])${escapedVarName}(?![a-zA-Z0-9._])`, 'g');
      processedFormula = processedFormula.replace(regex, String(value));
    }

    // カスタム丸め関数（ROUND, ROUNDUP, ROUNDDOWN）を処理
    // 負の桁指定に対応するため、mathjsに渡す前に独自処理
    processedFormula = processCustomRoundFunctions(processedFormula, variables);

    // その他のカスタム関数の置換
    processedFormula = processedFormula.replace(/ln\(/g, 'log(');

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