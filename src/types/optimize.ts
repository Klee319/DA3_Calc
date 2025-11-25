// 最適化用の型定義

import { CharacterBuild, EquipSlot } from './index';
import { GameData } from './data';
import { EquipmentSet } from './calc';

// 敵パラメータ
export interface EnemyParams {
  name: string;
  level: number;
  DEF: number;
  MDEF: number;
  element?: string;
  race?: string;
  size?: string;
}

// 探索制約条件
export interface OptimizeConstraints {
  // 武器ランクの上限・下限
  weaponRankMin?: number;
  weaponRankMax?: number;
  // 防具ランクの下限
  armorRankMin?: number;
  // 固定装備（探索対象外にする装備）
  fixedEquipment?: Partial<Record<EquipSlot, string>>;
  // 探索対象のスロット
  targetSlots: EquipSlot[];
  // 最大探索組み合わせ数（パフォーマンス制限）
  maxCombinations?: number;
}

// 最適化結果
export interface OptimizeResult {
  rank: number;
  build: CharacterBuild;
  equipment: EquipmentSet;
  expectedDamage: number;
  calculatedStats: {
    ATK?: number;
    MATK?: number;
    CRI?: number;
    HIT?: number;
    [key: string]: any;
  };
  damageDetails: {
    baseDamage: number;
    critRate: number;
    hitRate: number;
    elementalBonus?: number;
    skillMultiplier?: number;
  };
}

// 最適化プログレス情報
export interface OptimizeProgress {
  current: number;
  total: number;
  currentBest: number;
  message: string;
}

// 探索条件
export interface OptimizeConditions {
  currentBuild: CharacterBuild;
  targetSlots: EquipSlot[];
  constraints: OptimizeConstraints;
  skillForEvaluation: string;
  enemyParams: EnemyParams;
  gameData: GameData;
}