/**
 * 装備システム - 型定義
 */

import {
  WeaponData,
  ArmorData,
  AccessoryData,
  EmblemData,
  RunestoneData,
} from '@/types/data';

// ===== 型定義 =====

/**
 * 装備ランク
 */
export type EquipmentRank = 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

/**
 * 武器ランク（装備ランクのエイリアス）
 */
export type WeaponRank = EquipmentRank;

/**
 * 武器叩き回数（パラメータ別）
 */
export interface WeaponSmithingCounts {
  attackPower?: number;  // 攻撃力
  critRate?: number;     // 会心率
  critDamage?: number;   // 会心ダメージ
}

/**
 * ステータスブロック
 */
export interface StatBlock {
  [key: string]: number;
}

/**
 * 装備ステータス
 */
export interface EquipmentStats {
  // 基礎値
  initial: StatBlock;
  // 各種加算値
  rankBonus: StatBlock;
  reinforcement: StatBlock;
  forge: StatBlock;
  alchemy: StatBlock;
  // 最終値
  final: StatBlock;
  // 武器固有
  attackPower?: number;
  critRate?: number;
  critDamage?: number;
  damageCorrection?: number;
  coolTime?: number;
}

/**
 * 選択された装備
 */
export interface SelectedEquipment {
  weapon?: {
    data: WeaponData;
    rank: WeaponRank;
    reinforcement: number;
    hammerCount: number;
    alchemyEnabled: boolean;
  };
  head?: {
    data: ArmorData;
    rank: EquipmentRank;
    reinforcement: number;
    tatakiCount?: number;
  };
  body?: {
    data: ArmorData;
    rank: EquipmentRank;
    reinforcement: number;
    tatakiCount?: number;
  };
  leg?: {
    data: ArmorData;
    rank: EquipmentRank;
    reinforcement: number;
    tatakiCount?: number;
  };
  necklace?: {
    data: AccessoryData;
    rank: EquipmentRank;
  };
  bracelet?: {
    data: AccessoryData;
    rank: EquipmentRank;
  };
  emblem?: EmblemData;
  runes?: RunestoneData[];
  ring?: any;
}

/**
 * リングデータ（未実装）
 */
export interface RingData {
  // 将来実装予定
}

/**
 * 防具叩き配分（ステータス別の叩き回数）
 */
export interface ArmorSmithingDistribution {
  power?: number;      // 力
  magic?: number;      // 魔力
  hp?: number;         // 体力
  mind?: number;       // 精神
  speed?: number;      // 素早さ
  dexterity?: number;  // 器用
  critDamage?: number; // 撃力
  defense?: number;    // 守備力
}

/**
 * ランクリスト
 */
export const RANK_ORDER: EquipmentRank[] = ['SSS', 'SS', 'S', 'A', 'B', 'C', 'D', 'E', 'F'];
