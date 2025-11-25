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
      Coeff: {
        F: 0,
        E: 0,
        D: 0.0667,
        C: 0.0667,
        B: 0.08,
        A: 0.08,
        S: 0.0857,
        SS: 0.0909,
        SSS: 0.1,
      },
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
    TatakiMultiplier: {
      Defense: 1,
      Others: 2,
    },
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
      Other: {
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

      // Atk(Rank) = ROUNDUP(WeaponAttackP + AvailableLv * k_Rank) + Rank.Bonus.AttackP
      // k_Rank for A = 0.08
      const expectedBase = Math.ceil(50 + 10 * 0.08); // 51
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

      // k_Rank for A = 0.08
      const expectedBase = Math.ceil(50 + 10 * 0.08); // 51
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
      // A値 = ROUNDUP(75 + 10 * k_Rank) + 25
      // k_Rank for A = 0.08
      const expectedBase = Math.ceil(75 + 10 * 0.08); // 76
      const expectedTotal = expectedBase + 25; // 101
      
      expect(result.attackPower).toBe(expectedTotal);
      expect(result.critRate).toBe(10); // 10 - 3 + 3 = 10
    });

    it('無効なランク文字列の場合、デフォルトランク(SSS)にクランプされる', () => {
      // INVALIDはRANK_ORDERに含まれないため、rankIndex=-1となりindex=0(SSS)にクランプ
      const result = calculateWeaponStats(testWeapon, 'INVALID' as any, 0, 0, false, testEqConst);

      // SSSランクで計算される
      expect(result.attackPower).toBeGreaterThan(testWeapon['攻撃力（初期値）']);
    });

    it('最高ランク制限を超えるランクを指定した場合、自動的にクランプされる', () => {
      // 最高ランクがFの検証武器
      const testWeaponWithMaxRank: WeaponData = {
        アイテム名: '検証剣',
        制作: 'false',
        武器種: '剣',
        使用可能Lv: 100,
        '攻撃力（初期値）': 10,
        '会心率（初期値）': 100,
        '会心ダメージ（初期値）': -90,
        'ダメージ補正（初期値）': 100,
        'ct(初期値)': 1,
        最高ランク: 'F',
      };

      // SSS指定してもエラーにならず、Fにクランプされる
      const result = calculateWeaponStats(testWeaponWithMaxRank, 'SSS', 0, 0, false, testEqConst);

      // Fランクで計算されているため、ランクボーナスが0
      expect(result.attackPower).toBe(10); // 基礎値のみ
      expect(result.critRate).toBe(100);
      expect(result.critDamage).toBe(-90);
    });

    it('最低ランク制限を下回るランクを指定した場合、自動的にクランプされる', () => {
      const testWeaponWithMinRank: WeaponData = {
        アイテム名: 'テスト武器',
        制作: 'true',
        武器種: '剣',
        使用可能Lv: 10,
        '攻撃力（初期値）': 100, // Aランク時の値
        '会心率（初期値）': 10,
        '会心ダメージ（初期値）': 23,
        'ダメージ補正（初期値）': 80,
        'ct(初期値)': 1.5,
        最低ランク: 'A',
      };

      // F指定してもエラーにならず、Aにクランプされる
      const result = calculateWeaponStats(testWeaponWithMinRank, 'F', 0, 0, false, testEqConst);

      // Aランクで計算される（最低ランクにクランプ）
      // F基準値の逆算後にAランクボーナスが適用される
      expect(result.attackPower).toBeGreaterThan(0);
      expect(result.critRate).toBeGreaterThan(0);
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
      使用可能Lv: 10,
      部位を選択: 'Body',
      タイプを選択: '金属',
      '力（初期値）': 10,
      '魔力（初期値）': 10,
      '体力（初期値）': 100,
      '精神（初期値）': 10,
      '素早さ（初期値）': 10,
      '器用（初期値）': 10,
      '撃力（初期値）': 10,
      '守備力（初期値）': 30,
    };

    it('基礎値のみの場合、正しく計算される', () => {
      const result = calculateArmorStats(testArmor, 'F', 0, 0, testEqConst);

      // Fランクは係数0なので基礎値のみ
      expect(result.final.defense).toBe(30);
      expect(result.final.hp).toBe(100);
      expect(result.final.power).toBe(10);
      expect(result.final.magic).toBe(10);
      expect(result.final.mind).toBe(10);
      expect(result.final.speed).toBe(10);
      expect(result.final.dexterity).toBe(10);
      expect(result.final.critDamage).toBe(10);
    });

    it('ランクボーナスが正しく適用される', () => {
      const result = calculateArmorStats(testArmor, 'A', 0, 0, testEqConst);

      // Defense = ROUND(30 * (1 + 30^0.2 * (5 / 10)))
      // = ROUND(30 * (1 + 2.01 * 0.5))
      // = ROUND(30 * 2.005)
      // = 60
      expect(result.final.defense).toBeCloseTo(60, 0);

      // HP = ROUND(100 * (1 + 100^0.2 * (5 / 10)))
      // = ROUND(100 * (1 + 2.51 * 0.5))
      // = ROUND(100 * 2.256)
      // = 226
      expect(result.final.hp).toBeCloseTo(226, 0);
      
      // Power = ROUND(10 * (1 + 10^0.2 * (5 / 10)))
      // = ROUND(10 * (1 + 1.58 * 0.5))
      // = ROUND(10 * 1.79)
      // = 18
      expect(result.final.power).toBeCloseTo(18, 0);
    });

    it('強化値が正しく加算される', () => {
      const result = calculateArmorStats(testArmor, 'F', 20, 0, testEqConst);

      // 守備力: 30 + 1*20 (forge) = 50に対して計算
      // Defense = ROUND(50 * (1 + 50^0.2 * (0 / 10))) = 50
      expect(result.final.defense).toBe(50);

      // HP: 100 + 2*20 (forge) = 140に対して計算
      // HP = ROUND(140 * (1 + 140^0.2 * (0 / 10))) = 140
      expect(result.final.hp).toBe(140);
      
      // Power: 10 + 2*20 (forge) = 50に対して計算 
      // Power = ROUND(50 * (1 + 50^0.2 * (0 / 10))) = 50
      expect(result.final.power).toBe(50);
    });

    it('強化値が範囲外の場合、エラーがスローされる', () => {
      expect(() => {
        calculateArmorStats(testArmor, 'F', -1, 0, testEqConst);
      }).toThrow('Reinforcement must be between 0 and 40');

      expect(() => {
        calculateArmorStats(testArmor, 'F', 41, 0, testEqConst);
      }).toThrow('Reinforcement must be between 0 and 40');
    });

    it('叩き回数が正しく適用される', () => {
      const result = calculateArmorStats(testArmor, 'F', 0, 5, testEqConst);
      
      // 叩き値によってステータスが上昇していることを確認
      // 通常ステータス: 叩き回数 × 2
      // 守備力: 叩き回数 × 1
      expect(result.final.defense).toBeGreaterThan(testArmor['守備力（初期値）']);
      expect(result.final.hp).toBeGreaterThan(testArmor['体力（初期値）']);
      expect(result.final.power).toBeGreaterThan(0);
      expect(result.final.magic).toBeGreaterThan(0);
      expect(result.final.mind).toBeGreaterThan(0);
      expect(result.final.speed).toBeGreaterThan(0);
      expect(result.final.dexterity).toBeGreaterThan(0);
      expect(result.final.critDamage).toBeGreaterThan(0);
    });

    it('叩き回数が範囲外の場合、エラーがスローされる', () => {
      expect(() => {
        calculateArmorStats(testArmor, 'F', 0, -1, testEqConst);
      }).toThrow('Tataki count must be between 0 and 12');

      expect(() => {
        calculateArmorStats(testArmor, 'F', 0, 13, testEqConst);
      }).toThrow('Tataki count must be between 0 and 12');
    });
  });

  describe('calculateAccessoryStats', () => {
    const testAccessory: AccessoryData = {
      アイテム名: 'テストアクセサリー',
      使用可能Lv: 20,
      タイプを選択: 'ネックレス',
      '体力（初期値）': 0,
      '力（初期値）': 10,
      '魔力（初期値）': 0,
      '精神（初期値）': 0,
      '撃力（初期値）': 0,
      '素早さ（初期値）': 0,
    };

    it('基礎値のみの場合、正しく計算される', () => {
      const result = calculateAccessoryStats(testAccessory, 'F', testEqConst);

      // Fランクは基礎値そのまま
      expect(result.final.Power).toBe(10);
    });

    it('ランクボーナスが正しく適用される', () => {
      const result = calculateAccessoryStats(testAccessory, 'A', testEqConst);

      // 実数値 = ROUND(10 + (20 / 13))
      // = ROUND(10 + 1.54)
      // = 12
      expect(result.final.Power).toBe(12);
    });

    it('SSSランクで正しく計算される', () => {
      const result = calculateAccessoryStats(testAccessory, 'SSS', testEqConst);

      // 実数値 = ROUND(10 + (20 / 10))
      // = ROUND(10 + 2)
      // = 12
      expect(result.final.Power).toBe(12);
    });
  });

  describe('calculateEmblemStats', () => {
    const testEmblem: EmblemData = {
      name: 'テスト紋章',
      アイテム名: 'テスト紋章',
      使用可能Lv: 50,
      '力（%不要）': 10,
    };

    it('紋章の%ボーナスが正しく設定される', () => {
      const result = calculateEmblemStats(testEmblem);

      expect(result.final['power_percent']).toBe(10);
    });
  });

  describe('calculateRuneStats', () => {
    const testRunes: RunestoneData[] = [
      {
        name: 'ルーン1',
        'アイテム名（・<グレード>）は不要': 'ルーン1',
        グレード: 'ノーマル',
        力: 5,
      },
      {
        name: 'ルーン2',
        'アイテム名（・<グレード>）は不要': 'ルーン2',
        グレード: 'グレート',
        魔力: 7,
        体力: 50,
      },
    ];

    it('ルーンのステータスが正しく合算される', () => {
      const result = calculateRuneStats(testRunes);

      expect(result.final['power']).toBe(5);
      expect(result.final['magic']).toBe(7);
      expect(result.final['health']).toBe(50);
    });

    it('同じグレードのルーンを複数選択するとエラー', () => {
      const duplicateRunes: RunestoneData[] = [
        {
          name: 'ルーン1',
          'アイテム名（・<グレード>）は不要': 'ルーン1',
          グレード: 'ノーマル',
          力: 5,
        },
        {
          name: 'ルーン2',
          'アイテム名（・<グレード>）は不要': 'ルーン2',
          グレード: 'ノーマル', // 重複
          魔力: 7,
        },
      ];

      expect(() => {
        calculateRuneStats(duplicateRunes);
      }).toThrow('Duplicate rune grade: ノーマル');
    });

    it('5個以上のルーンを選択するとエラー', () => {
      const tooManyRunes: RunestoneData[] = [
        { name: 'ルーン1', 'アイテム名（・<グレード>）は不要': 'ルーン1', グレード: 'ノーマル', 力: 5 },
        { name: 'ルーン2', 'アイテム名（・<グレード>）は不要': 'ルーン2', グレード: 'グレート', 力: 5 },
        { name: 'ルーン3', 'アイテム名（・<グレード>）は不要': 'ルーン3', グレード: 'バスター', 力: 5 },
        { name: 'ルーン4', 'アイテム名（・<グレード>）は不要': 'ルーン4', グレード: 'レプリカ', 力: 5 },
        { name: 'ルーン5', 'アイテム名（・<グレード>）は不要': 'ルーン5', グレード: 'ノーマル', 力: 5 }, // 5個目はグレード重複
      ];

      expect(() => {
        calculateRuneStats(tooManyRunes);
      }).toThrow(); // グレード重複またはルーン数超過でエラー
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
            使用可能Lv: 10,
            部位を選択: '頭',
            タイプを選択: '布',
            '力（初期値）': 0,
            '魔力（初期値）': 0,
            '体力（初期値）': 50,
            '精神（初期値）': 0,
            '素早さ（初期値）': 0,
            '器用（初期値）': 0,
            '撃力（初期値）': 0,
            '守備力（初期値）': 10,
          },
          rank: 'F',
          reinforcement: 0,
          tatakiCount: 0,
        },
        necklace: {
          data: {
            アイテム名: 'テストネックレス',
            使用可能Lv: 10,
            タイプを選択: 'ネックレス',
            '体力（初期値）': 0,
            '力（初期値）': 5,
            '魔力（初期値）': 0,
            '精神（初期値）': 0,
            '撃力（初期値）': 0,
            '素早さ（初期値）': 0,
          },
          rank: 'F',
        },
        emblem: {
          name: 'テスト紋章',
          アイテム名: 'テスト紋章',
          使用可能Lv: 50,
          '力（%不要）': 10,
        },
        runes: [
          {
            name: 'テストルーン',
            'アイテム名（・<グレード>）は不要': 'テストルーン',
            グレード: 'ノーマル',
            魔力: 3,
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
      expect(result.final.Power).toBe(5);

      // 紋章からの力%ボーナス
      expect(result.final['power_percent']).toBe(10);

      // ルーンからの魔力
      expect(result.final['magic']).toBe(3);
    });
  });
});