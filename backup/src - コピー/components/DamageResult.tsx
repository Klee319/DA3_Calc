'use client';

import React, { useState } from 'react';
import { Tooltip } from '@/components/ui/Tooltip';

interface DamageResultProps {
  damagePerHit: number;
  totalDamage: number;
  dps: number;
  mpEfficiency: number;
  criticalRate?: number;
  criticalDamage?: number;
  hits?: number;
  mpCost?: number;
  cooldown?: number;
  calculationDetails?: {
    baseDamage: number;
    attackPower: number;
    defense: number;
    skillMultiplier: number;
    criticalMultiplier: number;
    elementMultiplier: number;
    speciesMultiplier: number;
    buffMultiplier: number;
    finalMultiplier: number;
  };
  className?: string;
}

export const DamageResult: React.FC<DamageResultProps> = ({
  damagePerHit,
  totalDamage,
  dps,
  mpEfficiency,
  criticalRate = 0,
  criticalDamage = 0,
  hits = 1,
  mpCost = 0,
  cooldown = 0,
  calculationDetails,
  className = '',
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toLocaleString();
  };

  const getDamageColor = (damage: number): string => {
    if (damage >= 100000) return 'text-purple-600 dark:text-purple-400';
    if (damage >= 50000) return 'text-red-600 dark:text-red-400';
    if (damage >= 10000) return 'text-orange-600 dark:text-orange-400';
    if (damage >= 5000) return 'text-yellow-600 dark:text-yellow-400';
    if (damage >= 1000) return 'text-green-600 dark:text-green-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const getEfficiencyColor = (efficiency: number): string => {
    if (efficiency >= 100) return 'text-purple-600 dark:text-purple-400';
    if (efficiency >= 50) return 'text-green-600 dark:text-green-400';
    if (efficiency >= 20) return 'text-yellow-600 dark:text-yellow-400';
    if (efficiency >= 10) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className={`p-6 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* メインダメージ表示 */}
      <div className="text-center mb-6">
        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
          1発ダメージ
        </h3>
        <div className={`text-5xl font-bold ${getDamageColor(damagePerHit)}`}>
          {formatNumber(damagePerHit)}
        </div>
        {criticalRate > 0 && (
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            会心時: <span className="font-bold text-yellow-600 dark:text-yellow-400">
              {formatNumber(criticalDamage)}
            </span>
            <span className="ml-2 text-xs">({criticalRate}%)</span>
          </div>
        )}
      </div>

      {/* サブステータス */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* 総ダメージ */}
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
            総ダメージ
          </div>
          <div className={`text-2xl font-bold ${getDamageColor(totalDamage)}`}>
            {formatNumber(totalDamage)}
          </div>
          {hits > 1 && (
            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {hits}ヒット
            </div>
          )}
        </div>

        {/* DPS */}
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
            DPS
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {formatNumber(dps)}
          </div>
          {cooldown > 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              CT: {cooldown}秒
            </div>
          )}
        </div>

        {/* MP効率 */}
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
            MP効率
          </div>
          <div className={`text-2xl font-bold ${getEfficiencyColor(mpEfficiency)}`}>
            {mpEfficiency.toFixed(1)}
          </div>
          {mpCost > 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              MP: {mpCost}
            </div>
          )}
        </div>
      </div>

      {/* 計算内訳アコーディオン */}
      {calculationDetails && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between text-left"
          >
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              計算内訳
            </span>
            <svg
              className={`w-5 h-5 text-gray-400 transform transition-transform ${showDetails ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showDetails && (
            <div className="mt-4 space-y-3 text-sm">
              {/* 基本計算 */}
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                  基本ダメージ計算
                </h4>
                <div className="space-y-1 text-gray-600 dark:text-gray-400">
                  <div className="flex justify-between">
                    <span>攻撃力:</span>
                    <span className="font-mono">{calculationDetails.attackPower}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>敵防御力:</span>
                    <span className="font-mono">- {calculationDetails.defense}</span>
                  </div>
                  <div className="border-t pt-1 mt-1">
                    <div className="flex justify-between font-medium">
                      <span>基本ダメージ:</span>
                      <span className="font-mono text-gray-800 dark:text-gray-200">
                        {calculationDetails.baseDamage}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 倍率計算 */}
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                  倍率計算
                </h4>
                <div className="space-y-1 text-gray-600 dark:text-gray-400">
                  <div className="flex justify-between">
                    <span>スキル倍率:</span>
                    <span className="font-mono">× {calculationDetails.skillMultiplier.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>会心補正:</span>
                    <span className="font-mono">× {calculationDetails.criticalMultiplier.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>属性補正:</span>
                    <span className={`font-mono ${calculationDetails.elementMultiplier > 1 ? 'text-green-600' : calculationDetails.elementMultiplier < 1 ? 'text-red-600' : ''}`}>
                      × {calculationDetails.elementMultiplier.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>種族補正:</span>
                    <span className={`font-mono ${calculationDetails.speciesMultiplier > 1 ? 'text-green-600' : calculationDetails.speciesMultiplier < 1 ? 'text-red-600' : ''}`}>
                      × {calculationDetails.speciesMultiplier.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>バフ補正:</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400">
                      × {calculationDetails.buffMultiplier.toFixed(2)}
                    </span>
                  </div>
                  <div className="border-t pt-1 mt-1">
                    <div className="flex justify-between font-medium">
                      <span>総合倍率:</span>
                      <span className="font-mono text-purple-600 dark:text-purple-400">
                        × {calculationDetails.finalMultiplier.toFixed(3)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 最終ダメージ */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    最終ダメージ計算式:
                  </span>
                  <span className={`font-bold text-lg ${getDamageColor(damagePerHit)}`}>
                    {formatNumber(damagePerHit)}
                  </span>
                </div>
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 font-mono">
                  {calculationDetails.baseDamage} × {calculationDetails.finalMultiplier.toFixed(3)} = {damagePerHit}
                </div>
              </div>

              {/* ダメージ範囲 */}
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                  ダメージ範囲 (乱数込み)
                </h4>
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">最小 (90%):</span>
                    <span className="ml-2 font-bold text-orange-600 dark:text-orange-400">
                      {formatNumber(Math.floor(damagePerHit * 0.9))}
                    </span>
                  </div>
                  <div className="text-gray-400">〜</div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">最大 (110%):</span>
                    <span className="ml-2 font-bold text-green-600 dark:text-green-400">
                      {formatNumber(Math.floor(damagePerHit * 1.1))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ダメージ評価 */}
      <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            ダメージ評価:
          </span>
          <span className={`text-lg font-bold ${getDamageColor(damagePerHit)}`}>
            {getDamageRating(damagePerHit)}
          </span>
        </div>
      </div>
    </div>
  );
};

// ダメージ評価を返すヘルパー関数
const getDamageRating = (damage: number): string => {
  if (damage >= 100000) return '神級 (SSS)';
  if (damage >= 50000) return '伝説級 (SS)';
  if (damage >= 20000) return '英雄級 (S)';
  if (damage >= 10000) return '上級 (A)';
  if (damage >= 5000) return '中級 (B)';
  if (damage >= 2000) return '初級 (C)';
  if (damage >= 1000) return '見習い (D)';
  if (damage >= 500) return '初心者 (E)';
  return '要強化 (F)';
};