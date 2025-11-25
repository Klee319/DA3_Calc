"use client";

import { useState, useEffect, useCallback } from 'react';
import { useBuildStore } from '@/store/buildStore';
import { 
  OptimizeConstraints, 
  OptimizeResult, 
  EnemyParams,
  OptimizeProgress 
} from '@/types/optimize';
import { EquipSlot } from '@/types';
import { GameData } from '@/types/data';
import { optimizeEquipment, generateOptimizeResultCSV } from '@/lib/calc/optimize';

export default function OptimizePage() {
  // Store
  const { currentBuild, loadBuild } = useBuildStore();

  // Game Data (TODO: 実際のデータローダーに置き換え)
  const [gameData, setGameData] = useState<GameData | null>(null);

  // 探索条件
  const [selectedSkill, setSelectedSkill] = useState<string>('');
  const [enemyParams, setEnemyParams] = useState<EnemyParams>({
    name: '標準エネミー',
    level: 100,
    DEF: 1000,
    MDEF: 1000,
  });

  // 探索対象スロット
  const [targetSlots, setTargetSlots] = useState<Set<EquipSlot>>(new Set(['weapon'] as EquipSlot[]));

  // 制約設定
  const [constraints, setConstraints] = useState<OptimizeConstraints>({
    targetSlots: Array.from(targetSlots),
    weaponRankMin: 1,
    weaponRankMax: 10,
    armorRankMin: 1,
    maxCombinations: 5000,
  });

  // 探索状態
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState<OptimizeProgress | null>(null);
  const [results, setResults] = useState<OptimizeResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<OptimizeResult | null>(null);

  // 表示設定
  const [showDetailModal, setShowDetailModal] = useState(false);

  // スロットのトグル
  const toggleSlot = (slot: EquipSlot) => {
    const newSlots = new Set(targetSlots);
    if (newSlots.has(slot)) {
      newSlots.delete(slot);
    } else {
      newSlots.add(slot);
    }
    setTargetSlots(newSlots);
    setConstraints(prev => ({
      ...prev,
      targetSlots: Array.from(newSlots)
    }));
  };

  // 探索実行
  const startOptimization = async () => {
    if (!gameData || targetSlots.size === 0 || !selectedSkill) {
      alert('探索条件を設定してください');
      return;
    }

    setIsOptimizing(true);
    setProgress(null);
    setResults([]);

    try {
      const optimizeResults = await optimizeEquipment(
        currentBuild,
        Array.from(targetSlots),
        constraints,
        selectedSkill,
        enemyParams,
        gameData,
        (prog) => setProgress(prog)
      );

      // ランク付け
      optimizeResults.forEach((result, index) => {
        result.rank = index + 1;
      });

      setResults(optimizeResults);
    } catch (error) {
      console.error('Optimization error:', error);
      alert('最適化中にエラーが発生しました');
    } finally {
      setIsOptimizing(false);
      setProgress(null);
    }
  };

  // ビルドを適用
  const applyBuild = (result: OptimizeResult) => {
    if (window.confirm('このビルドを現在のビルドに反映しますか？')) {
      loadBuild(result.build);
      alert('ビルドを反映しました。ビルドページで確認してください。');
    }
  };

  // CSV出力
  const exportToCSV = () => {
    if (results.length === 0) return;

    const csv = generateOptimizeResultCSV(results);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `optimize_results_${new Date().getTime()}.csv`;
    link.click();
  };

  // 詳細表示
  const showDetails = (result: OptimizeResult) => {
    setSelectedResult(result);
    setShowDetailModal(true);
  };

  // データロード（暫定）
  useEffect(() => {
    // TODO: 実際のデータローダーを実装
    setGameData({
      yaml: {
        eqConst: {} as any,
        jobConst: {} as any,
        weaponCalc: {} as any,
        userStatusCalc: {} as any,
        skillCalc: {} as any,
      },
      csv: {
        weapons: [],
        armors: [],
        accessories: [],
        emblems: [],
        runestones: [],
        foods: [],
        jobs: new Map(),
      }
    });
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex h-screen">
        {/* 左サイドバー: 探索条件設定 */}
        <div className="w-96 bg-white dark:bg-gray-800 shadow-lg overflow-y-auto p-6">
          <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100">
            探索条件設定
          </h2>

          {/* 現在の職業 */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">現在の職業</h3>
            <p className="p-3 bg-gray-100 dark:bg-gray-700 rounded">
              {currentBuild.job?.name || 'なし'}
            </p>
          </div>

          {/* 評価スキル選択 */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">評価スキル</h3>
            <select
              value={selectedSkill}
              onChange={(e) => setSelectedSkill(e.target.value)}
              className="w-full p-2 border rounded dark:bg-gray-700"
              disabled={isOptimizing}
            >
              <option value="">スキルを選択</option>
              <option value="skill_001">通常攻撃</option>
              <option value="skill_002">スキル1</option>
              <option value="skill_003">スキル2</option>
            </select>
          </div>

          {/* 敵パラメータ */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">敵パラメータ</h3>
            <div className="space-y-2">
              <div>
                <label className="block text-sm">レベル</label>
                <input
                  type="number"
                  value={enemyParams.level}
                  onChange={(e) => setEnemyParams(prev => ({
                    ...prev,
                    level: parseInt(e.target.value) || 1
                  }))}
                  className="w-full p-2 border rounded dark:bg-gray-700"
                  disabled={isOptimizing}
                />
              </div>
              <div>
                <label className="block text-sm">DEF</label>
                <input
                  type="number"
                  value={enemyParams.DEF}
                  onChange={(e) => setEnemyParams(prev => ({
                    ...prev,
                    DEF: parseInt(e.target.value) || 0
                  }))}
                  className="w-full p-2 border rounded dark:bg-gray-700"
                  disabled={isOptimizing}
                />
              </div>
              <div>
                <label className="block text-sm">MDEF</label>
                <input
                  type="number"
                  value={enemyParams.MDEF}
                  onChange={(e) => setEnemyParams(prev => ({
                    ...prev,
                    MDEF: parseInt(e.target.value) || 0
                  }))}
                  className="w-full p-2 border rounded dark:bg-gray-700"
                  disabled={isOptimizing}
                />
              </div>
            </div>
          </div>

          {/* 探索対象スロット */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">探索対象スロット</h3>
            <div className="space-y-2">
              {(['weapon', 'head', 'body', 'arm', 'leg', 'accessory1', 'accessory2'] as EquipSlot[]).map(slot => (
                <label key={slot} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={targetSlots.has(slot)}
                    onChange={() => toggleSlot(slot)}
                    className="mr-2"
                    disabled={isOptimizing}
                  />
                  <span className="capitalize">{slot}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 制約設定 */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">制約設定</h3>
            <div className="space-y-2">
              <div>
                <label className="block text-sm">武器ランク下限</label>
                <input
                  type="number"
                  value={constraints.weaponRankMin}
                  onChange={(e) => setConstraints(prev => ({
                    ...prev,
                    weaponRankMin: parseInt(e.target.value) || 1
                  }))}
                  className="w-full p-2 border rounded dark:bg-gray-700"
                  disabled={isOptimizing}
                />
              </div>
              <div>
                <label className="block text-sm">武器ランク上限</label>
                <input
                  type="number"
                  value={constraints.weaponRankMax}
                  onChange={(e) => setConstraints(prev => ({
                    ...prev,
                    weaponRankMax: parseInt(e.target.value) || 10
                  }))}
                  className="w-full p-2 border rounded dark:bg-gray-700"
                  disabled={isOptimizing}
                />
              </div>
              <div>
                <label className="block text-sm">防具ランク下限</label>
                <input
                  type="number"
                  value={constraints.armorRankMin}
                  onChange={(e) => setConstraints(prev => ({
                    ...prev,
                    armorRankMin: parseInt(e.target.value) || 1
                  }))}
                  className="w-full p-2 border rounded dark:bg-gray-700"
                  disabled={isOptimizing}
                />
              </div>
            </div>
          </div>

          {/* 探索実行ボタン */}
          <button
            onClick={startOptimization}
            disabled={isOptimizing || targetSlots.size === 0 || !selectedSkill}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {isOptimizing ? '探索中...' : '探索開始'}
          </button>

          {/* プログレス表示 */}
          {progress && (
            <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded">
              <p className="text-sm mb-2">{progress.message}</p>
              <div className="w-full bg-gray-300 dark:bg-gray-600 rounded h-2">
                <div 
                  className="bg-blue-600 rounded h-2 transition-all"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <p className="text-sm mt-2">
                現在のベスト: {Math.floor(progress.currentBest)}
              </p>
            </div>
          )}
        </div>

        {/* 右メイン: 結果表示 */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              最適化結果
            </h2>
            {results.length > 0 && (
              <button
                onClick={exportToCSV}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                CSV出力
              </button>
            )}
          </div>

          {/* 結果テーブル */}
          {results.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-700">
                    <th className="px-4 py-2 text-left">順位</th>
                    <th className="px-4 py-2 text-left">期待ダメージ</th>
                    <th className="px-4 py-2 text-left">武器</th>
                    <th className="px-4 py-2 text-left">防具</th>
                    <th className="px-4 py-2 text-left">アクセ</th>
                    <th className="px-4 py-2 text-left">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {results.slice(0, 50).map((result) => (
                    <tr
                      key={result.rank}
                      className="border-t hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      onClick={() => showDetails(result)}
                    >
                      <td className="px-4 py-2">{result.rank}</td>
                      <td className="px-4 py-2 font-bold text-blue-600">
                        {Math.floor(result.expectedDamage).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {(result.equipment.weapon as any)?.name || '-'}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {[
                          (result.equipment.head as any)?.name,
                          (result.equipment.body as any)?.name,
                        ].filter(Boolean).join(', ') || '-'}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {[
                          (result.equipment.accessory1 as any)?.name,
                          (result.equipment.accessory2 as any)?.name,
                        ].filter(Boolean).join(', ') || '-'}
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            applyBuild(result);
                          }}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                        >
                          ビルドを適用
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-20 text-gray-500">
              {isOptimizing ? 'Optimizing...' : '探索を実行してください'}
            </div>
          )}
        </div>
      </div>

      {/* 詳細モーダル */}
      {showDetailModal && selectedResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto p-6">
            <h3 className="text-2xl font-bold mb-4">
              ビルド詳細 (順位: {selectedResult.rank})
            </h3>
            
            <div className="grid grid-cols-2 gap-6">
              {/* 装備詳細 */}
              <div>
                <h4 className="text-lg font-semibold mb-2">装備構成</h4>
                <div className="space-y-2">
                  {Object.entries(selectedResult.equipment).map(([slot, equip]) => (
                    <div key={slot} className="flex justify-between">
                      <span className="font-medium capitalize">{slot}:</span>
                      <span>{equip?.name || '-'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ステータス */}
              <div>
                <h4 className="text-lg font-semibold mb-2">最終ステータス</h4>
                <div className="space-y-2">
                  {Object.entries(selectedResult.calculatedStats).map(([stat, value]) => (
                    <div key={stat} className="flex justify-between">
                      <span className="font-medium">{stat}:</span>
                      <span>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ダメージ詳細 */}
              <div className="col-span-2">
                <h4 className="text-lg font-semibold mb-2">ダメージ計算詳細</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium">期待ダメージ:</span>
                    <span className="ml-2 text-xl font-bold text-blue-600">
                      {Math.floor(selectedResult.expectedDamage).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">基本ダメージ:</span>
                    <span className="ml-2">
                      {Math.floor(selectedResult.damageDetails.baseDamage).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">クリティカル率:</span>
                    <span className="ml-2">
                      {selectedResult.damageDetails.critRate.toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">命中率:</span>
                    <span className="ml-2">
                      {selectedResult.damageDetails.hitRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => applyBuild(selectedResult)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                このビルドを適用
              </button>
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
