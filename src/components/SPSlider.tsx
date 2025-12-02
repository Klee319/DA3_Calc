'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { JobSPData } from '@/types/data';

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
  jobSPData?: JobSPData[];  // SPツリーデータ
}

// SPツリーのティア情報
interface TierInfo {
  tier: number;
  branch: 'A' | 'B' | 'C';
  requiredSP: number;
  skillName?: string;
  stats: {
    力?: number;
    体力?: number;
    魔力?: number;
    精神?: number;
    素早さ?: number;
    器用さ?: number;
    撃力?: number;
    守備力?: number;
  };
  resistances: {
    物理耐性?: number;
    魔耐性?: number;
    炎耐性?: number;
    水耐性?: number;
    雷耐性?: number;
    風耐性?: number;
    無耐性?: number;
    闇耐性?: number;
    光耐性?: number;
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
  jobSPData,
}) => {
  const [localValues, setLocalValues] = useState(spValues);
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [activeTreeTab, setActiveTreeTab] = useState<'A' | 'B' | 'C'>('A');

  useEffect(() => {
    setLocalValues(spValues);
  }, [spValues]);

  // jobSPDataからティア情報を抽出
  const tiersByBranch = useMemo(() => {
    if (!jobSPData) return { A: [] as TierInfo[], B: [] as TierInfo[], C: [] as TierInfo[] };

    const result: { A: TierInfo[]; B: TierInfo[]; C: TierInfo[] } = { A: [], B: [], C: [] };

    for (const row of jobSPData) {
      const stage = row.解法段階;
      const match = stage.match(/^([A-C])-(\d+)$/);
      if (match) {
        const branch = match[1] as 'A' | 'B' | 'C';
        const tier = parseInt(match[2]);
        const requiredSP = typeof row.必要SP === 'string' ? parseFloat(row.必要SP) || 0 : row.必要SP || 0;
        const toNum = (val: string | number | undefined) => {
          if (val === undefined || val === '') return 0;
          if (typeof val === 'number') return val;
          return parseFloat(val) || 0;
        };

        result[branch].push({
          tier,
          branch,
          requiredSP,
          skillName: row.解法スキル名,
          stats: {
            力: toNum(row.力),
            体力: toNum(row.体力),
            魔力: toNum(row.魔力),
            精神: toNum(row.精神),
            素早さ: toNum(row.素早さ),
            器用さ: toNum(row.器用さ),
            撃力: toNum(row.撃力),
            守備力: toNum(row.守備力),
          },
          resistances: {
            物理耐性: toNum(row.物理耐性),
            魔耐性: toNum(row.魔耐性),
            炎耐性: toNum(row.炎耐性),
            水耐性: toNum(row.水耐性),
            雷耐性: toNum(row.雷耐性),
            風耐性: toNum(row.風耐性),
            無耐性: toNum(row.無耐性),
            闇耐性: toNum(row.闇耐性),
            光耐性: toNum(row.光耐性),
          },
        });
      }
    }

    // ティア順にソート
    result.A.sort((a, b) => a.tier - b.tier);
    result.B.sort((a, b) => a.tier - b.tier);
    result.C.sort((a, b) => a.tier - b.tier);

    return result;
  }, [jobSPData]);

  // 最大ティア数を取得
  const maxTiers = Math.max(
    tiersByBranch.A.length,
    tiersByBranch.B.length,
    tiersByBranch.C.length
  );

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
            const axisLabel = axis === 'A' ? '上' : axis === 'B' ? '中' : '下';

            return (
              <div key={axis} className={`p-3 rounded-lg bg-gray-50 dark:bg-gray-800 ${isOverLimit && localValues[axis] > 0 ? 'ring-2 ring-red-400' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {axisLabel} {localValues[axis]}/{maxSPByBranch[axis]}
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

        {/* SPツリー表形式表示 */}
        {jobSPData && maxTiers > 0 && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                SPツリー
              </p>
            </div>

            {/* スマホ用タブ切り替え（md以下で表示） */}
            <div className="md:hidden flex gap-1 mb-3">
              {(['A', 'B', 'C'] as const).map((branch) => {
                const label = branch === 'A' ? '上' : branch === 'B' ? '中' : '下';
                const colorClass = branch === 'A'
                  ? 'bg-red-900/50 text-red-400 border-red-500/50'
                  : branch === 'B'
                    ? 'bg-green-900/50 text-green-400 border-green-500/50'
                    : 'bg-blue-900/50 text-blue-400 border-blue-500/50';
                const inactiveClass = 'bg-gray-800/30 text-gray-400 border-gray-600/30';

                return (
                  <button
                    key={branch}
                    type="button"
                    onClick={() => setActiveTreeTab(branch)}
                    className={`flex-1 py-2 text-sm font-semibold rounded border transition-all ${
                      activeTreeTab === branch ? colorClass : inactiveClass
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* PC用表ヘッダー（md以上で表示） */}
            <div className="hidden md:grid grid-cols-3 gap-2 mb-2">
              <div className="text-xs font-semibold text-red-400 text-center py-1.5 bg-red-900/30 rounded">
                上
              </div>
              <div className="text-xs font-semibold text-green-400 text-center py-1.5 bg-green-900/30 rounded">
                中
              </div>
              <div className="text-xs font-semibold text-blue-400 text-center py-1.5 bg-blue-900/30 rounded">
                下
              </div>
            </div>

            {/* 表本体 */}
            <div className="space-y-1 max-h-[480px] overflow-y-auto custom-scrollbar">
              {Array.from({ length: maxTiers }, (_, i) => i + 1).map((tier) => {
                const tierA = tiersByBranch.A.find(t => t.tier === tier);
                const tierB = tiersByBranch.B.find(t => t.tier === tier);
                const tierC = tiersByBranch.C.find(t => t.tier === tier);

                // 各軸が解放済みかどうかを判定
                const isUnlockedA = tierA && localValues.A >= tierA.requiredSP;
                const isUnlockedB = tierB && localValues.B >= tierB.requiredSP;
                const isUnlockedC = tierC && localValues.C >= tierC.requiredSP;

                // セルのスタイルを取得（常にborderを付けてサイズ変化を防ぐ）
                const getCellStyle = (tierInfo: TierInfo | undefined, isUnlocked: boolean) => {
                  if (!tierInfo) return 'bg-gray-800/30 text-gray-500 border border-transparent';
                  if (isUnlocked) {
                    // 解放済み: 薄い黄緑の背景、明るい白文字
                    return 'bg-lime-900/40 text-white border border-lime-500/50';
                  }
                  // 未解放: グレーアウト、透明なborderでサイズを統一
                  return 'bg-gray-800/40 text-gray-200 opacity-70 border border-transparent';
                };

                // ステータスボーナスのフォーマット
                const formatStats = (stats: TierInfo['stats']) => {
                  const bonuses: string[] = [];
                  if (stats.力 && stats.力 > 0) bonuses.push(`力+${stats.力}`);
                  if (stats.体力 && stats.体力 > 0) bonuses.push(`体力+${stats.体力}`);
                  if (stats.魔力 && stats.魔力 > 0) bonuses.push(`魔力+${stats.魔力}`);
                  if (stats.精神 && stats.精神 > 0) bonuses.push(`精神+${stats.精神}`);
                  if (stats.素早さ && stats.素早さ > 0) bonuses.push(`速+${stats.素早さ}`);
                  if (stats.器用さ && stats.器用さ > 0) bonuses.push(`器用+${stats.器用さ}`);
                  if (stats.撃力 && stats.撃力 > 0) bonuses.push(`撃+${stats.撃力}`);
                  if (stats.守備力 && stats.守備力 > 0) bonuses.push(`守+${stats.守備力}`);
                  return bonuses.join(' ');
                };

                // 耐性ボーナスのフォーマット
                const formatResistances = (resistances: TierInfo['resistances']) => {
                  const bonuses: string[] = [];
                  if (resistances.物理耐性 && resistances.物理耐性 !== 0) bonuses.push(`物理${resistances.物理耐性 > 0 ? '+' : ''}${resistances.物理耐性}%`);
                  if (resistances.魔耐性 && resistances.魔耐性 !== 0) bonuses.push(`魔法${resistances.魔耐性 > 0 ? '+' : ''}${resistances.魔耐性}%`);
                  if (resistances.炎耐性 && resistances.炎耐性 !== 0) bonuses.push(`炎${resistances.炎耐性 > 0 ? '+' : ''}${resistances.炎耐性}%`);
                  if (resistances.水耐性 && resistances.水耐性 !== 0) bonuses.push(`水${resistances.水耐性 > 0 ? '+' : ''}${resistances.水耐性}%`);
                  if (resistances.雷耐性 && resistances.雷耐性 !== 0) bonuses.push(`雷${resistances.雷耐性 > 0 ? '+' : ''}${resistances.雷耐性}%`);
                  if (resistances.風耐性 && resistances.風耐性 !== 0) bonuses.push(`風${resistances.風耐性 > 0 ? '+' : ''}${resistances.風耐性}%`);
                  if (resistances.無耐性 && resistances.無耐性 !== 0) bonuses.push(`無${resistances.無耐性 > 0 ? '+' : ''}${resistances.無耐性}%`);
                  if (resistances.闇耐性 && resistances.闇耐性 !== 0) bonuses.push(`闇${resistances.闇耐性 > 0 ? '+' : ''}${resistances.闇耐性}%`);
                  if (resistances.光耐性 && resistances.光耐性 !== 0) bonuses.push(`光${resistances.光耐性 > 0 ? '+' : ''}${resistances.光耐性}%`);
                  return bonuses.join(' ');
                };

                // セル内容のレンダリング関数
                const renderCell = (
                  tierInfo: TierInfo | undefined,
                  isUnlocked: boolean
                ) => {
                  if (!tierInfo) {
                    return <div className="text-center py-2 text-gray-400">-</div>;
                  }

                  const statsText = formatStats(tierInfo.stats);
                  const resistText = formatResistances(tierInfo.resistances);
                  const hasSkill = !!tierInfo.skillName;
                  const hasStats = !!statsText;
                  const hasResist = !!resistText;

                  return (
                    <div className="py-1.5 px-2">
                      <div className="flex items-start gap-1">
                        {isUnlocked && <span className="text-green-400 flex-shrink-0">✓</span>}
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-sm">{tierInfo.requiredSP}</span>
                          <span className="mx-1 opacity-70">:</span>
                          {hasSkill && (
                            <span className="font-medium">{tierInfo.skillName}</span>
                          )}
                          {hasSkill && (hasStats || hasResist) && (
                            <span className="mx-1 opacity-50">/</span>
                          )}
                          {hasStats && (
                            <span className="text-[10px]">{statsText}</span>
                          )}
                          {hasStats && hasResist && (
                            <span className="mx-1 opacity-50">/</span>
                          )}
                          {hasResist && (
                            <span className="text-[10px] text-cyan-400">{resistText}</span>
                          )}
                          {!hasSkill && !hasStats && !hasResist && (
                            <span className="font-medium">-</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                };

                // スマホ用：選択されたタブのティアのみ表示
                const activeTierInfo = activeTreeTab === 'A' ? tierA : activeTreeTab === 'B' ? tierB : tierC;
                const isActiveUnlocked = activeTreeTab === 'A' ? isUnlockedA : activeTreeTab === 'B' ? isUnlockedB : isUnlockedC;

                // スマホ用：選択された軸にデータがない場合はスキップ
                const hasActiveData = activeTierInfo !== undefined;

                return (
                  <div key={tier}>
                    {/* PC用: 3カラム表示 */}
                    <div className="hidden md:grid grid-cols-3 gap-2">
                      <div className={`text-xs rounded transition-all ${getCellStyle(tierA, !!isUnlockedA)}`}>
                        {renderCell(tierA, !!isUnlockedA)}
                      </div>
                      <div className={`text-xs rounded transition-all ${getCellStyle(tierB, !!isUnlockedB)}`}>
                        {renderCell(tierB, !!isUnlockedB)}
                      </div>
                      <div className={`text-xs rounded transition-all ${getCellStyle(tierC, !!isUnlockedC)}`}>
                        {renderCell(tierC, !!isUnlockedC)}
                      </div>
                    </div>

                    {/* スマホ用: 選択されたタブのみ表示 */}
                    {hasActiveData && (
                      <div className="md:hidden">
                        <div className={`text-xs rounded transition-all ${getCellStyle(activeTierInfo, !!isActiveUnlocked)}`}>
                          {renderCell(activeTierInfo, !!isActiveUnlocked)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 凡例 */}
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-lime-900/40 border border-lime-500/50"></div>
                <span className="text-gray-300">解放済み</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-gray-800/40 border border-transparent"></div>
                <span className="text-gray-300">未解放</span>
              </div>
            </div>
          </div>
        )}

        {/* jobSPDataがない場合のヒント */}
        {!jobSPData && (
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              SPを割り振るとスキルが解放されます
            </p>
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