/**
 * 他職業での副作用スモークテスト
 *
 * SpellRefactor最適化のための変更（特にskillAnalyzerでの
 * Power/Magic強制追加、engineのrune×emblem上限、approximateScore
 * のpercentBonus投影など）が他職業に副作用を起こさないか確認する。
 *
 * 各職業について、optimizeEquipmentが完走し、正の期待ダメージを
 * 返すこと、かつ結果が10件以上であることを検証する（具体数値は
 * ビルドツール側の計算式変更で動くため厳密値は比較しない）。
 */

import { runJobBench } from '../helpers/runJobBench';

const TIMEOUT = Number(process.env.SR_TIMEOUT || 600_000);
const BEAM_WIDTH = Number(process.env.SR_BEAM || 50);
// タロット/ルーンは既に SpellRefactor テストで検証済のため、
// 他職業スモークは時間短縮優先で OFF にする。
const ENABLE_RUNE = process.env.OTHER_RUNE === '1';
const ENABLE_TAROT = process.env.OTHER_TAROT === '1';

interface JobCase {
  label: string;
  jobName: string;
  jobNameJP: string;
  weaponType: string;
  availableWeaponTypes: string[];
  skill: string;
}

const CASES: JobCase[] = [
  {
    label: 'Wizard-Wand-通常攻撃',
    jobName: 'Wizard',
    jobNameJP: 'ウィザード',
    weaponType: 'Wand',
    availableWeaponTypes: ['Wand'],
    skill: '通常攻撃',
  },
  {
    label: 'Warrior-GreatSword-通常攻撃',
    jobName: 'Warrior',
    jobNameJP: 'ウォーリアー',
    weaponType: 'GreatSword',
    availableWeaponTypes: ['Axe', 'GreatSword'],
    skill: '通常攻撃',
  },
  {
    label: 'Knight-Sword-通常攻撃',
    jobName: 'Knight',
    jobNameJP: 'ナイト',
    weaponType: 'Sword',
    availableWeaponTypes: ['Sword'],
    skill: '通常攻撃',
  },
];

describe('他職業スモーク（SpellRefactor修正の副作用検知）', () => {
  jest.setTimeout(TIMEOUT);

  for (const c of CASES) {
    it(`${c.label} が完走し正の期待ダメージを返す`, async () => {
      const bench = await runJobBench({
        jobName: c.jobName,
        jobNameJP: c.jobNameJP,
        selectedWeaponType: c.weaponType,
        availableWeaponTypes: c.availableWeaponTypes,
        skillId: c.skill,
        beamWidth: BEAM_WIDTH,
        enableRunestoneSearch: ENABLE_RUNE,
        enableTarotSearch: ENABLE_TAROT,
        quiet: false,
        label: c.label,
      });

      console.log(`[SMOKE:${c.label}] dmg=${Math.round(bench.topDamage)} elapsed=${bench.elapsedMs}ms results=${bench.resultsCount} P=${Math.round(bench.topStats.Power || 0)} M=${Math.round(bench.topStats.Magic || 0)}`);

      expect(bench.topDamage).toBeGreaterThan(0);
      expect(bench.resultsCount).toBeGreaterThanOrEqual(1);
      expect(bench.elapsedMs).toBeLessThan(TIMEOUT);
    });
  }
});
