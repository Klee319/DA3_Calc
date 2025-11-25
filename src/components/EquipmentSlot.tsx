'use client';

import React, { useState } from 'react';
import { Equipment, EquipSlot } from '@/types';
import { Toggle } from '@/components/ui/Toggle';
import { NumberInput } from '@/components/ui/NumberInput';
import { Tooltip } from '@/components/ui/Tooltip';
import { CustomSelect, CustomSelectOption } from '@/components/CustomSelect';

interface EquipmentSlotProps {
  slot: EquipSlot;
  equipment: Equipment | null;
  availableEquipment: Equipment[];
  onEquipmentChange: (equipment: Equipment | null) => void;
  enhancementLevel?: number;
  onEnhancementChange?: (level: number) => void;
  rank?: string;
  onRankChange?: (rank: string) => void;
  smithingCount?: number; // 叩き回数
  onSmithingCountChange?: (count: number) => void;
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
  smithingCount = 0,
  onSmithingCountChange,
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
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [isSelectOpen, setIsSelectOpen] = useState(false);

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

  // ランク係数を取得
  const getRankMultiplier = (selectedRank: string): number => {
    const multipliers: Record<string, number> = {
      SSS: 8, SS: 7, S: 6, A: 5, B: 4, C: 3, D: 2, E: 1, F: 0,
    };
    return multipliers[selectedRank] || 0;
  };

  // ランクボーナスを取得（武器用）
  const getWeaponRankBonus = (selectedRank: string): { attackP: number; critR: number; critD: number } => {
    const bonuses: Record<string, { attackP: number; critR: number; critD: number }> = {
      SSS: { attackP: 50, critR: 10, critD: 50 },
      SS: { attackP: 40, critR: 8, critD: 40 },
      S: { attackP: 30, critR: 6, critD: 30 },
      A: { attackP: 20, critR: 4, critD: 20 },
      B: { attackP: 15, critR: 3, critD: 15 },
      C: { attackP: 10, critR: 2, critD: 10 },
      D: { attackP: 5, critR: 1, critD: 5 },
      E: { attackP: 2, critR: 0, critD: 2 },
      F: { attackP: 0, critR: 0, critD: 0 },
    };
    return bonuses[selectedRank] || { attackP: 0, critR: 0, critD: 0 };
  };

  // 計算済みステータスを取得
  const getCalculatedStats = () => {
    if (!equipment || !equipment.baseStats) return [];

    const rankMultiplier = getRankMultiplier(rank);
    const weaponRankBonus = getWeaponRankBonus(rank);

    return equipment.baseStats.map(stat => {
      let baseValue = stat.value;
      let finalValue = baseValue;
      let rankBonus = 0;
      let enhanceBonus = 0;
      let smithingBonus = 0;

      if (slot === 'weapon') {
        // 武器計算
        if (stat.stat === 'ATK') {
          rankBonus = weaponRankBonus.attackP;
          enhanceBonus = enhancementLevel * 2;
          smithingBonus = smithingCount * 1;
        } else if (stat.stat === 'CRI') {
          rankBonus = weaponRankBonus.critR;
        } else if (stat.stat === 'DEX') {
          rankBonus = weaponRankBonus.critD;
          enhanceBonus = enhancementLevel * 1;
        }
      } else if (['head', 'body', 'leg'].includes(slot)) {
        // 防具計算
        const isDefense = stat.stat === 'DEF';

        // ランク補正: base * (1 + base^0.2 * (rank / level))
        // 簡易計算: base * (1 + rank * 0.1)
        rankBonus = Math.round(baseValue * rankMultiplier * 0.1);

        // 強化ボーナス: +1〜2 per レベル
        enhanceBonus = isDefense ? enhancementLevel * 1 : enhancementLevel * 2;

        // 叩きボーナス: 守備力は+1, その他は+2 per 叩き回数
        smithingBonus = smithingCount * (isDefense ? 1 : 2);
      } else if (['arm'].includes(slot)) {
        // 腕防具（叩きなし）
        rankBonus = Math.round(baseValue * rankMultiplier * 0.1);
        enhanceBonus = enhancementLevel * 2;
      } else {
        // アクセサリー
        // ランク補正: base + (level / ランク補正係数)
        const rankDivisor = { SSS: 10, SS: 11, S: 12, A: 13, B: 13, C: 15, D: 15, E: 0, F: 0 }[rank] || 0;
        rankBonus = rankDivisor > 0 ? Math.round(40 / rankDivisor) : 0; // 仮のレベル40として計算
      }

      finalValue = baseValue + rankBonus + enhanceBonus + smithingBonus;

      return {
        stat: stat.stat,
        baseValue,
        rankBonus,
        enhanceBonus,
        smithingBonus,
        finalValue,
        isPercent: stat.isPercent,
      };
    });
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

  // ランク選択用のオプション生成
  const rankOptions: CustomSelectOption[] = RANKS.map(r => ({
    value: r,
    label: r,
    description: r === 'SSS' ? '最高ランク' : r === 'F' ? '初期ランク' : undefined,
  }));

  // 叩き回数選択用のオプション生成（0〜12）
  const smithingOptions: CustomSelectOption[] = Array.from({ length: 13 }, (_, i) => ({
    value: i.toString(),
    label: `${i}回`,
    description: i === 0 ? '未強化' : i === 12 ? '最大強化' : undefined,
  }));

  return (
    <div className={`p-6 rounded-xl bg-glass-dark backdrop-blur-md border border-white/20 relative overflow-hidden ${isSelectOpen ? 'z-50' : 'z-auto'} ${className}`}>
      {/* スロット名とカスタマイズ切替 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white/90">
          {getSlotDisplayName()}
        </h3>
        <div className="flex items-center gap-2">
          {equipment && (
            <>
              <button
                type="button"
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="px-3 py-1 text-sm rounded-lg bg-rpg-accent/20 text-rpg-accent hover:bg-rpg-accent/30 transition-all duration-200"
              >
                {showAdvancedSettings ? 'シンプル表示' : '詳細設定'}
              </button>
              <Tooltip content="装備を外す">
                <button
                  type="button"
                  onClick={() => onEquipmentChange(null)}
                  disabled={disabled}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-white/10"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </Tooltip>
            </>
          )}
        </div>
      </div>

      {/* 装備選択 */}
      <div className="mb-6">
        <CustomSelect
          options={[
            { value: '', label: '装備なし', description: '装備を外す' },
            ...availableEquipment.map(eq => ({
              value: eq.id,
              label: eq.name,
              description: eq.baseStats && eq.baseStats.length > 0
                ? eq.baseStats.map(s => `${s.stat}+${s.value}${s.isPercent ? '%' : ''}`).join(', ')
                : undefined,
            }))
          ]}
          value={equipment?.id || ''}
          onChange={(value) => {
            if (value === '') {
              onEquipmentChange(null);
            } else {
              const selected = availableEquipment.find(eq => eq.id === value);
              onEquipmentChange(selected || null);
            }
          }}
          placeholder="装備を選択してください"
          disabled={disabled}
          showIcon={false}
          onOpenChange={(open) => setIsSelectOpen(open)}
        />
      </div>

      {equipment && (
        <>
          {/* 基本カスタマイズ */}
          <div className={`space-y-4 ${showAdvancedSettings ? '' : ''}`}>
            {/* ランク選択 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                装備ランク
              </label>
              <CustomSelect
                options={rankOptions}
                value={rank}
                onChange={(value) => onRankChange?.(value)}
                placeholder="ランクを選択"
                disabled={disabled}
                showIcon={false}
                className="w-full"
                onOpenChange={(open) => setIsSelectOpen(open)}
              />
            </div>

            {/* 叩き回数（頭・胴・足防具のみ、または武器でSS以上のランクの場合） */}
            {(['head', 'body', 'leg'].includes(slot) || (slot === 'weapon' && ['SSS', 'SS'].includes(rank))) && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  叩き回数 {slot === 'weapon' ? '（SS以上で使用可）' : ''}
                </label>
                <CustomSelect
                  options={smithingOptions}
                  value={smithingCount?.toString() || '0'}
                  onChange={(value) => onSmithingCountChange?.(parseInt(value, 10))}
                  placeholder="叩き回数を選択"
                  disabled={disabled || (slot === 'weapon' && !['SSS', 'SS'].includes(rank))}
                  showIcon={false}
                  className="w-full"
                  onOpenChange={(open) => setIsSelectOpen(open)}
                />
                {['head', 'body', 'leg'].includes(slot) && (
                  <p className="text-xs text-gray-500 mt-1">
                    ※ SS以上は叩き回数を増やせます
                  </p>
                )}
              </div>
            )}

            {/* 強化レベル */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                強化レベル（+値）
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={getMaxEnhancement()}
                  value={enhancementLevel}
                  onChange={(e) => onEnhancementChange?.(parseInt(e.target.value, 10))}
                  disabled={disabled}
                  className="flex-1 h-2 bg-glass-light rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="w-16 text-center">
                  <input
                    type="number"
                    value={enhancementLevel}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val >= 0 && val <= getMaxEnhancement()) {
                        onEnhancementChange?.(val);
                      }
                    }}
                    min={0}
                    max={getMaxEnhancement()}
                    disabled={disabled}
                    className="w-full px-2 py-1 text-center bg-gray-800 border border-gray-600 rounded text-white text-sm"
                  />
                </div>
              </div>
              <div className="mt-1 text-xs text-gray-400">
                最大: +{getMaxEnhancement()}
              </div>
            </div>
          </div>

          {/* 詳細設定（拡張設定表示時のみ） */}
          {showAdvancedSettings && (
            <div className="mt-6 pt-6 border-t border-white/10 space-y-4">
              <h4 className="text-sm font-semibold text-gray-300 mb-3">拡張設定</h4>

              {/* 叩き詳細（武器の場合） */}
              {slot === 'weapon' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Toggle
                      label="叩き詳細設定"
                      checked={hasSmithing}
                      onChange={(val) => onSmithingChange?.(val)}
                      disabled={disabled}
                    />
                    {hasSmithing && (
                      <button
                        type="button"
                        onClick={() => setShowSmithingDetails(!showSmithingDetails)}
                        className="text-sm text-rpg-accent hover:text-rpg-accent/80"
                      >
                        {showSmithingDetails ? '詳細を隠す' : '詳細を表示'}
                      </button>
                    )}
                  </div>

                  {hasSmithing && showSmithingDetails && (
                    <div className="mt-3 p-4 bg-glass-light rounded-lg space-y-3">
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
              <div>
                <Toggle
                  label="錬金適用"
                  checked={hasAlchemy}
                  onChange={(val) => onAlchemyChange?.(val)}
                  disabled={disabled}
                />
                {hasAlchemy && (
                  <div className="mt-2 text-xs text-gray-400">
                    錬金効果が装備に適用されます
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 装備ステータス表示 */}
          {equipment.baseStats && equipment.baseStats.length > 0 && (
            <div className="mt-6 p-4 bg-glass-light rounded-lg">
              <h4 className="text-sm font-semibold text-gray-300 mb-3">
                装備ステータス
              </h4>

              {/* 計算済みステータス表示 */}
              <div className="space-y-2">
                {getCalculatedStats().map((calcStat, index) => (
                  <div key={index} className="p-2 bg-glass-dark/50 rounded">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">{calcStat.stat}</span>
                      <div className="flex items-center gap-2">
                        {/* 基礎値 */}
                        <span className="text-gray-500 text-xs">
                          {calcStat.baseValue}{calcStat.isPercent ? '%' : ''}
                        </span>
                        {/* 最終値 */}
                        <span className={`font-medium ${calcStat.finalValue > calcStat.baseValue ? 'text-green-400' : 'text-white'}`}>
                          → {calcStat.finalValue}{calcStat.isPercent ? '%' : ''}
                        </span>
                      </div>
                    </div>

                    {/* 内訳表示（変更がある場合のみ） */}
                    {(calcStat.rankBonus > 0 || calcStat.enhanceBonus > 0 || calcStat.smithingBonus > 0) && (
                      <div className="mt-1 flex flex-wrap gap-2 text-xs">
                        {calcStat.rankBonus > 0 && (
                          <span className="px-1.5 py-0.5 bg-purple-900/50 text-purple-300 rounded">
                            ランク +{calcStat.rankBonus}
                          </span>
                        )}
                        {calcStat.enhanceBonus > 0 && (
                          <span className="px-1.5 py-0.5 bg-blue-900/50 text-blue-300 rounded">
                            強化 +{calcStat.enhanceBonus}
                          </span>
                        )}
                        {calcStat.smithingBonus > 0 && (
                          <span className="px-1.5 py-0.5 bg-orange-900/50 text-orange-300 rounded">
                            叩き +{calcStat.smithingBonus}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* 設定サマリー */}
              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={`px-2 py-1 rounded ${getRankColor(rank)} bg-glass-dark/30`}>
                    ランク: {rank}
                  </span>
                  {enhancementLevel > 0 && (
                    <span className="px-2 py-1 rounded text-blue-400 bg-blue-900/30">
                      +{enhancementLevel}
                    </span>
                  )}
                  {smithingCount > 0 && (
                    <span className="px-2 py-1 rounded text-orange-400 bg-orange-900/30">
                      叩き {smithingCount}回
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// スライダーのカスタムスタイル
if (typeof document !== 'undefined' && !document.getElementById('equipment-slot-styles')) {
  const style = document.createElement('style');
  style.id = 'equipment-slot-styles';
  style.textContent = `
    .slider::-webkit-slider-thumb {
      appearance: none;
      width: 20px;
      height: 20px;
      background: linear-gradient(135deg, #60a5fa, #3b82f6);
      border-radius: 50%;
      cursor: pointer;
      transition: all 0.2s;
    }

    .slider::-webkit-slider-thumb:hover {
      transform: scale(1.1);
      box-shadow: 0 0 12px rgba(96, 165, 250, 0.5);
    }

    .slider::-moz-range-thumb {
      width: 20px;
      height: 20px;
      background: linear-gradient(135deg, #60a5fa, #3b82f6);
      border: none;
      border-radius: 50%;
      cursor: pointer;
      transition: all 0.2s;
    }

    .slider::-moz-range-thumb:hover {
      transform: scale(1.1);
      box-shadow: 0 0 12px rgba(96, 165, 250, 0.5);
    }

    .slider {
      background: linear-gradient(to right,
        rgba(96, 165, 250, 0.3) 0%,
        rgba(96, 165, 250, 0.1) 100%);
    }
  `;
  document.head.appendChild(style);
}