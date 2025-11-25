import {
  calculateStatus,
  calculateBaseStatus,
  applyPercentBonus,
  applyRingConvergence,
  calculateCritRate
} from '@/lib/calc/statusCalculator';
import { StatusCalcInput, StatBlock } from '@/types/calc';

describe('statusCalculator', () => {
  describe('calculateBaseStatus', () => {
    it('全要素を正しく加算する', () => {
      const equipment: StatBlock = { STR: 100, DEX: 50 };
      const jobInitial: StatBlock = { STR: 20, VIT: 30 };
      const jobSP: StatBlock = { STR: 10, INT: 15 };
      const food: StatBlock = { VIT: 5, DEX: 5 };
      const userOption: StatBlock = { INT: 10, STR: -5 };

      const result = calculateBaseStatus(equipment, jobInitial, jobSP, food, userOption);

      expect(result).toEqual({
        STR: 125, // 100 + 20 + 10 - 5
        DEX: 55,  // 50 + 5
        VIT: 35,  // 30 + 5
        INT: 25   // 15 + 10
      });
    });

    it('空のStatBlockも正しく処理する', () => {
      const equipment: StatBlock = { STR: 100 };
      const result = calculateBaseStatus(equipment, {}, {}, {}, {});

      expect(result).toEqual({ STR: 100 });
    });

    it('負の値も正しく処理する', () => {
      const equipment: StatBlock = { STR: 100 };
      const userOption: StatBlock = { STR: -50 };

      const result = calculateBaseStatus(equipment, {}, {}, {}, userOption);

      expect(result).toEqual({ STR: 50 });
    });
  });

  describe('applyPercentBonus', () => {
    it('%補正を正しく適用する', () => {
      const base: StatBlock = { STR: 100, DEX: 50, INT: 200 };
      const jobBonus: StatBlock = { STR: 10, DEX: 20 }; // 10%, 20%
      const emblemBonus: StatBlock = { STR: 5, INT: 15 }; // 5%, 15%

      const result = applyPercentBonus(base, jobBonus, emblemBonus);

      expect(result).toEqual({
        STR: 115, // 100 × (1 + 0.15) = 115
        DEX: 60,  // 50 × (1 + 0.20) = 60
        INT: 230  // 200 × (1 + 0.15) = 230
      });
    });

    it('補正のないステータスは変化しない', () => {
      const base: StatBlock = { STR: 100, DEX: 50 };
      const result = applyPercentBonus(base, {}, {});

      expect(result).toEqual({ STR: 100, DEX: 50 });
    });

    it('小数点は四捨五入される', () => {
      const base: StatBlock = { STR: 100 };
      const jobBonus: StatBlock = { STR: 7.5 }; // 7.5%

      const result = applyPercentBonus(base, jobBonus, {});

      expect(result.STR).toBe(108); // 100 × 1.075 = 107.5 → 108
    });
  });

  describe('applyRingConvergence', () => {
    it('収束計算が正しく行われる', () => {
      const base: StatBlock = { STR: 100 };
      const ringBonus: StatBlock = { STR: 10 }; // 10%

      const result = applyRingConvergence(base, ringBonus);

      // 1回目: 100 × 1.1 = 110
      // 2回目: 110 × 1.1 = 121
      // 3回目: 121 × 1.1 = 133.1 → 133
      // 4回目: 133 × 1.1 = 146.3 → 146
      // ... 収束するまで続く

      expect(result.iterations).toBeGreaterThan(0);
      expect(result.iterations).toBeLessThanOrEqual(100);
      expect(result.final.STR).toBeGreaterThan(100);
      expect(result.delta.STR).toBe(result.final.STR! - 100);
    });

    it('変化がない場合は1回で収束する', () => {
      const base: StatBlock = { STR: 100 };
      const ringBonus: StatBlock = {}; // 補正なし

      const result = applyRingConvergence(base, ringBonus);

      expect(result.iterations).toBe(1);
      expect(result.final).toEqual({ STR: 100 });
      expect(result.delta).toEqual({ STR: 0 });
    });

    it('最大反復回数で停止する', () => {
      const base: StatBlock = { STR: 1 };
      const ringBonus: StatBlock = { STR: 100 }; // 100%（常に2倍になる）

      const result = applyRingConvergence(base, ringBonus, 10);

      expect(result.iterations).toBe(10);
      // 2^10 = 1024
      expect(result.final.STR).toBe(1024);
    });

    it('複数ステータスの収束も正しく処理する', () => {
      const base: StatBlock = { STR: 100, DEX: 50 };
      const ringBonus: StatBlock = { STR: 5, DEX: 10 };

      const result = applyRingConvergence(base, ringBonus);

      expect(result.final.STR).toBeGreaterThan(100);
      expect(result.final.DEX).toBeGreaterThan(50);
      expect(result.delta.STR).toBeGreaterThan(0);
      expect(result.delta.DEX).toBeGreaterThan(0);
    });
  });

  describe('calculateCritRate', () => {
    it('会心率を正しく計算する', () => {
      expect(calculateCritRate(10, 100)).toBe(40); // 10 + 100 × 0.3
      expect(calculateCritRate(5, 50)).toBe(20);   // 5 + 50 × 0.3
      expect(calculateCritRate(0, 0)).toBe(0);     // 0 + 0 × 0.3
    });

    it('小数点も正しく処理する', () => {
      expect(calculateCritRate(10.5, 33)).toBe(20.4); // 10.5 + 33 × 0.3 = 20.4
    });
  });

  describe('calculateStatus（統合テスト）', () => {
    it('全体の計算フローが正しく動作する', () => {
      const input: StatusCalcInput = {
        jobStats: {
          initial: { STR: 50, DEX: 30 },
          sp: { STR: 20, INT: 10 },
          bonusPercent: { STR: 10 } // 10%補正
        },
        equipmentTotal: { STR: 100, DEX: 50, VIT: 30 },
        emblemBonusPercent: { STR: 5, VIT: 10 }, // 5%, 10%補正
        food: { VIT: 10 },
        userOption: { INT: 5 },
        weaponCritRate: 10
      };

      const result = calculateStatus(input);

      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data;

        // BaseStatus（%補正前）の確認
        expect(data.base).toEqual({
          STR: 170,  // 100 + 50 + 20
          DEX: 80,   // 50 + 30
          VIT: 40,   // 30 + 10
          INT: 15    // 10 + 5
        });

        // %補正後の確認
        // STR: 170 × (1 + 0.10 + 0.05) = 170 × 1.15 = 195.5 → 196
        // DEXは%補正なしなので80のまま
        // VIT: 40 × (1 + 0.10) = 40 × 1.10 = 44
        // INTは%補正なしなので15のまま
        expect(data.final.STR).toBe(196);
        expect(data.final.DEX).toBe(80);  
        expect(data.final.VIT).toBe(44);  
        expect(data.final.INT).toBe(15);

        // 会心率の確認
        expect(data.critRate).toBe(34); // 10 + 80 × 0.3
      }
    });

    it('リング有効時の計算が正しく動作する', () => {
      const input: StatusCalcInput = {
        jobStats: {
          initial: { STR: 50 },
          sp: {},
          bonusPercent: {}
        },
        equipmentTotal: { STR: 50 },
        ring: {
          enabled: true,
          bonusPercent: { STR: 10 }
        },
        weaponCritRate: 0
      };

      const result = calculateStatus(input);

      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data;

        expect(data.ring).toBeDefined();
        expect(data.ring!.iterations).toBeGreaterThan(0);
        expect(data.ring!.delta.STR).toBeGreaterThan(0);
        expect(data.final.STR).toBeGreaterThan(100);
      }
    });

    it('職業ステータスが指定されていない場合はエラー', () => {
      const input = {} as StatusCalcInput;
      const result = calculateStatus(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_INPUT');
      }
    });

    it('空の入力でもエラーにならない', () => {
      const input: StatusCalcInput = {
        jobStats: {
          initial: {},
          sp: {},
          bonusPercent: {}
        }
      };

      const result = calculateStatus(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.final).toEqual({});
        expect(result.data.critRate).toBe(0);
      }
    });
  });
});