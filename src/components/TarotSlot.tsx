'use client';

import React, { useMemo, useCallback } from 'react';
import {
  TarotCalcData,
  TarotCardDefinition,
  TarotSubOptionDefinition,
  SelectedTarot,
  SelectedTarotSubOption
} from '@/types/data';
import { DebugTarotStats } from '@/types';
import { CustomSelect, CustomSelectOption } from '@/components/CustomSelect';
import { useBuildStore } from '@/store/buildStore';

/**
 * タロットスロットコンポーネントのプロパティ
 */
interface TarotSlotProps {
  /** タロットカード定義データ（CSVから読み込み） */
  tarotCards: TarotCardDefinition[] | null;
  /** タロット計算データ（YAMLから読み込み） */
  tarotCalcData: TarotCalcData | null;
  /** 選択中のタロット */
  selectedTarot: SelectedTarot | null;
  /** タロット変更時のコールバック */
  onTarotChange: (tarot: SelectedTarot | null) => void;
  /** 無効化フラグ */
  disabled?: boolean;
}

/**
 * タロットレベルから解放されるサブオプションスロット数を計算
 */
const getUnlockedSubOptionSlots = (level: number, slots: { UnlockLevel: number }[]): number => {
  return slots.filter(slot => level >= slot.UnlockLevel).length;
};

/**
 * タロットレベルからメインステータスの現在値を計算
 * Lv0-4: tier0 = 1 * increasePerTier（初期値）
 * Lv5-9: tier1 = 2 * increasePerTier
 * Lv10-14: tier2 = 3 * increasePerTier
 * Lv15-19: tier3 = 4 * increasePerTier
 * Lv20: tier4 = 5 * increasePerTier
 */
const calculateMainStatValue = (increasePerTier: number, level: number, tierInterval: number): number => {
  // 5レベルごとにtierが上がる (Lv0-4=tier0, Lv5-9=tier1, ...)
  const tier = Math.floor(level / tierInterval);
  // tier + 1 を乗算（Lv0でも初期値が入る）
  return increasePerTier * (tier + 1);
};

/**
 * サブオプションの値を計算
 */
const calculateSubOptionValue = (valuePerLevel: number, level: number): number => {
  return valuePerLevel * level;
};

/**
 * サブオプション定義を配列形式に変換
 */
const getSubOptionsArray = (subOptions: TarotCalcData['SubOptions']): TarotSubOptionDefinition[] => {
  return Object.entries(subOptions).map(([id, def]) => ({
    id,
    ...def,
  }));
};

/**
 * タロットスロットコンポーネント
 * タロットカード、レベル、サブオプションの選択を行う
 */
export const TarotSlot: React.FC<TarotSlotProps> = ({
  tarotCards,
  tarotCalcData,
  selectedTarot,
  onTarotChange,
  disabled = false,
}) => {
  // ストアからデバッグ状態を取得
  const {
    isDebugTarot,
    debugTarot,
    setIsDebugTarot,
    setDebugTarot,
  } = useBuildStore();

  // データがない場合
  if (!tarotCards || !tarotCalcData) {
    return (
      <div className="glass-card p-8">
        <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
          <span className="text-3xl">🃏</span>
          <span className="truncate">タロット</span>
        </h2>
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">タロットデータを読み込み中...</p>
        </div>
      </div>
    );
  }

  const constants = tarotCalcData.TarotConstants;
  const subOptionsArray = useMemo(() => getSubOptionsArray(tarotCalcData.SubOptions), [tarotCalcData.SubOptions]);

  // カード選択オプション（デバッグ用オプションを一番下に追加）
  const cardOptions: CustomSelectOption[] = useMemo(() => {
    const options: CustomSelectOption[] = [
      { value: '', label: 'タロットなし', description: 'タロットを外す' },
    ];

    tarotCards.forEach(card => {
      // メインステータスの説明を生成
      const mainStatsDesc = card.mainStats
        .map(stat => `${stat.label}`)
        .join('、');

      options.push({
        value: card.id,
        label: card.name,
        description: mainStatsDesc + ' 上昇',
        icon: '🃏',
      });
    });

    // デバッグ用オプションを一番下に追加
    options.push({ value: 'debug', label: '(デバッグ用)', description: 'すべてのバフを直接入力' });

    return options;
  }, [tarotCards]);

  // 現在選択中のカード情報
  const currentCard = useMemo(() => {
    if (!selectedTarot) return null;
    return tarotCards.find(c => c.id === selectedTarot.cardId) || null;
  }, [selectedTarot, tarotCards]);

  // 解放されているサブオプションスロット数
  const unlockedSlots = useMemo(() => {
    if (!selectedTarot) return 0;
    return getUnlockedSubOptionSlots(selectedTarot.level, tarotCalcData.SubOptionSlots);
  }, [selectedTarot, tarotCalcData]);

  // 選択済みのサブオプションID一覧（重複防止用）
  const selectedSubOptionIds = useMemo(() => {
    if (!selectedTarot) return new Set<string>();
    // undefinedをフィルタリング
    return new Set(
      selectedTarot.subOptions
        .filter((so): so is { optionId: string; level: number } => so !== undefined && so !== null)
        .map(so => so.optionId)
    );
  }, [selectedTarot]);

  // サブオプション選択用オプション（スロットごとにフィルタリング）
  const getSubOptionOptions = useCallback((slotIndex: number): CustomSelectOption[] => {
    const currentOptionId = selectedTarot?.subOptions[slotIndex]?.optionId || '';

    const options: CustomSelectOption[] = [
      { value: '', label: 'なし', description: 'サブオプションを選択' },
    ];

    subOptionsArray.forEach(opt => {
      // 既に他のスロットで選択されているものは除外（ただし現在のスロットで選択中のものは含む）
      if (selectedSubOptionIds.has(opt.id) && opt.id !== currentOptionId) {
        return;
      }

      options.push({
        value: opt.id,
        label: opt.Name,
        description: `Lv毎 +${opt.ValuePerLevel}${opt.IsPercent ? '%' : ''}`,
      });
    });

    return options;
  }, [subOptionsArray, selectedSubOptionIds, selectedTarot]);

  // カード選択ハンドラ
  const handleCardChange = useCallback((value: string) => {
    if (value === 'debug') {
      setIsDebugTarot(true);
      setDebugTarot({
        powerPercent: 0,
        magicPercent: 0,
        hpPercent: 0,
        mindPercent: 0,
        agilityPercent: 0,
        dexPercent: 0,
        defensePercent: 0,
        critDamagePercent: 0,
        critRate: 0,
        critDamage: 0,
        damageCorrection: 0,
        attackPower: 0,
        allDamageBuff: 0,
        physicalDamageBuff: 0,
        magicDamageBuff: 0,
        noneDamageBuff: 0,
        lightDamageBuff: 0,
        darkDamageBuff: 0,
        windDamageBuff: 0,
        fireDamageBuff: 0,
        waterDamageBuff: 0,
        thunderDamageBuff: 0,
      });
      onTarotChange(null);
    } else if (value === '') {
      setIsDebugTarot(false);
      onTarotChange(null);
    } else {
      setIsDebugTarot(false);
      onTarotChange({
        cardId: value,
        level: 0, // 初期レベルを0に変更
        subOptions: [],
      });
    }
  }, [onTarotChange, setIsDebugTarot, setDebugTarot]);

  // レベル変更ハンドラ
  const handleLevelChange = useCallback((level: number) => {
    if (!selectedTarot) return;

    // 新しいレベルで解放されるスロット数
    const newUnlockedSlots = getUnlockedSubOptionSlots(level, tarotCalcData.SubOptionSlots);

    // 解放数を超えるサブオプションは削除
    const newSubOptions = selectedTarot.subOptions.slice(0, newUnlockedSlots);

    onTarotChange({
      ...selectedTarot,
      level,
      subOptions: newSubOptions,
    });
  }, [selectedTarot, onTarotChange, tarotCalcData]);

  // サブオプション選択ハンドラ
  const handleSubOptionChange = useCallback((slotIndex: number, optionId: string) => {
    if (!selectedTarot) return;

    const newSubOptions = [...selectedTarot.subOptions];

    if (optionId === '') {
      // オプションを削除
      newSubOptions.splice(slotIndex, 1);
    } else {
      // オプションを設定または更新
      if (newSubOptions[slotIndex]) {
        newSubOptions[slotIndex] = { optionId, level: newSubOptions[slotIndex].level };
      } else {
        newSubOptions[slotIndex] = { optionId, level: 1 };
      }
    }

    onTarotChange({
      ...selectedTarot,
      subOptions: newSubOptions,
    });
  }, [selectedTarot, onTarotChange]);

  // サブオプションレベル変更ハンドラ
  const handleSubOptionLevelChange = useCallback((slotIndex: number, level: number) => {
    if (!selectedTarot || !selectedTarot.subOptions[slotIndex]) return;

    const newSubOptions = [...selectedTarot.subOptions];
    newSubOptions[slotIndex] = { ...newSubOptions[slotIndex], level };

    onTarotChange({
      ...selectedTarot,
      subOptions: newSubOptions,
    });
  }, [selectedTarot, onTarotChange]);

  return (
    <div className="glass-card p-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <span className="text-3xl">🃏</span>
          <span className="truncate">タロット</span>
        </h2>
        {(selectedTarot || isDebugTarot) && (
          <button
            type="button"
            onClick={() => {
              setIsDebugTarot(false);
              onTarotChange(null);
            }}
            disabled={disabled}
            className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-white/10"
            title="タロットを外す"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* タロットカード選択 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">タロットカード</label>
        <CustomSelect
          options={cardOptions}
          value={isDebugTarot ? 'debug' : (selectedTarot?.cardId || '')}
          onChange={handleCardChange}
          placeholder="タロットカードを選択"
          disabled={disabled}
          showIcon={true}
        />
      </div>

      {/* デバッグ用入力UI */}
      {isDebugTarot && debugTarot && (
        <div className="space-y-4 p-4 bg-gradient-to-br from-red-900/30 to-orange-900/30 rounded-lg border border-red-700/50">
          <h4 className="text-sm font-medium text-red-300 flex items-center gap-2">
            <span>🔧</span>
            デバッグ用タロットステータス入力
          </h4>

          {/* ステータス%ボーナス */}
          <div className="p-3 bg-purple-900/30 rounded-lg">
            <h5 className="text-xs text-purple-300 mb-2">ステータス%ボーナス</h5>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'powerPercent', label: '力%' },
                { key: 'magicPercent', label: '魔力%' },
                { key: 'hpPercent', label: '体力%' },
                { key: 'mindPercent', label: '精神%' },
                { key: 'agilityPercent', label: '素早さ%' },
                { key: 'dexPercent', label: '器用%' },
                { key: 'defensePercent', label: '守備力%' },
                { key: 'critDamagePercent', label: '撃力%' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-400 mb-1">{label}</label>
                  <input
                    type="number"
                    value={debugTarot[key as keyof DebugTarotStats]}
                    onChange={(e) => setDebugTarot({ ...debugTarot, [key]: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 武器関連固定値 */}
          <div className="p-3 bg-blue-900/30 rounded-lg">
            <h5 className="text-xs text-blue-300 mb-2">武器関連固定値</h5>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'critRate', label: '会心率' },
                { key: 'critDamage', label: '会心ダメージ' },
                { key: 'damageCorrection', label: 'ダメージ補正' },
                { key: 'attackPower', label: '武器攻撃力' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-400 mb-1">{label}</label>
                  <input
                    type="number"
                    value={debugTarot[key as keyof DebugTarotStats]}
                    onChange={(e) => setDebugTarot({ ...debugTarot, [key]: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ダメージバフ */}
          <div className="p-3 bg-orange-900/30 rounded-lg">
            <h5 className="text-xs text-orange-300 mb-2">ダメージバフ</h5>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'allDamageBuff', label: '全ダメージ%' },
                { key: 'physicalDamageBuff', label: '物理%' },
                { key: 'magicDamageBuff', label: '魔法%' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-400 mb-1">{label}</label>
                  <input
                    type="number"
                    value={debugTarot[key as keyof DebugTarotStats]}
                    onChange={(e) => setDebugTarot({ ...debugTarot, [key]: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 属性ダメージバフ */}
          <div className="p-3 bg-green-900/30 rounded-lg">
            <h5 className="text-xs text-green-300 mb-2">属性ダメージバフ</h5>
            <div className="grid grid-cols-4 gap-2">
              {[
                { key: 'noneDamageBuff', label: '無%' },
                { key: 'fireDamageBuff', label: '炎%' },
                { key: 'waterDamageBuff', label: '水%' },
                { key: 'thunderDamageBuff', label: '雷%' },
                { key: 'windDamageBuff', label: '風%' },
                { key: 'lightDamageBuff', label: '光%' },
                { key: 'darkDamageBuff', label: '闇%' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-400 mb-1">{label}</label>
                  <input
                    type="number"
                    value={debugTarot[key as keyof DebugTarotStats]}
                    onChange={(e) => setDebugTarot({ ...debugTarot, [key]: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* タロット選択時の詳細設定（通常モード時のみ表示） */}
      {!isDebugTarot && selectedTarot && currentCard && (
        <>
          {/* レベル設定 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              タロットレベル: <span className="text-purple-400 font-bold">{selectedTarot.level}</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={constants.MaxLevel}
                value={selectedTarot.level}
                onChange={(e) => handleLevelChange(parseInt(e.target.value))}
                disabled={disabled}
                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
              <input
                type="number"
                min={0}
                max={constants.MaxLevel}
                value={selectedTarot.level}
                onChange={(e) => handleLevelChange(Math.min(constants.MaxLevel, Math.max(0, parseInt(e.target.value) || 0)))}
                disabled={disabled}
                className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-center text-white"
              />
            </div>
          </div>

          {/* メインステータス表示 */}
          <div className="mb-6 p-4 bg-gradient-to-r from-purple-900/30 to-indigo-900/30 rounded-lg border border-purple-500/30">
            <h4 className="text-sm font-semibold text-purple-300 mb-2">メインステータス</h4>
            {currentCard.mainStats.map((mainStat, index) => {
              const currentValue = calculateMainStatValue(
                mainStat.increasePerTier,
                selectedTarot.level,
                constants.TierInterval
              );
              return (
                <div key={index} className="flex items-center justify-between mb-1">
                  <span className="text-gray-300">{mainStat.label}</span>
                  <span className="text-xl font-bold text-purple-400">
                    +{currentValue}%
                  </span>
                </div>
              );
            })}
            <div className="mt-2 text-xs text-gray-500">
              (5レベル毎に上昇)
            </div>
          </div>

          {/* サブオプション設定 */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-300">
              サブオプション
              <span className="text-purple-400 ml-2">({unlockedSlots}スロット解放)</span>
            </h4>

            {tarotCalcData.SubOptionSlots.map((slot, index) => {
              const isUnlocked = selectedTarot.level >= slot.UnlockLevel;
              const currentSubOption = selectedTarot.subOptions[index];
              const subOptionDef = currentSubOption
                ? subOptionsArray.find(o => o.id === currentSubOption.optionId)
                : null;

              return (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${
                    isUnlocked
                      ? 'bg-gray-800/50 border-gray-600'
                      : 'bg-gray-900/30 border-gray-700/50 opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-sm font-medium ${isUnlocked ? 'text-gray-300' : 'text-gray-500'}`}>
                      スロット {index + 1}
                    </span>
                    {!isUnlocked && (
                      <span className="text-xs text-gray-500">
                        (Lv.{slot.UnlockLevel}で解放)
                      </span>
                    )}
                  </div>

                  {isUnlocked ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* サブオプション選択 */}
                      <div>
                        <CustomSelect
                          options={getSubOptionOptions(index)}
                          value={currentSubOption?.optionId || ''}
                          onChange={(value) => handleSubOptionChange(index, value)}
                          placeholder="オプション選択"
                          disabled={disabled}
                        />
                      </div>

                      {/* サブオプションレベル */}
                      {currentSubOption && subOptionDef && (
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-400 whitespace-nowrap">Lv:</label>
                          <select
                            value={currentSubOption.level}
                            onChange={(e) => handleSubOptionLevelChange(index, parseInt(e.target.value))}
                            disabled={disabled}
                            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                          >
                            {Array.from({ length: constants.MaxSubOptionLevel }, (_, i) => i + 1).map(lv => (
                              <option key={lv} value={lv}>
                                Lv.{lv} (+{calculateSubOptionValue(subOptionDef.ValuePerLevel, lv)}{subOptionDef.IsPercent ? '%' : ''})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-2 text-gray-600 text-sm">
                      タロットレベルを上げると解放されます
                    </div>
                  )}

                  {/* 現在の効果表示 */}
                  {isUnlocked && currentSubOption && subOptionDef && (
                    <div className="mt-2 text-right text-sm text-green-400">
                      {subOptionDef.Name}: +{calculateSubOptionValue(subOptionDef.ValuePerLevel, currentSubOption.level)}
                      {subOptionDef.IsPercent ? '%' : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* タロット未選択時のヒント */}
      {!selectedTarot && !isDebugTarot && (
        <div className="text-center py-8 text-gray-500">
          <p>タロットカードを装備するとステータスバフを得られます</p>
          <p className="text-sm mt-2">5レベル毎にメインステータスが上昇し、サブオプションが解放されます</p>
        </div>
      )}
    </div>
  );
};

export default TarotSlot;
