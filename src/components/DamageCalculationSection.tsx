'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useBuildStore } from '@/store/buildStore';
import { loadWeaponCalc } from '@/lib/data';
import { calcBaseDamage, applyJobCorrection } from '@/lib/calc';
import { convertJobNameToYAML } from '@/constants/jobMappings';
import { SkillCalculationSection } from './SkillCalculationSection';
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
  /** 基礎最大ダメージ（敵パラメータ未適用） */
  baseMaxDamage: number;
  /** 基礎期待値（敵パラメータ未適用） */
  baseExpectedDamage: number;
  /** 基礎DPS（敵パラメータ未適用） */
  baseDps: number;
  /** 最終最大ダメージ（敵パラメータ適用後） */
  maxDamage: number;
  /** 最終期待値（敵パラメータ適用後） */
  expectedDamage: number;
  /** 最終DPS（敵パラメータ適用後） */
  dps: number;
  /** 武器CT（秒） */
  coolTime: number;
  /** 会心率（%） */
  critRate: number;
  /** ダメージ補正範囲 */
  damageCorrectionRange: { min: number; max: number; avg: number };
  /** 敵防御力 */
  enemyDefense: number;
  /** 敵攻撃耐性（%） */
  enemyAttackResistance: number;
  /** 敵属性耐性（%） */
  enemyElementResistance: number;
  /** 敵耐性倍率 */
  resistanceMultiplier: number;
  /** 敵ステータスが設定されているか */
  hasEnemyStats: boolean;
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
 * 武器種ごとのUserCritDamage係数を取得する
 * WeaponCalc.yamlの各武器種の式に基づく
 */
function getUserCritDamageCoefficient(weaponType: string): number {
  const coefficients: Record<string, number> = {
    'Sword': 0.005,
    'Wand': 0.0016,
    'Bow': 0.0016,
    'Axe': 0.001,
    'GreatSword': 0.001,
    'Dagger': 0.0015,
    'Spear': 0.001 / 3, // 槍は÷3で適用される
    'Frypan': 0.005,
  };

  return coefficients[weaponType] || 0.005;
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

// 内部サブタブタイプ
type DamageSubTab = 'normal' | 'skill';

/**
 * 火力計算セクションコンポーネント
 * 通常攻撃とスキル計算を統合
 */
export function DamageCalculationSection() {
  // サブタブ状態
  const [subTab, setSubTab] = useState<DamageSubTab>('normal');

  // ストアから必要なデータを取得
  const { currentBuild, calculatedStats, weaponStats: storeWeaponStats, enemyStats, tarotBonusStats, attackElement, setAttackElement } = useBuildStore();

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
   * 武器のステータスを取得する（タロットボーナス込み）
   */
  const getWeaponStats = useCallback((): ExtendedWeaponStats => {
    // タロットからの武器ステータスボーナス
    const tarotCritRate = tarotBonusStats?.CritR || 0;
    const tarotCritDamage = tarotBonusStats?.CritD || 0;
    const tarotAttackP = tarotBonusStats?.AttackP || 0;

    if (storeWeaponStats) {
      return {
        attackPower: (storeWeaponStats.attackPower || 0) + tarotAttackP,
        magicPower: (storeWeaponStats.attackPower || 0) + tarotAttackP,
        critRate: (storeWeaponStats.critRate || 0) + tarotCritRate,
        critDamage: (storeWeaponStats.critDamage || 0) + tarotCritDamage,
      };
    }

    const weapon = currentBuild.equipment.weapon;
    if (!weapon) {
      return { attackPower: tarotAttackP, magicPower: tarotAttackP, critRate: tarotCritRate, critDamage: tarotCritDamage };
    }

    let attackPower = tarotAttackP;
    let magicPower = tarotAttackP;
    let critRate = tarotCritRate;
    let critDamage = tarotCritDamage;

    for (const effect of weapon.baseStats) {
      switch (effect.stat) {
        case 'ATK':
          attackPower += effect.value;
          break;
        case 'MATK':
          magicPower += effect.value;
          break;
        case 'CRI':
          critRate += effect.value;
          break;
        case 'DEX':
          critDamage += effect.value;
          break;
      }
    }

    return { attackPower, magicPower, critRate, critDamage };
  }, [storeWeaponStats, currentBuild.equipment.weapon, tarotBonusStats]);

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
   * タロットダメージバフ倍率を計算
   * 計算式: (1 + AttackBuff.<Attack>/100) * (1 + ElementBuff.<Element>/100) * (1 + AllBuff/100)
   */
  const getTarotDamageBuffMultiplier = useCallback((isPhysical: boolean): number => {
    if (!tarotBonusStats) return 1;

    // 攻撃種別バフ（物理 or 魔法）
    const attackBuff = isPhysical
      ? (tarotBonusStats['AttackBuff.Physical'] || 0)
      : (tarotBonusStats['AttackBuff.Magic'] || 0);

    // 全ダメージバフ
    const allBuff = tarotBonusStats.AllBuff || 0;

    // 属性バフ（選択された攻撃属性に基づく）
    const elementBuffKey = `ElementBuff.${attackElement}` as keyof typeof tarotBonusStats;
    const elementBuff = (tarotBonusStats[elementBuffKey] as number) || 0;

    // 乗算合成: (1 + attackBuff%) * (1 + elementBuff%) * (1 + allBuff%)
    return (1 + attackBuff / 100) * (1 + elementBuff / 100) * (1 + allBuff / 100);
  }, [tarotBonusStats, attackElement]);

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
        weapon.weaponType || storeWeaponStats?.weaponType || 'sword'
      ) as WeaponType;

      const weaponStats = getWeaponStats();
      const userStats = getUserStats();

      // 武器のダメージ補正（CSVの値、例: 80 = 80%）+ タロットのダメージ補正
      const tarotDamageC = tarotBonusStats?.DamageC || 0;
      const baseDamageCorrection = ((storeWeaponStats?.damageCorrection || 100) + tarotDamageC) / 100;

      // ダメージ補正の範囲（武器のダメージ補正 ~ 100%）
      const correctionMin = baseDamageCorrection;
      const correctionMax = 1.0;
      const correctionAvg = (correctionMin + correctionMax) / 2;

      // 会心率
      const totalCritRate = Math.min(100, userStats.CRI || 0);

      // 最大ダメージ（ダメージ補正100%、会心発生時）
      const maxDamageCorrection = 1.0;
      let maxDamage = calcBaseDamage(
        weaponType,
        weaponStats as WeaponStats,
        userStats,
        weaponCalc,
        maxDamageCorrection,
        1.0
      );

      // 職業補正を適用
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

      // 会心倍率計算
      const userCritDamageCoeff = getUserCritDamageCoefficient(weaponType);
      const critMultiplier = 1 + (weaponStats.critDamage || 0) / 100 + (userStats.HIT || 0) * userCritDamageCoeff;

      // 非会心時のダメージ
      const nonCritDamage = maxDamage / critMultiplier;

      // 期待値計算
      const critRateDecimal = totalCritRate / 100;
      const expectedDamageAtMaxCorrection = nonCritDamage * (1 - critRateDecimal) + maxDamage * critRateDecimal;

      // 平均ダメージ補正を適用
      const expectedDamageBeforeBuff = Math.floor(expectedDamageAtMaxCorrection * correctionAvg);

      // 武器種から物理/魔法を判定（杖は魔法、それ以外は物理）
      const isPhysical = weaponType !== 'Wand';

      // タロットダメージバフ倍率を取得・適用
      const tarotBuffMultiplier = getTarotDamageBuffMultiplier(isPhysical);
      const maxDamageWithBuff = Math.floor(maxDamage * tarotBuffMultiplier);
      const expectedDamage = Math.floor(expectedDamageBeforeBuff * tarotBuffMultiplier);

      // 基礎ダメージ（敵パラメータ未適用、タロットバフ適用後）
      const baseMaxDamage = maxDamageWithBuff;
      const baseExpectedDamage = expectedDamage;

      // 敵パラメータの取得
      const enemyDefense = enemyStats?.defense || 0;
      const enemyAttackResistance = enemyStats?.attackResistance || 0;
      const enemyElementResistance = enemyStats?.elementResistance || 0;

      // 敵ステータスが設定されているかの判定
      const hasEnemyStats = enemyDefense > 0 || enemyAttackResistance !== 0 || enemyElementResistance !== 0;

      // 敵の守備力を適用（ダメージから守備力/2を減算、最低1）
      const defenseReduction = Math.floor(enemyDefense / 2);
      const maxDamageAfterDefense = Math.max(1, baseMaxDamage - defenseReduction);
      const expectedDamageAfterDefense = Math.max(1, baseExpectedDamage - defenseReduction);

      // 敵の耐性を適用
      const attackResistanceMultiplier = (100 - enemyAttackResistance) / 100;
      const elementMultiplier = (100 - enemyElementResistance) / 100;
      const totalResistanceMultiplier = attackResistanceMultiplier * elementMultiplier;

      const finalMaxDamage = Math.floor(maxDamageAfterDefense * totalResistanceMultiplier);
      const finalExpectedDamage = Math.floor(expectedDamageAfterDefense * totalResistanceMultiplier);

      // 武器CT（秒）
      const coolTime = storeWeaponStats?.coolTime || 0;

      // DPS計算
      const baseDps = coolTime > 0 ? Math.floor(baseExpectedDamage / coolTime) : 0;
      const dps = coolTime > 0 ? Math.floor(finalExpectedDamage / coolTime) : 0;

      return {
        baseMaxDamage,
        baseExpectedDamage,
        baseDps,
        maxDamage: finalMaxDamage,
        expectedDamage: finalExpectedDamage,
        dps,
        coolTime,
        critRate: totalCritRate,
        damageCorrectionRange: {
          min: Math.round(correctionMin * 100),
          max: Math.round(correctionMax * 100),
          avg: Math.round(correctionAvg * 100),
        },
        enemyDefense,
        enemyAttackResistance,
        enemyElementResistance,
        resistanceMultiplier: totalResistanceMultiplier,
        hasEnemyStats,
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
    enemyStats,
    getTarotDamageBuffMultiplier,
    tarotBonusStats,
  ]);

  // 読み込み中の表示
  if (isLoading) {
    return (
      <section className="p-6 rounded-xl bg-gradient-to-br from-red-900/20 to-orange-900/20 border border-red-500/30">
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
      <section className="p-6 rounded-xl bg-gradient-to-br from-red-900/20 to-orange-900/20 border border-red-500/30">
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
    <section className="p-6 rounded-xl bg-gradient-to-br from-red-900/20 to-orange-900/20 border border-red-500/30">
      {/* ヘッダー */}
      <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
        <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        火力計算
      </h2>

      {/* サブタブ切り替え */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setSubTab('normal')}
          className={`min-w-[120px] px-4 py-2 rounded-lg font-medium transition-all ${
            subTab === 'normal'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50 hover:text-gray-300'
          }`}
        >
          ⚔️ 通常攻撃
        </button>
        <button
          onClick={() => setSubTab('skill')}
          className={`min-w-[120px] px-4 py-2 rounded-lg font-medium transition-all ${
            subTab === 'skill'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50 hover:text-gray-300'
          }`}
        >
          ✨ スキル
        </button>
      </div>

      {/* コンテンツエリア（切り替え時のちらつき防止のため最小高さを設定） */}
      <div className="min-h-[140px]">
        {/* 通常攻撃タブ */}
        {subTab === 'normal' && (
          <>
          {/* 職業/武器が未設定の場合 */}
          {(!currentBuild.job || !currentBuild.equipment.weapon) && (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p>職業と武器を選択してください</p>
            </div>
          )}

          {/* 職業と武器が設定されている場合 */}
          {currentBuild.job && currentBuild.equipment.weapon && damageResult && (
            <div className="space-y-4">
              {/* 基礎ダメージ表示グリッド */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 最大ダメージ */}
                <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-600/40">
                  <h3 className="text-sm text-slate-400 mb-1">最大ダメージ</h3>
                  <p className="text-2xl font-bold text-red-400">
                    {damageResult.baseMaxDamage.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    ダメ補正100% / 会心発生時
                  </p>
                </div>

                {/* 期待値 */}
                <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-600/40">
                  <h3 className="text-sm text-slate-400 mb-1">期待値</h3>
                  <p className="text-2xl font-bold text-orange-400">
                    {damageResult.baseExpectedDamage.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    ダメ補正{damageResult.damageCorrectionRange.avg}% / 会心率{damageResult.critRate}%考慮
                  </p>
                </div>

                {/* DPS */}
                <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-600/40">
                  <h3 className="text-sm text-slate-400 mb-1">DPS</h3>
                  <p className="text-2xl font-bold text-amber-400">
                    {damageResult.baseDps > 0 ? damageResult.baseDps.toLocaleString() : '-'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {damageResult.coolTime > 0
                      ? `CT: ${damageResult.coolTime.toFixed(2)}秒`
                      : 'CT情報なし'}
                  </p>
                </div>
              </div>

              {/* 敵ステータス考慮後のダメージ表示（敵パラメータが設定されている場合のみ） */}
              {damageResult.hasEnemyStats && (
                <div className="p-4 bg-slate-800/80 border border-cyan-600/40 rounded-lg">
                  <h4 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                    <span>🎯</span>
                    最終ダメージ（敵ステータス考慮）
                  </h4>
                  <p className="text-xs text-slate-400 mb-3">
                    守備力: {damageResult.enemyDefense} / 攻撃耐性: {damageResult.enemyAttackResistance}% / 属性耐性: {damageResult.enemyElementResistance}%
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-700/50 rounded-lg">
                      <p className="text-xs text-cyan-400 mb-1">最大ダメージ</p>
                      <p className="text-2xl font-bold text-cyan-300">
                        {damageResult.maxDamage.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-700/50 rounded-lg">
                      <p className="text-xs text-cyan-400 mb-1">期待値</p>
                      <p className="text-2xl font-bold text-cyan-300">
                        {damageResult.expectedDamage.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-700/50 rounded-lg">
                      <p className="text-xs text-cyan-400 mb-1">DPS</p>
                      <p className="text-2xl font-bold text-cyan-300">
                        {damageResult.dps > 0 ? damageResult.dps.toLocaleString() : '-'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 攻撃属性選択 */}
              <div className="p-3 bg-glass-dark/50 rounded-lg mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400">攻撃属性:</span>
                  <select
                    value={attackElement}
                    onChange={(e) => setAttackElement(e.target.value as typeof attackElement)}
                    className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  >
                    <option value="None">無</option>
                    <option value="Light">光</option>
                    <option value="Dark">闇</option>
                    <option value="Wind">風</option>
                    <option value="Fire">炎</option>
                    <option value="Water">水</option>
                    <option value="Thunder">雷</option>
                  </select>
                  {tarotBonusStats && (tarotBonusStats[`ElementBuff.${attackElement}` as keyof typeof tarotBonusStats] as number) > 0 && (
                    <span className="text-xs text-purple-400">
                      (タロット属性バフ: +{tarotBonusStats[`ElementBuff.${attackElement}` as keyof typeof tarotBonusStats]}%)
                    </span>
                  )}
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
          {currentBuild.job && currentBuild.equipment.weapon && !damageResult && (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-yellow-400">
                ダメージ計算に必要なデータが不足しています
              </p>
            </div>
          )}
          </>
        )}

        {/* スキルタブ */}
        {subTab === 'skill' && (
          <SkillCalculationSection embedded />
        )}
      </div>
    </section>
  );
}
