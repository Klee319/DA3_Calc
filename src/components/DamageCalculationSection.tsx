'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useBuildStore } from '@/store/buildStore';
import { loadWeaponCalc } from '@/lib/data';
import { calcBaseDamage, applyCritDamage } from '@/lib/calc';
import type { WeaponCalcData } from '@/types/data';
import type { WeaponType, StatBlock, WeaponStats } from '@/types/calc';

/**
 * 拡張武器ステータス（会心率・会心ダメージを含む）
 */
interface ExtendedWeaponStats {
  attackPower: number;
  magicPower: number;
  critRate: number;
  critDamage: number;
}

/**
 * 火力計算セクションのプロパティ
 * 敵防御力のデフォルト値を外部から指定可能
 */
interface DamageCalculationSectionProps {
  /** 敵防御力のデフォルト値 */
  defaultEnemyDefense?: number;
}

/**
 * 火力計算結果の型定義
 */
interface DamageCalculationResult {
  /** 基礎ダメージ */
  baseDamage: number;
  /** 会心時ダメージ */
  critDamage: number;
  /** 非会心時ダメージ */
  noCritDamage: number;
  /** 期待値ダメージ */
  expectedDamage: number;
  /** 敵防御後のダメージ（期待値） */
  finalDamage: number;
}

/**
 * 武器種をYAML形式の名前に変換する
 * @param weaponType - 内部武器種（例: 'sword', 'greatsword'）
 * @returns YAML形式の武器種名（例: 'Sword', 'GreatSword'）
 */
function convertWeaponTypeToYamlFormat(weaponType: string): string {
  const mapping: Record<string, string> = {
    'sword': 'Sword',
    'greatsword': 'GreatSword',
    'dagger': 'Dagger',
    'axe': 'Axe',
    'spear': 'Spear',
    'bow': 'Bow',
    'staff': 'Wand',
    'wand': 'Wand',
    'frypan': 'Frypan',
    'mace': 'Sword', // マスはデフォルトで剣扱い
    'katana': 'Sword', // 刀はデフォルトで剣扱い
    'fist': 'Sword', // 拳はデフォルトで剣扱い
  };

  return mapping[weaponType.toLowerCase()] || 'Sword';
}

/**
 * 火力計算セクションコンポーネント
 * ビルドページ下部に表示され、現在の装備・ステータスから計算される
 * 基礎ダメージ、会心時ダメージ、期待値ダメージを表示する
 */
export function DamageCalculationSection({
  defaultEnemyDefense = 100,
}: DamageCalculationSectionProps) {
  // ストアから必要なデータを取得
  const { currentBuild, calculatedStats } = useBuildStore();

  // WeaponCalcデータの状態管理
  const [weaponCalc, setWeaponCalc] = useState<WeaponCalcData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 敵防御力の状態管理
  const [enemyDefense, setEnemyDefense] = useState(defaultEnemyDefense);

  // WeaponCalcデータの読み込み
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await loadWeaponCalc();
        if (isMounted) {
          setWeaponCalc(data);
        }
      } catch (err) {
        if (isMounted) {
          console.error('WeaponCalcの読み込みに失敗しました:', err);
          setError('計算式データの読み込みに失敗しました');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * 武器のステータスを取得する
   * 装備からbaseStatsを読み取り、ExtendedWeaponStats形式に変換
   */
  const getWeaponStats = useCallback((): ExtendedWeaponStats => {
    const weapon = currentBuild.equipment.weapon;
    if (!weapon) {
      return { attackPower: 0, magicPower: 0, critRate: 0, critDamage: 0 };
    }

    // 武器のbaseStatsからステータスを抽出
    let attackPower = 0;
    let magicPower = 0;
    let critRate = 0;
    let critDamage = 0;

    for (const effect of weapon.baseStats) {
      switch (effect.stat) {
        case 'ATK':
          attackPower = effect.value;
          break;
        case 'MATK':
          magicPower = effect.value;
          break;
        case 'CRI':
          critRate = effect.value;
          break;
        case 'DEX':
          // DEXは会心ダメージとして扱われる場合がある
          critDamage = effect.value;
          break;
      }
    }

    return {
      attackPower,
      magicPower,
      critRate,
      critDamage,
    };
  }, [currentBuild.equipment.weapon]);

  /**
   * ユーザーステータスをStatBlock形式に変換
   */
  const getUserStats = useCallback((): StatBlock => {
    const total = calculatedStats.total;
    return {
      HP: total.HP || 0,
      ATK: total.ATK || 0,
      MATK: total.MATK || 0,
      DEF: total.DEF || 0,
      MDEF: total.MDEF || 0,
      AGI: total.AGI || 0,
      DEX: total.DEX || 0,
      CRI: total.CRI || 0,
      HIT: total.HIT || 0,
      FLEE: total.FLEE || 0,
    };
  }, [calculatedStats.total]);

  /**
   * ダメージ計算を実行
   * useMemoで計算結果をキャッシュし、依存値が変わったときのみ再計算
   */
  const damageResult = useMemo<DamageCalculationResult | null>(() => {
    // 必要なデータが揃っていない場合はnullを返す
    if (!weaponCalc || !currentBuild.equipment.weapon) {
      return null;
    }

    try {
      const weapon = currentBuild.equipment.weapon;
      const weaponType = convertWeaponTypeToYamlFormat(
        weapon.weaponType || 'sword'
      ) as WeaponType;

      const weaponStats = getWeaponStats();
      const userStats = getUserStats();

      // 基礎ダメージを計算（WeaponStats型へキャスト）
      const baseDamage = calcBaseDamage(
        weaponType,
        weaponStats as WeaponStats,
        userStats,
        weaponCalc,
        1.0, // ダメージ補正（平均）
        1.0  // コンボ補正
      );

      // 会心率と会心ダメージを取得
      const critRate = (weaponStats.critRate || 0) + (userStats.CRI || 0);
      const critDamageBonus = (weaponStats.critDamage || 0) + ((userStats.DEX || 0) * 0.5);

      // 会心時ダメージ（基礎ダメージ * (1.5 + クリダメボーナス/100)）
      const critDamage = applyCritDamage(baseDamage, critRate, critDamageBonus, 'crit');

      // 非会心時ダメージ
      const noCritDamage = applyCritDamage(baseDamage, critRate, critDamageBonus, 'nocrit');

      // 期待値ダメージ（会心率を考慮した平均）
      const expectedDamage = applyCritDamage(baseDamage, critRate, critDamageBonus, 'avg');

      // 敵防御後のダメージ（簡易計算: ダメージ - 防御/2、最低1ダメージ）
      const finalDamage = Math.max(1, Math.floor(expectedDamage - enemyDefense / 2));

      return {
        baseDamage,
        critDamage,
        noCritDamage,
        expectedDamage,
        finalDamage,
      };
    } catch (err) {
      console.error('ダメージ計算エラー:', err);
      return null;
    }
  }, [
    weaponCalc,
    currentBuild.equipment.weapon,
    enemyDefense,
    getWeaponStats,
    getUserStats,
  ]);

  /**
   * 敵防御力の入力ハンドラ
   */
  const handleEnemyDefenseChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value >= 0) {
        setEnemyDefense(value);
      }
    },
    []
  );

  // 読み込み中の表示
  if (isLoading) {
    return (
      <section className="mt-12 p-6 rounded-xl bg-gradient-to-br from-red-900/20 to-orange-900/20 border border-red-500/30">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <svg
            className="w-6 h-6 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          火力計算
        </h2>
        <div className="flex items-center justify-center py-8">
          <p className="text-gray-400">計算式データを読み込み中...</p>
        </div>
      </section>
    );
  }

  // エラー表示
  if (error) {
    return (
      <section className="mt-12 p-6 rounded-xl bg-gradient-to-br from-red-900/20 to-orange-900/20 border border-red-500/30">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <svg
            className="w-6 h-6 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          火力計算
        </h2>
        <div className="flex items-center justify-center py-8">
          <p className="text-red-400">{error}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-12 p-6 rounded-xl bg-gradient-to-br from-red-900/20 to-orange-900/20 border border-red-500/30">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
        <svg
          className="w-6 h-6 text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
        火力計算
      </h2>

      {/* 武器が装備されていない場合 */}
      {!currentBuild.equipment.weapon && (
        <div className="text-center py-8">
          <svg
            className="w-12 h-12 mx-auto mb-3 text-gray-500 opacity-50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="text-gray-400">武器を装備してください</p>
        </div>
      )}

      {/* 武器が装備されている場合 */}
      {currentBuild.equipment.weapon && damageResult && (
        <div className="space-y-6">
          {/* 敵防御力入力 */}
          <div className="flex items-center gap-4 mb-4">
            <label className="text-sm text-gray-400">敵防御力:</label>
            <input
              type="number"
              min={0}
              value={enemyDefense}
              onChange={handleEnemyDefenseChange}
              className="w-24 px-3 py-2 bg-glass-dark rounded-lg border border-gray-600 text-white text-sm focus:border-red-500 focus:outline-none"
            />
          </div>

          {/* ダメージ表示グリッド */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 基礎ダメージ */}
            <div className="p-4 bg-glass-dark rounded-lg">
              <h3 className="text-sm text-gray-400 mb-1">基礎ダメージ</h3>
              <p className="text-2xl font-bold text-white">
                {damageResult.baseDamage.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                (会心・補正前)
              </p>
            </div>

            {/* 会心時 */}
            <div className="p-4 bg-glass-dark rounded-lg">
              <h3 className="text-sm text-gray-400 mb-1">会心時</h3>
              <p className="text-2xl font-bold text-yellow-400">
                {damageResult.critDamage.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                (会心発生時のダメージ)
              </p>
            </div>

            {/* 期待値 */}
            <div className="p-4 bg-glass-dark rounded-lg">
              <h3 className="text-sm text-gray-400 mb-1">期待値</h3>
              <p className="text-2xl font-bold text-green-400">
                {damageResult.expectedDamage.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                (会心率考慮の平均)
              </p>
            </div>
          </div>

          {/* 最終ダメージ（敵防御後） */}
          <div className="p-4 bg-gradient-to-r from-red-900/30 to-orange-900/30 rounded-lg border border-red-500/20">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm text-gray-400 mb-1">
                  敵防御後のダメージ (期待値)
                </h3>
                <p className="text-3xl font-bold text-red-400">
                  {damageResult.finalDamage.toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">
                  計算式: ダメージ - (防御 / 2)
                </p>
                <p className="text-xs text-gray-500">
                  防御力: {enemyDefense}
                </p>
              </div>
            </div>
          </div>

          {/* 非会心時ダメージ（補足情報） */}
          <div className="text-xs text-gray-500 mt-2">
            <p>
              ※ 非会心時ダメージ: {damageResult.noCritDamage.toLocaleString()}
            </p>
            <p>
              ※ 武器種: {currentBuild.equipment.weapon.weaponType || '不明'}
            </p>
          </div>
        </div>
      )}

      {/* 計算エラー時 */}
      {currentBuild.equipment.weapon && !damageResult && (
        <div className="text-center py-8">
          <p className="text-yellow-400">
            ダメージ計算に必要なデータが不足しています
          </p>
        </div>
      )}
    </section>
  );
}
