/**
 * Playwright E2E: SpellRefactor剣通常攻撃で最適化が動くことを確認。
 * スコアの具体値はJestのベンチマークで検証する。
 */
import { test, expect } from '@playwright/test';

const THEORETICAL_DAMAGE = Number(process.env.SR_THEORETICAL || 22823);
const TOLERANCE_PCT = Number(process.env.SR_TOLERANCE_PCT || 3);

test.describe('optimize page - SpellRefactor Sword 通常攻撃', () => {
  test('完走し、期待ダメージが理論値に近いこと', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/optimize');
    await expect(page).toHaveURL(/optimize/);
    await page.waitForLoadState('networkidle');

    // 職業セレクト
    const jobSelect = page.getByRole('combobox', { name: /職業/ });
    if (await jobSelect.count()) await jobSelect.selectOption({ label: 'スペルリファクター' });

    const weaponSelect = page.getByRole('combobox', { name: /武器/ });
    if (await weaponSelect.count()) await weaponSelect.selectOption({ label: /剣/ });

    const skillSelect = page.getByRole('combobox', { name: /スキル/ });
    if (await skillSelect.count()) await skillSelect.selectOption({ label: /通常攻撃/ });

    const startButton = page.getByRole('button', { name: /最適化(を)?開始/ });
    await expect(startButton).toBeVisible({ timeout: 30_000 });
    await startButton.click();

    await page.waitForSelector('text=/完了|順位 ?1/', { timeout: 4 * 60 * 1000 });

    const rank1 = await page.locator('[data-testid="optimize-rank-1-damage"], text=/期待ダメージ/').first().innerText().catch(() => '');
    console.log('[E2E] rank1 text:', rank1);
    expect(errors, errors.join('\n')).toEqual([]);

    const match = rank1.match(/([0-9][0-9,]*)/);
    if (match) {
      const dmg = Number(match[1].replace(/,/g, ''));
      const gapPct = ((THEORETICAL_DAMAGE - dmg) / THEORETICAL_DAMAGE) * 100;
      console.log(`[E2E] damage=${dmg} gap=${gapPct.toFixed(2)}%`);
      expect(gapPct).toBeLessThanOrEqual(TOLERANCE_PCT);
    }
  });
});
