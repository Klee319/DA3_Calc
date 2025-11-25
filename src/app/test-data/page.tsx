'use client';

import { useEffect, useState } from 'react';
import { initializeGameData } from '@/lib/data';
import { GameData } from '@/types/data';

export default function TestDataPage() {
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('Loading game data...');
        const data = await initializeGameData();
        setGameData(data);
        console.log('Game data loaded:', data);
      } catch (err) {
        console.error('Error loading game data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">データ読み込みテスト</h1>
        <p>データを読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">データ読み込みテスト</h1>
        <p className="text-red-500">エラー: {error}</p>
      </div>
    );
  }

  if (!gameData) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">データ読み込みテスト</h1>
        <p>データが見つかりません</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">データ読み込みテスト</h1>

      <div className="space-y-6">
        <section>
          <h2 className="text-xl font-semibold mb-2">YAMLデータ</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>EqConst: {gameData.yaml.eqConst ? '✓ 読み込み成功' : '✗ 失敗'}</li>
            <li>JobConst: {gameData.yaml.jobConst ? '✓ 読み込み成功' : '✗ 失敗'}</li>
            <li>WeaponCalc: {gameData.yaml.weaponCalc ? '✓ 読み込み成功' : '✗ 失敗'}</li>
            <li>UserStatusCalc: {gameData.yaml.userStatusCalc ? '✓ 読み込み成功' : '✗ 失敗'}</li>
            <li>SkillCalc: {gameData.yaml.skillCalc ? '✓ 読み込み成功' : '✗ 失敗'}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">CSVデータ</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>武器: {gameData.csv.weapons.length}件</li>
            <li>防具: {gameData.csv.armors.length}件</li>
            <li>アクセサリー: {gameData.csv.accessories.length}件</li>
            <li>紋章: {gameData.csv.emblems.length}件</li>
            <li>ルーンストーン: {gameData.csv.runestones.length}件</li>
            <li>食べ物: {gameData.csv.foods.length}件</li>
            <li>ジョブデータ: {gameData.csv.jobs.size}種類</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">サンプルデータ</h2>

          <div className="mb-4">
            <h3 className="font-semibold">武器データ（最初の3件）</h3>
            <pre className="bg-gray-100 p-2 rounded text-sm overflow-x-auto">
              {JSON.stringify(gameData.csv.weapons.slice(0, 3), null, 2)}
            </pre>
          </div>

          <div className="mb-4">
            <h3 className="font-semibold">ジョブデータ（ガーディアン）</h3>
            <pre className="bg-gray-100 p-2 rounded text-sm overflow-x-auto">
              {JSON.stringify(
                gameData.csv.jobs.get('ガーディアン')?.slice(0, 3) || [],
                null,
                2
              )}
            </pre>
          </div>
        </section>
      </div>
    </div>
  );
}