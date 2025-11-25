'use client';

import React, { useState, useEffect } from 'react';

interface SPSliderProps {
  spValues: {
    A: number;
    B: number;
    C: number;
  };
  maxSP: number;
  onChange: (values: { A: number; B: number; C: number }) => void;
  disabled?: boolean;
  className?: string;
}

export const SPSlider: React.FC<SPSliderProps> = ({
  spValues,
  maxSP,
  onChange,
  disabled = false,
  className = '',
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
    newValues[axis] = Math.max(0, Math.min(100, value));

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

  const distributeEqually = () => {
    const equalValue = Math.floor(maxSP / 3);
    const remainder = maxSP % 3;
    const newValues = {
      A: equalValue + (remainder > 0 ? 1 : 0),
      B: equalValue + (remainder > 1 ? 1 : 0),
      C: equalValue,
    };
    setLocalValues(newValues);
    onChange(newValues);
  };

  return (
    <div className={`${className}`}>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            SP割り振り
          </h3>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${isOverLimit ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
              {totalSP} / {maxSP}
            </span>
            {remainingSP !== 0 && (
              <span className={`text-xs ${remainingSP > 0 ? 'text-green-600' : 'text-red-600'}`}>
                ({remainingSP > 0 ? '+' : ''}{remainingSP})
              </span>
            )}
          </div>
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
          {(['A', 'B', 'C'] as const).map(axis => (
            <div key={axis} className={`p-3 rounded-lg bg-gray-50 dark:bg-gray-800 ${isOverLimit && localValues[axis] > 0 ? 'ring-2 ring-red-400' : ''}`}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {axis}軸
                </label>
                <input
                  type="number"
                  value={localValues[axis]}
                  onChange={(e) => handleInputChange(axis, e.target.value)}
                  disabled={disabled}
                  min={0}
                  max={100}
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
                  max={100}
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
                    background: `linear-gradient(to right, ${getSliderColorValue(axis)} 0%, ${getSliderColorValue(axis)} ${localValues[axis]}%, #e5e7eb ${localValues[axis]}%, #e5e7eb 100%)`,
                  }}
                />
                {isDragging === axis && (
                  <div
                    className="absolute -top-8 px-2 py-1 bg-gray-900 text-white text-xs rounded pointer-events-none"
                    style={{ left: `${localValues[axis]}%`, transform: 'translateX(-50%)' }}
                  >
                    {localValues[axis]}
                  </div>
                )}
              </div>
            </div>
          ))}
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
          <button
            type="button"
            onClick={distributeEqually}
            disabled={disabled}
            className={`
              px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300
              rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            均等配分
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