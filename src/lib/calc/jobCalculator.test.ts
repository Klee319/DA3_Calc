/**
 * 職業・SPシステム計算モジュールのテスト
 * @module jobCalculator.test
 */

import {
  calculateJobBaseStats,
  calculateTotalSP,
  validateSPAllocation,
  calculateSPBonus,
  calculateJobCorrection,
  calculateAllJobStats,
  convertToSPTree,
  type Job,
  type SPAllocation,
  type SPTreeData
} from './jobCalculator';
import type { JobConstData, JobSPData } from '@/types/data';

// ===== テストデータ =====

const mockJobConst: JobConstData = {
  JobDefinition: {
    Novice: {
      MainWeapon: ['剣', '斧', '杖', '弓'],
      HP: 10,
      STR: 0,
      INT: 0,
      MND: 10,
      VIT: 0,
      AGI: 5,
      DEX: 3,
      JobCorrection: {
        HP: 5,
        Power: 10
      }
    },
    Wizard: {
      MainWeapon: ['杖'],
      HP: 5,
      STR: 0,
      INT: 15,
      MND: 10,
      VIT: 0,
      AGI: 3,
      DEX: 5
    }
  }
};

const mockJobSPData: JobSPData[] = [
  {
    解法段階: '初期値',
    必要SP: '',
    体力: 10,
    力: '',
    魔力: '',
    精神: 10,
    素早さ: '',
    器用さ: '',
    撃力: '',
    守備力: ''
  },
  {
    解法段階: 'A-1',
    必要SP: 3,
    解法スキル名: 'パワーアタック',
    体力: '',
    力: 5,
    魔力: '',
    精神: '',
    素早さ: '',
    器用さ: '',
    撃力: '',
    守備力: ''
  },
  {
    解法段階: 'A-2',
    必要SP: 7,
    解法スキル名: '',
    体力: '',
    力: '',
    魔力: '',
    精神: '',
    素早さ: '',
    器用さ: 3,
    撃力: '',
    守備力: ''
  },
  {
    解法段階: 'A-3',
    必要SP: 13,
    解法スキル名: '',
    体力: '',
    力: '',
    魔力: '',
    精神: '',
    素早さ: '',
    器用さ: '',
    撃力: 5,
    守備力: ''
  },
  {
    解法段階: 'B-1',
    必要SP: 3,
    解法スキル名: 'マジックアロー',
    体力: '',
    力: '',
    魔力: 5,
    精神: '',
    素早さ: '',
    器用さ: '',
    撃力: '',
    守備力: ''
  },
  {
    解法段階: 'B-2',
    必要SP: 7,
    解法スキル名: '',
    体力: '',
    力: '',
    魔力: '',
    精神: 3,
    素早さ: '',
    器用さ: '',
    撃力: '',
    守備力: ''
  },
  {
    解法段階: 'C-1',
    必要SP: 3,
    解法スキル名: 'ガード',
    体力: 5,
    力: '',
    魔力: '',
    精神: '',
    素早さ: '',
    器用さ: '',
    撃力: '',
    守備力: 3
  },
  {
    解法段階: '職業補正(%)',
    必要SP: '',
    体力: 5,
    力: 10,
    魔力: '',
    精神: '',
    素早さ: '',
    器用さ: '',
    撃力: '',
    守備力: ''
  }
];

// ===== テスト =====

describe('jobCalculator', () => {
  describe('calculateJobBaseStats', () => {
    it('レベル1の基礎ステータスを正しく計算する', () => {
      const stats = calculateJobBaseStats('Novice', 1, mockJobConst);
      
      expect(stats.HP).toBe(11);       // 10 + 1
      expect(stats.Power).toBe(1);     // 0 + 1
      expect(stats.Magic).toBe(1);     // 0 + 1
      expect(stats.Mind).toBe(11);     // 10 + 1
      expect(stats.Agility).toBe(5);   // 固定値
      expect(stats.Dex).toBe(3);       // 固定値
    });

    it('レベル20の基礎ステータスを正しく計算する', () => {
      const stats = calculateJobBaseStats('Novice', 20, mockJobConst);
      
      expect(stats.HP).toBe(30);       // 10 + 20
      expect(stats.Power).toBe(20);     // 0 + 20
      expect(stats.Magic).toBe(20);     // 0 + 20
      expect(stats.Mind).toBe(30);     // 10 + 20
      expect(stats.Agility).toBe(5);   // 固定値
      expect(stats.Dex).toBe(3);       // 固定値
    });

    it('存在しない職業でエラーを投げる', () => {
      expect(() => calculateJobBaseStats('Unknown', 1, mockJobConst))
        .toThrow('職業 "Unknown" が見つかりません');
    });

    it('レベル0でエラーを投げる', () => {
      expect(() => calculateJobBaseStats('Novice', 0, mockJobConst))
        .toThrow('レベルは1以上である必要があります');
    });
  });

  describe('calculateTotalSP', () => {
    it('レベル1のSP量を計算する', () => {
      expect(calculateTotalSP(1)).toBe(2);
    });

    it('レベル20のSP量を計算する', () => {
      expect(calculateTotalSP(20)).toBe(40);
    });

    it('レベル50のSP量を計算する', () => {
      expect(calculateTotalSP(50)).toBe(100);
    });

    it('レベル0でエラーを投げる', () => {
      expect(() => calculateTotalSP(0))
        .toThrow('レベルは1以上である必要があります');
    });
  });

  describe('convertToSPTree', () => {
    it('JobSPDataを正しくSPTreeDataに変換する', () => {
      const tree = convertToSPTree(mockJobSPData);
      
      // 初期値
      expect(tree.initialStats.HP).toBe(10);
      expect(tree.initialStats.Mind).toBe(10);
      expect(tree.initialStats.Power).toBe(0);
      
      // 職業補正
      expect(tree.jobCorrection.HP).toBe(5);
      expect(tree.jobCorrection.Power).toBe(10);
      
      // SPノード
      expect(tree.spNodes).toHaveLength(6);
      expect(tree.spNodes[0]).toEqual({
        branch: 'A',
        tier: 1,
        requiredSP: 3,
        skillName: 'パワーアタック',
        stats: {
          体力: 0,
          力: 5,
          魔力: 0,
          精神: 0,
          素早さ: 0,
          器用さ: 0,
          撃力: 0,
          守備力: 0
        }
      });
    });
  });

  describe('validateSPAllocation', () => {
    let spTree: SPTreeData;

    beforeEach(() => {
      spTree = convertToSPTree(mockJobSPData);
    });

    it('有効なSP割り振りを検証する', () => {
      const allocation: SPAllocation[] = [
        { branch: 'A', tier: 1, spCost: 3 },
        { branch: 'A', tier: 2, spCost: 4 },
        { branch: 'B', tier: 1, spCost: 3 }
      ];
      
      const result = validateSPAllocation(allocation, spTree, 20);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('SP超過エラーを検出する', () => {
      const allocation: SPAllocation[] = [
        { branch: 'A', tier: 1, spCost: 3 },
        { branch: 'A', tier: 2, spCost: 4 },
        { branch: 'B', tier: 1, spCost: 3 },
        { branch: 'B', tier: 2, spCost: 4 }
      ];
      
      const result = validateSPAllocation(allocation, spTree, 10);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('SPが上限を超えています: 使用SP=14, 最大SP=10');
    });

    it('順序違反エラーを検出する', () => {
      const allocation: SPAllocation[] = [
        { branch: 'A', tier: 3, spCost: 6 }  // A-1, A-2を取得せずにA-3を取得
      ];
      
      const result = validateSPAllocation(allocation, spTree, 20);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('A-3を取得するにはA-2を先に取得する必要があります');
    });

    it('存在しないSPノードエラーを検出する', () => {
      const allocation: SPAllocation[] = [
        { branch: 'A', tier: 10, spCost: 5 }  // A-10は存在しない
      ];
      
      const result = validateSPAllocation(allocation, spTree, 20);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('A-10はSPツリーに存在しません');
    });
  });

  describe('calculateSPBonus', () => {
    let spTree: SPTreeData;

    beforeEach(() => {
      spTree = convertToSPTree(mockJobSPData);
    });

    it('単一ノードのボーナスを計算する', () => {
      const allocation: SPAllocation[] = [
        { branch: 'A', tier: 1, spCost: 3 }
      ];
      
      const bonus = calculateSPBonus(allocation, spTree);
      expect(bonus['力']).toBe(5);
      expect(bonus['体力']).toBeUndefined();
    });

    it('複数ノードのボーナスを合算する', () => {
      const allocation: SPAllocation[] = [
        { branch: 'A', tier: 1, spCost: 3 },  // 力+5
        { branch: 'A', tier: 2, spCost: 4 },  // 器用さ+3
        { branch: 'B', tier: 1, spCost: 3 },  // 魔力+5
        { branch: 'C', tier: 1, spCost: 3 }   // 体力+5, 守備力+3
      ];
      
      const bonus = calculateSPBonus(allocation, spTree);
      expect(bonus['力']).toBe(5);
      expect(bonus['器用さ']).toBe(3);
      expect(bonus['魔力']).toBe(5);
      expect(bonus['体力']).toBe(5);
      expect(bonus['守備力']).toBe(3);
    });
  });

  describe('calculateJobCorrection', () => {
    it('職業補正を取得する', () => {
      const correction = calculateJobCorrection('Novice', mockJobConst);
      expect(correction.HP).toBe(5);
      expect(correction.Power).toBe(10);
    });

    it('職業補正がない場合は空オブジェクトを返す', () => {
      const correction = calculateJobCorrection('Wizard', mockJobConst);
      expect(correction).toEqual({});
    });

    it('存在しない職業でエラーを投げる', () => {
      expect(() => calculateJobCorrection('Unknown', mockJobConst))
        .toThrow('職業 "Unknown" が見つかりません');
    });
  });

  describe('calculateAllJobStats', () => {
    it('職業の全ステータスを計算する（SPなし）', () => {
      const stats = calculateAllJobStats('Novice', 20, [], mockJobConst);
      
      expect(stats.HP).toBe(30);       // 10 + 20
      expect(stats.Power).toBe(20);     // 0 + 20
      expect(stats.Magic).toBe(20);     // 0 + 20
      expect(stats.Mind).toBe(30);     // 10 + 20
      expect(stats.Agility).toBe(5);   // 固定値
      expect(stats.Dex).toBe(3);       // 固定値
    });

    it('職業の全ステータスを計算する（SP込み）', () => {
      const allocation: SPAllocation[] = [
        { branch: 'A', tier: 1, spCost: 3 },  // 力+5
        { branch: 'A', tier: 2, spCost: 4 },  // 器用さ+3
        { branch: 'B', tier: 1, spCost: 3 }   // 魔力+5
      ];
      
      const stats = calculateAllJobStats('Novice', 20, allocation, mockJobConst, mockJobSPData);
      
      expect(stats.HP).toBe(30);       // 10 + 20（CSVの初期値を使用）
      expect(stats.Power).toBe(25);     // 20 + 5（SPボーナス）
      expect(stats.Magic).toBe(25);     // 20 + 5（SPボーナス）
      expect(stats.Mind).toBe(30);     // 10 + 20
      expect(stats.Dex).toBe(6);       // 3(JobConst基礎値) + 3（SPボーナス）
    });

    it('レベル範囲外でエラーを投げる', () => {
      expect(() => calculateAllJobStats('Novice', 0, [], mockJobConst))
        .toThrow('レベルは1-100の範囲である必要があります');
        
      expect(() => calculateAllJobStats('Novice', 101, [], mockJobConst))
        .toThrow('レベルは1-100の範囲である必要があります');
    });

    it('SP割り振りエラーでエラーを投げる', () => {
      const allocation: SPAllocation[] = [
        { branch: 'A', tier: 3, spCost: 6 }  // 順序違反
      ];
      
      expect(() => calculateAllJobStats('Novice', 20, allocation, mockJobConst, mockJobSPData))
        .toThrow(/SP割り振りエラー/);
    });
  });
});