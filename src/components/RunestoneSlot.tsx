'use client';

import React, { useState, useMemo } from 'react';
import { RunestoneData, RunestoneGrade, RunestoneResistance } from '@/types/data';
import { CustomSelect, CustomSelectOption } from '@/components/CustomSelect';

/**
 * ルーンストーンスロットコンポーネントのプロパティ
 */
interface RunestoneSlotProps {
  /** 選択中のルーンストーン（最大4つ、各グレード1つずつ） */
  selectedRunes: RunestoneData[];
  /** 選択可能なルーンストーンリスト */
  availableRunes: RunestoneData[];
  /** ルーンストーン変更時のコールバック */
  onRunesChange: (runes: RunestoneData[]) => void;
  /** 無効化フラグ */
  disabled?: boolean;
}

/**
 * グレードごとの表示設定
 */
const GRADE_CONFIG: Record<RunestoneGrade, { label: string; color: string; bgColor: string; borderColor: string; icon: string }> = {
  'ノーマル': {
    label: 'ノーマル',
    color: 'text-gray-300',
    bgColor: 'bg-gray-700/30',
    borderColor: 'border-gray-500/30',
    icon: '◇',
  },
  'グレート': {
    label: 'グレート',
    color: 'text-green-300',
    bgColor: 'bg-green-700/30',
    borderColor: 'border-green-500/30',
    icon: '◆',
  },
  'バスター': {
    label: 'バスター',
    color: 'text-blue-300',
    bgColor: 'bg-blue-700/30',
    borderColor: 'border-blue-500/30',
    icon: '★',
  },
  'レプリカ': {
    label: 'レプリカ',
    color: 'text-purple-300',
    bgColor: 'bg-purple-700/30',
    borderColor: 'border-purple-500/30',
    icon: '✦',
  },
};

/**
 * グレード順序（表示順）
 */
const GRADE_ORDER: RunestoneGrade[] = ['ノーマル', 'グレート', 'バスター', 'レプリカ'];

/**
 * ルーンストーンの名前を取得（CSVカラム名の処理）
 */
const getRunestoneName = (rune: RunestoneData): string => {
  return rune['アイテム名（・<グレード>）は不要'] || '不明';
};

/**
 * ルーンストーンのステータス効果を表示用に整形
 */
const formatRunestoneStats = (rune: RunestoneData): string => {
  const stats: string[] = [];

  if (rune.力) stats.push(`力+${rune.力}`);
  if (rune.魔力) stats.push(`魔力+${rune.魔力}`);
  if (rune.体力) stats.push(`体力+${rune.体力}`);
  if (rune.精神) stats.push(`精神+${rune.精神}`);
  if (rune.素早さ) stats.push(`素早さ+${rune.素早さ}`);
  if (rune.器用) stats.push(`器用+${rune.器用}`);
  if (rune.撃力) stats.push(`撃力+${rune.撃力}`);
  if (rune.守備力) stats.push(`守備力+${rune.守備力}`);

  return stats.join(', ') || 'ステータス効果なし';
};

/**
 * ルーンストーンのステータス効果を配列形式で取得
 */
const getRunestoneStatEffects = (rune: RunestoneData): Array<{ name: string; value: number }> => {
  const effects: Array<{ name: string; value: number }> = [];

  if (rune.力) effects.push({ name: '力', value: rune.力 });
  if (rune.魔力) effects.push({ name: '魔力', value: rune.魔力 });
  if (rune.体力) effects.push({ name: '体力', value: rune.体力 });
  if (rune.精神) effects.push({ name: '精神', value: rune.精神 });
  if (rune.素早さ) effects.push({ name: '素早さ', value: rune.素早さ });
  if (rune.器用) effects.push({ name: '器用', value: rune.器用 });
  if (rune.撃力) effects.push({ name: '撃力', value: rune.撃力 });
  if (rune.守備力) effects.push({ name: '守備力', value: rune.守備力 });

  return effects;
};

/**
 * ルーンストーンの耐性効果を配列形式で取得
 */
const getRunestoneResistances = (rune: RunestoneData): RunestoneResistance[] => {
  const resistances: RunestoneResistance[] = [];

  if (rune.耐性1) resistances.push(rune.耐性1);
  if (rune.耐性2) resistances.push(rune.耐性2);
  if (rune.耐性3) resistances.push(rune.耐性3);
  if (rune.耐性4) resistances.push(rune.耐性4);
  if (rune.耐性5) resistances.push(rune.耐性5);
  if (rune.耐性6) resistances.push(rune.耐性6);

  return resistances;
};

/**
 * 耐性タイプに応じた色を取得
 */
const getResistanceColor = (type: string): string => {
  const colorMap: Record<string, string> = {
    '炎': 'text-red-400',
    '水': 'text-blue-400',
    '風': 'text-green-400',
    '雷': 'text-yellow-400',
    '闇': 'text-purple-400',
    '光': 'text-amber-300',
    '物理': 'text-orange-400',
    '魔力': 'text-indigo-400',
  };
  return colorMap[type] || 'text-gray-400';
};

/**
 * ルーンストーンスロットコンポーネント
 * 4つのグレード別にルーンストーンを選択可能
 */
export const RunestoneSlot: React.FC<RunestoneSlotProps> = ({
  selectedRunes,
  availableRunes,
  onRunesChange,
  disabled = false,
}) => {
  const [openGrade, setOpenGrade] = useState<RunestoneGrade | null>(null);

  // グレード別にルーンストーンをグループ化
  const runesByGrade = useMemo(() => {
    const grouped: Record<RunestoneGrade, RunestoneData[]> = {
      'ノーマル': [],
      'グレート': [],
      'バスター': [],
      'レプリカ': [],
    };

    availableRunes.forEach(rune => {
      if (rune.グレード && grouped[rune.グレード]) {
        grouped[rune.グレード].push(rune);
      }
    });

    return grouped;
  }, [availableRunes]);

  // 現在選択中のルーンストーンをグレード別に取得
  const selectedByGrade = useMemo(() => {
    const selected: Record<RunestoneGrade, RunestoneData | null> = {
      'ノーマル': null,
      'グレート': null,
      'バスター': null,
      'レプリカ': null,
    };

    selectedRunes.forEach(rune => {
      if (rune.グレード) {
        selected[rune.グレード] = rune;
      }
    });

    return selected;
  }, [selectedRunes]);

  // グレード別のルーンストーン選択ハンドラ
  const handleRuneChange = (grade: RunestoneGrade, runeName: string) => {
    let newRunes = selectedRunes.filter(r => r.グレード !== grade);

    if (runeName !== '') {
      const selectedRune = availableRunes.find(
        r => r.グレード === grade && getRunestoneName(r) === runeName
      );
      if (selectedRune) {
        newRunes.push(selectedRune);
      }
    }

    onRunesChange(newRunes);
  };

  // グレード別のセレクトオプション生成
  const getOptionsForGrade = (grade: RunestoneGrade): CustomSelectOption[] => {
    const options: CustomSelectOption[] = [
      { value: '', label: '未選択', description: 'ルーンストーンを外す' },
    ];

    runesByGrade[grade].forEach(rune => {
      const stats = formatRunestoneStats(rune);
      const resistances = getRunestoneResistances(rune);
      const resistanceText = resistances.length > 0
        ? ` / 耐性: ${resistances.map(r => `${r.type}${r.value >= 0 ? '+' : ''}${r.value}%`).join(', ')}`
        : '';

      options.push({
        value: getRunestoneName(rune),
        label: getRunestoneName(rune),
        description: stats + resistanceText,
        icon: GRADE_CONFIG[grade].icon,
      });
    });

    return options;
  };

  // 選択中のルーンストーンの合計ステータスを計算
  const totalStats = useMemo(() => {
    const total: Record<string, number> = {};

    selectedRunes.forEach(rune => {
      const effects = getRunestoneStatEffects(rune);
      effects.forEach(effect => {
        total[effect.name] = (total[effect.name] || 0) + effect.value;
      });
    });

    return Object.entries(total).map(([name, value]) => ({ name, value }));
  }, [selectedRunes]);

  // 選択中のルーンストーンの合計耐性を計算
  const totalResistances = useMemo(() => {
    const total: Record<string, number> = {};

    selectedRunes.forEach(rune => {
      const resistances = getRunestoneResistances(rune);
      resistances.forEach(res => {
        total[res.type] = (total[res.type] || 0) + res.value;
      });
    });

    return Object.entries(total).map(([type, value]) => ({ type, value }));
  }, [selectedRunes]);

  return (
    <div className="p-6 rounded-xl bg-gradient-to-br from-purple-900/20 to-indigo-900/20 border border-purple-500/30">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white/90 flex items-center gap-2">
          <span className="text-purple-400">💎</span>
          ルーンストーン
        </h3>
        <span className="text-xs text-gray-400">
          選択中: {selectedRunes.length}/4
        </span>
      </div>

      <p className="text-sm text-gray-400 mb-4">
        各グレードから1つずつ選択可能
      </p>

      {/* グレード別スロット */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {GRADE_ORDER.map(grade => {
          const config = GRADE_CONFIG[grade];
          const selectedRune = selectedByGrade[grade];
          const options = getOptionsForGrade(grade);

          return (
            <div
              key={grade}
              className={`p-4 rounded-lg ${config.bgColor} border ${config.borderColor}`}
            >
              {/* グレードラベル */}
              <div className="flex items-center justify-between mb-3">
                <span className={`font-semibold ${config.color} flex items-center gap-1`}>
                  <span>{config.icon}</span>
                  {config.label}
                </span>
                {selectedRune && (
                  <button
                    type="button"
                    onClick={() => handleRuneChange(grade, '')}
                    disabled={disabled}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded hover:bg-white/10"
                    title="ルーンストーンを外す"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* ルーンストーン選択 */}
              <CustomSelect
                options={options}
                value={selectedRune ? getRunestoneName(selectedRune) : ''}
                onChange={(value) => handleRuneChange(grade, value)}
                placeholder="選択してください"
                disabled={disabled || runesByGrade[grade].length === 0}
                showIcon={true}
                onOpenChange={(isOpen) => setOpenGrade(isOpen ? grade : null)}
              />

              {/* 選択中のルーンストーンの効果表示 */}
              {selectedRune && (
                <div className="mt-3 space-y-2">
                  {/* ステータス効果 */}
                  {getRunestoneStatEffects(selectedRune).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {getRunestoneStatEffects(selectedRune).map((effect, idx) => (
                        <span
                          key={idx}
                          className={`px-2 py-0.5 text-xs rounded ${effect.value >= 0 ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}
                        >
                          {effect.name}{effect.value >= 0 ? '+' : ''}{effect.value}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 耐性効果 */}
                  {getRunestoneResistances(selectedRune).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {getRunestoneResistances(selectedRune).map((res, idx) => (
                        <span
                          key={idx}
                          className={`px-2 py-0.5 text-xs rounded bg-gray-800/50 ${getResistanceColor(res.type)}`}
                        >
                          {res.type}{res.value >= 0 ? '+' : ''}{res.value}%
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ルーンストーンがない場合 */}
              {runesByGrade[grade].length === 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  このグレードのルーンストーンはありません
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* 合計ステータス表示 */}
      {selectedRunes.length > 0 && (totalStats.length > 0 || totalResistances.length > 0) && (
        <div className="mt-6 p-4 bg-glass-light rounded-lg">
          <h4 className="text-sm font-semibold text-purple-300 mb-3">
            合計ステータス効果
          </h4>

          {/* ステータス合計 */}
          {totalStats.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {totalStats.map((stat, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 bg-glass-dark/50 rounded"
                >
                  <span className="text-gray-400 text-xs">{stat.name}</span>
                  <span className={`text-sm font-medium ${stat.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stat.value >= 0 ? '+' : ''}{stat.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 耐性合計 */}
          {totalResistances.length > 0 && (
            <>
              <h5 className="text-xs font-medium text-gray-400 mb-2">耐性効果</h5>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {totalResistances.map((res, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-glass-dark/50 rounded"
                  >
                    <span className={`text-xs ${getResistanceColor(res.type)}`}>{res.type}</span>
                    <span className={`text-sm font-medium ${res.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {res.value >= 0 ? '+' : ''}{res.value}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ルーンストーン未選択時のヒント */}
      {selectedRunes.length === 0 && (
        <div className="text-center py-4 text-gray-500 text-sm">
          <p>ルーンストーンを装備するとステータスと耐性を得られます</p>
        </div>
      )}
    </div>
  );
};

export default RunestoneSlot;
