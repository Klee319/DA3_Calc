'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useBuildStore } from '@/store/buildStore';
import { loadWeaponCalc } from '@/lib/data';
import { calcBaseDamage, applyJobCorrection } from '@/lib/calc';
import { convertJobNameToYAML } from '@/constants/jobMappings';
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
 * 火力計算結果の型定義
 */
interface DamageCalculationResult {
  /** 最大ダメージ（ダメージ補正100%、会心発生時） */
  maxDamage: number;
  /** 期待値（ダメージ補正乱数・会心率考慮） */
  expectedDamage: number;
  /** DPS（期待値 / CT） */
  dps: number;
  /** 武器CT（秒） */
  coolTime: number;
  /** 会心率（%） */
  critRate: number;
  /** ダメージ補正範囲 */
  damageCorrectionRange: { min: number; max: number; avg: number };
}

/**
 * 武器種をYAML形式の名前に変換する
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
    'mace': 'Sword',
    'katana': 'Sword',
    'fist': 'Sword',
  };

  return mapping[weaponType.toLowerCase()] || 'Sword';
}

/**
 * 武器種を日本語名に変換する
 */
function convertWeaponTypeToJapanese(weaponType: string): string {
  const mapping: Record<string, string> = {
    'sword': '剣',
    'greatsword': '大剣',
    'dagger': '短剣',
    'axe': '斧',
    'spear': '槍',
    'bow': '弓',
    'staff': '杖',
    'wand': '杖',
    'frypan': 'フライパン',
    'mace': 'メイス',
    'katana': '刀',
    'fist': '拳',
  };

  return mapping[weaponType.toLowerCase()] || weaponType;
}

/**
 * 火力計算セクションコンポーネント
 * 最大ダメージ、期待値、DPSを表示
 */
export function DamageCalculationSection() {
  // ストアから必要なデータを取得
  const { currentBuild, calculatedStats, weaponStats: storeWeaponStats } = useBuildStore();

  // 現在の職業名をYAML形式に変換
  const jobName = currentBuild.job ? convertJobNameToYAML(currentBuild.job.id) : null;

  // WeaponCalcデータの状態管理
  const [weaponCalc, setWeaponCalc] = useState<WeaponCalcData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
   */
  const getWeaponStats = useCallback((): ExtendedWeaponStats => {
    if (storeWeaponStats) {
      return {
        attackPower: storeWeaponStats.attackPower || 0,
        magicPower: storeWeaponStats.attackPower || 0,
        critRate: storeWeaponStats.critRate || 0,
        critDamage: storeWeaponStats.critDamage || 0,
      };
    }

    const weapon = currentBuild.equipment.weapon;
    if (!weapon) {
      return { attackPower: 0, magicPower: 0, critRate: 0, critDamage: 0 };
    }

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
          critDamage = effect.value;
          break;
      }
    }

    return { attackPower, magicPower, critRate, critDamage };
  }, [storeWeaponStats, currentBuild.equipment.weapon]);

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
   */
  const damageResult = useMemo<DamageCalculationResult | null>(() => {
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

      // 武器のダメージ補正（CSVの値、例: 80 = 80%）
      const baseDamageCorrection = (storeWeaponStats?.damageCorrection || 100) / 100;

      // ダメージ補正の範囲（武器のダメージ補正 ~ 100%）
      // 例: 武器が80%なら 80%~100%の範囲で乱数
      const correctionMin = baseDamageCorrection;
      const correctionMax = 1.0;
      const correctionAvg = (correctionMin + correctionMax) / 2;

      // 会心率（武器 + ユーザー）
      const totalCritRate = Math.min(100, (weaponStats.critRate || 0) + (userStats.CRI || 0));

      // 最大ダメージ（ダメージ補正100%、会心発生時）
      // ダメージ補正100%とは、補正範囲の最大値（1.2倍）ではなく、ダメージ補正が100%（1.0）の状態
      const maxDamageCorrection = 1.0;
      let maxDamage = calcBaseDamage(
        weaponType,
        weaponStats as WeaponStats,
        userStats,
        weaponCalc,
        maxDamageCorrection,
        1.0
      );

      // 職業補正を適用（職業固有式またはBonus係数）
      if (jobName) {
        maxDamage = applyJobCorrection(
          maxDamage,
          jobName,
          weaponType,
          weaponStats as WeaponStats,
          userStats,
          weaponCalc,
          maxDamageCorrection
        );
      }

      // 非会心ダメージを計算するために、会心ダメージ部分を除外した係数を計算
      // YAML式: (base) * DamageCorrection * (1 + WeaponCritDamage/100 + UserCritDamage*0.005)
      // 会心倍率 = (1 + WeaponCritDamage/100 + UserCritDamage*0.005)
      const critMultiplier = 1 + (weaponStats.critDamage || 0) / 100 + (userStats.HIT || 0) * 0.005;

      // 非会心時のダメージ（会心ダメージ部分を除外）
      // 非会心時は critMultiplier が 1.0 と仮定
      const nonCritDamage = maxDamage / critMultiplier;

      // 期待値計算
      // E[damage] = avgCorrection × (nonCritDamage × (1 - critRate) + critDamage × critRate)
      const critRateDecimal = totalCritRate / 100;
      const expectedDamageAtMaxCorrection = nonCritDamage * (1 - critRateDecimal) + maxDamage * critRateDecimal;

      // 平均ダメージ補正を適用
      const expectedDamage = Math.floor(expectedDamageAtMaxCorrection * correctionAvg);

      // 武器CT（秒）- CSVは秒単位で保存されている
      const coolTime = storeWeaponStats?.coolTime || 0;

      // DPS計算（CT が 0 の場合は計算しない）
      const dps = coolTime > 0 ? Math.floor(expectedDamage / coolTime) : 0;

      return {
        maxDamage: Math.floor(maxDamage),
        expectedDamage,
        dps,
        coolTime,
        critRate: totalCritRate,
        damageCorrectionRange: {
          min: Math.round(correctionMin * 100),
          max: Math.round(correctionMax * 100),
          avg: Math.round(correctionAvg * 100),
        },
      };
    } catch (err) {
      console.error('ダメージ計算エラー:', err);
      return null;
    }
  }, [
    weaponCalc,
    currentBuild.equipment.weapon,
    storeWeaponStats,
    getWeaponStats,
    getUserStats,
    jobName,
  ]);

  // 読み込み中の表示
  if (isLoading) {
    return (
      <section className="mt-12 p-6 rounded-xl bg-gradient-to-br from-red-900/20 to-orange-900/20 border border-red-500/30">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
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
          <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
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
        <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        火力計算
      </h2>

      {/* 武器が装備されていない場合 */}
      {!currentBuild.equipment.weapon && (
        <div className="text-center py-8">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-500 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-gray-400">武器を装備してください</p>
        </div>
      )}

      {/* 武器が装備されている場合 */}
      {currentBuild.equipment.weapon && damageResult && (
        <div className="space-y-4">
          {/* 3つのダメージ表示グリッド */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 最大ダメージ */}
            <div className="p-4 bg-gradient-to-r from-yellow-900/30 to-orange-900/30 rounded-lg border border-yellow-500/20">
              <h3 className="text-sm text-gray-400 mb-1">最大ダメージ</h3>
              <p className="text-2xl font-bold text-yellow-400">
                {damageResult.maxDamage.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                ダメ補正100% / 会心発生時
              </p>
            </div>

            {/* 期待値 */}
            <div className="p-4 bg-gradient-to-r from-green-900/30 to-teal-900/30 rounded-lg border border-green-500/20">
              <h3 className="text-sm text-gray-400 mb-1">期待値</h3>
              <p className="text-2xl font-bold text-green-400">
                {damageResult.expectedDamage.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                ダメ補正{damageResult.damageCorrectionRange.avg}% / 会心率{damageResult.critRate}%考慮
              </p>
            </div>

            {/* DPS */}
            <div className="p-4 bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-lg border border-purple-500/20">
              <h3 className="text-sm text-gray-400 mb-1">DPS</h3>
              <p className="text-2xl font-bold text-purple-400">
                {damageResult.dps > 0 ? damageResult.dps.toLocaleString() : '-'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {damageResult.coolTime > 0
                  ? `CT: ${damageResult.coolTime.toFixed(2)}秒`
                  : 'CT情報なし'}
              </p>
            </div>
          </div>

          {/* 補足情報 */}
          <div className="p-3 bg-glass-dark/50 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-400">
              <div>
                <span className="text-gray-500">武器種:</span>{' '}
                <span className="text-white">
                  {convertWeaponTypeToJapanese(currentBuild.equipment.weapon.weaponType || '')}
                </span>
              </div>
              <div>
                <span className="text-gray-500">ダメ補正範囲:</span>{' '}
                <span className="text-white">
                  {damageResult.damageCorrectionRange.min}%〜{damageResult.damageCorrectionRange.max}%
                </span>
              </div>
              <div>
                <span className="text-gray-500">会心率:</span>{' '}
                <span className="text-white">{damageResult.critRate}%</span>
              </div>
              <div>
                <span className="text-gray-500">武器CT:</span>{' '}
                <span className="text-white">
                  {damageResult.coolTime > 0 ? `${(damageResult.coolTime * 1000).toFixed(0)}ms` : '-'}
                </span>
              </div>
            </div>
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
