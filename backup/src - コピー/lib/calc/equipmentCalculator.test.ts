/**
 * 装備システム計算モジュールのテスト
 */

import {
  calculateWeaponStats,
  calculateArmorStats,
  calculateAccessoryStats,
  calculateEmblemStats,
  calculateRuneStats,
  calculateAllEquipmentStats,
  SelectedEquipment,
} from './equipmentCalculator';
import { 
  WeaponData, 
  ArmorData, 
  AccessoryData, 
  EmblemData,
  RunestoneData,
  EqConstData 
} from '@/types/data';

// テスト用のEqConstData
const testEqConst: EqConstData = {
  Weapon: {
    Forge: {
      Damage: 1,
      Other: 1,
    },
    Reinforcement: {
      MAX: 80,
      Damage: 2,
      Other: 2,
      AttackP: 2,
      CritD: 1,
      CritR: 0,
      Denominator: 320,
    } as any,
    Rank: {
      SSS: {
        Bonus: {
          AttackP: 31,
          CritD: 5,
          CritR: 5,
          CoolT: -0.1,
        },
        Alchemy: {
          AttackP: 118,
          CritD: 48,
          CritR: 11,
        },
      },
      A: {
        Bonus: {
          AttackP: 25,
          CritD: 3,
          CritR: 3,
          CoolT: 0,
        },
        Alchemy: {
          AttackP: 116,
          CritD: 47,
          CritR: 9,
        },
      },
      F: {
        Bonus: {
          AttackP: 0,
          CritD: 0,
          CritR: 0,
          CoolT: 0,
        },
        Alchemy: {
          AttackP: 113,
          CritD: 46,
          CritR: 7,
        },
      },
    },
  } as any,
  Armor: {
    Forge: {
      Defence: 1,
      Other: 2,
    },
    Reinforcement: {
      MAX: 40,
      Defence: 1,
      Other: 2,
    },
    Rank: {
      SSS: 8,
      SS: 7,
      S: 6,
      A: 5,
      B: 4,
      C: 3,
      D: 2,
      E: 1,
      F: 0,
    },
  },
  Accessory: {
    Rank: {
      SSS: 55,
      SS: 50,
      S: 45,
      A: 44,
      B: 44,
      C: 35,
      D: 35,
      E: 0,
      F: 0,
    },
  },
  Equipment_EX: {
    Rank: {
      CritR: {
        SSS: 0.15,
        SS: 0.13,
      },
      Speed_CritD: {
        SSS: 0.6,
        SS: 0.5,
      },
      Aspd: {
        SSS: 0.7,
        SS: 0.6,
      },
    },
  },
};

describe('equipmentCalculator', () => {
  describe('calculateWeaponStats', () => {
    const testWeapon: WeaponData = {
      アイテム名: 'テスト武器',
      制作: 'true',
      武器種: '剣',
      使用可能Lv: 10,
      '攻撃力（初期値）': 50,
      '会心率（初期値）': 5,
      '会心ダメージ（初期値）': 20,
      'ダメージ補正（初期値）': 80,
      'ct(初期値)': 1.5,
    };

    it('基礎値のみの場合、正しく計算される', () => {
      const result = calculateWeaponStats(testWeapon, 'F', 0, 0, false, testEqConst);

      expect(result.attackPower).toBe(50); // 基礎値のみ
      expect(result.critRate).toBe(5);
      expect(result.critDamage).toBe(20);
      expect(result.coolTime).toBe(1.5);
      expect(result.damageCorrection).toBe(80);
    });

    it('ランクボーナスが正しく適用される', () => {
      const result = calculateWeaponStats(testWeapon, 'A', 0, 0, false, testEqConst);

      // AttackP = ROUNDUP(50 + 10 * (25 / 320)) + 25
      const expectedBase = Math.ceil(50 + 10 * (25 / 320)); // 51
      const expectedTotal = expectedBase + 25; // 76
      
      expect(result.attackPower).toBe(expectedTotal);
      expect(result.critRate).toBe(8); // 5 + 3
      expect(result.critDamage).toBe(23); // 20 + 3
    });

    it('強化値が正しく加算される', () => {
      const result = calculateWeaponStats(testWeapon, 'F', 40, 0, false, testEqConst);

      expect(result.attackPower).toBe(130); // 50 + 2*40
      expect(result.critRate).toBe(5); // 変わらない
      expect(result.critDamage).toBe(60); // 20 + 1*40
    });

    it('錬金ON時、錬金値が加算される', () => {
      const result = calculateWeaponStats(testWeapon, 'A', 0, 0, true, testEqConst);

      const expectedBase = Math.ceil(50 + 10 * (25 / 320)); // 51
      const expectedTotal = expectedBase + 25 + 116; // 192
      
      expect(result.attackPower).toBe(expectedTotal);
      expect(result.critRate).toBe(17); // 5 + 3 + 9
      expect(result.critDamage).toBe(70); // 20 + 3 + 47
    });

    it('叩きが正しく加算される', () => {
      const result = calculateWeaponStats(testWeapon, 'F', 0, 20, false, testEqConst);

      expect(result.attackPower).toBe(70); // 50 + 1*20
      expect(result.critRate).toBe(5);
      expect(result.critDamage).toBe(20);
    });

    it('最低ランク指定時、F値が正しく逆算される', () => {
      const weaponWithMinRank: WeaponData = {
        ...testWeapon,
        '攻撃力（初期値）': 100,
        '会心率（初期値）': 10,
        最低ランク: 'A',
      };

      const result = calculateWeaponStats(weaponWithMinRank, 'A', 0, 0, false, testEqConst);

      // CSVの100はAランクの値
      // F値 = 100 - 25 = 75
      // A値 = ROUNDUP(75 + 10 * (25/320)) + 25 = 76 + 25 = 101
      const expectedBase = Math.ceil(75 + 10 * (25 / 320)); // 76
      const expectedTotal = expectedBase + 25; // 101
      
      expect(result.attackPower).toBe(expectedTotal);
      expect(result.critRate).toBe(10); // 10 - 3 + 3 = 10
    });

    it('無効なランクの場合、エラーがスローされる', () => {
      expect(() => {
        calculateWeaponStats(testWeapon, 'INVALID' as any, 0, 0, false, testEqConst);
      }).toThrow();
    });

    it('強化値が範囲外の場合、エラーがスローされる', () => {
      expect(() => {
        calculateWeaponStats(testWeapon, 'F', -1, 0, false, testEqConst);
      }).toThrow('Reinforcement must be between 0 and 80');

      expect(() => {
        calculateWeaponStats(testWeapon, 'F', 81, 0, false, testEqConst);
      }).toThrow('Reinforcement must be between 0 and 80');
    });
  });

  describe('calculateArmorStats', () => {
    const testArmor: ArmorData = {
      アイテム名: 'テスト防具',
      制作: 'true',
      使用可能Lv: 10,
      '守備力（初期値）': 30,
      '物理耐性（初期値）': 10,
      '魔法耐性（初期値）': 10,
      'HP（初期値）': 100,
    };

    it('基礎値のみの場合、正しく計算される', () => {
      const result = calculateArmorStats(testArmor, 'F', 0, testEqConst);

      // Fランクは係数0なので基礎値のみ
      expect(result.final.defense).toBe(30);
      expect(result.final.hp).toBe(100);
      expect(result.final.physicalResist).toBe(10);
      expect(result.final.magicResist).toBe(10);
    });

    it('ランクボーナスが正しく適用される', () => {
      const result = calculateArmorStats(testArmor, 'A', 0, testEqConst);

      // MainStatus = ROUND(30 * (1 + 30^0.2 * (5 / 10)))
      // = ROUND(30 * (1 + 2.01 * 0.5))
      // = ROUND(30 * 2.005)
      // = 60
      expect(result.final.defense).toBeCloseTo(60, 0);

      // HP = ROUND(100 * (1 + 100^0.2 * (5 / 10)))
      // = ROUND(100 * (1 + 2.51 * 0.5))
      // = ROUND(100 * 2.256)
      // = 226
      expect(result.final.hp).toBeCloseTo(226, 0);
    });

    it('強化値が正しく加算される', () => {
      const result = calculateArmorStats(testArmor, 'F', 20, testEqConst);

      // 守備力: 30 + 1*20 (forge) = 50に対して計算
      // Defense = ROUND(50 * (1 + 50^0.2 * (0 / 10))) = 50
      expect(result.final.defense).toBe(50);

      // HP: 100 + 2*20 (forge) = 140に対して計算
      // HP = ROUND(140 * (1 + 140^0.2 * (0 / 10))) = 140
      expect(result.final.hp).toBe(140);
    });

    it('強化値が範囲外の場合、エラーがスローされる', () => {
      expect(() => {
        calculateArmorStats(testArmor, 'F', -1, testEqConst);
      }).toThrow('Reinforcement must be between 0 and 40');

      expect(() => {
        calculateArmorStats(testArmor, 'F', 41, testEqConst);
      }).toThrow('Reinforcement must be between 0 and 40');
    });
  });

  describe('calculateAccessoryStats', () => {
    const testAccessory: AccessoryData = {
      アイテム名: 'テストアクセサリー',
      制作: 'true',
      使用可能Lv: 20,
      ステータス種類: '力',
      'ステータス値（初期値）': 10,
    };

    it('基礎値のみの場合、正しく計算される', () => {
      const result = calculateAccessoryStats(testAccessory, 'F', testEqConst);

      // Fランクは係数0
      expect(result.final['力']).toBe(10);
    });

    it('ランクボーナスが正しく適用される', () => {
      const result = calculateAccessoryStats(testAccessory, 'A', testEqConst);

      // MainStatus = ROUNDUP(10 + 20 * 44 / 550)
      // = ROUNDUP(10 + 1.6)
      // = 12
      expect(result.final['力']).toBe(12);
    });

    it('SSSランクで正しく計算される', () => {
      const result = calculateAccessoryStats(testAccessory, 'SSS', testEqConst);

      // MainStatus = ROUNDUP(10 + 20 * 55 / 550)
      // = ROUNDUP(10 + 2)
      // = 12
      expect(result.final['力']).toBe(12);
    });
  });

  describe('calculateEmblemStats', () => {
    const testEmblem: EmblemData = {
      アイテム名: 'テスト紋章',
      タイプ: '攻撃',
      効果: '力',
      数値: 10,
    };

    it('紋章の%ボーナスが正しく設定される', () => {
      const result = calculateEmblemStats(testEmblem);

      expect(result.final['力_percent']).toBe(10);
    });
  });

  describe('calculateRuneStats', () => {
    const testRunes: RunestoneData[] = [
      {
        アイテム名: 'ルーン1',
        タイプ: 'ノーマル',
        効果: '力',
        数値: 5,
      },
      {
        アイテム名: 'ルーン2',
        タイプ: 'グレート',
        効果: '魔力',
        数値: 7,
        セット効果: 'HP',
        セット数値: 50,
      },
    ];

    it('ルーンのステータスが正しく合算される', () => {
      const result = calculateRuneStats(testRunes);

      expect(result.final['力']).toBe(5);
      expect(result.final['魔力']).toBe(7);
      expect(result.final['HP']).toBe(50);
    });

    it('同じグレードのルーンを複数選択するとエラー', () => {
      const duplicateRunes: RunestoneData[] = [
        {
          アイテム名: 'ルーン1',
          タイプ: 'ノーマル',
          効果: '力',
          数値: 5,
        },
        {
          アイテム名: 'ルーン2',
          タイプ: 'ノーマル', // 重複
          効果: '魔力',
          数値: 7,
        },
      ];

      expect(() => {
        calculateRuneStats(duplicateRunes);
      }).toThrow('Duplicate rune grade: ノーマル');
    });

    it('5個以上のルーンを選択するとエラー', () => {
      const tooManyRunes: RunestoneData[] = [
        { アイテム名: 'ルーン1', タイプ: 'ノーマル', 効果: '力', 数値: 5 },
        { アイテム名: 'ルーン2', タイプ: 'グレート', 効果: '力', 数値: 5 },
        { アイテム名: 'ルーン3', タイプ: 'バスター', 効果: '力', 数値: 5 },
        { アイテム名: 'ルーン4', タイプ: 'レプリカ', 効果: '力', 数値: 5 },
        { アイテム名: 'ルーン5', タイプ: 'その他', 効果: '力', 数値: 5 },
      ];

      expect(() => {
        calculateRuneStats(tooManyRunes);
      }).toThrow('Maximum 4 runes allowed');
    });
  });

  describe('calculateAllEquipmentStats', () => {
    it('全装備のステータスが正しく合算される', () => {
      const equipment: SelectedEquipment = {
        weapon: {
          data: {
            アイテム名: 'テスト武器',
            制作: 'true',
            武器種: '剣',
            使用可能Lv: 10,
            '攻撃力（初期値）': 50,
            '会心率（初期値）': 5,
            '会心ダメージ（初期値）': 20,
            'ダメージ補正（初期値）': 80,
            'ct(初期値)': 1.5,
          },
          rank: 'F',
          reinforcement: 0,
          hammerCount: 0,
          alchemyEnabled: false,
        },
        head: {
          data: {
            アイテム名: 'テスト頭防具',
            制作: 'true',
            使用可能Lv: 10,
            '守備力（初期値）': 10,
            '物理耐性（初期値）': 5,
            '魔法耐性（初期値）': 5,
            'HP（初期値）': 50,
          },
          rank: 'F',
          reinforcement: 0,
        },
        necklace: {
          data: {
            アイテム名: 'テストネックレス',
            制作: 'true',
            使用可能Lv: 10,
            ステータス種類: '力',
            'ステータス値（初期値）': 5,
          },
          rank: 'F',
        },
        emblem: {
          アイテム名: 'テスト紋章',
          タイプ: '攻撃',
          効果: '力',
          数値: 10,
        },
        runes: [
          {
            アイテム名: 'テストルーン',
            タイプ: 'ノーマル',
            効果: '魔力',
            数値: 3,
          },
        ],
      };

      const result = calculateAllEquipmentStats(equipment, testEqConst);

      // 武器からの攻撃力
      expect(result.attackPower).toBe(50);
      expect(result.critRate).toBe(5);
      expect(result.critDamage).toBe(20);

      // 防具からの守備力とHP
      expect(result.final.defense).toBe(10);
      expect(result.final.hp).toBe(50);

      // アクセサリーからの力
      expect(result.final['力']).toBe(5);

      // 紋章からの力%ボーナス
      expect(result.final['力_percent']).toBe(10);

      // ルーンからの魔力
      expect(result.final['魔力']).toBe(3);
    });
  });
});