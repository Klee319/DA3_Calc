/**
 * Warrior-GreatSword 診断: 1,143,927 のダメージが異常に高い要因を特定する。
 * 全ステータスとデバッグフィールドを出力する。
 */
import { runJobBench } from '../helpers/runJobBench';

jest.setTimeout(600_000);

test('Warrior-GreatSword-通常攻撃 全ステータスを出力', async () => {
  const bench = await runJobBench({
    jobName: 'Warrior',
    jobNameJP: 'ウォーリアー',
    selectedWeaponType: 'GreatSword',
    availableWeaponTypes: ['Axe', 'GreatSword'],
    skillId: '通常攻撃',
    beamWidth: 50,
    enableRunestoneSearch: false,
    enableTarotSearch: false,
    quiet: false,
    label: 'Warrior-GreatSword',
  });

  const s = bench.topStats as Record<string, number>;
  const show = (k: string) => `${k}=${typeof s[k] === 'number' ? Math.round(s[k]) : s[k]}`;
  const keys = [
    'Power', 'Magic', 'HP', 'Mind', 'Agility', 'Dex', 'CritRate', 'CritDamage', 'Defense',
    'WeaponAttackPower', 'WeaponCritDamage', 'DamageCorrection', 'CoolTime',
    'MaxDamage', 'MinDamage',
    '_debug_spBonus_Power', '_debug_spBonus_Magic', '_debug_spBonus_CritDamage',
    '_debug_job_Power', '_debug_job_Magic',
    '_debug_equip_Power', '_debug_equip_Magic', '_debug_equip_CritDamage',
    '_debug_weapon_attackPower', '_debug_weapon_critRate', '_debug_weapon_critDamage',
    '_debug_weapon_damageCorrection',
    '_debug_jobLevel', '_SP_A', '_SP_B', '_SP_C',
  ];
  console.log('[DIAG-Warrior] topDamage=', bench.topDamage);
  console.log('[DIAG-Warrior] equipment=', bench.rank1EquipNames);
  console.log('[DIAG-Warrior] emblem=', bench.emblem);
  console.log('[DIAG-Warrior] runestones=', bench.runestones);
  for (const k of keys) {
    if (s[k] != null) console.log('  ', show(k));
  }
  console.log('[DIAG-Warrior] allStatsJSON=', JSON.stringify(bench.topStats, (k, v) => typeof v === 'number' ? Math.round(v) : v));
  expect(bench.topDamage).toBeGreaterThan(0);
});
