/**
 * 職業・SPシステム計算モジュール
 * @module jobCalculator
 * @description 職業レベル、SPツリー、職業補正の計算を行う
 */

import { JobConstData, JobSPData } from '@/types/data';

// ===== 型定義 =====

/**
 * 職業名の型
 */
export type Job = string;

/**
 * SP系統
 */
export type SPBranch = 'A' | 'B' | 'C';

/**
 * ステータスの型
 */
export type StatType =
  | 'HP' | 'MP' | 'Power' | 'Magic' | 'Mind'
  | 'Agility' | 'Dex' | 'Defense' | 'CritDamage';

/**
 * 職業ステータス
 */
export interface JobStats {
  HP?: number;
  MP?: number;
  Power?: number;
  Magic?: number;
  Mind?: number;
  Agility?: number;
  Dex?: number;
  Defense?: number;
  CritDamage?: number;
  [key: string]: number | undefined;
}

/**
 * SP割り振り
 */
export interface SPAllocation {
  branch: SPBranch;
  tier: number;  // 1-based (A-1なら1, A-2なら2)
  spCost: number; // このノードを取得するのに必要なSP
}

/**
 * SPボーナス
 */
export interface SPBonus {
  体力?: number;
  力?: number;
  魔力?: number;
  精神?: number;
  素早さ?: number;
  器用さ?: number;
  撃力?: number;
  守備力?: number;
  [key: string]: number | undefined;
}

/**
 * 職業補正（%）
 */
export interface JobCorrection {
  HP?: number;
  Power?: number;
  Magic?: number;
  Mind?: number;
  Agility?: number;
  Dex?: number;
  Defense?: number;
  CritDamage?: number;
  [key: string]: number | undefined;
}

/**
 * バリデーション結果
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * SPツリーデータ（CSVから変換した形式）
 */
export interface SPTreeData {
  initialStats: JobStats;
  jobCorrection: JobCorrection;
  spNodes: SPNode[];
}

/**
 * SPノード
 */
export interface SPNode {
  branch: SPBranch;
  tier: number;
  requiredSP: number;
  skillName?: string;
  stats: SPBonus;
}

// ===== ユーティリティ関数 =====

/**
 * 数値への変換（空文字は0として扱う）
 */
function toNumber(value: string | number | undefined): number {
  if (value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  return parseFloat(value) || 0;
}

/**
 * JobSPDataからSPTreeDataへの変換
 */
export function convertToSPTree(jobSPData: JobSPData[]): SPTreeData {
  const initialStats: JobStats = {};
  const jobCorrection: JobCorrection = {};
  const spNodes: SPNode[] = [];

  for (const row of jobSPData) {
    const stage = row.解法段階;
    
    if (stage === '初期値') {
      // 初期値の設定
      initialStats.HP = toNumber(row.体力);
      initialStats.Power = toNumber(row.力);
      initialStats.Magic = toNumber(row.魔力);
      initialStats.Mind = toNumber(row.精神);
      initialStats.Agility = toNumber(row.素早さ);
      initialStats.Dex = toNumber(row.器用さ);
      initialStats.CritDamage = toNumber(row.撃力);
      initialStats.Defense = toNumber(row.守備力);
    } else if (stage === '職業補正(%)') {
      // 職業補正の設定
      jobCorrection.HP = toNumber(row.体力);
      jobCorrection.Power = toNumber(row.力);
      jobCorrection.Magic = toNumber(row.魔力);
      jobCorrection.Mind = toNumber(row.精神);
      jobCorrection.Agility = toNumber(row.素早さ);
      jobCorrection.Dex = toNumber(row.器用さ);
      jobCorrection.CritDamage = toNumber(row.撃力);
      jobCorrection.Defense = toNumber(row.守備力);
    } else if (stage.match(/^[A-C]-\d+$/)) {
      // SPノードの設定
      const [branch, tierStr] = stage.split('-');
      const tier = parseInt(tierStr);
      
      spNodes.push({
        branch: branch as SPBranch,
        tier: tier,
        requiredSP: toNumber(row.必要SP),
        skillName: row.解法スキル名,
        stats: {
          体力: toNumber(row.体力),
          力: toNumber(row.力),
          魔力: toNumber(row.魔力),
          精神: toNumber(row.精神),
          素早さ: toNumber(row.素早さ),
          器用さ: toNumber(row.器用さ),
          撃力: toNumber(row.撃力),
          守備力: toNumber(row.守備力),
        }
      });
    }
  }

  return {
    initialStats,
    jobCorrection,
    spNodes
  };
}

// ===== メイン関数 =====

/**
 * 1. 職業基礎ステータス計算
 * 仕様書 §4.3に基づいて、レベルごとに基礎ステータスを計算
 */
export function calculateJobBaseStats(
  job: Job,
  level: number,
  jobConst: JobConstData
): JobStats {
  // JobConstDataから職業の基礎ステータスを取得
  const jobDef = jobConst.JobDefinition[job];
  if (!jobDef) {
    throw new Error(`職業 "${job}" が見つかりません`);
  }

  // レベル範囲チェック（最大レベルはJobConstDataに定義されている場合）
  if (level < 1) {
    throw new Error(`レベルは1以上である必要があります: ${level}`);
  }

  // 基礎ステータスの計算
  // 力、魔力、体力、精神はレベルごとに+1
  const baseStats: JobStats = {
    HP: (jobDef.HP || 0) + level,  // 体力: 初期値 + レベル
    Power: (jobDef.STR || 0) + level,  // 力: 初期値 + レベル
    Magic: (jobDef.INT || 0) + level,  // 魔力: 初期値 + レベル
    Mind: (jobDef.MND || 0) + level,   // 精神: 初期値 + レベル
    Agility: jobDef.AGI || 0,  // 素早さ: 初期値のまま（レベルアップしない）
    Dex: jobDef.DEX || 0,       // 器用さ: 初期値のまま（レベルアップしない）
    // Defense, CritDamageは職業定数に含まれない場合は0
    Defense: 0,
    CritDamage: 0
  };

  return baseStats;
}

/**
 * 2. SP獲得量計算
 * 仕様書 §4.2に基づいて、レベル×2のSPを獲得
 */
export function calculateTotalSP(level: number): number {
  if (level < 1) {
    throw new Error(`レベルは1以上である必要があります: ${level}`);
  }
  return level * 2;
}

/**
 * 3. SPツリー検証
 * 仕様書 §4.1に基づいて、SP割り振りの妥当性を検証
 */
export function validateSPAllocation(
  spAllocation: SPAllocation[],
  spTree: SPTreeData,
  totalSP: number
): ValidationResult {
  const errors: string[] = [];

  // 系統ごとの最大tier
  const maxTierPerBranch: Record<SPBranch, number> = { A: 0, B: 0, C: 0 };
  
  // 系統ごとの累計SP
  const spPerBranch: Record<SPBranch, number> = { A: 0, B: 0, C: 0 };
  
  // 各ノードの必要SPを計算
  for (const allocation of spAllocation) {
    const { branch, tier } = allocation;
    
    // 順序チェック：前のtierが取得済みか
    if (tier > 1 && maxTierPerBranch[branch] < tier - 1) {
      errors.push(`${branch}-${tier}を取得するには${branch}-${tier - 1}を先に取得する必要があります`);
    }
    
    // 対応するSPノードを探す
    const node = spTree.spNodes.find(n => n.branch === branch && n.tier === tier);
    if (!node) {
      errors.push(`${branch}-${tier}はSPツリーに存在しません`);
      continue;
    }
    
    // 必要SPチェック
    if (node.requiredSP > spPerBranch[branch] + allocation.spCost) {
      errors.push(`${branch}-${tier}を取得するには${node.requiredSP}SP必要ですが、${spPerBranch[branch] + allocation.spCost}SPしかありません`);
    }
    
    spPerBranch[branch] += allocation.spCost;
    maxTierPerBranch[branch] = Math.max(maxTierPerBranch[branch], tier);
  }
  
  // 総SP量チェック
  const usedSP = spPerBranch.A + spPerBranch.B + spPerBranch.C;
  if (usedSP > totalSP) {
    errors.push(`SPが上限を超えています: 使用SP=${usedSP}, 最大SP=${totalSP}`);
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * 4. SPボーナス計算
 * 各SPノードのボーナスを合算
 */
export function calculateSPBonus(
  spAllocation: SPAllocation[],
  spTree: SPTreeData
): SPBonus {
  const totalBonus: SPBonus = {};
  
  for (const allocation of spAllocation) {
    const { branch, tier } = allocation;
    
    // 対応するSPノードを探す
    const node = spTree.spNodes.find(n => n.branch === branch && n.tier === tier);
    if (!node) continue;
    
    // ボーナスを加算
    for (const [key, value] of Object.entries(node.stats)) {
      if (value) {
        totalBonus[key] = (totalBonus[key] || 0) + value;
      }
    }
  }
  
  return totalBonus;
}

/**
 * 5. 職業補正計算
 * 職業ごとの%補正を返す
 */
export function calculateJobCorrection(
  job: Job,
  jobConst: JobConstData
): JobCorrection {
  const jobDef = jobConst.JobDefinition[job];
  if (!jobDef) {
    throw new Error(`職業 "${job}" が見つかりません`);
  }
  
  // JobCorrectionがある場合はそれを使用、なければ空オブジェクト
  const correction: JobCorrection = {};
  
  if (jobDef.JobCorrection) {
    // JobCorrectionのキーをマッピング
    for (const [key, value] of Object.entries(jobDef.JobCorrection)) {
      correction[key] = value;
    }
  }
  
  return correction;
}

/**
 * 6. 統合関数
 * 職業の全ステータスを計算して返す
 */
export function calculateAllJobStats(
  job: Job,
  level: number,
  spAllocation: SPAllocation[],
  jobConst: JobConstData,
  jobSPData?: JobSPData[]
): JobStats {
  // レベル範囲チェック
  if (level < 1 || level > 100) {
    throw new Error(`レベルは1-100の範囲である必要があります: ${level}`);
  }
  
  // 基礎ステータス計算
  let stats = calculateJobBaseStats(job, level, jobConst);
  
  // JobSPDataがある場合はSPボーナスを適用
  if (jobSPData && jobSPData.length > 0) {
    const spTree = convertToSPTree(jobSPData);
    
    // SPツリーから初期値を適用
    // CSVに初期値がある項目（値が0でない場合）のみ上書き
    // レベル成長するステータス
    if (spTree.initialStats.HP !== undefined && spTree.initialStats.HP !== 0) {
      stats.HP = spTree.initialStats.HP + level;
    }
    if (spTree.initialStats.Power !== undefined && spTree.initialStats.Power !== 0) {
      stats.Power = spTree.initialStats.Power + level;
    }
    if (spTree.initialStats.Magic !== undefined && spTree.initialStats.Magic !== 0) {
      stats.Magic = spTree.initialStats.Magic + level;
    }
    if (spTree.initialStats.Mind !== undefined && spTree.initialStats.Mind !== 0) {
      stats.Mind = spTree.initialStats.Mind + level;
    }
    
    // レベル成長しないステータス（値が明示的に設定されている場合のみ上書き）
    if (spTree.initialStats.Agility !== undefined && spTree.initialStats.Agility !== 0) {
      stats.Agility = spTree.initialStats.Agility;
    }
    if (spTree.initialStats.Dex !== undefined && spTree.initialStats.Dex !== 0) {
      stats.Dex = spTree.initialStats.Dex;
    }
    if (spTree.initialStats.CritDamage !== undefined && spTree.initialStats.CritDamage !== 0) {
      stats.CritDamage = spTree.initialStats.CritDamage;
    }
    if (spTree.initialStats.Defense !== undefined && spTree.initialStats.Defense !== 0) {
      stats.Defense = spTree.initialStats.Defense;
    }
    
    // SP割り振りの検証
    const totalSP = calculateTotalSP(level);
    const validation = validateSPAllocation(spAllocation, spTree, totalSP);
    
    if (!validation.valid) {
      throw new Error(`SP割り振りエラー: ${validation.errors?.join(', ')}`);
    }
    
    // SPボーナスの計算と適用
    const spBonus = calculateSPBonus(spAllocation, spTree);
    
    // SPボーナスをステータスに加算
    // 日本語キーを英語キーにマッピング
    const keyMapping: Record<string, keyof JobStats> = {
      '体力': 'HP',
      '力': 'Power',
      '魔力': 'Magic',
      '精神': 'Mind',
      '素早さ': 'Agility',
      '器用さ': 'Dex',
      '撃力': 'CritDamage',
      '守備力': 'Defense'
    };
    
    for (const [jpKey, value] of Object.entries(spBonus)) {
      const enKey = keyMapping[jpKey];
      if (enKey && value) {
        stats[enKey] = (stats[enKey] || 0) + value;
      }
    }
  }
  
  return stats;
}

// ===== エクスポート =====

export default {
  calculateJobBaseStats,
  calculateTotalSP,
  validateSPAllocation,
  calculateSPBonus,
  calculateJobCorrection,
  calculateAllJobStats,
  convertToSPTree
};