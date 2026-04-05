/**
 * V2重み計算のテストスクリプト
 */

import {
  calculateDynamicWeights,
  DEFAULT_STATS,
  DEFAULT_WEAPON_PARAMS,
  JOB_SKILL_MAPPING,
  calculateSpellRefactorBonus,
  calculateMarinaLaneSpeedValue,
  type WeightCalculationParams,
} from '../src/lib/calc/statWeightMappingV2';

// テスト用パラメータ
const testParams: WeightCalculationParams = {
  currentStats: DEFAULT_STATS,
  weaponAttackPower: DEFAULT_WEAPON_PARAMS.weaponAttackPower,
  weaponCritDamage: DEFAULT_WEAPON_PARAMS.weaponCritDamage,
  critRate: DEFAULT_WEAPON_PARAMS.critRate,
};

console.log('=== V2 ステータス重み計算テスト ===\n');
console.log('デフォルトステータス:', DEFAULT_STATS);
console.log('デフォルト武器パラメータ:', DEFAULT_WEAPON_PARAMS);
console.log('');

// テストケース1: シャイニングアロー（ステラシャフト）
console.log('--- シャイニングアロー (StellaShaft/Bow) ---');
const ssWeights = calculateDynamicWeights('シャイニングアロー', 'Bow', testParams);
ssWeights.forEach(w => {
  console.log(`  ${w.stat}: ${(w.normalizedWeight * 100).toFixed(1)}% (感度: ${w.sensitivity.toFixed(2)})`);
});
console.log('');

// テストケース2: イグナイト・改（ウィザード）
console.log('--- イグナイト・改 (Wizard/Wand) ---');
const wizWeights = calculateDynamicWeights('イグナイト・改', 'Wand', testParams);
wizWeights.forEach(w => {
  console.log(`  ${w.stat}: ${(w.normalizedWeight * 100).toFixed(1)}% (感度: ${w.sensitivity.toFixed(2)})`);
});
console.log('');

// テストケース3: 疾風連撃（ハンター）
console.log('--- 疾風連撃 (Hunter/Dagger) ---');
const hunterWeights = calculateDynamicWeights('疾風連撃', 'Dagger', testParams);
hunterWeights.forEach(w => {
  console.log(`  ${w.stat}: ${(w.normalizedWeight * 100).toFixed(1)}% (感度: ${w.sensitivity.toFixed(2)})`);
});
console.log('');

// テストケース4: 聖なる鉄槌（ナイト）
console.log('--- 聖なる鉄槌 (Knight/Sword) ---');
const knightWeights = calculateDynamicWeights('聖なる鉄槌', 'Sword', testParams);
knightWeights.forEach(w => {
  console.log(`  ${w.stat}: ${(w.normalizedWeight * 100).toFixed(1)}% (感度: ${w.sensitivity.toFixed(2)})`);
});
console.log('');

// テストケース5: 通常攻撃（大剣）
console.log('--- 通常攻撃 (Warrior/GreatSword) ---');
const warriorWeights = calculateDynamicWeights('通常攻撃', 'GreatSword', testParams);
warriorWeights.forEach(w => {
  console.log(`  ${w.stat}: ${(w.normalizedWeight * 100).toFixed(1)}% (感度: ${w.sensitivity.toFixed(2)})`);
});
console.log('');

// テストケース6: SpellRefactorボーナス計算
console.log('--- SpellRefactor ボーナス計算 ---');
const bonusSame = calculateSpellRefactorBonus(300, 300);
const bonusDiff = calculateSpellRefactorBonus(400, 200);
console.log(`  力=魔力=300: Bonus = ${bonusSame.toFixed(3)}`);
console.log(`  力=400, 魔力=200: Bonus = ${bonusDiff.toFixed(3)}`);
console.log('');

// テストケース7: マリーナ・レーン閾値
console.log('--- マリーナ・レーン Speed閾値 ---');
for (const speed of [40, 50, 99, 100, 150]) {
  const info = calculateMarinaLaneSpeedValue(speed);
  console.log(`  Speed=${speed}: ${info.currentHits}ヒット (次閾値: ${info.nextThreshold}, 残り: ${info.speedToNextHit})`);
}
console.log('');

// テストケース8: 職業スキルマッピング
console.log('--- 職業スキルマッピング ---');
for (const [job, mapping] of Object.entries(JOB_SKILL_MAPPING)) {
  console.log(`  ${job}: ${mapping.weapons.join('/')} - ${mapping.skills.slice(0, 3).join(', ')}...`);
}

console.log('\n=== テスト完了 ===');
