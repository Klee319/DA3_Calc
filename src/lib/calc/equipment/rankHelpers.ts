/**
 * 装備ランク関連のヘルパー関数
 */

import { EquipmentRank, RANK_ORDER } from './types';

/**
 * ランクの妥当性チェック
 */
export function validateRank(rank: EquipmentRank, minRank?: string, maxRank?: string): boolean {
  const rankIndex = RANK_ORDER.indexOf(rank);
  if (rankIndex === -1) return false;

  if (minRank) {
    const minIndex = RANK_ORDER.indexOf(minRank as EquipmentRank);
    if (minIndex !== -1 && rankIndex > minIndex) return false; // より低いランク
  }

  if (maxRank) {
    const maxIndex = RANK_ORDER.indexOf(maxRank as EquipmentRank);
    if (maxIndex !== -1 && rankIndex < maxIndex) return false; // より高いランク
  }

  return true;
}

/**
 * ランクを有効範囲にクランプする
 * 指定されたランクが範囲外の場合、有効な範囲内のランクを返す
 */
export function clampRank(rank: EquipmentRank, minRank?: string, maxRank?: string): EquipmentRank {
  let rankIndex = RANK_ORDER.indexOf(rank);
  if (rankIndex === -1) rankIndex = 0; // デフォルトはSSS

  // 最高ランクより高い場合、最高ランクにクランプ
  if (maxRank) {
    const maxIndex = RANK_ORDER.indexOf(maxRank as EquipmentRank);
    if (maxIndex !== -1 && rankIndex < maxIndex) {
      rankIndex = maxIndex;
    }
  }

  // 最低ランクより低い場合、最低ランクにクランプ
  if (minRank) {
    const minIndex = RANK_ORDER.indexOf(minRank as EquipmentRank);
    if (minIndex !== -1 && rankIndex > minIndex) {
      rankIndex = minIndex;
    }
  }

  return RANK_ORDER[rankIndex];
}
