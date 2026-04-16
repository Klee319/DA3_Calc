/**
 * スペルリファクター剣通常攻撃のベンチマーク
 *
 * 実機理論値（testOptimizer.ts算出の完全最大化シナリオ）に
 * 最適化エンジンがどこまで近づけるかを測定する。
 */

import { runSpellRefactorSwordBench } from '../helpers/runSpellRefactorBench';

const THEORETICAL_DAMAGE = Number(process.env.SR_THEORETICAL || 22823);
const TOLERANCE_PCT = Number(process.env.SR_TOLERANCE_PCT || 3);
const TEST_TIMEOUT = Number(process.env.SR_TIMEOUT || 900_000);

function formatStats(stats: Record<string, any>): string {
  const keys = ['Power', 'Magic', 'HP', 'Mind', 'Agility', 'Dex', 'CritRate', 'CritDamage', 'Defense'];
  return keys
    .filter((k) => typeof stats[k] === 'number')
    .map((k) => `${k}=${Math.round(stats[k])}`)
    .join(' ');
}

describe('SpellRefactor Sword 通常攻撃 benchmark', () => {
  jest.setTimeout(TEST_TIMEOUT);

  it('optimizer damage should approach theoretical value', async () => {
    console.log(`[START] Running optimizer (timeout=${TEST_TIMEOUT}ms, threshold=${THEORETICAL_DAMAGE}, tolerance=${TOLERANCE_PCT}%)`);
    const enableTarot = process.env.SR_TAROT !== '0';
    const enableRune = process.env.SR_RUNE !== '0';
    const beamWidth = process.env.SR_BEAM ? Number(process.env.SR_BEAM) : undefined;
    console.log(`  flags: tarot=${enableTarot}, rune=${enableRune}, beam=${beamWidth ?? 'default'}`);
    const bench = await runSpellRefactorSwordBench({
      enableTarotSearch: enableTarot,
      enableRunestoneSearch: enableRune,
      beamWidth,
    });

    const gapAbs = THEORETICAL_DAMAGE - bench.topDamage;
    const gapPct = (gapAbs / THEORETICAL_DAMAGE) * 100;
    const statsStr = formatStats(bench.topStats);

    const summary = [
      '===== SpellRefactor Sword 通常攻撃 =====',
      `  Theoretical target : ${THEORETICAL_DAMAGE.toLocaleString()}`,
      `  Optimizer top dmg  : ${Math.round(bench.topDamage).toLocaleString()}`,
      `  Gap (theoretical - top) : ${Math.round(gapAbs).toLocaleString()} (${gapPct.toFixed(2)}%)`,
      `  Tolerance          : ${TOLERANCE_PCT}%`,
      `  Elapsed            : ${bench.elapsedMs}ms`,
      `  Results            : ${bench.resultsCount}`,
      `  meetsMinimum       : ${bench.meetsMinimum}`,
      `  Top equipment      : ${JSON.stringify(bench.rank1EquipNames)}`,
      `  Top stats          : ${statsStr}`,
      `  Emblem             : ${bench.emblem ?? '—'}`,
      `  Runestones         : ${(bench.runestones ?? []).join(', ') || '—'}`,
      bench.warnings?.length ? `  Warnings         : ${bench.warnings.join(' | ')}` : '',
    ].filter(Boolean).join('\n');

    console.log(summary);

    expect(bench.topDamage).toBeGreaterThan(0);
    expect(gapPct).toBeLessThanOrEqual(TOLERANCE_PCT);
  });
});
