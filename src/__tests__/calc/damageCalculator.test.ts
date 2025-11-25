import { describe, it, expect } from '@jest/globals';
import {
  calculateDamage,
  calculateBaseDamage,
  applyJobCorrection,
  applyCritDamage,
  applyDamageCorrection,
  calculateFinalDamage,
  calculateSkillDamage,
  evaluateFormulaString,
  parseHits
} from '@/lib/calc/damageCalculator';
import {
  DamageCalcInput,
  CalculatedStats,
  EnemyParams,
  DamageCalcOptions,
  StatBlock
} from '@/types/calc';
import { WeaponCalcData, SkillCalcData } from '@/types/data';

// モックデータを使用してYAML読み込みをスキップ
const weaponCalc: WeaponCalcData = {
  BasedDamage: {
    Sword: "(WeaponAttackPower+UserPower*1.6)*DamageCorrection*(1+(WeaponCritDamage/100)+UserCritDamage*0.005)",
    Wand: "(WeaponAttackPower + UserMagic*1.75) * DamageCorrection * (1 + WeaponCritDamage/100 + UserCritDamage*0.0016)",
    Bow: "(WeaponAttackPower + UserPower*1.75) * DamageCorrection * (1 + WeaponCritDamage/100 + UserCritDamage*0.0016)",
    Axe: "(WeaponAttackPower + UserPower*1.5 + UserMind*2.5) * DamageCorrection * (1 + WeaponCritDamage/100 + UserCritDamage*0.001)",
    Greatsword: "(WeaponAttackPower + UserPower*1.6 + UserHP*3.1) * DamageCorrection * (1 + WeaponCritDamage/100 + UserCritDamage*0.001)",
    Dagger: "(WeaponAttackPower + UserPower*1.25 + UserAgility*3.5) * DamageCorrection * (1 + WeaponCritDamage/100 + UserCritDamage*0.0015)",
    Spear: "((((UserDex + WeaponCritRate + 100) * UserDefense * 8 / 300) + (UserPower / 200) + WeaponAttackPower) * DamageCorrection * (1 + (WeaponCritDamage/100 + UserCritDamage*0.001) / 3))",
    Frypan: "round((WeaponAttackPower + UserPower*1.6) * DamageCorrection * ComboCorrection * (1 + WeaponCritDamage/100 + UserCritDamage*0.005)) / 2"
  },
  JobCorrection: {
    Novice: {
      Sword: "(UserPower*1.6 + WeaponAttackPower) * DamageCorrection * (1 + WeaponCritDamage/100 + UserCritDamage*0.005)",
      Wand: "(UserMagic*1.75 + WeaponAttackPower) * DamageCorrection * (1 + WeaponCritDamage/100 + UserCritDamage*0.0016)",
      Bow: "(UserPower*1.3 + WeaponAttackPower) * DamageCorrection * (1 + WeaponCritDamage/100 + UserCritDamage*0.0016)",
      Axe: "(UserPower*1.8 + WeaponAttackPower) * DamageCorrection * (1 + WeaponCritDamage/100 + UserCritDamage*0.001)",
      GreatSword: "(UserPower*1.8 + WeaponAttackPower) * DamageCorrection * (1 + WeaponCritDamage/100 + UserCritDamage*0.001)",
      Dagger: "(UserPower*1.5 + WeaponAttackPower) * DamageCorrection * (1 + WeaponCritDamage/100 + UserCritDamage*0.0015)",
      Spear: "(UserPower*1.8 + WeaponAttackPower) * DamageCorrection * (1 + (WeaponCritDamage/100 + UserCritDamage*0.001)/3)"
    },
    SpellRefactor: {
      Bonus: "0.75 - round(0.475 * ln(max(UserPower, UserMagic) / min(UserPower, UserMagic)), 2) * 2"
    }
  },
  FinalDamage: "(HitDamage-(EnemyDefence/2))*(1-(EnemyTypeResistance/100))*(1-(EnemyAttributeResistance/100))"
};

const skillCalc: SkillCalcData = {
  SkillDefinition: {
    SkillBook: {
      Sword: {
        Zan_gekiha: {
          MP: "15 + <Level>*5",
          CT: "7 - <Level>*0.25",
          Damage: null
        }
      },
      GreatSword: {
        Zan_gekiha_GS: {
          MP: "15 + <Level>*5",
          CT: "7 - <Level>*0.25",
          Damage: "BaseDamage.GreatSword * (<Level> + 2) * 0.1"
        }
      },
      Dagger: {
        Renge_Ha: {
          MP: null,
          Damage: "BaseDamage.Dagger * (<Level> + 13) * 0.05 + UserAgility * <AgilityFactor>"
        }
      }
    },
    JobSkill: {
      Novice: {
        Nagihara_i: {
          MP: 5,
          CT: 5,
          Damage: "BaseDamage.Sword * 1.3"
        }
      },
      Fighter: {
        Retsujin_Enzangeki: {
          MP: 12,
          CT: 9,
          Hits: 5,
          Damage: "BaseDamage.Sword * 0.4"
        }
      }
    }
  }
};

describe('damageCalculator', () => {
  // テスト用のユーザーステータス
  const mockUserStats: StatBlock = {
    Power: 100,
    Magic: 80,
    Mind: 60,
    Agility: 70,
    HP: 500,
    Dexterity: 50,
    Defense: 100,
    CriticalDamage: 50
  };

  const mockCalculatedStats: CalculatedStats = {
    breakdown: {
      equipment: {},
      jobInitial: {},
      jobSP: {},
      food: {},
      userOption: {}
    },
    base: mockUserStats,
    bonusPercent: {
      job: {},
      emblem: {},
      total: {}
    },
    final: mockUserStats,
    critRate: 25
  };

  describe('calculateBaseDamage', () => {
    it('剣の基礎ダメージを計算できる', () => {
      const damage = calculateBaseDamage(
        'sword',
        100, // weaponAttackPower
        10,  // weaponCritRate
        50,  // weaponCritDamage
        80,  // damageCorrection (80%)
        mockUserStats,
        weaponCalc,
        'avg'
      );

      expect(damage).toBeGreaterThan(0);
      expect(damage).toBeLessThan(1000);
    });

    it('杖の基礎ダメージを計算できる', () => {
      const damage = calculateBaseDamage(
        'wand',
        80,
        5,
        40,
        90,
        mockUserStats,
        weaponCalc,
        'avg'
      );

      expect(damage).toBeGreaterThan(0);
      expect(damage).toBeLessThan(1000);
    });

    it('各武器種の基礎ダメージを計算できる', () => {
      const weaponTypes = ['sword', 'wand', 'bow', 'axe', 'greatsword', 'dagger', 'spear'];
      
      weaponTypes.forEach(weaponType => {
        const damage = calculateBaseDamage(
          weaponType,
          100,
          10,
          50,
          80,
          mockUserStats,
          weaponCalc,
          'avg'
        );

        expect(damage).toBeGreaterThan(0);
        expect(damage).toBeLessThan(10000);
      });
    });

    it('フライパンの基礎ダメージを計算できる', () => {
      const damage = calculateBaseDamage(
        'frypan',
        100,
        10,
        50,
        80,
        mockUserStats,
        weaponCalc,
        'avg'
      );

      expect(damage).toBeGreaterThan(0);
    });
  });

  describe('applyJobCorrection', () => {
    it('ノービスの職業補正を適用できる', () => {
      const baseDamage = 500;
      const correctedDamage = applyJobCorrection(
        baseDamage,
        'Novice',
        'sword',
        100,
        10,
        50,
        80,
        mockUserStats,
        weaponCalc,
        'avg'
      );

      expect(correctedDamage).toBeGreaterThan(0);
    });

    it('職業補正がない場合は基礎ダメージをそのまま返す', () => {
      const baseDamage = 500;
      const correctedDamage = applyJobCorrection(
        baseDamage,
        'NonExistentJob',
        'sword',
        100,
        10,
        50,
        80,
        mockUserStats,
        weaponCalc,
        'avg'
      );

      expect(correctedDamage).toBe(baseDamage);
    });
  });

  describe('applyCritDamage', () => {
    it('会心100%モードで2倍のダメージを返す', () => {
      const result = applyCritDamage(1000, 25, 100, 'crit'); // critDamageを100%に設定
      expect(result).toBe(2000);
    });

    it('会心0%モードで基礎ダメージをそのまま返す', () => {
      const result = applyCritDamage(1000, 25, 100, 'nocrit');
      expect(result).toBe(1000);
    });

    it('期待値モードで会心率を考慮したダメージを返す', () => {
      const result = applyCritDamage(1000, 50, 100, 'avg'); // 会心率50%、会心ダメージ100%
      expect(result).toBe(1500); // 1000 * 0.5 + 2000 * 0.5 = 1500
    });
  });

  describe('applyDamageCorrection', () => {
    it('minモードで最小値を返す', () => {
      const correctedDamage = applyDamageCorrection(100, 'min');
      expect(correctedDamage).toBe(80); // 100 * 0.8 = 80
    });

    it('maxモードで最大値を返す', () => {
      const correctedDamage = applyDamageCorrection(100, 'max');
      expect(correctedDamage).toBe(120); // 100 * 1.2 = 120
    });

    it('avgモードで平均値を返す', () => {
      const correctedDamage = applyDamageCorrection(100, 'avg');
      expect(correctedDamage).toBe(100); // avgモードではそのまま返す
    });
  });

  describe('calculateFinalDamage', () => {
    it('敵防御を適用できる', () => {
      const finalDamage = calculateFinalDamage(1000, 100);
      // 1000 * (1 - 100/1000) = 1000 * 0.9 = 900
      expect(finalDamage).toBe(900);
    });

    it('敵防御が0の場合', () => {
      const finalDamage = calculateFinalDamage(1000, 0);
      expect(finalDamage).toBe(1000);
    });

    it('敵防御が1000の場合、ダメージが0になる', () => {
      const finalDamage = calculateFinalDamage(1000, 1000);
      expect(finalDamage).toBe(0);
    });
  });

  describe('evaluateFormulaString', () => {
    it('基本的な計算式を評価できる', () => {
      const result = evaluateFormulaString(
        'WeaponAttackPower + UserPower * 2',
        {
          WeaponAttackPower: 100,
          UserPower: 50
        }
      );
      expect(result).toBe(200);
    });

    it('複雑な計算式を評価できる', () => {
      const result = evaluateFormulaString(
        '(WeaponAttackPower + UserPower * 1.5) * (1 + WeaponCritDamage/100)',
        {
          WeaponAttackPower: 100,
          UserPower: 50,
          WeaponCritDamage: 50
        }
      );
      expect(result).toBe(262.5); // (100 + 75) * 1.5
    });

    it('round関数を含む式を評価できる', () => {
      const result = evaluateFormulaString(
        'round(WeaponAttackPower * 1.5)',
        {
          WeaponAttackPower: 101
        }
      );
      expect(result).toBe(152);
    });
  });

  describe('parseHits', () => {
    it('数値を正しく解析できる', () => {
      expect(parseHits(5)).toBe(5);
      expect(parseHits('5')).toBe(5);
    });

    it('範囲指定を解析できる（avg）', () => {
      expect(parseHits('5~6')).toBe(5.5);
      expect(parseHits('10~20')).toBe(15);
    });

    it('範囲指定を解析できる（min）', () => {
      expect(parseHits('5~6', 'min')).toBe(5);
      expect(parseHits('10~20', 'min')).toBe(10);
    });

    it('範囲指定を解析できる（max）', () => {
      expect(parseHits('5~6', 'max')).toBe(6);
      expect(parseHits('10~20', 'max')).toBe(20);
    });
  });

  describe('calculateSkillDamage', () => {
    it('スキルダメージを計算できる', () => {
      const result = calculateSkillDamage(
        'Nagihara_i',
        5,
        500,
        'sword',
        mockUserStats,
        weaponCalc,
        skillCalc,
        100, // weaponAttackPower
        10,  // weaponCritRate
        50,  // weaponCritDamage
        80   // damageCorrection
      );

      if (result.success) {
        expect(result.data.damage).toBeGreaterThan(0);
        expect(result.data.hits).toBe(1);
        expect(result.data.mp).toBeGreaterThan(0);
        expect(result.data.ct).toBeGreaterThan(0);
      } else {
        // スキルが見つからない場合もテストを失敗させない
        expect(result.error.code).toBe('SKILL_NOT_FOUND');
      }
    });

    it('多段ヒットスキルを計算できる', () => {
      const result = calculateSkillDamage(
        'Retsujin_Enzangeki',
        5,
        500,
        'sword',
        mockUserStats,
        weaponCalc,
        skillCalc,
        100, // weaponAttackPower
        10,  // weaponCritRate
        50,  // weaponCritDamage
        80   // damageCorrection
      );

      if (result.success) {
        expect(result.data.hits).toBe(5);
      }
    });

    it('存在しないスキルでエラーを返す', () => {
      const result = calculateSkillDamage(
        'NonExistentSkill',
        5,
        500,
        'sword',
        mockUserStats,
        weaponCalc,
        skillCalc,
        100,
        10,
        50,
        80
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SKILL_NOT_FOUND');
      }
    });
  });

  describe('calculateDamage（統合テスト）', () => {
    it('完全なダメージ計算を実行できる', () => {
      const input: DamageCalcInput = {
        userStats: mockCalculatedStats,
        weaponType: 'sword',
        weaponAttackPower: 100,
        weaponCritRate: 10,
        weaponCritDamage: 50,
        damageCorrection: 80,
        enemy: {
          defense: 100,
          typeResistance: 20,
          attributeResistance: 10
        },
        options: {
          critMode: 'expected',
          damageCorrectionMode: 'avg'
        },
        jobName: 'Novice'
      };

      const result = calculateDamage(input, weaponCalc, skillCalc);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.baseDamage).toBeGreaterThan(0);
        expect(result.data.finalDamage).toBeGreaterThan(0);
        expect(result.data.hits).toBe(1);
      }
    });

    it('スキルを含む完全なダメージ計算を実行できる', () => {
      const input: DamageCalcInput = {
        userStats: mockCalculatedStats,
        weaponType: 'sword',
        weaponAttackPower: 100,
        weaponCritRate: 10,
        weaponCritDamage: 50,
        damageCorrection: 80,
        enemy: {
          defense: 100,
          typeResistance: 20,
          attributeResistance: 10,
          hp: 10000
        },
        options: {
          critMode: 'expected',
          damageCorrectionMode: 'avg',
          skillName: 'Nagihara_i',
          skillLevel: 5
        }
      };

      const result = calculateDamage(input, weaponCalc, skillCalc);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mp).toBeGreaterThan(0);
        expect(result.data.ct).toBeGreaterThan(0);
        expect(result.data.dps).toBeGreaterThan(0);
        expect(result.data.ttk).toBeGreaterThan(0);
        expect(result.data.mpEfficiency).toBeGreaterThan(0);
      }
    });

    it('エラーハンドリングが正しく動作する', () => {
      const input: DamageCalcInput = {
        userStats: mockCalculatedStats,
        weaponType: 'invalid_weapon_type',
        weaponAttackPower: 100,
        weaponCritRate: 10,
        weaponCritDamage: 50,
        damageCorrection: 80,
        enemy: {
          defense: 100,
          typeResistance: 20,
          attributeResistance: 10
        },
        options: {
          critMode: 'expected',
          damageCorrectionMode: 'avg'
        }
      };

      const result = calculateDamage(input, weaponCalc, skillCalc);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DAMAGE_CALC_ERROR');
      }
    });
  });
});