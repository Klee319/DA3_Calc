/**
 * Playwright E2E: SpellRefactor剣通常攻撃の最適化がUIから実行できることを確認。
 *
 * CustomSelectはaria-labelを持つbuttonで、クリック後にrole="option"で
 * 候補が表示される。「最適化を開始」→実行中は「最適化を中止」に変化し、
 * 完了で再度「最適化を開始」に戻る。これを完了シグナルとして用いる。
 * 進捗表示の「現在の最良期待ダメージ」と結果側の「期待ダメージ:」は
 * プレフィックスで区別する。
 */
import { test, expect } from '@playwright/test';

const THEORETICAL_DAMAGE = Number(process.env.SR_THEORETICAL || 22823);
const TOLERANCE_PCT = Number(process.env.SR_TOLERANCE_PCT || 5);

test.describe('optimize page - SpellRefactor Sword 通常攻撃', () => {
  test('フォーム入力→最適化実行→結果表示まで完走する', async ({ page }) => {
    test.setTimeout(12 * 60 * 1000);

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
    });

    await page.goto('/optimize', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/optimize/);

    const jobTrigger = page.getByRole('button', { name: '職業', exact: true });
    await expect(jobTrigger).toBeVisible({ timeout: 60_000 });

    await jobTrigger.click();
    await page.getByRole('option', { name: /スペルリファクター/ }).click();

    const weaponTrigger = page.getByRole('button', { name: '評価武器種', exact: true });
    if (await weaponTrigger.count()) {
      await weaponTrigger.click();
      await page.getByRole('option', { name: /剣/ }).first().click();
    }

    const skillTrigger = page.getByRole('button', { name: '評価スキル', exact: true });
    await expect(skillTrigger).toBeVisible({ timeout: 15_000 });
    await skillTrigger.click();
    await page.getByRole('option', { name: /通常攻撃/ }).first().click();

    const startButton = page.getByRole('button', { name: '最適化を開始', exact: true });
    await expect(startButton).toBeVisible({ timeout: 15_000 });
    await expect(startButton).toBeEnabled();
    await startButton.click();

    // 「最適化を中止」に切り替わることを確認（実行開始）
    const cancelButton = page.getByRole('button', { name: '最適化を中止', exact: true });
    await expect(cancelButton).toBeVisible({ timeout: 15_000 });

    // 最適化完了を「最適化を開始」ボタンの再出現で検知
    await expect(startButton).toBeVisible({ timeout: 11 * 60 * 1000 });

    // 結果側の「期待ダメージ:」は順位カード内。進捗側は「現在の最良期待ダメージ」
    // なので ^期待ダメージ:\s*\d で厳密にマッチさせる。
    const damageLocator = page.locator('text=/^期待ダメージ:\\s*[0-9,]+/').first();
    await expect(damageLocator).toBeVisible({ timeout: 30_000 });

    const text = await damageLocator.innerText();
    const match = text.match(/([0-9][0-9,]*)/);
    const dmg = match ? Number(match[1].replace(/,/g, '')) : 0;
    console.log(`[E2E] rank1 text='${text}' damage=${dmg}`);

    expect(dmg).toBeGreaterThan(0);

    const gapPct = ((THEORETICAL_DAMAGE - dmg) / THEORETICAL_DAMAGE) * 100;
    console.log(`[E2E] theoretical=${THEORETICAL_DAMAGE} damage=${dmg} gap=${gapPct.toFixed(2)}% (tolerance=${TOLERANCE_PCT}%)`);
    expect(gapPct).toBeLessThanOrEqual(TOLERANCE_PCT);

    if (errors.length > 0) {
      console.log('[E2E] page errors:\n' + errors.join('\n'));
    }
  });
});
