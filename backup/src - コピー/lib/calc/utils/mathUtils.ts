/**
 * 数値計算ユーティリティ関数
 */

import { StatBlock } from '@/types/calc';

/**
 * 四捨五入
 * 浮動小数点誤差を考慮して、小数第10位で丸めてから四捨五入
 */
export function round(value: number): number {
  // 浮動小数点誤差を回避するため、一度小数第10位で丸める
  return Math.round(Math.round(value * 1e10) / 1e10);
}

/**
 * 切り上げ
 */
export function roundUp(value: number): number {
  return Math.ceil(value);
}

/**
 * 2つのStatBlockを加算
 */
export function addStats(a: StatBlock, b: StatBlock): StatBlock {
  const result: StatBlock = {};
  
  // aのすべてのキーを処理
  for (const key in a) {
    (result as any)[key] = ((a as any)[key] || 0) + ((b as any)[key] || 0);
  }
  
  // bにのみ存在するキーを処理
  for (const key in b) {
    if (!(key in result)) {
      (result as any)[key] = (b as any)[key] || 0;
    }
  }
  
  return result;
}

/**
 * 複数のStatBlockを加算
 */
export function sumStats(...blocks: StatBlock[]): StatBlock {
  return blocks.reduce((acc, block) => addStats(acc, block), {});
}

/**
 * StatBlockに係数を掛ける
 */
export function multiplyStats(stats: StatBlock, multiplier: number): StatBlock {
  const result: StatBlock = {};

  for (const key in stats) {
    if ((stats as any)[key] !== undefined) {
      (result as any)[key] = ((stats as any)[key] || 0) * multiplier;
    }
  }

  return result;
}

/**
 * ステータスが等しいか比較
 */
export function isEqualStats(a: StatBlock, b: StatBlock): boolean {
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const key of Array.from(allKeys)) {
    const aValue = (a as any)[key] || 0;
    const bValue = (b as any)[key] || 0;

    if (Math.abs(aValue - bValue) > 0.0001) {
      return false;
    }
  }

  return true;
}

/**
 * ステータスの複製
 */
export function cloneStats(stats: StatBlock): StatBlock {
  const result: StatBlock = {};
  for (const key in stats) {
    if ((stats as any)[key] !== undefined) {
      (result as any)[key] = (stats as any)[key];
    }
  }
  return result;
}

/**
 * StatBlockの各値に関数を適用
 */
export function mapStats(stats: StatBlock, fn: (value: number) => number): StatBlock {
  const result: StatBlock = {};

  for (const key in stats) {
    if ((stats as any)[key] !== undefined) {
      (result as any)[key] = fn((stats as any)[key] || 0);
    }
  }

  return result;
}