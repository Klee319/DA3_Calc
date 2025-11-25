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
  // JobConstDataの存在チェック
  if (!jobConst || !jobConst.JobDefinition) {
    console.error('JobConstDataが不正です:', jobConst);
    throw new Error('JobConstDataが未定義またはJobDefinitionが存在しません');
  }

  // JobConstDataから職業の基礎ステータスを取得
  const jobDef = jobConst.JobDefinition[job];
  if (!jobDef) {
    console.error(`職業 "${job}" が見つかりません。利用可能な職業:`, Object.keys(jobConst.JobDefinition));
    throw new Error(`職業 "${job}" が見つかりません`);
  }

  // レベル範囲チェック（最大レベルはJobConstDataに定義されている場合）
  if (level < 1) {
    throw new Error(`レベルは1以上である必要があります: ${level}`);
  }

  // 基礎ステータスの計算
  // 新計算式:
  //   - 体力・精神: 初期値 + (レベル × 1) - 1
  //   - 力・魔力: 初期値 + (レベル × 2) - 2
  const baseStats: JobStats = {
    HP: (jobDef.HP || 0) + (level * 1) - 1,     // 体力: 初期値 + (レベル × 1) - 1
    Power: (jobDef.STR || 0) + (level * 2) - 2, // 力: 初期値 + (レベル × 2) - 2
    Magic: (jobDef.INT || 0) + (level * 2) - 2, // 魔力: 初期値 + (レベル × 2) - 2
    Mind: (jobDef.MND || 0) + (level * 1) - 1,  // 精神: 初期値 + (レベル × 1) - 1
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
 * 解放済みスキル一覧を取得
 * 仕様書 §9 に基づく
 * @param job 職業名
 * @param spAllocation SP割り振り状況
 * @param jobSPData 職業CSVデータ配列
 * @returns 解放済みスキル情報の配列
 */
export function calculateUnlockedSkills(
  job: string,
  spAllocation: { A: number; B: number; C: number },
  jobSPData: JobSPData[]
): Array<{
  skillName: string;
  branch: 'A' | 'B' | 'C';
  tier: number;
  requiredSP: number;
}> {
  const unlockedSkills: Array<{
    skillName: string;
    branch: 'A' | 'B' | 'C';
    tier: number;
    requiredSP: number;
  }> = [];

  // 各ラインをチェック
  (['A', 'B', 'C'] as const).forEach((branch) => {
    const allocatedSP = spAllocation[branch] || 0;

    // 各ブランチの各ティアをチェック（最大50ティアまで）
    for (let tier = 1; tier <= 50; tier++) {
      const stageName = `${branch}-${tier}`;
      const row = jobSPData.find(r => r.解法段階 === stageName);

      if (!row) break; // これ以上のティアは存在しない

      const requiredSP = typeof row.必要SP === 'string'
        ? parseFloat(row.必要SP) || 0
        : row.必要SP || 0;

      // 必要SPが割り当てられたSP以下の場合、このスキルは解放される
      if (requiredSP <= allocatedSP) {
        const skillName = row.解法スキル名;
        if (skillName) {
          unlockedSkills.push({
            skillName,
            branch,
            tier,
            requiredSP: requiredSP,
          });
        }
      } else {
        break; // このブランチでこれ以上のスキルは解放されない
      }
    }
  });

  return unlockedSkills;
}

/**
 * 到達解放段階を取得
 * @param branch ライン（A/B/C）
 * @param allocatedSP 割り当てSP
 * @param jobSPData 職業CSVデータ配列
 * @returns 到達段階（例: "A-3"）
 */
export function getReachedTier(
  branch: 'A' | 'B' | 'C',
  allocatedSP: number,
  jobSPData: JobSPData[]
): string {
  let maxReachedTier = 0;

  // 各ティアをチェック（最大50ティアまで）
  for (let tier = 1; tier <= 50; tier++) {
    const stageName = `${branch}-${tier}`;
    const row = jobSPData.find(r => r.解法段階 === stageName);

    if (!row) break; // これ以上のティアは存在しない

    const requiredSP = typeof row.必要SP === 'string'
      ? parseFloat(row.必要SP) || 0
      : row.必要SP || 0;

    if (requiredSP <= allocatedSP) {
      maxReachedTier = tier;
    } else {
      break;
    }
  }

  return maxReachedTier > 0 ? `${branch}-${maxReachedTier}` : `${branch}-0`;
}

/**
 * 次のスキル解放情報を取得
 * @param spAllocation SP割り振り状況
 * @param jobSPData 職業CSVデータ配列
 * @returns 次に解放可能なスキル情報
 */
export function getNextSkillInfo(
  spAllocation: { A: number; B: number; C: number },
  jobSPData: JobSPData[]
): {
  branch: 'A' | 'B' | 'C';
  skillName: string;
  requiredSP: number;
  currentSP: number;
  needMoreSP: number;
} | null {
  let nextSkill: {
    branch: 'A' | 'B' | 'C';
    skillName: string;
    requiredSP: number;
    currentSP: number;
    needMoreSP: number;
  } | null = null;

  // 各ブランチで次に解放可能なスキルを探す
  (['A', 'B', 'C'] as const).forEach((branch) => {
    const allocatedSP = spAllocation[branch] || 0;

    // 各ティアをチェック（最大50ティアまで）
    for (let tier = 1; tier <= 50; tier++) {
      const stageName = `${branch}-${tier}`;
      const row = jobSPData.find(r => r.解法段階 === stageName);

      if (!row) break;

      const requiredSP = typeof row.必要SP === 'string'
        ? parseFloat(row.必要SP) || 0
        : row.必要SP || 0;

      // まだ解放されていないスキルを見つけた
      if (requiredSP > allocatedSP) {
        const skillName = row.解法スキル名;
        if (skillName) {
          const needMoreSP = requiredSP - allocatedSP;

          // 最も少ないSPで解放できるスキルを選択
          if (!nextSkill || needMoreSP < nextSkill.needMoreSP) {
            nextSkill = {
              branch,
              skillName,
              requiredSP,
              currentSP: allocatedSP,
              needMoreSP
            };
          }
        }
        break;
      }
    }
  });

  return nextSkill;
}

/**
 * 各軸の最大SPを取得
 * @param jobSPData 職業のSPデータ
 * @returns 各軸の最大SP {A: number, B: number, C: number}
 */
export function getMaxSPByBranch(jobSPData: JobSPData[]): { A: number; B: number; C: number } {
  const maxSP = { A: 100, B: 100, C: 100 }; // デフォルト値

  // 各軸（A/B/C）の最大値を探す
  (['A', 'B', 'C'] as const).forEach((branch) => {
    let lastRequiredSP = 100; // デフォルト値

    // 各ティアをチェックして最後の値を見つける
    for (let tier = 1; tier <= 50; tier++) { // 念のため多めにチェック
      const stageName = `${branch}-${tier}`;
      const row = jobSPData.find(r => r.解法段階 === stageName);

      if (!row) break; // これ以上のティアは存在しない

      // 必要SPを取得
      const requiredSP = typeof row.必要SP === 'string'
        ? parseFloat(row.必要SP) || 0
        : row.必要SP || 0;

      // 最後のティアの必要SPを更新
      if (requiredSP > 0) {
        lastRequiredSP = requiredSP;
      }
    }

    // 最大値を設定
    maxSP[branch] = lastRequiredSP;
  });

  return maxSP;
}

/**
 * ステータスボーナス合計を計算
 * @param spAllocation SP割り振り状況
 * @param jobSPData 職業CSVデータ配列
 * @returns ブランチごとのステータスボーナス
 */
export function calculateBranchBonus(
  spAllocation: { A: number; B: number; C: number },
  jobSPData: JobSPData[]
): {
  A: { 力: number; 体力: number; 魔力: number; 精神: number; 素早さ: number; 器用さ: number; 撃力: number; 守備力: number };
  B: { 力: number; 体力: number; 魔力: number; 精神: number; 素早さ: number; 器用さ: number; 撃力: number; 守備力: number };
  C: { 力: number; 体力: number; 魔力: number; 精神: number; 素早さ: number; 器用さ: number; 撃力: number; 守備力: number };
} {
  const branchBonus = {
    A: { 力: 0, 体力: 0, 魔力: 0, 精神: 0, 素早さ: 0, 器用さ: 0, 撃力: 0, 守備力: 0 },
    B: { 力: 0, 体力: 0, 魔力: 0, 精神: 0, 素早さ: 0, 器用さ: 0, 撃力: 0, 守備力: 0 },
    C: { 力: 0, 体力: 0, 魔力: 0, 精神: 0, 素早さ: 0, 器用さ: 0, 撃力: 0, 守備力: 0 },
  };

  // 各ブランチのボーナスを計算
  (['A', 'B', 'C'] as const).forEach((branch) => {
    const allocatedSP = spAllocation[branch] || 0;

    // 各ティアをチェック（最大50ティアまで）
    for (let tier = 1; tier <= 50; tier++) {
      const stageName = `${branch}-${tier}`;
      const row = jobSPData.find(r => r.解法段階 === stageName);

      if (!row) break;

      const requiredSP = typeof row.必要SP === 'string'
        ? parseFloat(row.必要SP) || 0
        : row.必要SP || 0;

      // このティアが解放されている場合、ボーナスを加算
      if (requiredSP <= allocatedSP) {
        branchBonus[branch].力 += toNumber(row.力);
        branchBonus[branch].体力 += toNumber(row.体力);
        branchBonus[branch].魔力 += toNumber(row.魔力);
        branchBonus[branch].精神 += toNumber(row.精神);
        branchBonus[branch].素早さ += toNumber(row.素早さ);
        branchBonus[branch].器用さ += toNumber(row.器用さ);
        branchBonus[branch].撃力 += toNumber(row.撃力);
        branchBonus[branch].守備力 += toNumber(row.守備力);
      } else {
        break;
      }
    }
  });

  return branchBonus;
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
  // レベル範囲チェック（最大999まで許可）
  if (level < 1 || level > 999) {
    throw new Error(`レベルは1-999の範囲である必要があります: ${level}`);
  }

  // 基礎ステータス計算
  let stats: JobStats;

  try {
    stats = calculateJobBaseStats(job, level, jobConst);
  } catch (error) {
    console.error('基礎ステータス計算エラー:', error);
    // フォールバック: デフォルト値を返す
    // 新計算式:
    //   - 体力・精神: (レベル × 1) - 1
    //   - 力・魔力: (レベル × 2) - 2
    stats = {
      HP: (level * 1) - 1,
      Power: (level * 2) - 2,
      Magic: (level * 2) - 2,
      Mind: (level * 1) - 1,
      Agility: 10,
      Dex: 10,
      Defense: 0,
      CritDamage: 0
    };
  }
  
  // JobSPDataがある場合はSPボーナスを適用
  if (jobSPData && jobSPData.length > 0) {
    const spTree = convertToSPTree(jobSPData);
    
    // SPツリーから初期値を適用
    // CSVに初期値がある項目（値が0でない場合）のみ上書き
    // レベル成長するステータス
    // 新計算式:
    //   - 体力・精神: 初期値 + (レベル × 1) - 1
    //   - 力・魔力: 初期値 + (レベル × 2) - 2
    if (spTree.initialStats.HP !== undefined && spTree.initialStats.HP !== 0) {
      stats.HP = spTree.initialStats.HP + (level * 1) - 1;
    }
    if (spTree.initialStats.Power !== undefined && spTree.initialStats.Power !== 0) {
      stats.Power = spTree.initialStats.Power + (level * 2) - 2;
    }
    if (spTree.initialStats.Magic !== undefined && spTree.initialStats.Magic !== 0) {
      stats.Magic = spTree.initialStats.Magic + (level * 2) - 2;
    }
    if (spTree.initialStats.Mind !== undefined && spTree.initialStats.Mind !== 0) {
      stats.Mind = spTree.initialStats.Mind + (level * 1) - 1;
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
  convertToSPTree,
  calculateUnlockedSkills,
  getReachedTier,
  getNextSkillInfo,
  calculateBranchBonus,
  getMaxSPByBranch
};