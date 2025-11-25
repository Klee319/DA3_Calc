/**
 * データローダーのテストスクリプト
 */

import { initializeGameData, getGameData, clearGameDataCache } from './index';
import { DataLoadErrorHandler } from './errors';

/**
 * データローダーのテストを実行
 */
export async function testDataLoader(): Promise<void> {
  console.log('=====================================');
  console.log('データローダーのテストを開始します');
  console.log('=====================================\n');

  try {
    // エラーハンドラーをクリア
    DataLoadErrorHandler.clearErrors();

    // 1. 初回のデータ読み込みテスト
    console.log('【テスト1】初回データ読み込み');
    console.time('初回読み込み時間');
    
    const gameData = await initializeGameData();
    
    console.timeEnd('初回読み込み時間');
    console.log('✓ データ読み込み成功\n');

    // 2. データの内容確認
    console.log('【テスト2】データ内容の確認');
    console.log('--- YAMLデータ ---');
    console.log(`EqConst: ${gameData.yaml.eqConst ? '✓' : '✗'}`);
    console.log(`JobConst: ${gameData.yaml.jobConst ? '✓' : '✗'}`);
    console.log(`WeaponCalc: ${gameData.yaml.weaponCalc ? '✓' : '✗'}`);
    console.log(`UserStatusCalc: ${gameData.yaml.userStatusCalc ? '✓' : '✗'}`);
    console.log(`SkillCalc: ${gameData.yaml.skillCalc ? '✓' : '✗'}`);
    
    console.log('\n--- CSVデータ ---');
    console.log(`武器数: ${gameData.csv.weapons.length}`);
    console.log(`防具数: ${gameData.csv.armors.length}`);
    console.log(`アクセサリー数: ${gameData.csv.accessories.length}`);
    console.log(`紋章数: ${gameData.csv.emblems.length}`);
    console.log(`ルーンストーン数: ${gameData.csv.runestones.length}`);
    console.log(`食べ物数: ${gameData.csv.foods.length}`);
    console.log(`職業数: ${gameData.csv.jobs.size}`);
    console.log();

    // 3. 武器データの詳細確認
    if (gameData.csv.weapons.length > 0) {
      console.log('【テスト3】武器データの詳細（最初の3件）');
      gameData.csv.weapons.slice(0, 3).forEach((weapon, index) => {
        console.log(`\n武器 ${index + 1}: ${weapon.アイテム名}`);
        console.log(`  武器種: ${weapon.武器種}`);
        console.log(`  使用可能Lv: ${weapon.使用可能Lv}`);
        console.log(`  攻撃力: ${weapon['攻撃力（初期値）']}`);
        console.log(`  会心率: ${weapon['会心率（初期値）']}`);
        console.log(`  会心ダメージ: ${weapon['会心ダメージ（初期値）']}`);
        if (weapon.最低ランク) {
          console.log(`  最低ランク: ${weapon.最低ランク}`);
        }
        if (weapon.最高ランク) {
          console.log(`  最高ランク: ${weapon.最高ランク}`);
        }
      });
      console.log();
    }

    // 4. キャッシュテスト
    console.log('【テスト4】キャッシュ機能の確認');
    console.time('キャッシュ読み込み時間');
    
    const cachedData = await getGameData();
    
    console.timeEnd('キャッシュ読み込み時間');
    console.log(`キャッシュ有効: ${cachedData === gameData ? '✓' : '✗'}`);
    console.log();

    // 5. キャッシュクリアテスト
    console.log('【テスト5】キャッシュクリア後の再読み込み');
    clearGameDataCache();
    console.log('キャッシュをクリアしました');
    
    console.time('再読み込み時間');
    const newData = await getGameData();
    console.timeEnd('再読み込み時間');
    console.log(`新規データ読み込み: ${newData !== gameData ? '✓' : '✗'}`);
    console.log();

    // 6. エラー確認
    console.log('【テスト6】エラーハンドリングの確認');
    if (DataLoadErrorHandler.hasErrors()) {
      console.log('⚠️ 読み込み中にエラーが発生しました:');
      console.log(DataLoadErrorHandler.getErrorSummary());
    } else {
      console.log('✓ エラーなし');
    }
    console.log();

    // 7. パラメータ置き換えの確認
    console.log('【テスト7】YAMLパラメータ置き換えの確認');
    if (gameData.yaml.userStatusCalc?.UserStatusFormula) {
      const formula = Object.values(gameData.yaml.userStatusCalc.UserStatusFormula)[0];
      if (typeof formula === 'string') {
        const hasPlaceholders = formula.includes('<') && formula.includes('>');
        console.log(`パラメータ置き換え: ${!hasPlaceholders ? '✓ 成功' : '✗ 失敗'}`);
        console.log(`サンプル式: ${formula.substring(0, 100)}...`);
      }
    }
    console.log();

    console.log('=====================================');
    console.log('✅ すべてのテストが完了しました');
    console.log('=====================================');

  } catch (error) {
    console.error('❌ テスト中にエラーが発生しました:');
    console.error(error);
    
    if (DataLoadErrorHandler.hasErrors()) {
      console.error('\n記録されたエラー:');
      console.error(DataLoadErrorHandler.getErrorSummary());
    }
    
    throw error;
  }
}

// ブラウザ環境でのテスト実行用
if (typeof window !== 'undefined') {
  (window as any).testDataLoader = testDataLoader;
}