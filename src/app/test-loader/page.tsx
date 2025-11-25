'use client';

import { useState } from 'react';
import { initializeGameData, getGameData, clearGameDataCache } from '@/lib/data';
import { DataLoadErrorHandler } from '@/lib/data/errors';

export default function TestLoaderPage() {
  const [output, setOutput] = useState<string[]>(['テストを実行してください。']);
  const [loading, setLoading] = useState(false);

  const log = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const prefix = {
      info: 'ℹ️',
      success: '✅',
      error: '❌',
      warning: '⚠️'
    }[type];
    
    setOutput(prev => [...prev, `${prefix} ${message}`]);
  };

  const runTest = async () => {
    setOutput([]);
    setLoading(true);
    log('データローダーのテストを開始します', 'info');

    try {
      // エラーハンドラーをクリア
      DataLoadErrorHandler.clearErrors();

      // 1. 初回のデータ読み込みテスト
      log('【テスト1】初回データ読み込み', 'info');
      const startTime = performance.now();
      
      const gameData = await initializeGameData();
      
      const loadTime = performance.now() - startTime;
      log(`読み込み時間: ${loadTime.toFixed(2)}ms`, 'success');

      // 2. データの内容確認
      log('【テスト2】データ内容の確認', 'info');
      log(`YAMLファイル数: ${Object.keys(gameData.yaml).length}`, 'info');
      log(`武器数: ${gameData.csv.weapons.length}`, 'info');
      log(`防具数: ${gameData.csv.armors.length}`, 'info');
      log(`アクセサリー数: ${gameData.csv.accessories.length}`, 'info');
      log(`紋章数: ${gameData.csv.emblems.length}`, 'info');
      log(`ルーンストーン数: ${gameData.csv.runestones.length}`, 'info');
      log(`食べ物数: ${gameData.csv.foods.length}`, 'info');
      log(`職業数: ${gameData.csv.jobs.size}`, 'info');

      // 3. 武器データの詳細確認
      if (gameData.csv.weapons.length > 0) {
        log('【テスト3】武器データのサンプル', 'info');
        const weapon = gameData.csv.weapons[0];
        log(`武器名: ${weapon.アイテム名}`, 'info');
        log(`武器種: ${weapon.武器種}`, 'info');
        log(`攻撃力: ${weapon['攻撃力（初期値）']}`, 'info');
      }

      // 4. キャッシュテスト
      log('【テスト4】キャッシュ機能の確認', 'info');
      const cacheStartTime = performance.now();
      const cachedData = await getGameData();
      const cacheTime = performance.now() - cacheStartTime;
      
      log(`キャッシュ読み込み時間: ${cacheTime.toFixed(2)}ms`, 'success');
      log(`キャッシュ有効: ${cachedData === gameData ? 'はい' : 'いいえ'}`, 'info');

      // 5. エラー確認
      log('【テスト5】エラーハンドリングの確認', 'info');
      if (DataLoadErrorHandler.hasErrors()) {
        log('読み込み中にエラーが発生しました', 'warning');
        const errors = DataLoadErrorHandler.getErrors();
        errors.forEach(err => {
          log(`${err.name}: ${err.fileName}`, 'error');
        });
      } else {
        log('エラーなし', 'success');
      }

      log('すべてのテストが完了しました', 'success');

    } catch (error) {
      log('テスト中にエラーが発生しました', 'error');
      if (error instanceof Error) {
        log(error.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const clearCache = () => {
    clearGameDataCache();
    log('キャッシュをクリアしました', 'success');
  };

  const clearOutput = () => {
    setOutput(['出力をクリアしました。']);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6 text-blue-600">
        🔧 データローダーテスト
      </h1>

      <div className="mb-6 space-x-4">
        <button
          onClick={runTest}
          disabled={loading}
          className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          {loading ? '実行中...' : 'テスト実行'}
        </button>
        <button
          onClick={clearCache}
          className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          キャッシュクリア
        </button>
        <button
          onClick={clearOutput}
          className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          出力クリア
        </button>
      </div>

      <div className="bg-gray-900 text-gray-100 p-6 rounded-lg">
        <pre className="whitespace-pre-wrap font-mono text-sm">
          {output.map((line, index) => (
            <div
              key={index}
              className={
                line.includes('❌') ? 'text-red-400' :
                line.includes('⚠️') ? 'text-yellow-400' :
                line.includes('✅') ? 'text-green-400' :
                line.includes('【') ? 'text-blue-400' :
                'text-gray-300'
              }
            >
              {line}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}