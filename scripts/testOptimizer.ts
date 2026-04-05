/**
 * Optimizer Test Script for SpellRefactor Sword Normal Attack
 * Target: 24,808 damage
 *
 * This script simulates the full optimizer calculation using actual game formulas
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CSV parser
function parseCSV<T>(csvText: string): T[] {
  const lines = csvText.trim().split('\n');
  if (lines.length === 0) return [];

  const firstLine = lines[0].replace(/^\uFEFF/, '');
  lines[0] = firstLine;

  const headers = lines[0].split(',').map(h => h.trim());
  const data: T[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row: any = {};

    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = values[j]?.trim() || '';

      if (value !== '' && !isNaN(Number(value))) {
        row[header] = Number(value);
      } else if (value === 'TRUE' || value === 'FALSE') {
        row[header] = value === 'TRUE';
      } else {
        row[header] = value;
      }
    }
    data.push(row as T);
  }
  return data;
}

// Load data files
const dataDir = path.join(__dirname, '../public/data');

function loadCSV<T>(relativePath: string): T[] {
  const fullPath = path.join(dataDir, relativePath);
  const content = fs.readFileSync(fullPath, 'utf-8');
  return parseCSV<T>(content);
}

function loadYAML<T>(relativePath: string): T {
  const fullPath = path.join(dataDir, relativePath);
  const content = fs.readFileSync(fullPath, 'utf-8');
  return yaml.load(content) as T;
}

// Utility functions
function roundUp(value: number): number {
  return Math.ceil(value);
}

function roundDown(value: number): number {
  return Math.floor(value);
}

function round(value: number): number {
  return Math.round(value);
}

// Load all required data
console.log('=== SpellRefactor Sword Normal Attack Optimization Test ===\n');
console.log('Target: 24,808 damage\n');
console.log('Loading data...');

const weapons = loadCSV<any>('csv/Equipment/DA_EqCalc_Data - 武器.csv');
const armors = loadCSV<any>('csv/Equipment/DA_EqCalc_Data - 防具.csv');
const accessories = loadCSV<any>('csv/Equipment/DA_EqCalc_Data - アクセサリー .csv');
const emblems = loadCSV<any>('csv/Equipment/DA_EqCalc_Data - 紋章.csv');
const runestones = loadCSV<any>('csv/Equipment/DA_EqCalc_Data - ルーンストーン.csv');
const spellRefactorSP = loadCSV<any>('csv/Job/スペルリファクター.csv');

const eqConst = loadYAML<any>('formula/EqConst.yaml');
const jobConst = loadYAML<any>('formula/JobConst.yaml');
const weaponCalc = loadYAML<any>('formula/WeaponCalc.yaml');

console.log(`Loaded: ${weapons.length} weapons, ${armors.length} armors, ${accessories.length} accessories`);

// Filter swords
const swords = weapons.filter((w: any) => w['武器種'] === '剣');
console.log(`Sword weapons: ${swords.length}`);

/**
 * Calculate weapon stats at SSS rank with full reinforcement and smithing
 */
function calculateWeaponStats(weapon: any, eqConst: any) {
  const rank = 'SSS';
  const reinforcementLevel = 80; // 武器強化は最大+80
  const smithingCount = 12; // Max smithing for attack power

  const baseAttackP = weapon['攻撃力（初期値）'] || 0;
  const baseCritR = weapon['会心率（初期値）'] || 0;
  const baseCritD = weapon['会心ダメージ（初期値）'] || 0;
  const damageCorrection = weapon['ダメージ補正（初期値）'] || 80;
  const coolTime = weapon['ct(初期値)'] || 1;
  const availableLv = weapon['使用可能Lv'] || 1;

  const rankData = eqConst.Weapon.Rank[rank];
  const rankBonus = rankData.Bonus || {};
  const alchemyBonus = rankData.Alchemy || {};
  const denominator = eqConst.Weapon.Reinforcement?.Denominator || 320;

  // Attack Power = ROUNDUP(Initial + Lv * (RankBonus / 320)) + Alchemy + Reinforcement * 2 + Smithing * 1
  const attackPowerBase = roundUp(baseAttackP + availableLv * ((rankBonus.AttackP || 0) / denominator));
  const attackPower = attackPowerBase +
    (alchemyBonus.AttackP || 0) +
    (eqConst.Weapon.Reinforcement?.AttackP || 2) * reinforcementLevel +
    (eqConst.Weapon.Forge?.Other || 1) * smithingCount;

  // Crit Rate = Initial + RankBonus + Alchemy
  const critRate = baseCritR +
    (rankBonus.CritR || 0) +
    (alchemyBonus.CritR || 0);

  // Crit Damage = Initial + RankBonus + Alchemy
  const critDamage = baseCritD +
    (rankBonus.CritD || 0) +
    (alchemyBonus.CritD || 0);

  return {
    name: weapon['アイテム名'],
    level: availableLv,
    attackPower,
    critRate,
    critDamage,
    damageCorrection,
    coolTime: coolTime + (rankBonus.CoolT || 0),
  };
}

/**
 * Calculate armor stats at SSS rank with full reinforcement and smithing
 * Using actual formula: round(baseWithTataki * (1 + baseWithTataki^0.2 * (rankValue / availableLv))) + enhanceBonus
 */
function calculateArmorStats(armor: any, eqConst: any, smithingDistribution: Record<string, number> = {}) {
  const rank = 'SSS';
  const reinforcementCount = 40; // +40

  const stats: Record<string, number> = {};
  const statDefs = [
    { csvKey: '守備力（初期値）', outputKey: 'Defense', smithingParam: 'defense', isDefense: true },
    { csvKey: '体力（初期値）', outputKey: 'HP', smithingParam: 'hp' },
    { csvKey: '力（初期値）', outputKey: 'Power', smithingParam: 'power' },
    { csvKey: '魔力（初期値）', outputKey: 'Magic', smithingParam: 'magic' },
    { csvKey: '精神（初期値）', outputKey: 'Mind', smithingParam: 'mind' },
    { csvKey: '素早さ（初期値）', outputKey: 'Agility', smithingParam: 'speed' },
    { csvKey: '器用（初期値）', outputKey: 'Dex', smithingParam: 'dexterity' },
    { csvKey: '撃力（初期値）', outputKey: 'CritDamage', smithingParam: 'critDamage' },
  ];

  const rankValue = eqConst.Armor?.Rank?.[rank] || 8;
  const availableLv = armor['使用可能Lv'] || 1;

  const forgeDefence = eqConst.Armor?.Forge?.Defence ?? 1;
  const forgeOther = eqConst.Armor?.Forge?.Other ?? 2;
  const reinforceDefence = eqConst.Armor?.Reinforcement?.Defence ?? 2;
  const reinforceOther = eqConst.Armor?.Reinforcement?.Other ?? 2;

  for (const statDef of statDefs) {
    const baseValue = armor[statDef.csvKey] || 0;
    if (baseValue === 0) continue;

    const paramSmithingCount = smithingDistribution[statDef.smithingParam] || 0;
    const forgeMultiplier = statDef.isDefense ? forgeDefence : forgeOther;
    const smithingBonus = paramSmithingCount * forgeMultiplier;

    const reinforceMultiplier = statDef.isDefense ? reinforceDefence : reinforceOther;
    const enhanceBonus = reinforcementCount * reinforceMultiplier;

    // Actual formula: round(baseWithTataki * (1 + baseWithTataki^0.2 * (rankValue / availableLv))) + enhanceBonus
    const baseWithTataki = baseValue + smithingBonus;
    const calculatedValue = round(
      baseWithTataki * (1 + Math.pow(baseWithTataki, 0.2) * (rankValue / availableLv))
    );

    const finalValue = calculatedValue + enhanceBonus;
    stats[statDef.outputKey] = finalValue;
  }

  return {
    name: armor['アイテム名(種類でOK)'],
    part: armor['部位を選択'],
    type: armor['タイプを選択'],
    level: armor['使用可能Lv'],
    stats,
  };
}

/**
 * Calculate armor EX stats (エクステンション)
 * Correct formula from equipmentCalculator.ts:
 * EX = round(Lv × ランクEX係数 + 1)
 *
 * Coefficients from EqConst.yaml:
 * - Dex: CritR coefficient (SSS = 0.15)
 * - CritDamage/Speed: Speed_CritD coefficient (SSS = 0.6)
 * - Others (HP, Power, Magic, Mind, Defense): Other coefficient (SSS = 0.7)
 */
function calculateArmorEX(armor: any, rank: string, exType: string, eqConst: any): number {
  const level = armor['使用可能Lv'] || 1;
  if (level <= 0) return 1;

  // Get coefficient from EqConst
  let coeff: number;
  const exRankCoeffs = eqConst.Equipment_EX?.Rank;

  if (exType === 'Dex') {
    coeff = exRankCoeffs?.CritR?.[rank] ?? 0.15;
  } else if (exType === 'CritDamage' || exType === 'Agility' || exType === 'Speed') {
    coeff = exRankCoeffs?.Speed_CritD?.[rank] ?? 0.6;
  } else {
    // HP, Power, Magic, Mind, Defense
    coeff = exRankCoeffs?.Other?.[rank] ?? 0.7;
  }

  // EX value = round(Lv × coefficient + 1)
  return round(level * coeff + 1);
}

/**
 * Calculate accessory stats at SSS rank (including EX stats!)
 */
function calculateAccessoryStats(accessory: any, eqConst: any) {
  const rank = 'SSS';
  const level = accessory['使用可能Lv'] || 1;

  const stats: Record<string, number> = {};
  const statKeys = ['力（初期値）', '魔力（初期値）', '体力（初期値）', '精神（初期値）',
                    '素早さ（初期値）', '器用（初期値）', '撃力（初期値）', '守備力（初期値）'];
  const internalKeys = ['Power', 'Magic', 'HP', 'Mind', 'Agility', 'Dex', 'CritDamage', 'Defense'];

  const rankValue = eqConst.Accessory?.Rank?.[rank] || 55;
  const divisor = eqConst.Accessory?.ScalingDivisor || 550;

  statKeys.forEach((key, idx) => {
    const baseValue = accessory[key] || 0;
    if (baseValue > 0) {
      const internalKey = internalKeys[idx];
      // Accessory formula: floor(base * (1 + level * rankValue / divisor))
      const scalingFactor = 1 + level * rankValue / divisor;
      stats[internalKey] = roundDown(baseValue * scalingFactor);
    }
  });

  // Accessories also have 2 EX slots (like armor)!
  // EX formula: round(Lv × coefficient + 1)
  // Using Power and Magic EX for SpellRefactor
  const exCoeff = eqConst.Equipment_EX?.Rank?.Other?.[rank] ?? 0.7;
  const ex1Value = round(level * exCoeff + 1); // Power EX
  const ex2Value = round(level * exCoeff + 1); // Magic EX

  stats.Power = (stats.Power || 0) + ex1Value;
  stats.Magic = (stats.Magic || 0) + ex2Value;

  return {
    name: accessory['アイテム名'] || accessory['アイテム名(種類でOK)'] || 'Unknown',
    type: accessory['タイプを選択'] || '',
    level,
    stats,
    ex1: ex1Value,
    ex2: ex2Value,
  };
}

/**
 * Calculate SP bonuses for SpellRefactor at given allocation
 */
function calculateSPBonus(spAllocation: { A: number; B: number; C: number }): Record<string, number> {
  const bonus: Record<string, number> = {
    HP: 0, Power: 0, Magic: 0, Mind: 0, Agility: 0, Dex: 0, CritDamage: 0, Defense: 0
  };

  const jpToInternal: Record<string, string> = {
    '体力': 'HP', '力': 'Power', '魔力': 'Magic', '精神': 'Mind',
    '素早さ': 'Agility', '器用さ': 'Dex', '撃力': 'CritDamage', '守備力': 'Defense'
  };

  for (const row of spellRefactorSP) {
    const stage = row['解法段階'];
    if (!stage || !stage.match(/^[A-C]-\d+$/)) continue;

    const [branch, tierStr] = stage.split('-');
    const requiredSP = Number(row['必要SP']) || 0;
    const allocatedSP = spAllocation[branch as 'A' | 'B' | 'C'] || 0;

    if (requiredSP <= allocatedSP) {
      // Add bonuses from this tier
      for (const [jpKey, internalKey] of Object.entries(jpToInternal)) {
        const value = Number(row[jpKey]) || 0;
        if (value) {
          bonus[internalKey] += value;
        }
      }
    }
  }

  return bonus;
}

/**
 * Get initial stats and job correction from SpellRefactor SP data
 */
function getJobInitialAndCorrection() {
  let initialStats: Record<string, number> = {};
  let jobCorrection: Record<string, number> = {};

  const jpToInternal: Record<string, string> = {
    '体力': 'HP', '力': 'Power', '魔力': 'Magic', '精神': 'Mind',
    '素早さ': 'Agility', '器用さ': 'Dex', '撃力': 'CritDamage', '守備力': 'Defense'
  };

  for (const row of spellRefactorSP) {
    const stage = row['解法段階'];
    if (stage === '初期値') {
      for (const [jpKey, internalKey] of Object.entries(jpToInternal)) {
        initialStats[internalKey] = Number(row[jpKey]) || 0;
      }
    } else if (stage === '職業補正(%)') {
      for (const [jpKey, internalKey] of Object.entries(jpToInternal)) {
        jobCorrection[internalKey] = Number(row[jpKey]) || 0;
      }
    }
  }

  return { initialStats, jobCorrection };
}

/**
 * Calculate SpellRefactor bonus
 * Formula: 1.75 - round(0.475 * ln(max/min), 2) * 2
 * When Power == Magic, bonus = 1.75
 */
function calculateSpellRefactorBonus(power: number, magic: number): number {
  if (power <= 0 || magic <= 0) return 1.0;
  const maxStat = Math.max(power, magic);
  const minStat = Math.min(power, magic);
  if (minStat === maxStat) return 1.75;

  const ratio = maxStat / minStat;
  const lnRatio = Math.log(ratio);
  const penalty = Math.round(0.475 * lnRatio * 100) / 100 * 2;
  return Math.max(1.0, 1.75 - penalty);
}

/**
 * Calculate damage using the sword formula
 */
function calculateSwordDamage(
  weaponAttackPower: number,
  userPower: number,
  userMagic: number,
  damageCorrection: number,
  weaponCritRate: number,
  weaponCritDamage: number,
  userCritDamage: number,
  userDex: number,
  options: { critMode: 'expected' | 'always' | 'never'; damageCorrectionMode: 'min' | 'max' | 'avg' }
): number {
  // Damage correction calculation
  const damageCorrectionMin = damageCorrection;
  const damageCorrectionMax = 100;
  let actualDamageCorrection: number;

  if (options.damageCorrectionMode === 'min') {
    actualDamageCorrection = damageCorrectionMin / 100;
  } else if (options.damageCorrectionMode === 'max') {
    actualDamageCorrection = damageCorrectionMax / 100;
  } else {
    actualDamageCorrection = (damageCorrectionMin + damageCorrectionMax) / 2 / 100;
  }

  // Calculate actual crit rate including Dex
  const dexCritRate = userDex * 0.3;
  const actualCritRate = Math.min(100, weaponCritRate + dexCritRate);

  // Crit multiplier = 1 + (WeaponCritDamage / 100) + (UserCritDamage * 0.005)
  const critDamageMultiplier = 1 + (weaponCritDamage / 100) + (userCritDamage * 0.005);

  // Base damage = (WeaponATK + Power * 1.6) * DamageCorrection
  const baseDamage = (weaponAttackPower + userPower * 1.6) * actualDamageCorrection;

  // SpellRefactor bonus
  const spellBonus = calculateSpellRefactorBonus(userPower, userMagic);

  // Apply crit based on mode
  let finalDamage: number;

  if (options.critMode === 'always') {
    finalDamage = baseDamage * critDamageMultiplier * spellBonus;
  } else if (options.critMode === 'never') {
    finalDamage = baseDamage * spellBonus;
  } else {
    // Expected value: baseDamage * (nonCritPortion + critPortion)
    // = baseDamage * ((1 - critRate/100) * 1 + (critRate/100) * critMultiplier)
    // = baseDamage * (1 + (critRate/100) * (critMultiplier - 1))
    const expectedCritMultiplier = 1 + (actualCritRate / 100) * (critDamageMultiplier - 1);
    finalDamage = baseDamage * expectedCritMultiplier * spellBonus;
  }

  return Math.floor(finalDamage);
}

// ===== Main Simulation =====

console.log('\n=== Full Simulation with Actual Formulas ===\n');

// Job configuration
const jobLevel = 180;
const totalSP = jobLevel * 2; // 360 SP

// Get initial stats and job correction
const { initialStats, jobCorrection } = getJobInitialAndCorrection();

console.log('SpellRefactor Initial Stats:', initialStats);
console.log('SpellRefactor Job Correction (%):', jobCorrection);

// Calculate job base stats at level 180
// Formula: initial + (level * multiplier) - multiplier
// HP/Mind: level * 1 - 1, Power/Magic: level * 2 - 2
const jobBaseStats: Record<string, number> = {
  HP: (initialStats.HP || 0) + (jobLevel * 1) - 1,
  Power: (initialStats.Power || 0) + (jobLevel * 2) - 2,
  Magic: (initialStats.Magic || 0) + (jobLevel * 2) - 2,
  Mind: (initialStats.Mind || 0) + (jobLevel * 1) - 1,
  Agility: initialStats.Agility || 0,
  Dex: initialStats.Dex || 0,
  CritDamage: initialStats.CritDamage || 0,
  Defense: initialStats.Defense || 0,
};

console.log(`\nJob Base Stats at Level ${jobLevel}:`, jobBaseStats);
console.log(`Total SP available: ${totalSP}`);

// SP allocation: A:180 + C:180 provides highest damage
// A軸: 魔力+275, 力+225, 撃力+201 at full
// C軸: 撃力/器用重視
const spAllocation = { A: 180, B: 0, C: 180 };
const spBonus = calculateSPBonus(spAllocation);
console.log(`\nSP Allocation (A:${spAllocation.A}, B:${spAllocation.B}, C:${spAllocation.C}):`);
console.log('SP Bonuses:', spBonus);

// Calculate best weapon
const swordStats = swords
  .filter((w: any) => w['使用可能Lv'] <= jobLevel)
  .map((w: any) => calculateWeaponStats(w, eqConst))
  .sort((a, b) => b.attackPower - a.attackPower);

const bestWeapon = swordStats[0];
console.log(`\nBest Weapon: ${bestWeapon.name}`);
console.log(`  ATK: ${bestWeapon.attackPower}, CritR: ${bestWeapon.critRate}, CritD: ${bestWeapon.critDamage}, DmgCorr: ${bestWeapon.damageCorrection}%`);

// Calculate best armors - Compare ALL armor types (革, 布, 金属)
// Smithing distribution: max 12 smithing per armor piece
const smithingForPowerMagic = { power: 6, magic: 6 }; // Balanced

function processArmors(armorList: any[], part: string) {
  return armorList
    .filter((a: any) => a['部位を選択'] === part && (a['使用可能Lv'] || 0) <= jobLevel)
    .map(a => {
      const baseStats = calculateArmorStats(a, eqConst, smithingForPowerMagic);
      // Add EX stats (Power + Magic)
      const ex1 = calculateArmorEX(a, 'SSS', 'Power', eqConst);
      const ex2 = calculateArmorEX(a, 'SSS', 'Magic', eqConst);
      baseStats.stats.Power = (baseStats.stats.Power || 0) + ex1;
      baseStats.stats.Magic = (baseStats.stats.Magic || 0) + ex2;
      return { ...baseStats, ex1, ex2 };
    })
    .sort((a, b) => {
      const aTotal = (a.stats.Power || 0) + (a.stats.Magic || 0);
      const bTotal = (b.stats.Power || 0) + (b.stats.Magic || 0);
      return bTotal - aTotal;
    });
}

// Process all armor types
const headArmors = processArmors(armors, '頭');
const bodyArmors = processArmors(armors, '胴');
const legArmors = processArmors(armors, '脚');

// Show top 3 armors for each part with their type
console.log(`\nTop 3 Head Armors (all types):`);
headArmors.slice(0, 3).forEach((a, i) => {
  console.log(`  ${i+1}. ${a.name} (${a.type}, Lv${a.level}) - P:${a.stats.Power}, M:${a.stats.Magic}, Total:${(a.stats.Power||0)+(a.stats.Magic||0)}`);
});
console.log(`\nTop 3 Body Armors (all types):`);
bodyArmors.slice(0, 3).forEach((a, i) => {
  console.log(`  ${i+1}. ${a.name} (${a.type}, Lv${a.level}) - P:${a.stats.Power}, M:${a.stats.Magic}, Total:${(a.stats.Power||0)+(a.stats.Magic||0)}`);
});
console.log(`\nTop 3 Leg Armors (all types):`);
legArmors.slice(0, 3).forEach((a, i) => {
  console.log(`  ${i+1}. ${a.name} (${a.type}, Lv${a.level}) - P:${a.stats.Power}, M:${a.stats.Magic}, CritD:${a.stats.CritDamage||0}, Total:${(a.stats.Power||0)+(a.stats.Magic||0)}`);
});

const bestHead = headArmors[0];
const bestBody = bodyArmors[0];
const bestLeg = legArmors[0];

console.log(`\nBest Armors Selected (with EX and smithing):`);
console.log(`  Head: ${bestHead?.name} (Lv${bestHead?.level}) - Power:${bestHead?.stats.Power}, Magic:${bestHead?.stats.Magic}, EX1:${bestHead?.ex1}, EX2:${bestHead?.ex2}`);
console.log(`  Body: ${bestBody?.name} (Lv${bestBody?.level}) - Power:${bestBody?.stats.Power}, Magic:${bestBody?.stats.Magic}, EX1:${bestBody?.ex1}, EX2:${bestBody?.ex2}`);
console.log(`  Leg: ${bestLeg?.name} (Lv${bestLeg?.level}) - Power:${bestLeg?.stats.Power}, Magic:${bestLeg?.stats.Magic}, CritD:${bestLeg?.stats.CritDamage}, EX1:${bestLeg?.ex1}, EX2:${bestLeg?.ex2}`);

// Calculate accessories (2 slots)
const accessoryStats = accessories
  .filter((a: any) => (a['使用可能Lv'] || 0) <= jobLevel)
  .map(a => calculateAccessoryStats(a, eqConst))
  .sort((a, b) => {
    const aTotal = (a.stats.Power || 0) + (a.stats.Magic || 0);
    const bTotal = (b.stats.Power || 0) + (b.stats.Magic || 0);
    return bTotal - aTotal;
  });

const bestAccessory1 = accessoryStats[0];
const bestAccessory2 = accessoryStats[1] || accessoryStats[0];

console.log(`\nBest Accessories (with EX):`);
console.log(`  Acc1: ${bestAccessory1?.name} (Lv${bestAccessory1?.level}) - P:${bestAccessory1?.stats.Power}, M:${bestAccessory1?.stats.Magic}, EX1:${bestAccessory1?.ex1}, EX2:${bestAccessory1?.ex2}`);
console.log(`  Acc2: ${bestAccessory2?.name} (Lv${bestAccessory2?.level}) - P:${bestAccessory2?.stats.Power}, M:${bestAccessory2?.stats.Magic}, EX1:${bestAccessory2?.ex1}, EX2:${bestAccessory2?.ex2}`);

// Find best runestones for Power/Magic/CritDamage
// Note: CSV header is 'アイテム名（・<グレード>）は不要'
const runeStats = runestones.map(r => {
  const stats: Record<string, number> = {};
  const keys = ['力', '魔力', '撃力', '器用', '体力', '精神', '素早さ'];
  const internalKeys = ['Power', 'Magic', 'CritDamage', 'Dex', 'HP', 'Mind', 'Agility'];
  keys.forEach((k, i) => {
    const val = Number(r[k]) || 0;
    if (val !== 0) stats[internalKeys[i]] = val; // Include negative values too
  });
  return { name: r['アイテム名（・<グレード>）は不要'] || 'Unknown', grade: r['グレード'], stats };
}).filter(r => Object.keys(r.stats).length > 0);

// Best runestone for each stat (HIGHEST value, not just first)
const powerRune = runeStats
  .filter(r => (r.stats.Power || 0) > 0)
  .sort((a, b) => (b.stats.Power || 0) - (a.stats.Power || 0))[0] || { name: 'None', stats: {} };
const magicRune = runeStats
  .filter(r => (r.stats.Magic || 0) > 0)
  .sort((a, b) => (b.stats.Magic || 0) - (a.stats.Magic || 0))[0] || { name: 'None', stats: {} };
const critDamageRune = runeStats
  .filter(r => (r.stats.CritDamage || 0) > 0)
  .sort((a, b) => (b.stats.CritDamage || 0) - (a.stats.CritDamage || 0))[0] || { name: 'None', stats: {} };
// Best combined P+M runestone (for balanced builds)
const balancedRune = runeStats
  .filter(r => (r.stats.Power || 0) > 0 && (r.stats.Magic || 0) > 0)
  .sort((a, b) => ((b.stats.Power || 0) + (b.stats.Magic || 0)) - ((a.stats.Power || 0) + (a.stats.Magic || 0)))[0] || { name: 'None', stats: {} };

console.log(`\nTop Runestones:`);
console.log(`  Best Power: ${powerRune.name} - P:${powerRune.stats?.Power || 0}`);
console.log(`  Best Magic: ${magicRune.name} - M:${magicRune.stats?.Magic || 0}`);
console.log(`  Best CritD: ${critDamageRune.name} - CritD:${critDamageRune.stats?.CritDamage || 0}`);
console.log(`  Best P+M Combined: ${balancedRune.name} - P:${balancedRune.stats?.Power || 0}, M:${balancedRune.stats?.Magic || 0}`);

// Calculate total equipment stats
const equipmentTotal: Record<string, number> = {
  Power: (bestHead?.stats.Power || 0) + (bestBody?.stats.Power || 0) + (bestLeg?.stats.Power || 0) +
         (bestAccessory1?.stats.Power || 0) + (bestAccessory2?.stats.Power || 0),
  Magic: (bestHead?.stats.Magic || 0) + (bestBody?.stats.Magic || 0) + (bestLeg?.stats.Magic || 0) +
         (bestAccessory1?.stats.Magic || 0) + (bestAccessory2?.stats.Magic || 0),
  HP: (bestHead?.stats.HP || 0) + (bestBody?.stats.HP || 0) + (bestLeg?.stats.HP || 0),
  Mind: (bestHead?.stats.Mind || 0) + (bestBody?.stats.Mind || 0) + (bestLeg?.stats.Mind || 0),
  Agility: (bestHead?.stats.Agility || 0) + (bestBody?.stats.Agility || 0) + (bestLeg?.stats.Agility || 0),
  Dex: (bestHead?.stats.Dex || 0) + (bestBody?.stats.Dex || 0) + (bestLeg?.stats.Dex || 0),
  CritDamage: (bestHead?.stats.CritDamage || 0) + (bestBody?.stats.CritDamage || 0) + (bestLeg?.stats.CritDamage || 0),
  Defense: (bestHead?.stats.Defense || 0) + (bestBody?.stats.Defense || 0) + (bestLeg?.stats.Defense || 0),
};

// Each grade allows one runestone (max 4 total: ノーマル, グレート, バスター, レプリカ)
// Find best runestone for each grade
const runesByGrade: Record<string, any[]> = {
  'ノーマル': runeStats.filter(r => r.grade === 'ノーマル'),
  'グレート': runeStats.filter(r => r.grade === 'グレート'),
  'バスター': runeStats.filter(r => r.grade === 'バスター'),
  'レプリカ': runeStats.filter(r => r.grade === 'レプリカ'),
};

// Select best rune per grade for Power+Magic
const bestRunePerGrade: Record<string, any> = {};
for (const [grade, runes] of Object.entries(runesByGrade)) {
  const sorted = runes
    .filter(r => (r.stats.Power || 0) + (r.stats.Magic || 0) > 0 || (r.stats.Power || 0) > 0)
    .sort((a, b) => {
      // Prioritize Power, then consider P+M total
      const aScore = (a.stats.Power || 0) * 1.5 + (a.stats.Magic || 0);
      const bScore = (b.stats.Power || 0) * 1.5 + (b.stats.Magic || 0);
      return bScore - aScore;
    });
  bestRunePerGrade[grade] = sorted[0] || null;
}

console.log(`\nBest Runestones by Grade (max 4):`);
let totalRuneP = 0, totalRuneM = 0, totalRuneCritD = 0, totalRuneDex = 0;
for (const [grade, rune] of Object.entries(bestRunePerGrade)) {
  if (rune) {
    const p = rune.stats.Power || 0;
    const m = rune.stats.Magic || 0;
    const cd = rune.stats.CritDamage || 0;
    const d = rune.stats.Dex || 0;
    console.log(`  ${grade}: ${rune.name} - P:${p}, M:${m}, CritD:${cd}, Dex:${d}`);
    totalRuneP += p;
    totalRuneM += m;
    totalRuneCritD += cd;
    totalRuneDex += d;
  } else {
    console.log(`  ${grade}: None`);
  }
}
console.log(`  Total: P+${totalRuneP}, M+${totalRuneM}, CritD+${totalRuneCritD}, Dex+${totalRuneDex}`);

const runestoneTotal: Record<string, number> = {
  Power: totalRuneP,
  Magic: totalRuneM,
  CritDamage: totalRuneCritD,
  Dex: totalRuneDex,
};

console.log(`\nEquipment Total (without runestones):`, equipmentTotal);
console.log(`Runestone Total:`, runestoneTotal);

// Best emblem for maximum damage
// ガイア gives +11% Power, which may provide more damage despite P:M imbalance
// Test both and compare
const emblemOptions = [
  { name: 'ガイア', bonusStats: { Power: 11, Magic: 0, HP: -5, CritDamage: 0 } },
  { name: 'ラーゾ', bonusStats: { Power: 5, Magic: 5, HP: 0, CritDamage: 0 } },
];
const emblemBonusStats = emblemOptions[0].bonusStats; // Use ガイア for max damage
console.log(`\nEmblem: ${emblemOptions[0].name}`);
console.log(`Emblem Bonus (%):`, emblemBonusStats);

// Best food for damage (極上霜降りステーキ: 力+40)
const foodBonus: Record<string, number> = {
  Power: 40,
  Magic: 0,
  HP: 20,
  Mind: 10,
  Agility: -15,
};
console.log(`Food Bonus:`, foodBonus);

// Calculate base stats (before % bonus)
const baseStats: Record<string, number> = {};
const statKeys = ['HP', 'Power', 'Magic', 'Mind', 'Agility', 'Dex', 'CritDamage', 'Defense'];
for (const key of statKeys) {
  baseStats[key] = (equipmentTotal[key] || 0) + (jobBaseStats[key] || 0) + (spBonus[key] || 0) + (runestoneTotal[key] || 0) + (foodBonus[key] || 0);
}

console.log(`\nBase Stats (before % bonus):`, baseStats);

// Apply % bonus
const finalStats: Record<string, number> = {};
for (const key of statKeys) {
  const base = baseStats[key] || 0;
  const jobBonusPercent = jobCorrection[key] || 0;
  const emblemBonusPercent = emblemBonusStats[key] || 0;
  const multiplier = 1 + (jobBonusPercent + emblemBonusPercent) / 100;
  finalStats[key] = round(base * multiplier);
}

console.log(`Final Stats (after % bonus):`, finalStats);

// Calculate SpellRefactor bonus
const spellBonus = calculateSpellRefactorBonus(finalStats.Power, finalStats.Magic);
console.log(`\nSpellRefactor Bonus: ${spellBonus.toFixed(4)} (P:${finalStats.Power}, M:${finalStats.Magic})`);

// Calculate damage
const damage = calculateSwordDamage(
  bestWeapon.attackPower,
  finalStats.Power,
  finalStats.Magic,
  bestWeapon.damageCorrection,
  bestWeapon.critRate,
  bestWeapon.critDamage,
  finalStats.CritDamage,
  finalStats.Dex,
  { critMode: 'expected', damageCorrectionMode: 'avg' }
);

console.log(`\n=== Damage Calculation ===`);
console.log(`Weapon ATK: ${bestWeapon.attackPower}`);
console.log(`User Power: ${finalStats.Power}`);
console.log(`Power scaling: ${finalStats.Power} * 1.6 = ${finalStats.Power * 1.6}`);
console.log(`Base damage component: ${bestWeapon.attackPower} + ${finalStats.Power * 1.6} = ${bestWeapon.attackPower + finalStats.Power * 1.6}`);

const avgDmgCorr = (bestWeapon.damageCorrection + 100) / 200;
console.log(`Avg damage correction: (${bestWeapon.damageCorrection} + 100) / 200 = ${avgDmgCorr}`);

const baseDamage = (bestWeapon.attackPower + finalStats.Power * 1.6) * avgDmgCorr;
console.log(`Base damage (before crit/spell): ${baseDamage.toFixed(2)}`);

const dexCritRate = finalStats.Dex * 0.3;
const actualCritRate = Math.min(100, bestWeapon.critRate + dexCritRate);
console.log(`Crit rate: ${bestWeapon.critRate} + ${finalStats.Dex} * 0.3 = ${actualCritRate.toFixed(2)}%`);

const critMultiplier = 1 + (bestWeapon.critDamage / 100) + (finalStats.CritDamage * 0.005);
console.log(`Crit multiplier: 1 + ${bestWeapon.critDamage}/100 + ${finalStats.CritDamage}*0.005 = ${critMultiplier.toFixed(4)}`);

const expectedCritMultiplier = 1 + (actualCritRate / 100) * (critMultiplier - 1);
console.log(`Expected crit multiplier: 1 + ${actualCritRate}/100 * (${critMultiplier.toFixed(4)} - 1) = ${expectedCritMultiplier.toFixed(4)}`);

console.log(`SpellRefactor bonus: ${spellBonus.toFixed(4)}`);

const finalDamage = baseDamage * expectedCritMultiplier * spellBonus;
console.log(`Final damage: ${baseDamage.toFixed(2)} * ${expectedCritMultiplier.toFixed(4)} * ${spellBonus.toFixed(4)} = ${finalDamage.toFixed(2)}`);

console.log(`\n=== Result Comparison ===`);
console.log(`Target: 24,808`);
console.log(`Calculated: ${damage}`);
console.log(`Difference: ${24808 - damage}`);

// Calculate what's needed to reach target
console.log(`\n=== Reverse Engineering for 24,808 ===`);

// With current crit/spell bonuses, what Power is needed?
const targetDamage = 24808;
// targetDamage = (weaponATK + Power * 1.6) * avgDmgCorr * expectedCritMultiplier * spellBonus
// Power = (targetDamage / (avgDmgCorr * expectedCritMultiplier * spellBonus) - weaponATK) / 1.6

const divisor = avgDmgCorr * expectedCritMultiplier * spellBonus;
const requiredPower = (targetDamage / divisor - bestWeapon.attackPower) / 1.6;

console.log(`To achieve 24,808 damage with current setup:`);
console.log(`  Required Power: ${requiredPower.toFixed(0)}`);
console.log(`  Current Power: ${finalStats.Power}`);
console.log(`  Power gap: ${(requiredPower - finalStats.Power).toFixed(0)}`);

// Max crit scenario
const maxCritDamage = calculateSwordDamage(
  bestWeapon.attackPower,
  finalStats.Power,
  finalStats.Magic,
  bestWeapon.damageCorrection,
  bestWeapon.critRate,
  bestWeapon.critDamage,
  finalStats.CritDamage,
  finalStats.Dex,
  { critMode: 'always', damageCorrectionMode: 'max' }
);

console.log(`\n=== Maximum Damage (Always Crit, Max Correction) ===`);
console.log(`Max Damage: ${maxCritDamage}`);

// ===== Configuration Comparison =====
console.log(`\n${'='.repeat(60)}`);
console.log(`=== Configuration Comparison ===`);
console.log(`${'='.repeat(60)}`);

// Test different configurations
interface TestConfig {
  name: string;
  emblem: { name: string; power: number; magic: number };
  runestone: { name: string; power: number; magic: number };
  food: { power: number; magic: number };
}

const configs: TestConfig[] = [
  { name: 'Max Power Focus', emblem: { name: 'ガイア', power: 11, magic: 0 }, runestone: { name: '灼熱のダルフガゼル', power: 40, magic: 0 }, food: { power: 40, magic: 0 } },
  { name: 'Balanced Emblem', emblem: { name: 'ラーゾ', power: 5, magic: 5 }, runestone: { name: '灼熱のダルフガゼル', power: 40, magic: 0 }, food: { power: 40, magic: 0 } },
  { name: 'Balanced Runestone', emblem: { name: 'ガイア', power: 11, magic: 0 }, runestone: { name: '侵食された世界樹の根', power: 20, magic: 20 }, food: { power: 40, magic: 0 } },
  { name: 'Full Balance', emblem: { name: 'ラーゾ', power: 5, magic: 5 }, runestone: { name: '侵食された世界樹の根', power: 20, magic: 20 }, food: { power: 40, magic: 0 } },
];

for (const config of configs) {
  // Recalculate with this config
  const testRunestoneTotal = { Power: config.runestone.power, Magic: config.runestone.magic };
  const testFoodBonus = { Power: config.food.power, Magic: config.food.magic };
  const testEmblemBonus = { Power: config.emblem.power, Magic: config.emblem.magic };

  const testBaseStats: Record<string, number> = {};
  for (const key of statKeys) {
    testBaseStats[key] = (equipmentTotal[key] || 0) + (jobBaseStats[key] || 0) + (spBonus[key] || 0);
  }
  testBaseStats.Power += testRunestoneTotal.Power + testFoodBonus.Power;
  testBaseStats.Magic += testRunestoneTotal.Magic + testFoodBonus.Magic;

  // Apply % bonus
  const testPower = round(testBaseStats.Power * (1 + (jobCorrection.Power + testEmblemBonus.Power) / 100));
  const testMagic = round(testBaseStats.Magic * (1 + (jobCorrection.Magic + testEmblemBonus.Magic) / 100));
  const testCritD = round(testBaseStats.CritDamage * (1 + jobCorrection.CritDamage / 100));

  const testSpellBonus = calculateSpellRefactorBonus(testPower, testMagic);
  const testCritMultiplier = 1 + (bestWeapon.critDamage / 100) + (testCritD * 0.005);
  const testBaseDamage = (bestWeapon.attackPower + testPower * 1.6) * 1.0; // max correction
  const testMaxDamage = Math.floor(testBaseDamage * testCritMultiplier * testSpellBonus);

  console.log(`\n${config.name}:`);
  console.log(`  Emblem: ${config.emblem.name}, Rune: ${config.runestone.name}`);
  console.log(`  P:${testPower}, M:${testMagic}, Ratio:${(testPower/testMagic).toFixed(3)}`);
  console.log(`  SpellBonus: ${testSpellBonus.toFixed(4)}, CritMult: ${testCritMultiplier.toFixed(4)}`);
  console.log(`  Max Damage: ${testMaxDamage}`);
}
