'use client';

import React from 'react';
import { useOptimizeStore } from '@/store/optimizeStore';
import { EquipSlot } from '@/types';
import { MinimumStatRequirements } from '@/types/optimize';

const SLOT_LABELS: Record<EquipSlot, string> = {
  weapon: '武器',
  head: '頭',
  body: '胴',
  leg: '脚',
  accessory1: 'ネックレス',
  accessory2: 'ブレスレット',
};

const ALL_SLOTS: EquipSlot[] = ['weapon', 'head', 'body', 'leg', 'accessory1', 'accessory2'];

// ステータスラベル
const STAT_LABELS: Record<keyof MinimumStatRequirements, string> = {
  HP: 'HP',
  Power: '力',
  Magic: '魔力',
  Defense: '守備力',
  Mind: '精神',
  Agility: '素早さ',
  Dex: '器用',
  CritDamage: '撃力',
  CritRate: '会心率',
};

export function OptimizeConstraints() {
  const {
    constraints,
    minimumStats,
    setConstraints,
    setMinimumStat,
    resetConstraints,
  } = useOptimizeStore();

  const handleSlotToggle = (slot: EquipSlot) => {
    const currentSlots = constraints.targetSlots;
    const newSlots = currentSlots.includes(slot)
      ? currentSlots.filter((s) => s !== slot)
      : [...currentSlots, slot];
    setConstraints({ targetSlots: newSlots });
  };

  const handleMinimumStatChange = (
    stat: keyof MinimumStatRequirements,
    value: string
  ) => {
    const numValue = value === '' ? undefined : Number(value);
    setMinimumStat(stat, numValue);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gradient from-white to-gray-300">制約条件</h3>
        <button
          onClick={resetConstraints}
          className="text-sm text-white/50 hover:text-white transition-colors"
        >
          リセット
        </button>
      </div>

      {/* 探索対象スロット */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-white/80">
          探索対象スロット
        </label>
        <div className="grid grid-cols-3 gap-3">
          {ALL_SLOTS.map((slot) => (
            <label
              key={slot}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <input
                type="checkbox"
                checked={constraints.targetSlots.includes(slot)}
                onChange={() => handleSlotToggle(slot)}
                className="checkbox-primary"
              />
              <span className="text-sm text-white/70 group-hover:text-white transition-colors">
                {SLOT_LABELS[slot]}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* 最低必須ステータス */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-white/80">
          最低必須ステータス（任意）
        </label>
        <p className="text-xs text-white/50 mb-2">
          指定したステータス以上の装備構成のみを探索します
        </p>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(STAT_LABELS) as (keyof MinimumStatRequirements)[]).map((stat) => (
            <div key={stat} className="space-y-1">
              <label className="text-xs text-white/50">{STAT_LABELS[stat]}</label>
              <input
                type="number"
                min={0}
                value={minimumStats[stat] ?? ''}
                onChange={(e) => handleMinimumStatChange(stat, e.target.value)}
                placeholder="任意"
                className="w-full input-secondary text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      {/* 結果数 */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-white/80">
          結果表示数
        </label>
        <input
          type="number"
          min={1}
          max={50}
          value={constraints.maxResults || 10}
          onChange={(e) => setConstraints({ maxResults: Number(e.target.value) })}
          className="w-full input-secondary"
        />
      </div>
    </div>
  );
}
