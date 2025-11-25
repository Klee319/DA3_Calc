'use client';

import React from 'react';
import { NumberInput } from '@/components/ui/NumberInput';

interface LevelInputProps {
  level: number;
  onChange: (level: number) => void;
  maxLevel?: number;
  minLevel?: number;
  disabled?: boolean;
  className?: string;
}

export const LevelInput: React.FC<LevelInputProps> = ({
  level,
  onChange,
  maxLevel = 100,
  minLevel = 1,
  disabled = false,
  className = '',
}) => {
  const handleLevelChange = (newLevel: number) => {
    // 範囲チェック
    if (newLevel < minLevel) {
      onChange(minLevel);
    } else if (newLevel > maxLevel) {
      onChange(maxLevel);
    } else {
      onChange(newLevel);
    }
  };

  // エラーメッセージの生成
  const getError = (): string | undefined => {
    if (level < minLevel) {
      return `レベルは${minLevel}以上である必要があります`;
    }
    if (level > maxLevel) {
      return `レベルは${maxLevel}以下である必要があります`;
    }
    return undefined;
  };

  return (
    <div className={`${className}`}>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          レベル
        </label>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          (最小: {minLevel}, 最大: {maxLevel})
        </span>
      </div>

      <NumberInput
        value={level}
        onChange={handleLevelChange}
        min={minLevel}
        max={maxLevel}
        step={1}
        disabled={disabled}
        showStepper={true}
        error={getError()}
        placeholder="レベルを入力"
      />

      <div className="mt-3 space-y-2">
        {/* クイックセットボタン */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange(1)}
            disabled={disabled}
            className={`
              px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300
              rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            Lv.1
          </button>
          <button
            type="button"
            onClick={() => onChange(50)}
            disabled={disabled || maxLevel < 50}
            className={`
              px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300
              rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors
              ${disabled || maxLevel < 50 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            Lv.50
          </button>
          <button
            type="button"
            onClick={() => onChange(maxLevel)}
            disabled={disabled}
            className={`
              px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300
              rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            Lv.{maxLevel}
          </button>
        </div>

        {/* プログレスバー */}
        <div className="relative pt-1">
          <div className="flex mb-1 items-center justify-between">
            <div className="text-xs font-semibold inline-block text-blue-600 dark:text-blue-400">
              {Math.round((level / maxLevel) * 100)}%
            </div>
          </div>
          <div className="overflow-hidden h-2 mb-2 text-xs flex rounded bg-gray-200 dark:bg-gray-700">
            <div
              style={{ width: `${(level / maxLevel) * 100}%` }}
              className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 transition-all duration-300"
            />
          </div>
        </div>
      </div>
    </div>
  );
};