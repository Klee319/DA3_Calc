'use client';

import React, { useState } from 'react';
import { NumberInput } from '@/components/ui/NumberInput';
import { Tooltip } from '@/components/ui/Tooltip';

interface EnemyInputProps {
  enemyStats: {
    defense: number;
    attackResistance: number;
    elementResistance: number;
  };
  onStatsChange: (stats: {
    defense: number;
    attackResistance: number;
    elementResistance: number;
  }) => void;
  disabled?: boolean;
  className?: string;
}

interface ResistancePresetProps {
  name: string;
  defense: number;
  attackResistance: number;
  elementResistance: number;
  onClick: () => void;
}

const ResistancePreset: React.FC<ResistancePresetProps> = ({
  name,
  defense,
  attackResistance,
  elementResistance,
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-2 text-sm bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
    >
      <div className="font-medium text-gray-800 dark:text-gray-200">{name}</div>
      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
        守備: {defense} / 攻耐性: {attackResistance}% / 属性: {elementResistance}%
      </div>
    </button>
  );
};

export const EnemyInput: React.FC<EnemyInputProps> = ({
  enemyStats,
  onStatsChange,
  disabled = false,
  className = '',
}) => {
  const [showPresets, setShowPresets] = useState(false);

  const handleDefenseChange = (value: number) => {
    onStatsChange({
      ...enemyStats,
      defense: Math.max(0, value),
    });
  };

  const handleAttackResistanceChange = (value: number) => {
    onStatsChange({
      ...enemyStats,
      attackResistance: Math.max(-100, Math.min(100, value)),
    });
  };

  const handleElementResistanceChange = (value: number) => {
    onStatsChange({
      ...enemyStats,
      elementResistance: Math.max(-100, Math.min(100, value)),
    });
  };

  const applyPreset = (preset: {
    defense: number;
    attackResistance: number;
    elementResistance: number;
  }) => {
    onStatsChange(preset);
    setShowPresets(false);
  };

  // プリセットデータ
  const presets = [
    { name: '弱い敵', defense: 50, attackResistance: 0, elementResistance: 0 },
    { name: '通常の敵', defense: 100, attackResistance: 10, elementResistance: 10 },
    { name: '強敵', defense: 200, attackResistance: 20, elementResistance: 20 },
    { name: 'ボス', defense: 300, attackResistance: 30, elementResistance: 30 },
    { name: '裏ボス', defense: 500, attackResistance: 50, elementResistance: 40 },
    { name: '耐性持ち', defense: 150, attackResistance: 80, elementResistance: 80 },
    { name: '弱点持ち', defense: 150, attackResistance: -30, elementResistance: -50 },
  ];

  const getResistanceColor = (value: number): string => {
    if (value > 50) return 'text-red-600 dark:text-red-400';
    if (value > 0) return 'text-orange-600 dark:text-orange-400';
    if (value < -30) return 'text-green-600 dark:text-green-400';
    if (value < 0) return 'text-blue-600 dark:text-blue-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const getResistanceLabel = (value: number): string => {
    if (value >= 80) return '(ほぼ無効)';
    if (value >= 50) return '(高耐性)';
    if (value >= 30) return '(耐性)';
    if (value > 0) return '(軽減)';
    if (value === 0) return '(通常)';
    if (value <= -50) return '(大弱点)';
    if (value <= -30) return '(弱点)';
    if (value < 0) return '(やや弱い)';
    return '';
  };

  return (
    <div className={`p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          敵パラメータ
        </h3>
        <button
          type="button"
          onClick={() => setShowPresets(!showPresets)}
          className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
        >
          {showPresets ? 'プリセットを隠す' : 'プリセット'}
        </button>
      </div>

      {/* プリセット一覧 */}
      {showPresets && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {presets.map((preset, index) => (
              <ResistancePreset
                key={index}
                name={preset.name}
                defense={preset.defense}
                attackResistance={preset.attackResistance}
                elementResistance={preset.elementResistance}
                onClick={() => applyPreset(preset)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* 守備力 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              守備力
            </label>
            <Tooltip content="物理・魔法ダメージを軽減する基本的な守備値です。ダメージから守備力の半分が減算されます">
              <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </Tooltip>
          </div>
          <NumberInput
            value={enemyStats.defense}
            onChange={handleDefenseChange}
            min={0}
            max={9999}
            disabled={disabled}
            showStepper={true}
            placeholder="守備力を入力"
          />
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            ダメージ計算式: (攻撃力 - 守備力/2) × 各種倍率
          </div>
        </div>

        {/* 攻撃耐性（物/魔） */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              攻撃耐性（物/魔） (%)
            </label>
            <Tooltip content="物理・魔法攻撃に対する耐性。正の値で軽減、負の値で弱点となります">
              <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </Tooltip>
          </div>
          <NumberInput
            value={enemyStats.attackResistance}
            onChange={handleAttackResistanceChange}
            min={-100}
            max={100}
            disabled={disabled}
            showStepper={true}
            error={enemyStats.attackResistance > 100 ? '最大100%です' : enemyStats.attackResistance < -100 ? '最小-100%です' : undefined}
            placeholder="攻撃耐性を入力"
          />
          <div className={`mt-1 text-xs ${getResistanceColor(enemyStats.attackResistance)}`}>
            {enemyStats.attackResistance}% {getResistanceLabel(enemyStats.attackResistance)}
            {enemyStats.attackResistance !== 0 && (
              <span className="ml-2 text-gray-500">
                (ダメージ × {(100 - enemyStats.attackResistance) / 100})
              </span>
            )}
          </div>
        </div>

        {/* 属性耐性 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              属性耐性 (%)
            </label>
            <Tooltip content="火、水、風などの属性攻撃に対する耐性。正の値で軽減、負の値で弱点となります">
              <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </Tooltip>
          </div>
          <NumberInput
            value={enemyStats.elementResistance}
            onChange={handleElementResistanceChange}
            min={-100}
            max={100}
            disabled={disabled}
            showStepper={true}
            error={enemyStats.elementResistance > 100 ? '最大100%です' : enemyStats.elementResistance < -100 ? '最小-100%です' : undefined}
            placeholder="属性耐性を入力"
          />
          <div className={`mt-1 text-xs ${getResistanceColor(enemyStats.elementResistance)}`}>
            {enemyStats.elementResistance}% {getResistanceLabel(enemyStats.elementResistance)}
            {enemyStats.elementResistance !== 0 && (
              <span className="ml-2 text-gray-500">
                (ダメージ × {(100 - enemyStats.elementResistance) / 100})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* サマリー */}
      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          最終ダメージ倍率
        </h4>
        <div className="text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">基本ダメージ:</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">
              攻撃力 - {Math.floor(enemyStats.defense / 2)} (守備力{enemyStats.defense}/2)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">攻撃耐性補正:</span>
            <span className={`font-medium ${getResistanceColor(enemyStats.attackResistance)}`}>
              × {((100 - enemyStats.attackResistance) / 100).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">属性耐性補正:</span>
            <span className={`font-medium ${getResistanceColor(enemyStats.elementResistance)}`}>
              × {((100 - enemyStats.elementResistance) / 100).toFixed(2)}
            </span>
          </div>
          <div className="border-t pt-1 mt-1">
            <div className="flex justify-between">
              <span className="text-gray-700 dark:text-gray-300 font-medium">総合倍率:</span>
              <span className="font-bold text-lg text-blue-600 dark:text-blue-400">
                × {(((100 - enemyStats.attackResistance) / 100) * ((100 - enemyStats.elementResistance) / 100)).toFixed(3)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};