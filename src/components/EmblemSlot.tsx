'use client';

import React, { useState, useMemo } from 'react';
import { EmblemData } from '@/types/data';
import { DebugEmblemStats } from '@/types';
import { CustomSelect, CustomSelectOption } from '@/components/CustomSelect';
import { useBuildStore } from '@/store/buildStore';

/**
 * 紋章スロットコンポーネントのプロパティ
 */
interface EmblemSlotProps {
  /** 選択中の紋章 */
  emblem: EmblemData | null;
  /** 選択可能な紋章リスト */
  availableEmblems: EmblemData[];
  /** 紋章変更時のコールバック */
  onEmblemChange: (emblem: EmblemData | null) => void;
  /** 無効化フラグ */
  disabled?: boolean;
  /** 現在のキャラクターレベル（レベル制限フィルタ用） */
  characterLevel?: number;
}

/**
 * 紋章のステータス効果を表示用に整形
 * CSVの「〇〇（%不要）」カラムは%補正として扱う
 */
const formatEmblemStats = (emblem: EmblemData): string => {
  const stats: string[] = [];

  if (emblem['力（%不要）']) stats.push(`力+${emblem['力（%不要）']}%`);
  if (emblem['魔力（%不要）']) stats.push(`魔力+${emblem['魔力（%不要）']}%`);
  if (emblem['体力（%不要）']) stats.push(`体力+${emblem['体力（%不要）']}%`);
  if (emblem['精神（%不要）']) stats.push(`精神+${emblem['精神（%不要）']}%`);
  if (emblem['素早さ（%不要）']) stats.push(`素早さ+${emblem['素早さ（%不要）']}%`);
  if (emblem['器用（%不要）']) stats.push(`器用+${emblem['器用（%不要）']}%`);
  if (emblem['撃力（%不要）']) stats.push(`撃力+${emblem['撃力（%不要）']}%`);
  if (emblem['守備力（%不要）']) stats.push(`守備力+${emblem['守備力（%不要）']}%`);

  return stats.join(', ') || 'ステータス効果なし';
};

/**
 * 紋章のステータス効果を配列形式で取得
 */
const getEmblemStatEffects = (emblem: EmblemData): Array<{ name: string; value: number }> => {
  const effects: Array<{ name: string; value: number }> = [];

  if (emblem['力（%不要）']) effects.push({ name: '力', value: emblem['力（%不要）'] });
  if (emblem['魔力（%不要）']) effects.push({ name: '魔力', value: emblem['魔力（%不要）'] });
  if (emblem['体力（%不要）']) effects.push({ name: '体力', value: emblem['体力（%不要）'] });
  if (emblem['精神（%不要）']) effects.push({ name: '精神', value: emblem['精神（%不要）'] });
  if (emblem['素早さ（%不要）']) effects.push({ name: '素早さ', value: emblem['素早さ（%不要）'] });
  if (emblem['器用（%不要）']) effects.push({ name: '器用', value: emblem['器用（%不要）'] });
  if (emblem['撃力（%不要）']) effects.push({ name: '撃力', value: emblem['撃力（%不要）'] });
  if (emblem['守備力（%不要）']) effects.push({ name: '守備力', value: emblem['守備力（%不要）'] });

  return effects;
};

/**
 * 紋章スロットコンポーネント
 * 紋章の選択とステータス効果の表示を行う
 */
export const EmblemSlot: React.FC<EmblemSlotProps> = ({
  emblem,
  availableEmblems,
  onEmblemChange,
  disabled = false,
  characterLevel = 999,
}) => {
  const [isSelectOpen, setIsSelectOpen] = useState(false);

  // ストアからデバッグ状態を取得
  const {
    isDebugEmblem,
    debugEmblem,
    setIsDebugEmblem,
    setDebugEmblem,
  } = useBuildStore();

  // レベル制限を考慮したフィルタリング
  const filteredEmblems = useMemo(() => {
    return availableEmblems.filter(e => e.使用可能Lv <= characterLevel);
  }, [availableEmblems, characterLevel]);

  // セレクトオプションの生成（デバッグ用オプションを一番下に追加）
  const emblemOptions: CustomSelectOption[] = useMemo(() => {
    const options: CustomSelectOption[] = [
      { value: '', label: '紋章なし', description: '紋章を外す' },
    ];

    filteredEmblems.forEach(e => {
      options.push({
        value: e.アイテム名,
        label: e.アイテム名,
        description: formatEmblemStats(e),
        icon: '🏅',
      });
    });

    // デバッグ用オプションを一番下に追加
    options.push({ value: 'debug', label: '(デバッグ用)', description: '%補正を直接入力' });

    return options;
  }, [filteredEmblems]);

  // 紋章選択ハンドラ
  const handleEmblemChange = (value: string) => {
    if (value === 'debug') {
      setIsDebugEmblem(true);
      setDebugEmblem({
        powerPercent: 0,
        magicPercent: 0,
        hpPercent: 0,
        mindPercent: 0,
        agilityPercent: 0,
        dexPercent: 0,
        critDamagePercent: 0,
        defensePercent: 0,
      });
      onEmblemChange(null);
    } else if (value === '') {
      setIsDebugEmblem(false);
      onEmblemChange(null);
    } else {
      setIsDebugEmblem(false);
      const selected = availableEmblems.find(e => e.アイテム名 === value);
      onEmblemChange(selected || null);
    }
  };

  // 現在選択中の紋章のステータス効果
  const currentEffects = emblem ? getEmblemStatEffects(emblem) : [];

  return (
    <div className={`p-6 rounded-xl bg-gradient-to-br from-amber-900/20 to-yellow-900/20 border border-amber-500/30 ${isSelectOpen ? 'z-50 overflow-visible' : 'z-auto overflow-hidden'}`}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white/90 flex items-center gap-2">
          <span className="text-amber-400">🏅</span>
          紋章
        </h3>
        {(emblem || isDebugEmblem) && (
          <button
            type="button"
            onClick={() => {
              setIsDebugEmblem(false);
              onEmblemChange(null);
            }}
            disabled={disabled}
            className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-white/10"
            title="紋章を外す"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* 紋章選択 */}
      <div className="mb-4">
        <CustomSelect
          options={emblemOptions}
          value={isDebugEmblem ? 'debug' : (emblem?.アイテム名 || '')}
          onChange={handleEmblemChange}
          placeholder="紋章を選択してください"
          disabled={disabled}
          showIcon={true}
          onOpenChange={setIsSelectOpen}
        />
      </div>

      {/* デバッグ用入力UI */}
      {isDebugEmblem && (
        <div className="p-4 bg-gradient-to-br from-red-900/30 to-orange-900/30 rounded-lg border border-red-700/50">
          <h4 className="text-sm font-medium text-red-300 mb-3 flex items-center gap-2">
            <span>🔧</span>
            デバッグ用%補正入力
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'powerPercent', label: '力%' },
              { key: 'magicPercent', label: '魔力%' },
              { key: 'hpPercent', label: '体力%' },
              { key: 'mindPercent', label: '精神%' },
              { key: 'agilityPercent', label: '素早さ%' },
              { key: 'dexPercent', label: '器用%' },
              { key: 'critDamagePercent', label: '撃力%' },
              { key: 'defensePercent', label: '守備力%' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs text-gray-400 mb-1">{label}</label>
                <input
                  type="number"
                  value={debugEmblem?.[key as keyof DebugEmblemStats] || 0}
                  onChange={(e) => setDebugEmblem({
                    ...debugEmblem!,
                    [key]: parseFloat(e.target.value) || 0
                  })}
                  className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 選択中の紋章のステータス表示 */}
      {!isDebugEmblem && emblem && currentEffects.length > 0 && (
        <div className="mt-4 p-4 bg-glass-light rounded-lg">
          <h4 className="text-sm font-semibold text-amber-300 mb-3">
            ステータス効果（%補正）
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {currentEffects.map((effect, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-glass-dark/50 rounded"
              >
                <span className="text-gray-400 text-sm">{effect.name}</span>
                <span className={`font-medium ${effect.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {effect.value >= 0 ? '+' : ''}{effect.value}%
                </span>
              </div>
            ))}
          </div>
          {emblem.使用可能Lv > 0 && (
            <div className="mt-3 pt-3 border-t border-white/10 text-xs text-gray-400">
              必要レベル: Lv.{emblem.使用可能Lv}
            </div>
          )}
        </div>
      )}

      {/* 紋章未選択時のヒント */}
      {!emblem && !isDebugEmblem && (
        <div className="text-center py-4 text-gray-500 text-sm">
          <p>紋章を装備すると%ステータス補正を得られます</p>
        </div>
      )}
    </div>
  );
};

export default EmblemSlot;
