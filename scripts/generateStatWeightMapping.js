#!/usr/bin/env node
/**
 * ステータス重みづけマッピング生成スクリプト
 *
 * 使い方: node scripts/generateStatWeightMapping.js
 *
 * 出力: public/data/mapping/statWeightMapping.json
 */

const fs = require('fs');
const path = require('path');

// ===== 定数定義 =====

/** 武器種ごとのステータス係数 */
const WEAPON_BASE_DAMAGE_COEFFICIENTS = {
  Sword: { Power: 1.6, Magic: 0, HP: 0, Mind: 0, Agility: 0, Dex: 0, CritDamage: 0.005, Defense: 0 },
  Wand: { Power: 0, Magic: 1.75, HP: 0, Mind: 0, Agility: 0, Dex: 0, CritDamage: 0.0016, Defense: 0 },
  Bow: { Power: 1.75, Magic: 0, HP: 0, Mind: 0, Agility: 0, Dex: 0, CritDamage: 0.0016, Defense: 0 },
  Axe: { Power: 1.5, Magic: 0, HP: 0, Mind: 2.5, Agility: 0, Dex: 0, CritDamage: 0.001, Defense: 0 },
  GreatSword: { Power: 1.6, Magic: 0, HP: 3.1, Mind: 0, Agility: 0, Dex: 0, CritDamage: 0.001, Defense: 0 },
  Dagger: { Power: 1.25, Magic: 0, HP: 0, Mind: 0, Agility: 3.5, Dex: 0, CritDamage: 0.0015, Defense: 0 },
  Spear: { Power: 0.005, Magic: 0, HP: 0, Mind: 0, Agility: 0, Dex: 1.0, CritDamage: 0.001/3, Defense: 0.027 },
  Frypan: { Power: 1.6, Magic: 0, HP: 0, Mind: 0, Agility: 0, Dex: 0, CritDamage: 0.005, Defense: 0 },
};

/** 職業バフ依存 */
const JOB_BUFF_DEPENDENCIES = {
  SpellRefactor: [{ stat: 'Magic', coefficient: 1.5 }, { stat: 'Power', coefficient: 1.5 }],
  Priest: [{ stat: 'Mind', coefficient: 2.0 }],
  StellaShaft: [{ stat: 'Agility', coefficient: 2.5 }],
  Guardian: [{ stat: 'Defense', coefficient: 2.0 }],
};

/** 職業定義 */
const JOB_DEFINITIONS = {
  Novice: { MaxLevel: 220, Grade: 'Special', AvailableWeapons: ['All'], AvailableArmors: ['Cloth', 'Leather', 'Metal'] },
  Fighter: { MaxLevel: 100, Grade: 'First', AvailableWeapons: ['Sword'], AvailableArmors: ['Leather'] },
  Acolyte: { MaxLevel: 100, Grade: 'First', AvailableWeapons: ['Wand'], AvailableArmors: ['Cloth'] },
  Archer: { MaxLevel: 100, Grade: 'First', AvailableWeapons: ['Bow'], AvailableArmors: ['Leather'] },
  Mage: { MaxLevel: 100, Grade: 'First', AvailableWeapons: ['Wand'], AvailableArmors: ['Cloth'] },
  Cleric: { MaxLevel: 150, Grade: 'Second', AvailableWeapons: ['Wand'], AvailableArmors: ['Cloth'] },
  Hunter: { MaxLevel: 150, Grade: 'Second', AvailableWeapons: ['Dagger', 'Sword'], AvailableArmors: ['Leather'] },
  Ranger: { MaxLevel: 150, Grade: 'Second', AvailableWeapons: ['Bow'], AvailableArmors: ['Leather'] },
  Wizard: { MaxLevel: 150, Grade: 'Second', AvailableWeapons: ['Wand'], AvailableArmors: ['Cloth'] },
  Knight: { MaxLevel: 150, Grade: 'Second', AvailableWeapons: ['Sword'], AvailableArmors: ['Leather', 'Metal'] },
  Warrior: { MaxLevel: 150, Grade: 'Second', AvailableWeapons: ['Axe', 'GreatSword'], AvailableArmors: ['Leather', 'Metal'] },
  SpellRefactor: { MaxLevel: 180, Grade: 'Third', AvailableWeapons: ['Sword', 'Wand', 'Grimoire', 'Shield'], AvailableArmors: ['Leather', 'Metal'] },
  Guardian: { MaxLevel: 180, Grade: 'Third', AvailableWeapons: ['Sword', 'Spear'], AvailableArmors: ['Metal'] },
  Priest: { MaxLevel: 180, Grade: 'Third', AvailableWeapons: ['Wand'], AvailableArmors: ['Cloth'] },
  StellaShaft: { MaxLevel: 180, Grade: 'Third', AvailableWeapons: ['Bow'], AvailableArmors: ['Leather'] },
};

/** 職業名マッピング */
const JOB_NAME_MAPPING = {
  Novice: '初心者', Fighter: 'ファイター', Acolyte: 'アコライト', Archer: 'アーチャー',
  Mage: 'メイジ', Cleric: 'クレリック', Hunter: 'ハンター', Ranger: 'レンジャー',
  Wizard: 'ウィザード', Knight: 'ナイト', Warrior: 'ウォーリア',
  SpellRefactor: 'スペルリファクター', Guardian: 'ガーディアン', Priest: 'プリースト', StellaShaft: 'ステラシャフト',
};

/** 職業スキル定義 */
const JOB_SKILLS = {
  Fighter: {
    '烈刃の円斬撃': { BaseDamageType: ['Sword'], Hits: 5, Damage: 'BaseDamage.Sword * 0.4' },
    '常闇斬撃': { BaseDamageType: ['Sword'], Hits: 5.5, Damage: 'BaseDamage.Sword * 0.6' },
    'ファイアインパクト': { BaseDamageType: ['Sword'], Hits: 1, Damage: 'BaseDamage.Sword * 3.0' },
  },
  Mage: {
    'イグナ': { BaseDamageType: ['Wand'], Hits: 2, Damage: '(BaseDamage.Wand + UserCritDamage * 5) * 0.5' },
    'イグナム': { BaseDamageType: ['Wand'], Hits: 2, Damage: '(BaseDamage.Wand + UserCritDamage * 5) * 0.4' },
    'イグナイト': { BaseDamageType: ['Wand'], Hits: 1, Damage: '(BaseDamage.Wand + UserCritDamage * 5) * 1.0' },
    'イグナイト2': { BaseDamageType: ['Wand'], Hits: 1, Damage: '(BaseDamage.Wand + UserCritDamage * 5) * 1.25' },
    'ウィンド': { BaseDamageType: ['Wand'], Hits: 3, Damage: '(BaseDamage.Wand + UserMind * 0.2) * 0.5' },
    'ウィンドラ': { BaseDamageType: ['Wand'], Hits: 5, Damage: '(BaseDamage.Wand + UserMind * 0.2) * 0.4' },
    'ウィンドバースト': { BaseDamageType: ['Wand'], Hits: 8, Damage: '(BaseDamage.Wand + UserMind * 0.2) * 0.4' },
    'ウィンドバースト2': { BaseDamageType: ['Wand'], Hits: 8, Damage: '(BaseDamage.Wand + UserMind * 0.2) * 0.65' },
  },
  Archer: {
    'アローレイン': { BaseDamageType: ['Bow'], Hits: 'variable', Damage: 'BaseDamage.Bow * 0.5' },
    '迅雷射': { BaseDamageType: ['Bow'], Hits: 12, Damage: 'BaseDamage.Bow * 0.4' },
    '迅雷射2': { BaseDamageType: ['Bow'], Hits: 14, Damage: 'BaseDamage.Bow * 0.4' },
    'バレット・レーン': { BaseDamageType: ['Bow'], Hits: 5, Damage: 'BaseDamage.Bow * 0.6' },
  },
  Acolyte: {
    'エリアヒール': { BaseDamageType: ['Wand'], Hits: 1, Heal: 'BaseDamage.Wand * 0.0675 + UserMagic*0.114 + UserHP*0.25' },
    'エリアヒール2': { BaseDamageType: ['Wand'], Hits: 1, Heal: '(BaseDamage.Wand * 0.0675 + UserMagic*0.114 + UserHP*0.25) * 1.2' },
    'ホーリーディメンション': { BaseDamageType: ['Wand'], Hits: 1, Damage: 'BaseDamage.Wand * 3 + UserHP*3 + UserMind*2 + UserMagic*1' },
  },
  Warrior: {
    '烈刃の円斬撃3': { BaseDamageType: ['GreatSword', 'Axe'], Hits: 5, Damage: 'BaseDamage.GreatSword * 0.7' },
    '常闇斬撃2': { BaseDamageType: ['GreatSword', 'Axe'], Hits: 6, Damage: 'BaseDamage.GreatSword * 0.8' },
    '常闇斬撃4': { BaseDamageType: ['GreatSword', 'Axe'], Hits: 6, Damage: 'BaseDamage.GreatSword * 1.2' },
    '烈刃の円斬撃6': { BaseDamageType: ['GreatSword', 'Axe'], Hits: 5, Damage: 'BaseDamage.GreatSword * 1.15' },
  },
  Knight: {
    '烈刃の円斬撃2': { BaseDamageType: ['Sword'], Hits: 5, Damage: 'BaseDamage.Sword * 0.55' },
    '烈刃の円斬撃3': { BaseDamageType: ['Sword'], Hits: 5, Damage: 'BaseDamage.Sword * 0.7' },
    '聖なる鉄槌': { BaseDamageType: ['Sword'], Hits: 5, Damage: 'BaseDamage.Sword * 0.5 + UserDefense*1.75 + UserPower*0.5 + UserHP*0.25' },
    '聖なる鉄槌2': { BaseDamageType: ['Sword'], Hits: 5, Damage: '(BaseDamage.Sword * 0.5 + UserDefense*1.75 + UserPower*0.5 + UserHP*0.25) * 1.1' },
    'セルフヒール2': { BaseDamageType: ['Bow'], Hits: 1, Heal: 'BaseDamage.Bow * 0.048 + UserHP*0.12 + UserMagic*0.08' },
    'セルフヒール4': { BaseDamageType: ['Bow'], Hits: 1, Heal: '(BaseDamage.Bow * 0.048 + UserHP*0.12 + UserMagic*0.08) * 1.333' },
  },
  Wizard: {
    'イグナ2': { BaseDamageType: ['Wand'], Hits: 2, Damage: '(BaseDamage.Wand + UserCritDamage * 5) * 0.65' },
    'イグナム2': { BaseDamageType: ['Wand'], Hits: 2, Damage: '(BaseDamage.Wand + UserCritDamage * 5) * 0.6' },
    'イグナイト2': { BaseDamageType: ['Wand'], Hits: 1, Damage: '(BaseDamage.Wand + UserCritDamage * 5) * 1.25' },
    'イグナイト3': { BaseDamageType: ['Wand'], Hits: 1, Damage: '(BaseDamage.Wand + UserCritDamage * 5) * 1.5' },
    'イグナイト・改': { BaseDamageType: ['Wand'], Hits: 1, Damage: '(BaseDamage.Wand + UserCritDamage * 5) * 2.5' },
    'ウィンド2': { BaseDamageType: ['Wand'], Hits: 3, Damage: '(BaseDamage.Wand + UserMind * 0.2) * 0.65' },
    'ウィンドラ2': { BaseDamageType: ['Wand'], Hits: 5, Damage: '(BaseDamage.Wand + UserMind * 0.2) * 0.6' },
    'ウィンドバースト2': { BaseDamageType: ['Wand'], Hits: 8, Damage: '(BaseDamage.Wand + UserMind * 0.2) * 0.65' },
    'ウィンドバースト3': { BaseDamageType: ['Wand'], Hits: 8, Damage: '(BaseDamage.Wand + UserMind * 0.2) * 0.9' },
    'ウィンドバースト・改': { BaseDamageType: ['Wand'], Hits: 8, Damage: '(BaseDamage.Wand + UserMind * 0.2) * 0.5' },
    'ノンエレメント・エクスプロード': { BaseDamageType: ['Wand'], Hits: 1, Damage: 'BaseDamage.Wand * UserMind*2 * 0.03115' },
    'ノンエレメント・エクスプロード2': { BaseDamageType: ['Wand'], Hits: 1, Damage: 'BaseDamage.Wand * UserMind*2 * 0.03185' },
    'ノンエレメント・エクスプロード・烈': { BaseDamageType: ['Wand'], Hits: 1, Damage: '(BaseDamage.Wand + UserMind * 2 * 5) * 3.2' },
  },
  Ranger: {
    'アローレイン2': { BaseDamageType: ['Bow'], Hits: 'variable', Damage: 'BaseDamage.Bow * 0.5' },
    '迅雷射3': { BaseDamageType: ['Bow'], Hits: 16, Damage: 'BaseDamage.Bow * 0.4' },
    '風神射': { BaseDamageType: ['Bow'], Hits: 12, Damage: 'BaseDamage.Bow * 0.45' },
    '風神射2': { BaseDamageType: ['Bow'], Hits: 14, Damage: 'BaseDamage.Bow * 0.45' },
    'バレット・レーン2': { BaseDamageType: ['Bow'], Hits: 7, Damage: 'BaseDamage.Bow * 0.6' },
    'マリーナ・レーン': { BaseDamageType: ['Bow'], Hits: '6 + floor(UserSpeed/50)', Damage: 'BaseDamage.Bow * 0.6' },
    'マリーナ・レーン2': { BaseDamageType: ['Bow'], Hits: '8 + floor(UserSpeed/50)', Damage: 'BaseDamage.Bow * 0.6' },
  },
  Hunter: {
    '疾風連撃': { BaseDamageType: ['Dagger'], Hits: 4, Damage: '(BaseDamage.Dagger + UserSpeed * 0.5) * 0.6' },
    '水流連撃': { BaseDamageType: ['Dagger'], Hits: 4, Damage: '(BaseDamage.Dagger + UserSpeed * 0.5) * 0.6' },
    '水流連撃2': { BaseDamageType: ['Dagger'], Hits: 4, Damage: '(BaseDamage.Dagger + UserSpeed * 0.5) * 0.65' },
    'サンライトスラッシュ': { BaseDamageType: ['Dagger'], Hits: 6, Damage: '(BaseDamage.Dagger + UserSpeed * 0.5) * 0.65' },
  },
  SpellRefactor: {
    'ウィンドバースト・改': { BaseDamageType: ['Sword', 'Wand'], Hits: 8, Damage: '(BaseDamage.Sword + UserMind*0.2)*0.5' },
    'ウィンドバースト・改2': { BaseDamageType: ['Sword', 'Wand'], Hits: 8, Damage: '(BaseDamage.Sword + UserMind*0.2)*0.75' },
  },
  StellaShaft: {
    'シャイニングアロー': { BaseDamageType: ['Bow'], Hits: 5, Damage: 'Round(BaseDamage.Bow + UserSpeed*13,-1)' },
    'シャイニングアロー2': { BaseDamageType: ['Bow'], Hits: 5, Damage: 'Round((BaseDamage.Bow + UserSpeed*13)*1.25,-1)' },
  },
  Priest: {
    '女神の神弓': { BaseDamageType: ['Wand'], Hits: 11, Heal: 'Round(Round((BaseDamage.Wand / 65) + (UserMagic / 55) + (UserHP / 18)) * 2.05)' },
  },
  Novice: {
    '応急手当': { BaseDamageType: [], Hits: 1, Heal: 'UserHP * 0.3' },
    'なぎはらい': { BaseDamageType: ['Sword'], Hits: 1, Damage: 'BaseDamage.Sword * 1.3' },
    'ぶんまわし': { BaseDamageType: ['Bow'], Hits: 1, Damage: 'BaseDamage.Bow * 1.4' },
    'ファイア': { BaseDamageType: ['Sword', 'Bow', 'Wand', 'Spear'], Hits: 1, Damage: 'BaseDamage.Sword * 1.3' },
    'アイス': { BaseDamageType: ['Wand'], Hits: 1, Damage: 'BaseDamage.Wand * 1.3' },
  },
  Guardian: {},
  Cleric: {},
};

/** スキルブック */
const SKILL_BOOKS = {
  Sword: {
    '斬撃波': { BaseDamageType: ['Sword'], Hits: 1, Damage: 'BaseDamage.Sword * 1.0' },
    '火炎斬': { BaseDamageType: ['Sword'], Hits: 1, Damage: 'BaseDamage.Sword * 1.0' },
    '斬撃波・改': { BaseDamageType: ['Sword'], Hits: 1, Damage: 'BaseDamage.Sword * 1.2' },
  },
  Wand: {
    'フェアリースイフト': { BaseDamageType: ['Wand'], Hits: 1, Damage: 'BaseDamage.Wand * 1.0' },
    'ウォルタ': { BaseDamageType: ['Wand'], Hits: 1, Damage: 'BaseDamage.Wand * 1.0' },
  },
  Bow: {
    'ブラッドショット': { BaseDamageType: ['Bow'], Hits: 1, Damage: 'Round((BaseDamage.Bow + UserSpeed*40) * 4.05,-1)' },
  },
  GreatSword: {
    '斬撃波(大剣)': { BaseDamageType: ['GreatSword'], Hits: 1, Damage: 'BaseDamage.GreatSword * 1.2' },
  },
  Dagger: {
    '連撃・覇': { BaseDamageType: ['Dagger'], Hits: 1, Damage: 'BaseDamage.Dagger * 1.4 + UserSpeed * 0.5' },
    '鏡喪斬': { BaseDamageType: ['Dagger'], Hits: 1, Damage: 'BaseDamage.Dagger * 1.0' },
  },
};

// ===== ユーティリティ関数 =====

const STAT_VAR_MAPPING = {
  UserPower: 'Power', UserMagic: 'Magic', UserHP: 'HP', UserMind: 'Mind',
  UserSpeed: 'Agility', UserAgility: 'Agility', UserDex: 'Dex',
  UserCritDamage: 'CritDamage', UserDefense: 'Defense',
};

function extractCoefficientsFromFormula(formula) {
  const result = {};
  if (!formula || typeof formula !== 'string') return result;

  const pattern1 = /User([A-Za-z]+)\s*\*\s*(\d+(?:\.\d+)?)/g;
  const pattern2 = /(\d+(?:\.\d+)?)\s*\*\s*User([A-Za-z]+)/g;

  let match;
  while ((match = pattern1.exec(formula)) !== null) {
    const varName = 'User' + match[1];
    const statKey = STAT_VAR_MAPPING[varName];
    if (statKey) {
      const coeff = parseFloat(match[2]);
      result[statKey] = Math.max(result[statKey] || 0, coeff);
    }
  }

  while ((match = pattern2.exec(formula)) !== null) {
    const varName = 'User' + match[2];
    const statKey = STAT_VAR_MAPPING[varName];
    if (statKey) {
      const coeff = parseFloat(match[1]);
      result[statKey] = Math.max(result[statKey] || 0, coeff);
    }
  }

  return result;
}

function getWeaponBaseDamageStats(weaponType) {
  const coeffs = WEAPON_BASE_DAMAGE_COEFFICIENTS[weaponType];
  if (!coeffs) return [];

  const weights = [];
  let totalCoeff = 0;

  for (const [stat, coeff] of Object.entries(coeffs)) {
    if (coeff > 0) {
      totalCoeff += coeff;
      weights.push({ stat, coefficient: coeff, normalizedWeight: 0, source: 'baseDamage' });
    }
  }

  for (const w of weights) {
    w.normalizedWeight = totalCoeff > 0 ? w.coefficient / totalCoeff : 0;
  }

  return weights;
}

function createSkillStatMapping(skillName, def, jobName) {
  const coeffMap = new Map();

  // BaseDamage依存
  for (const weaponType of (def.BaseDamageType || [])) {
    const weaponCoeffs = WEAPON_BASE_DAMAGE_COEFFICIENTS[weaponType];
    if (weaponCoeffs) {
      for (const [stat, coeff] of Object.entries(weaponCoeffs)) {
        if (coeff > 0) {
          const current = coeffMap.get(stat) || 0;
          coeffMap.set(stat, Math.max(current, coeff));
        }
      }
    }
  }

  // Damage/Heal式からの追加依存
  const formula = def.Damage || def.Heal || '';
  const extraCoeffs = extractCoefficientsFromFormula(formula);
  for (const [stat, coeff] of Object.entries(extraCoeffs)) {
    if (coeff > 0) {
      const current = coeffMap.get(stat) || 0;
      coeffMap.set(stat, current + coeff);
    }
  }

  // 職業バフ依存
  if (jobName && JOB_BUFF_DEPENDENCIES[jobName]) {
    for (const { stat, coefficient } of JOB_BUFF_DEPENDENCIES[jobName]) {
      const current = coeffMap.get(stat) || 0;
      coeffMap.set(stat, current + coefficient);
    }
  }

  // 正規化
  let totalCoeff = 0;
  for (const coeff of coeffMap.values()) totalCoeff += coeff;

  const weights = [];
  for (const [stat, coeff] of coeffMap.entries()) {
    weights.push({
      stat,
      coefficient: coeff,
      normalizedWeight: totalCoeff > 0 ? coeff / totalCoeff : 0,
      source: formula ? 'skill' : 'baseDamage',
    });
  }

  weights.sort((a, b) => b.coefficient - a.coefficient);

  return {
    skillId: skillName,
    skillName,
    baseDamageTypes: def.BaseDamageType || [],
    weights,
    hits: def.Hits || 1,
    mp: def.MP,
    coolTime: def.CT,
    hasBuff: !!(def.Buff || def.Debuff),
    isHeal: !!def.Heal,
  };
}

// ===== メイン処理 =====

function generateMapping() {
  const weaponBaseDamage = [];
  const jobMappings = [];
  const skillBooks = [];

  // 武器基礎ダメージ
  for (const [weaponType, coeffs] of Object.entries(WEAPON_BASE_DAMAGE_COEFFICIENTS)) {
    weaponBaseDamage.push({
      weaponType,
      weights: getWeaponBaseDamageStats(weaponType),
      attackPowerCoeff: 1.0,
      critDamageCoeff: coeffs.CritDamage || 0,
    });
  }

  // 職業マッピング
  for (const [jobNameYaml, jobDef] of Object.entries(JOB_DEFINITIONS)) {
    const availableWeapons = jobDef.AvailableWeapons.includes('All')
      ? Object.keys(WEAPON_BASE_DAMAGE_COEFFICIENTS)
      : jobDef.AvailableWeapons;

    // 通常攻撃
    const basicAttack = {};
    for (const weaponType of availableWeapons) {
      const weights = getWeaponBaseDamageStats(weaponType);

      // 職業バフ追加
      if (JOB_BUFF_DEPENDENCIES[jobNameYaml]) {
        for (const { stat, coefficient } of JOB_BUFF_DEPENDENCIES[jobNameYaml]) {
          const existing = weights.find(w => w.stat === stat);
          if (existing) {
            existing.coefficient += coefficient;
          } else {
            weights.push({ stat, coefficient, normalizedWeight: 0, source: 'jobBonus' });
          }
        }

        let totalCoeff = 0;
        for (const w of weights) totalCoeff += w.coefficient;
        for (const w of weights) w.normalizedWeight = totalCoeff > 0 ? w.coefficient / totalCoeff : 0;
        weights.sort((a, b) => b.coefficient - a.coefficient);
      }

      basicAttack[weaponType] = {
        skillId: `basic_attack_${weaponType}`,
        skillName: '通常攻撃',
        baseDamageTypes: [weaponType],
        weights,
        hits: 1,
        hasBuff: false,
        isHeal: false,
      };
    }

    // 職業スキル
    const skills = [];
    const jobSkillDefs = JOB_SKILLS[jobNameYaml] || {};
    for (const [skillName, skillDef] of Object.entries(jobSkillDefs)) {
      skills.push(createSkillStatMapping(skillName, skillDef, jobNameYaml));
    }

    // 職業ボーナス
    let jobBonus;
    if (JOB_BUFF_DEPENDENCIES[jobNameYaml]) {
      const deps = JOB_BUFF_DEPENDENCIES[jobNameYaml];
      jobBonus = {
        description: jobNameYaml === 'SpellRefactor'
          ? '力と魔力の比率に応じたダメージボーナス'
          : `${deps.map(d => d.stat).join(', ')}に応じたボーナス`,
        affectedStats: deps.map(d => d.stat),
      };
    }

    jobMappings.push({
      jobNameYaml,
      jobNameJa: JOB_NAME_MAPPING[jobNameYaml] || jobNameYaml,
      grade: jobDef.Grade,
      availableWeapons,
      availableArmors: jobDef.AvailableArmors,
      jobBonus,
      basicAttack,
      skills,
    });
  }

  // スキルブック
  for (const [weaponType, skills] of Object.entries(SKILL_BOOKS)) {
    const skillMappings = [];
    for (const [skillName, skillDef] of Object.entries(skills)) {
      skillMappings.push(createSkillStatMapping(skillName, skillDef));
    }
    skillBooks.push({ weaponType, skills: skillMappings });
  }

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    weaponBaseDamage,
    jobMappings,
    skillBooks,
  };
}

// ===== 実行 =====

function main() {
  console.log('Generating stat weight mapping...');

  const mapping = generateMapping();

  // 出力ディレクトリ作成
  const outputDir = path.join(__dirname, '..', 'public', 'data', 'mapping');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // JSON出力
  const outputPath = path.join(outputDir, 'statWeightMapping.json');
  fs.writeFileSync(outputPath, JSON.stringify(mapping, null, 2), 'utf-8');

  console.log(`Generated: ${outputPath}`);

  // 統計表示
  console.log('\n=== Statistics ===');
  console.log(`Weapon types: ${mapping.weaponBaseDamage.length}`);
  console.log(`Jobs: ${mapping.jobMappings.length}`);

  let totalSkills = 0;
  for (const job of mapping.jobMappings) {
    totalSkills += job.skills.length;
    totalSkills += Object.keys(job.basicAttack).length;  // 通常攻撃
  }
  for (const book of mapping.skillBooks) {
    totalSkills += book.skills.length;
  }
  console.log(`Total skills (including basic attacks): ${totalSkills}`);

  // サンプル表示
  console.log('\n=== Sample: StellaShaft シャイニングアロー ===');
  const stella = mapping.jobMappings.find(j => j.jobNameYaml === 'StellaShaft');
  if (stella) {
    const skill = stella.skills.find(s => s.skillName === 'シャイニングアロー');
    if (skill) {
      console.log('Weights:');
      for (const w of skill.weights) {
        console.log(`  ${w.stat}: coeff=${w.coefficient.toFixed(3)}, weight=${(w.normalizedWeight * 100).toFixed(1)}%`);
      }
    }
  }

  console.log('\n=== Sample: Wizard イグナイト・改 ===');
  const wizard = mapping.jobMappings.find(j => j.jobNameYaml === 'Wizard');
  if (wizard) {
    const skill = wizard.skills.find(s => s.skillName === 'イグナイト・改');
    if (skill) {
      console.log('Weights:');
      for (const w of skill.weights) {
        console.log(`  ${w.stat}: coeff=${w.coefficient.toFixed(3)}, weight=${(w.normalizedWeight * 100).toFixed(1)}%`);
      }
    }
  }
}

main();
