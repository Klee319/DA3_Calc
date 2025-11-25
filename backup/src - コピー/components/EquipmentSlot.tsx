'use client';

import React, { useState } from 'react';
import { Equipment, EquipSlot } from '@/types';
import { Toggle } from '@/components/ui/Toggle';
import { NumberInput } from '@/components/ui/NumberInput';
import { Tooltip } from '@/components/ui/Tooltip';

interface EquipmentSlotProps {
  slot: EquipSlot;
  equipment: Equipment | null;
  availableEquipment: Equipment[];
  onEquipmentChange: (equipment: Equipment | null) => void;
  enhancementLevel?: number;
  onEnhancementChange?: (level: number) => void;
  rank?: string;
  onRankChange?: (rank: string) => void;
  hasSmithing?: boolean;
  onSmithingChange?: (enabled: boolean) => void;
  smithingDetails?: {
    attack?: number;
    defense?: number;
    critical?: number;
  };
  onSmithingDetailsChange?: (details: any) => void;
  hasAlchemy?: boolean;
  onAlchemyChange?: (enabled: boolean) => void;
  disabled?: boolean;
  className?: string;
}

const RANKS = ['SSS', 'SS', 'S', 'A', 'B', 'C', 'D', 'E', 'F'];

export const EquipmentSlot: React.FC<EquipmentSlotProps> = ({
  slot,
  equipment,
  availableEquipment,
  onEquipmentChange,
  enhancementLevel = 0,
  onEnhancementChange,
  rank = 'F',
  onRankChange,
  hasSmithing = false,
  onSmithingChange,
  smithingDetails = {},
  onSmithingDetailsChange,
  hasAlchemy = false,
  onAlchemyChange,
  disabled = false,
  className = '',
}) => {
  const [showSmithingDetails, setShowSmithingDetails] = useState(false);

  const handleEquipmentSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const equipmentId = e.target.value;
    if (equipmentId === '') {
      onEquipmentChange(null);
    } else {
      const selected = availableEquipment.find(eq => eq.id === equipmentId);
      onEquipmentChange(selected || null);
    }
  };

  const getSlotDisplayName = (): string => {
    const slotNames: Record<EquipSlot, string> = {
      weapon: '武器',
      head: '頭装備',
      body: '胴装備',
      arm: '腕装備',
      leg: '脚装備',
      accessory1: 'アクセサリー1',
      accessory2: 'アクセサリー2',
    };
    return slotNames[slot] || slot;
  };

  const getMaxEnhancement = (): number => {
    if (slot === 'weapon') return 80;
    return 40;
  };

  const getRankColor = (selectedRank: string): string => {
    const colors: Record<string, string> = {
      SSS: 'text-purple-600 dark:text-purple-400 font-bold',
      SS: 'text-purple-500 dark:text-purple-400',
      S: 'text-yellow-600 dark:text-yellow-400',
      A: 'text-red-600 dark:text-red-400',
      B: 'text-orange-600 dark:text-orange-400',
      C: 'text-green-600 dark:text-green-400',
      D: 'text-blue-600 dark:text-blue-400',
      E: 'text-gray-600 dark:text-gray-400',
      F: 'text-gray-500 dark:text-gray-500',
    };
    return colors[selectedRank] || '';
  };

  return (
    <div className={`p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* スロット名 */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          {getSlotDisplayName()}
        </h3>
        {equipment && (
          <Tooltip content="装備を外す">
            <button
              type="button"
              onClick={() => onEquipmentChange(null)}
              disabled={disabled}
              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </Tooltip>
        )}
      </div>

      {/* 装備選択 */}
      <div className="mb-4">
        <select
          value={equipment?.id || ''}
          onChange={handleEquipmentSelect}
          disabled={disabled}
          className={`
            w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600
            bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
            focus:ring-2 focus:ring-blue-500 focus:border-transparent
            disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:opacity-50
          `}
        >
          <option value="">装備なし</option>
          {availableEquipment.map(eq => (
            <option key={eq.id} value={eq.id}>
              {eq.name}
            </option>
          ))}
        </select>
      </div>

      {equipment && (
        <>
          {/* ランク選択 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ランク
            </label>
            <div className="flex gap-1 flex-wrap">
              {RANKS.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onRankChange?.(r)}
                  disabled={disabled}
                  className={`
                    px-3 py-1 text-sm rounded transition-all
                    ${rank === r
                      ? 'bg-blue-100 dark:bg-blue-900 ' + getRankColor(r)
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* 強化値 */}
          <div className="mb-4">
            <NumberInput
              label="強化値"
              value={enhancementLevel}
              onChange={(val) => onEnhancementChange?.(val)}
              min={0}
              max={getMaxEnhancement()}
              disabled={disabled}
              showStepper={true}
            />
          </div>

          {/* 叩き */}
          {slot === 'weapon' && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <Toggle
                  label="叩き"
                  checked={hasSmithing}
                  onChange={(val) => onSmithingChange?.(val)}
                  disabled={disabled}
                />
                {hasSmithing && (
                  <button
                    type="button"
                    onClick={() => setShowSmithingDetails(!showSmithingDetails)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {showSmithingDetails ? '詳細を隠す' : '詳細を表示'}
                  </button>
                )}
              </div>

              {hasSmithing && showSmithingDetails && (
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md space-y-3">
                  <NumberInput
                    label="攻撃力+"
                    value={smithingDetails.attack || 0}
                    onChange={(val) => onSmithingDetailsChange?.({ ...smithingDetails, attack: val })}
                    min={0}
                    max={999}
                    disabled={disabled}
                  />
                  <NumberInput
                    label="会心率+"
                    value={smithingDetails.critical || 0}
                    onChange={(val) => onSmithingDetailsChange?.({ ...smithingDetails, critical: val })}
                    min={0}
                    max={100}
                    disabled={disabled}
                  />
                </div>
              )}
            </div>
          )}

          {/* 錬金 */}
          <div className="mb-4">
            <Toggle
              label="錬金"
              checked={hasAlchemy}
              onChange={(val) => onAlchemyChange?.(val)}
              disabled={disabled}
            />
          </div>

          {/* 装備ステータス表示 */}
          {equipment.baseStats && equipment.baseStats.length > 0 && (
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                基本ステータス
              </h4>
              <div className="space-y-1">
                {equipment.baseStats.map((stat, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">{stat.stat}</span>
                    <span className="text-gray-800 dark:text-gray-200">
                      {stat.isPercent ? '+' : '+'}{stat.value}{stat.isPercent ? '%' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};