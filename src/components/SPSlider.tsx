'use client';

import React, { useState, useEffect } from 'react';

interface SPSliderProps {
  spValues: {
    A: number;
    B: number;
    C: number;
  };
  maxSP: number;
  maxSPByBranch: { A: number; B: number; C: number };  // 各軸の最大値を追加
  onChange: (values: { A: number; B: number; C: number }) => void;
  disabled?: boolean;
  className?: string;
  unlockedSkills?: Array<{
    skillName: string;
    branch: 'A' | 'B' | 'C';
    tier: number;
  }>;
  reachedTier?: string;  // 例: "A-3"
  nextSkillInfo?: {
    branch: 'A' | 'B' | 'C';
    skillName: string;
    requiredSP: number;
    currentSP: number;
    needMoreSP: number;
  } | null;
  branchBonus?: {
    A: { 力: number; 体力: number; 魔力: number; 精神: number; 素早さ: number; 器用さ: number; 撃力: number; 守備力: number };
    B: { 力: number; 体力: number; 魔力: number; 精神: number; 素早さ: number; 器用さ: number; 撃力: number; 守備力: number };
    C: { 力: number; 体力: number; 魔力: number; 精神: number; 素早さ: number; 器用さ: number; 撃力: number; 守備力: number };
  };
}

export const SPSlider: React.FC<SPSliderProps> = ({
  spValues,
  maxSP,
  maxSPByBranch,
  onChange,
  disabled = false,
  className = '',
  unlockedSkills,
  reachedTier,
  nextSkillInfo,
  branchBonus,
}) => {
  const [localValues, setLocalValues] = useState(spValues);
  const [isDragging, setIsDragging] = useState<string | null>(null);

  useEffect(() => {
    setLocalValues(spValues);
  }, [spValues]);

  const totalSP = localValues.A + localValues.B + localValues.C;
  const isOverLimit = totalSP > maxSP;
  const remainingSP = maxSP - totalSP;

  const handleSliderChange = (axis: 'A' | 'B' | 'C', value: number) => {
    if (disabled) return;

    const newValues = { ...localValues };
    // 各軸の最大値に基づいて制限
    newValues[axis] = Math.max(0, Math.min(maxSPByBranch[axis], value));

    // 他の軸の値を調整して合計を最大SPに収める
    const otherAxes = (['A', 'B', 'C'] as const).filter(a => a !== axis);
    const otherTotal = otherAxes.reduce((sum, a) => sum + newValues[a], 0);

    if (newValues[axis] + otherTotal > maxSP) {
      // 超過分を他の軸から均等に減らす
      const excess = newValues[axis] + otherTotal - maxSP;
      const reduction = excess / otherAxes.length;

      otherAxes.forEach(a => {
        newValues[a] = Math.max(0, newValues[a] - Math.ceil(reduction));
      });

      // それでも超過する場合は、現在の軸の値を調整
      const newTotal = newValues.A + newValues.B + newValues.C;
      if (newTotal > maxSP) {
        newValues[axis] -= newTotal - maxSP;
      }
    }

    setLocalValues(newValues);
    onChange(newValues);
  };

  const handleInputChange = (axis: 'A' | 'B' | 'C', value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      handleSliderChange(axis, numValue);
    }
  };

  const getSliderColor = (axis: 'A' | 'B' | 'C') => {
    const colors = {
      A: 'bg-red-500 dark:bg-red-600',
      B: 'bg-green-500 dark:bg-green-600',
      C: 'bg-blue-500 dark:bg-blue-600',
    };
    return colors[axis];
  };

  const resetValues = () => {
    const newValues = { A: 0, B: 0, C: 0 };
    setLocalValues(newValues);
    onChange(newValues);
  };

  // 均等配分機能は削除（実数値表示では不要）

  return (
    <div className={`${className}`}>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            SP割り振り
          </h3>
        </div>

        {isOverLimit && (
          <div className="p-2 mb-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 rounded-md">
            <p className="text-sm text-red-700 dark:text-red-300 flex items-center">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              SP合計が最大値を超えています！
            </p>
          </div>
        )}

        <div className="space-y-4">
          {(['A', 'B', 'C'] as const).map(axis => {
            const percentage = maxSPByBranch[axis] > 0 ? (localValues[axis] / maxSPByBranch[axis]) * 100 : 0;

            return (
              <div key={axis} className={`p-3 rounded-lg bg-gray-50 dark:bg-gray-800 ${isOverLimit && localValues[axis] > 0 ? 'ring-2 ring-red-400' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {axis}軸 {localValues[axis]}/{maxSPByBranch[axis]}
                  </label>
                  <input
                    type="number"
                    value={localValues[axis]}
                    onChange={(e) => handleInputChange(axis, e.target.value)}
                    disabled={disabled}
                    min={0}
                    max={maxSPByBranch[axis]}
                    className={`
                      w-16 px-2 py-1 text-sm text-center rounded border
                      ${isOverLimit ? 'border-red-400 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'}
                      bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                      focus:outline-none focus:ring-2 focus:ring-blue-500
                      disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:opacity-50
                    `}
                  />
                </div>

                <div className="relative">
                  <input
                    type="range"
                    min={0}
                    max={maxSPByBranch[axis]}
                    value={localValues[axis]}
                    onChange={(e) => handleSliderChange(axis, parseInt(e.target.value, 10))}
                    onMouseDown={() => setIsDragging(axis)}
                    onMouseUp={() => setIsDragging(null)}
                    onTouchStart={() => setIsDragging(axis)}
                    onTouchEnd={() => setIsDragging(null)}
                    disabled={disabled}
                    className={`
                      w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer
                      disabled:opacity-50 disabled:cursor-not-allowed
                      slider-${axis.toLowerCase()}
                    `}
                    style={{
                      background: `linear-gradient(to right, ${getSliderColorValue(axis)} 0%, ${getSliderColorValue(axis)} ${percentage}%, #e5e7eb ${percentage}%, #e5e7eb 100%)`,
                    }}
                  />
                  {isDragging === axis && (
                    <div
                      className="absolute -top-8 px-2 py-1 bg-gray-900 text-white text-xs rounded pointer-events-none"
                      style={{ left: `${percentage}%`, transform: 'translateX(-50%)' }}
                    >
                      {localValues[axis]}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* クイックアクションボタン */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={resetValues}
            disabled={disabled}
            className={`
              px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300
              rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            リセット
          </button>
        </div>

        {/* SP配分の可視化 */}
        <div className="mt-4 h-8 flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
          {localValues.A > 0 && (
            <div
              className="bg-red-500 dark:bg-red-600 flex items-center justify-center text-white text-xs font-medium"
              style={{ width: `${(localValues.A / totalSP) * 100}%` }}
            >
              A: {localValues.A}
            </div>
          )}
          {localValues.B > 0 && (
            <div
              className="bg-green-500 dark:bg-green-600 flex items-center justify-center text-white text-xs font-medium"
              style={{ width: `${(localValues.B / totalSP) * 100}%` }}
            >
              B: {localValues.B}
            </div>
          )}
          {localValues.C > 0 && (
            <div
              className="bg-blue-500 dark:bg-blue-600 flex items-center justify-center text-white text-xs font-medium"
              style={{ width: `${(localValues.C / totalSP) * 100}%` }}
            >
              C: {localValues.C}
            </div>
          )}
          {totalSP === 0 && (
            <div className="flex-1 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 text-xs">
              未配分
            </div>
          )}
        </div>

        {/* 到達段階表示 */}
        {reachedTier && (
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            到達段階: <span className="font-semibold text-blue-600 dark:text-blue-400">{reachedTier}</span>
          </div>
        )}

        {/* 解放済みスキル一覧 */}
        {unlockedSkills && unlockedSkills.length > 0 && (
          <div className="mt-4 p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                解放済みスキル ({unlockedSkills.length}個)
              </p>
            </div>
            <ul className="space-y-2">
              {unlockedSkills.map((skill, index) => (
                <li
                  key={`${skill.branch}-${skill.tier}-${index}`}
                  className="flex items-start gap-2 text-sm"
                >
                  <span className="flex-shrink-0 w-12 text-xs font-mono text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded">
                    {skill.branch}-{skill.tier}
                  </span>
                  <span className="text-gray-700 dark:text-gray-300 flex-1">
                    {skill.skillName}
                  </span>
                  <span className="flex-shrink-0 text-xs text-green-600 dark:text-green-400">
                    ✓
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 未解放スキルのヒント */}
        {(!unlockedSkills || unlockedSkills.length === 0) && (
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              SPを割り振るとスキルが解放されます
            </p>
          </div>
        )}

        {/* 次のスキル解放情報 */}
        {nextSkillInfo && (
          <div className="mt-4 p-4 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                次の解放可能スキル
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-mono text-xs bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded mr-2">
                    {nextSkillInfo.branch}軸
                  </span>
                  {nextSkillInfo.skillName}
                </span>
                <span className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">
                  あと{nextSkillInfo.needMoreSP}SP必要
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
                <div
                  className="bg-yellow-500 dark:bg-yellow-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(nextSkillInfo.currentSP / nextSkillInfo.requiredSP) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ステータスボーナス表示 */}
        {branchBonus && (
          <div className="mt-4 p-4 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-sm font-semibold text-purple-800 dark:text-purple-200">
                ステータスボーナス
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(['A', 'B', 'C'] as const).map((branch) => {
                const bonus = branchBonus[branch];
                const hasBonuses = Object.values(bonus).some(val => val > 0);
                const branchColor = branch === 'A' ? 'red' : branch === 'B' ? 'green' : 'blue';

                return (
                  <div key={branch} className="space-y-1">
                    <div className={`text-xs font-semibold ${
                      branch === 'A' ? 'text-red-600 dark:text-red-400' :
                      branch === 'B' ? 'text-green-600 dark:text-green-400' :
                      'text-blue-600 dark:text-blue-400'
                    } mb-1`}>
                      {branch}軸
                    </div>
                    {hasBonuses ? (
                      <div className="text-xs space-y-1">
                        {bonus.力 > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">力:</span>
                            <span className="font-medium text-gray-800 dark:text-gray-200">+{bonus.力}</span>
                          </div>
                        )}
                        {bonus.体力 > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">体力:</span>
                            <span className="font-medium text-gray-800 dark:text-gray-200">+{bonus.体力}</span>
                          </div>
                        )}
                        {bonus.魔力 > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">魔力:</span>
                            <span className="font-medium text-gray-800 dark:text-gray-200">+{bonus.魔力}</span>
                          </div>
                        )}
                        {bonus.精神 > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">精神:</span>
                            <span className="font-medium text-gray-800 dark:text-gray-200">+{bonus.精神}</span>
                          </div>
                        )}
                        {bonus.素早さ > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">素早:</span>
                            <span className="font-medium text-gray-800 dark:text-gray-200">+{bonus.素早さ}</span>
                          </div>
                        )}
                        {bonus.器用さ > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">器用:</span>
                            <span className="font-medium text-gray-800 dark:text-gray-200">+{bonus.器用さ}</span>
                          </div>
                        )}
                        {bonus.撃力 > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">撃力:</span>
                            <span className="font-medium text-gray-800 dark:text-gray-200">+{bonus.撃力}</span>
                          </div>
                        )}
                        {bonus.守備力 > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">守備:</span>
                            <span className="font-medium text-gray-800 dark:text-gray-200">+{bonus.守備力}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-500 italic">
                        ボーナスなし
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// スライダーの色値を取得するヘルパー関数
const getSliderColorValue = (axis: 'A' | 'B' | 'C'): string => {
  const colors = {
    A: '#ef4444', // red-500
    B: '#22c55e', // green-500
    C: '#3b82f6', // blue-500
  };
  return colors[axis];
};