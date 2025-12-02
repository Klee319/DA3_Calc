// 最適化機能は今後実装予定のため一時的に削除
// このファイルは最適化ページが将来実装された際に使用されます

import { CharacterBuild, EquipSlot } from '@/types';
import { OptimizeConstraints, OptimizeResult, EnemyParams, OptimizeProgress } from '@/types/optimize';
import { GameData } from '@/types/data';

/**
 * 装備の最適化を実行する（プレースホルダー）
 */
export async function optimizeEquipment(
  _currentBuild: CharacterBuild,
  _targetSlots: EquipSlot[],
  _constraints: OptimizeConstraints,
  _skillForEvaluation: string,
  _enemyParams: EnemyParams,
  _gameData: GameData,
  _onProgress?: (progress: OptimizeProgress) => void
): Promise<OptimizeResult[]> {
  // TODO: 今後実装予定
  return [];
}

/**
 * CSV出力用のデータを生成（プレースホルダー）
 */
export function generateOptimizeResultCSV(_results: OptimizeResult[]): string {
  // TODO: 今後実装予定
  return '';
}
