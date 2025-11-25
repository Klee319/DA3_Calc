// 装備最適化ロジック

import {
  CharacterBuild,
  EquipSlot,
  Equipment,
  CalculatedStats,
} from '@/types';
import {
  OptimizeConstraints,
  OptimizeResult,
  EnemyParams,
  OptimizeProgress,
} from '@/types/optimize';
import { GameData } from '@/types/data';
import { EquipmentSet, SkillResult } from '@/types/calc';
import { calcExpectedSkillDamage } from './skillDamage';
import { calcFinalStatus } from './userStatus';
import { sumEquipmentStats } from './equipmentStatus';

/**
 * 装備の最適化を実行する
 */
export async function optimizeEquipment(
  currentBuild: CharacterBuild,
  targetSlots: EquipSlot[],
  constraints: OptimizeConstraints,
  skillForEvaluation: string,
  enemyParams: EnemyParams,
  gameData: GameData,
  onProgress?: (progress: OptimizeProgress) => void
): Promise<OptimizeResult[]> {
  const results: OptimizeResult[] = [];
  
  // 探索対象の装備候補を取得
  const equipmentCandidates = getEquipmentCandidates(
    targetSlots,
    constraints,
    gameData
  );

  // 組み合わせ総数を計算
  const totalCombinations = calculateTotalCombinations(equipmentCandidates);
  const maxCombinations = constraints.maxCombinations || 10000;
  
  if (totalCombinations > maxCombinations) {
    // 組み合わせが多すぎる場合は貪欲法で探索
    return greedyOptimization(
      currentBuild,
      equipmentCandidates,
      skillForEvaluation,
      enemyParams,
      gameData,
      onProgress
    );
  }

  // 全探索実行
  let current = 0;
  let currentBest = 0;

  // 固定装備を設定
  const baseEquipment: EquipmentSet = {};
  if (constraints.fixedEquipment) {
    for (const [slot, equipId] of Object.entries(constraints.fixedEquipment)) {
      if (equipId) {
        baseEquipment[slot as EquipSlot] = findEquipmentById(equipId, gameData);
      }
    }
  }

  // 再帰的に全組み合わせを探索
  await exploreAllCombinations(
    targetSlots,
    equipmentCandidates,
    0,
    baseEquipment,
    currentBuild,
    skillForEvaluation,
    enemyParams,
    gameData,
    results,
    (progress) => {
      current++;
      if (progress.expectedDamage > currentBest) {
        currentBest = progress.expectedDamage;
      }
      if (onProgress && current % 100 === 0) {
        onProgress({
          current,
          total: totalCombinations,
          currentBest,
          message: `探索中... ${current}/${totalCombinations}`
        });
      }
    }
  );

  // 結果をダメージ降順でソート
  results.sort((a, b) => b.expectedDamage - a.expectedDamage);

  // 上位100件のみ返す
  return results.slice(0, 100);
}

/**
 * 探索対象の装備候補を取得
 */
function getEquipmentCandidates(
  targetSlots: EquipSlot[],
  constraints: OptimizeConstraints,
  gameData: GameData
): Record<EquipSlot, Equipment[]> {
  const candidates: Record<EquipSlot, Equipment[]> = {} as any;

  for (const slot of targetSlots) {
    candidates[slot] = [];
    
    // スロットに応じて装備を絞り込み
    let equipmentList: any[] = [];
    
    switch (slot) {
      case 'weapon':
        equipmentList = gameData.csv.weapons || [];
        // 武器ランクでフィルタ
        if (constraints.weaponRankMin !== undefined || constraints.weaponRankMax !== undefined) {
          equipmentList = equipmentList.filter((eq: any) => {
            const rank = eq.rank || 0;
            if (constraints.weaponRankMin !== undefined && rank < constraints.weaponRankMin) return false;
            if (constraints.weaponRankMax !== undefined && rank > constraints.weaponRankMax) return false;
            return true;
          });
        }
        break;
      case 'head':
      case 'body':
      case 'arm':
      case 'leg':
        equipmentList = (gameData.csv.armors || []).filter((armor: any) => 
          armor.slot === slot
        );
        // 防具ランクでフィルタ
        if (constraints.armorRankMin !== undefined) {
          equipmentList = equipmentList.filter((eq: any) => {
            const rank = eq.rank || 0;
            return rank >= constraints.armorRankMin!;
          });
        }
        break;
      case 'accessory1':
      case 'accessory2':
        equipmentList = gameData.csv.accessories || [];
        break;
    }

    // 職業制限をチェック（TODO: 実際の職業データ構造に合わせて調整）
    // equipmentList = equipmentList.filter(eq => {
    //   if (!eq.requiredJob) return true;
    //   return eq.requiredJob.includes(currentBuild.job?.id || '');
    // });

    candidates[slot] = equipmentList.slice(0, 50); // パフォーマンスのため上位50個に制限
  }

  return candidates;
}

/**
 * 組み合わせ総数を計算
 */
function calculateTotalCombinations(
  equipmentCandidates: Record<EquipSlot, Equipment[]>
): number {
  let total = 1;
  for (const slot in equipmentCandidates) {
    total *= Math.max(1, equipmentCandidates[slot as EquipSlot].length);
  }
  return total;
}

/**
 * 全組み合わせを再帰的に探索
 */
async function exploreAllCombinations(
  targetSlots: EquipSlot[],
  equipmentCandidates: Record<EquipSlot, Equipment[]>,
  slotIndex: number,
  currentEquipment: EquipmentSet,
  baseBuild: CharacterBuild,
  skillForEvaluation: string,
  enemyParams: EnemyParams,
  gameData: GameData,
  results: OptimizeResult[],
  onExplore: (progress: { expectedDamage: number }) => void
): Promise<void> {
  // 全スロットを探索済み
  if (slotIndex >= targetSlots.length) {
    // ダメージを計算
    const result = await evaluateBuild(
      baseBuild,
      currentEquipment,
      skillForEvaluation,
      enemyParams,
      gameData
    );
    
    if (result) {
      results.push(result);
      onExplore({ expectedDamage: result.expectedDamage });
    }
    return;
  }

  const slot = targetSlots[slotIndex];
  const candidates = equipmentCandidates[slot];

  // 装備なしの場合も探索
  currentEquipment[slot] = undefined;
  await exploreAllCombinations(
    targetSlots,
    equipmentCandidates,
    slotIndex + 1,
    currentEquipment,
    baseBuild,
    skillForEvaluation,
    enemyParams,
    gameData,
    results,
    onExplore
  );

  // 各装備候補を探索
  for (const equipment of candidates) {
    currentEquipment[slot] = equipment as any;
    await exploreAllCombinations(
      targetSlots,
      equipmentCandidates,
      slotIndex + 1,
      currentEquipment,
      baseBuild,
      skillForEvaluation,
      enemyParams,
      gameData,
      results,
      onExplore
    );
  }

  // クリーンアップ
  delete currentEquipment[slot];
}

/**
 * 貪欲法による最適化
 */
async function greedyOptimization(
  currentBuild: CharacterBuild,
  equipmentCandidates: Record<EquipSlot, Equipment[]>,
  skillForEvaluation: string,
  enemyParams: EnemyParams,
  gameData: GameData,
  onProgress?: (progress: OptimizeProgress) => void
): Promise<OptimizeResult[]> {
  const results: OptimizeResult[] = [];
  const baseEquipment: EquipmentSet = {};
  
  // 各スロットごとに最適な装備を選択
  let currentBest = 0;
  let iteration = 0;
  const totalIterations = Object.keys(equipmentCandidates).length;

  for (const [slot, candidates] of Object.entries(equipmentCandidates)) {
    let bestEquipment: Equipment | undefined;
    let bestDamage = 0;

    // 装備なしの場合
    baseEquipment[slot as EquipSlot] = undefined;
    const noneResult = await evaluateBuild(
      currentBuild,
      baseEquipment,
      skillForEvaluation,
      enemyParams,
      gameData
    );
    if (noneResult && noneResult.expectedDamage > bestDamage) {
      bestDamage = noneResult.expectedDamage;
      bestEquipment = undefined;
    }

    // 各装備候補を評価
    for (const equipment of candidates) {
      baseEquipment[slot as EquipSlot] = equipment as any;
      const result = await evaluateBuild(
        currentBuild,
        baseEquipment,
        skillForEvaluation,
        enemyParams,
        gameData
      );
      
      if (result && result.expectedDamage > bestDamage) {
        bestDamage = result.expectedDamage;
        bestEquipment = equipment;
      }
    }

    // 最適な装備を設定
    baseEquipment[slot as EquipSlot] = bestEquipment as any;
    currentBest = bestDamage;
    
    iteration++;
    if (onProgress) {
      onProgress({
        current: iteration,
        total: totalIterations,
        currentBest,
        message: `スロット ${slot} を最適化中...`
      });
    }
  }

  // 最終結果を評価
  const finalResult = await evaluateBuild(
    currentBuild,
    baseEquipment,
    skillForEvaluation,
    enemyParams,
    gameData
  );
  
  if (finalResult) {
    results.push(finalResult);
  }

  // 追加で上位候補を生成（ランダムサンプリング）
  for (let i = 0; i < 20; i++) {
    const randomEquipment: EquipmentSet = {};
    for (const [slot, candidates] of Object.entries(equipmentCandidates)) {
      if (candidates.length > 0 && Math.random() > 0.3) {
        const randomIndex = Math.floor(Math.random() * candidates.length);
        randomEquipment[slot as EquipSlot] = candidates[randomIndex] as any;
      }
    }
    
    const result = await evaluateBuild(
      currentBuild,
      randomEquipment,
      skillForEvaluation,
      enemyParams,
      gameData
    );
    
    if (result) {
      results.push(result);
    }
  }

  // 結果をソート
  results.sort((a, b) => b.expectedDamage - a.expectedDamage);
  return results;
}

/**
 * ビルドを評価してダメージを計算
 */
async function evaluateBuild(
  baseBuild: CharacterBuild,
  equipment: EquipmentSet,
  skillForEvaluation: string,
  enemyParams: EnemyParams,
  gameData: GameData
): Promise<OptimizeResult | null> {
  try {
    // ビルドを更新
    const updatedBuild: CharacterBuild = {
      ...baseBuild,
      equipment: {
        ...baseBuild.equipment,
        ...equipment
      } as any
    };

    // ステータス計算
    const userStatus = calcFinalStatus(
      equipment as EquipmentSet,  // 装備セット
      updatedBuild.job?.name || '',  // ジョブ名
      updatedBuild.level || 1,  // レベル
      updatedBuild.spAllocation || {},  // SP割り振り
      []  // ジョブSPデータ（TODO: 実際のデータを渡す）
    );

    const equipmentStatus = sumEquipmentStats(equipment as EquipmentSet);
    
    // 最終ステータス（簡易版）
    const finalStats = {
      ATK: (userStatus.ATK || 0) + (equipmentStatus.ATK || 0),
      MATK: (userStatus.MATK || 0) + (equipmentStatus.MATK || 0),
      DEF: (userStatus.DEF || 0) + (equipmentStatus.DEF || 0),
      MDEF: (userStatus.MDEF || 0) + (equipmentStatus.MDEF || 0),
      CRI: (userStatus.CRI || 0) + (equipmentStatus.CRI || 0),
      HIT: (userStatus.HIT || 0) + (equipmentStatus.HIT || 0),
    };

    // ダメージ計算 (TODO: 実際のダメージ計算ロジックを実装)
    // 一時的にダミーデータを使用
    const skillResult: SkillResult = {
      damage: 1000,
      hits: 1,
      totalDamage: 1000,
      mp: 10,
      ct: 3
    };
    
    const damageResult = calcExpectedSkillDamage(
      skillResult,
      finalStats.CRI || 0,  // クリティカル率
      50  // クリティカルダメージボーナス（仮）
    );

    if (!damageResult) {
      return null;
    }

    return {
      rank: 0, // 後で設定
      build: updatedBuild,
      equipment,
      expectedDamage: damageResult,  // 数値そのものを使用
      calculatedStats: finalStats,
      damageDetails: {
        baseDamage: skillResult.damage,
        critRate: finalStats.CRI || 0,
        hitRate: 100,
        elementalBonus: 0,
        skillMultiplier: 1,
      }
    };
  } catch (error) {
    console.error('Build evaluation error:', error);
    return null;
  }
}

/**
 * 装備IDから装備データを検索
 */
function findEquipmentById(id: string, gameData: GameData): any {
  // 武器から検索
  if (gameData.csv.weapons) {
    const weapon = gameData.csv.weapons.find((w: any) => w.id === id);
    if (weapon) return weapon;
  }
  
  // 防具から検索
  if (gameData.csv.armors) {
    const armor = gameData.csv.armors.find((a: any) => a.id === id);
    if (armor) return armor;
  }
  
  // アクセサリーから検索
  if (gameData.csv.accessories) {
    const accessory = gameData.csv.accessories.find((a: any) => a.id === id);
    if (accessory) return accessory;
  }
  
  return null;
}

/**
 * CSV出力用のデータを生成
 */
export function generateOptimizeResultCSV(results: OptimizeResult[]): string {
  const headers = [
    '順位',
    '期待ダメージ',
    '武器',
    '頭',
    '胴',
    '腕',
    '脚',
    'アクセ1',
    'アクセ2',
    'ATK',
    'MATK',
    'CRI',
    'HIT',
    '基本ダメージ',
    'クリティカル率',
    '命中率'
  ];

  const rows = results.map((result, index) => {
    const eq = result.equipment;
    return [
      index + 1,
      Math.floor(result.expectedDamage),
      (eq.weapon as any)?.name || '-',
      (eq.head as any)?.name || '-',
      (eq.body as any)?.name || '-',
      (eq.arm as any)?.name || '-',
      (eq.leg as any)?.name || '-',
      (eq.accessory1 as any)?.name || '-',
      (eq.accessory2 as any)?.name || '-',
      result.calculatedStats.ATK || 0,
      result.calculatedStats.MATK || 0,
      result.calculatedStats.CRI || 0,
      result.calculatedStats.HIT || 0,
      Math.floor(result.damageDetails.baseDamage),
      `${result.damageDetails.critRate.toFixed(1)}%`,
      `${result.damageDetails.hitRate.toFixed(1)}%`
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\\n');

  return csvContent;
}