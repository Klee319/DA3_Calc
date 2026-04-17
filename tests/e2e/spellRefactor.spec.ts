/**
 * Playwright E2E: SpellRefactor剣通常攻撃の最適化がUIから実行できることを確認。
 *
 * CustomSelectはaria-labelを持つbuttonで、クリック後にrole="option"で
 * 候補が表示される。「最適化を開始」→実行中は「最適化を中止」に変化し、
 * 完了で再度「最適化を開始」に戻る。これを完了シグナルとして用いる。
 * 進捗表示の「現在の最良期待ダメージ」と結果側の「期待ダメージ:」は
 * プレフィックスで区別する。
 */
import { test, expect, Page } from '@playwright/test';

const THEORETICAL_DAMAGE = Number(process.env.SR_THEORETICAL || 22823);
const TOLERANCE_PCT = Number(process.env.SR_TOLERANCE_PCT || 5);
// タロットOFFでは tarot ダメージバフが無いぶん damage が下がる。ユーザーが
// 提示した理論値 22,823 を閾値とする（2%の誤差まで許容）。
const TOLERANCE_PCT_NO_TAROT = Number(process.env.SR_TOLERANCE_PCT_NO_TAROT || 3);

async function setupSpellRefactorSwordNormalAttack(page: Page): Promise<void> {
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
}

async function runOptimizationAndRead(page: Page): Promise<number> {
  const startButton = page.getByRole('button', { name: '最適化を開始', exact: true });
  await expect(startButton).toBeVisible({ timeout: 15_000 });
  await expect(startButton).toBeEnabled();
  await startButton.click();

  // 実行中は「最適化を中止」に変わる
  const cancelButton = page.getByRole('button', { name: '最適化を中止', exact: true });
  await expect(cancelButton).toBeVisible({ timeout: 15_000 });

  // 完了で「最適化を開始」ボタンが戻る
  await expect(startButton).toBeVisible({ timeout: 14 * 60 * 1000 });

  // 結果カード内の「期待ダメージ: nn,nnn」だけに厳密一致（進捗表示と区別）
  const damageLocator = page.locator('text=/^期待ダメージ:\\s*[0-9,]+/').first();
  await expect(damageLocator).toBeVisible({ timeout: 30_000 });
  const text = await damageLocator.innerText();
  const match = text.match(/([0-9][0-9,]*)/);
  return match ? Number(match[1].replace(/,/g, '')) : 0;
}

test.describe('optimize page - SpellRefactor Sword 通常攻撃', () => {
  test('タロットON: フォーム入力→最適化→理論値超え', async ({ page }) => {
    test.setTimeout(15 * 60 * 1000);

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
    });

    await setupSpellRefactorSwordNormalAttack(page);
    const dmg = await runOptimizationAndRead(page);
    console.log(`[E2E-tarot-on] damage=${dmg}`);
    expect(dmg).toBeGreaterThan(0);

    const gapPct = ((THEORETICAL_DAMAGE - dmg) / THEORETICAL_DAMAGE) * 100;
    console.log(`[E2E-tarot-on] theoretical=${THEORETICAL_DAMAGE} damage=${dmg} gap=${gapPct.toFixed(2)}% (tolerance=${TOLERANCE_PCT}%)`);
    expect(gapPct).toBeLessThanOrEqual(TOLERANCE_PCT);

    if (errors.length > 0) {
      console.log('[E2E-tarot-on] page errors:\n' + errors.join('\n'));
    }
  });

  test('タロットOFF: 理論値 22,823 に肉薄', async ({ page }) => {
    test.setTimeout(15 * 60 * 1000);

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
    });

    await setupSpellRefactorSwordNormalAttack(page);

    // 「タロット探索」のチェックボックス（OptimizeConstraints 内）をOFFに
    const tarotLabel = page.locator('label', { hasText: 'タロット探索' }).first();
    await expect(tarotLabel).toBeVisible({ timeout: 30_000 });
    const tarotCheckbox = tarotLabel.locator('input[type="checkbox"]');
    await expect(tarotCheckbox).toBeChecked();
    await tarotCheckbox.uncheck();
    await expect(tarotCheckbox).not.toBeChecked();

    const dmg = await runOptimizationAndRead(page);
    console.log(`[E2E-tarot-off] damage=${dmg}`);
    expect(dmg).toBeGreaterThan(0);

    const gapPct = ((THEORETICAL_DAMAGE - dmg) / THEORETICAL_DAMAGE) * 100;
    console.log(`[E2E-tarot-off] theoretical=${THEORETICAL_DAMAGE} damage=${dmg} gap=${gapPct.toFixed(2)}% (tolerance=${TOLERANCE_PCT_NO_TAROT}%)`);
    expect(gapPct).toBeLessThanOrEqual(TOLERANCE_PCT_NO_TAROT);

    if (errors.length > 0) {
      console.log('[E2E-tarot-off] page errors:\n' + errors.join('\n'));
    }
  });
});
