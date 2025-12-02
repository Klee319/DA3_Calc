// 最適化用の型定義（今後実装予定のため最小限のプレースホルダー）

import { CharacterBuild, EquipSlot } from './index';
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
  weaponRankMin?: number;
  weaponRankMax?: number;
  armorRankMin?: number;
  fixedEquipment?: Partial<Record<EquipSlot, string>>;
  targetSlots: EquipSlot[];
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
    [key: string]: unknown;
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
