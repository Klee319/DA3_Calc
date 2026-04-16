/**
 * Warrior-GreatSword ダメージ計算の直接トレース
 * 最適化で得たステータスをそのまま calculateDamage に渡して
 * finalDamage/baseDamage がどう出るか見る。
 */
import { loadFullGameData } from '../helpers/loadGameData';
import { calculateDamage } from '@/lib/calc/damageCalculator';

jest.setTimeout(60_000);

test('GreatSword 直接damage計算', async () => {
  const game = await loadFullGameData();

  const finalStats = {
    HP: 480, Power: 1096, Magic: 457, Mind: 447,
    Agility: 137, Dex: 134, CritDamage: 922, Defense: 540,
  };
  const input = {
    weaponType: 'greatsword' as any,
    weaponAttackPower: 378,
    weaponCritRate: 100,
    weaponCritDamage: 167,
    damageCorrection: 90,
    userStats: {
      breakdown: { equipment: {}, jobInitial: {}, jobSP: {}, food: {}, userOption: {} } as any,
      base: finalStats,
      bonusPercent: { job: {}, emblem: {}, total: {} },
      final: finalStats,
      critRate: 100,
    } as any,
    jobName: 'Warrior',
    enemy: { defense: 0, typeResistance: 0, attributeResistance: 0 },
    options: { critMode: 'expected' as const, damageCorrectionMode: 'avg' as const, skillName: '通常攻撃' },
  };

  const res = calculateDamage(input, game.yaml.weaponCalc, game.yaml.skillCalc);
  console.log('[TRACE] success=', res.success);
  if (res.success) {
    console.log('[TRACE] baseDamage=', res.data.baseDamage);
    console.log('[TRACE] critMultiplier=', res.data.critMultiplier);
    console.log('[TRACE] skillMultiplier=', res.data.skillMultiplier);
    console.log('[TRACE] hits=', res.data.hits);
    console.log('[TRACE] hitDamage=', res.data.hitDamage);
    console.log('[TRACE] totalDamage=', res.data.totalDamage);
    console.log('[TRACE] finalDamage=', res.data.finalDamage);
  } else {
    console.log('[TRACE] error=', res.error);
  }

  // max
  const maxRes = calculateDamage({
    ...input,
    options: { ...input.options, critMode: 'always', damageCorrectionMode: 'max' },
  }, game.yaml.weaponCalc, game.yaml.skillCalc);
  console.log('[TRACE-MAX] success=', maxRes.success);
  if (maxRes.success) console.log('[TRACE-MAX] finalDamage=', maxRes.data.finalDamage);
  else console.log('[TRACE-MAX] error=', maxRes.error);

  // min
  const minRes = calculateDamage({
    ...input,
    options: { ...input.options, critMode: 'never', damageCorrectionMode: 'min' },
  }, game.yaml.weaponCalc, game.yaml.skillCalc);
  console.log('[TRACE-MIN] success=', minRes.success);
  if (minRes.success) console.log('[TRACE-MIN] finalDamage=', minRes.data.finalDamage);
  else console.log('[TRACE-MIN] error=', minRes.error);

  expect(res.success).toBe(true);
});
