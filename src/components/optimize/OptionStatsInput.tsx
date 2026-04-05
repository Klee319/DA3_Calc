'use client';

import React from 'react';
import { useOptimizeStore } from '@/store/optimizeStore';
import { InternalStatKey } from '@/types/calc';

// オプション値として設定可能なステータス
const OPTION_STATS: { key: InternalStatKey; label: string; description: string }[] = [
  { key: 'Power', label: '力', description: '食べ物、バフ等からの追加力' },
  { key: 'Magic', label: '魔力', description: '食べ物、バフ等からの追加魔力' },
  { key: 'HP', label: 'HP', description: '食べ物、バフ等からの追加HP' },
  { key: 'Mind', label: '精神', description: '食べ物、バフ等からの追加精神' },
  { key: 'Agility', label: '素早さ', description: '食べ物、バフ等からの追加素早さ' },
  { key: 'Dex', label: '器用', description: '食べ物、バフ等からの追加器用' },
  { key: 'CritRate', label: '会心率', description: '食べ物、バフ等からの追加会心率 (%)' },
  { key: 'CritDamage', label: '撃力', description: '食べ物、バフ等からの追加撃力' },
  { key: 'Defense', label: '守備力', description: '食べ物、バフ等からの追加守備力' },
];

export function OptionStatsInput() {
  const { userOption, setUserOption } = useOptimizeStore();

  const handleStatChange = (key: InternalStatKey, value: string) => {
    const numValue = value === '' ? undefined : Number(value);
    const newOption = { ...userOption };
    if (numValue === undefined || numValue === 0) {
      delete newOption[key];
    } else {
      newOption[key] = numValue;
    }
    setUserOption(newOption);
  };

  const resetOptionStats = () => {
    setUserOption({});
  };

  // 設定されている値の数をカウント
  const setCount = Object.values(userOption).filter((v) => v !== undefined && v !== 0).length;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs text-white/50">
          最終ステータスにこの値が加算された前提で最適化します
        </p>
        {setCount > 0 && (
          <button
            onClick={resetOptionStats}
            className="text-xs text-white/40 hover:text-white transition-colors"
          >
            クリア
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {OPTION_STATS.map(({ key, label, description }) => (
          <div key={key} className="space-y-1">
            <label className="text-xs text-white/50" title={description}>
              {label}
            </label>
            <input
              type="number"
              min={0}
              value={userOption[key] ?? ''}
              onChange={(e) => handleStatChange(key, e.target.value)}
              placeholder="0"
              aria-label={`${label}の追加値`}
              className="w-full input-secondary text-sm"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
