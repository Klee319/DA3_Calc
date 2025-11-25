'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Equipment, EquipSlot, SmithingCounts, SmithingParamType, StatType } from '@/types';
import { ArmorData, EqConstData } from '@/types/data';
import { Toggle } from '@/components/ui/Toggle';
import { NumberInput } from '@/components/ui/NumberInput';
import { Tooltip } from '@/components/ui/Tooltip';
import { CustomSelect, CustomSelectOption } from '@/components/CustomSelect';

// 防具タイプの定義
type ArmorMaterialType = '布' | '革' | '金属';
const ARMOR_TYPES: ArmorMaterialType[] = ['布', '革', '金属'];

// 防具タイプのアイコンと説明
const ARMOR_TYPE_INFO: Record<ArmorMaterialType, { icon: string; description: string }> = {
  '布': { icon: '&#129525;', description: '魔法系向け・軽量' },
  '革': { icon: '&#129422;', description: 'バランス型' },
  '金属': { icon: '&#128737;', description: '防御特化・重装' },
};

// StatTypeから叩きパラメータ名への変換マッピング
// 注: HIT = 撃力、CRI = 会心率（武器固有）
const STAT_TO_SMITHING_PARAM: Partial<Record<StatType, SmithingParamType>> = {
  ATK: '力',
  MATK: '魔力',
  HP: '体力',
  MDEF: '精神',
  AGI: '素早さ',
  DEX: '器用',
  HIT: '撃力',  // 撃力はHITにマッピング
  DEF: '守備力',
};

// 最大叩き回数
const MAX_SMITHING_COUNT = 12;

// デフォルト値（YAMLがロードされていない場合のフォールバック）
const DEFAULT_SMITHING_BONUS = {
  Defence: 1,  // 守備力の叩き1回あたり+1
  Other: 2,    // その他のパラメータの叩き1回あたり+2
} as const;

const DEFAULT_REINFORCEMENT_BONUS = {
  Defence: 2,  // 守備力の強化1回あたり+2（EqConst.yaml準拠）
  Other: 2,    // その他のパラメータの強化1回あたり+2
} as const;

const DEFAULT_WEAPON_SMITHING_BONUS = 1;  // すべてのパラメータで1回あたり+1

// 武器用叩きパラメータ
type WeaponSmithingParamType = '攻撃力' | '会心率' | '会心ダメージ';
const WEAPON_SMITHING_PARAMS: WeaponSmithingParamType[] = ['攻撃力', '会心率', '会心ダメージ'];

// EXステータスのオプション定義
const EX_STAT_OPTIONS = [
  { value: 'power', label: '力', category: 'Other' as const },
  { value: 'magic', label: '魔力', category: 'Other' as const },
  { value: 'hp', label: '体力', category: 'Other' as const },
  { value: 'mind', label: '精神', category: 'Other' as const },
  { value: 'speed', label: '素早さ', category: 'Speed_CritD' as const },
  { value: 'dex', label: '器用', category: 'CritR' as const },
  { value: 'critDamage', label: '撃力', category: 'Speed_CritD' as const },
  { value: 'defense', label: '守備力', category: 'Other' as const },
];

// EX値計算のカテゴリ型
type ExCategory = 'CritR' | 'Speed_CritD' | 'Other';

// EX値計算関数（EqConst.yaml準拠）
const calculateExValue = (level: number, rank: string, category: ExCategory): number => {
  const coefficients = {
    CritR: { SSS: 0.15, SS: 0.13, S: 0.11, A: 0.09, B: 0.09, C: 0.07, D: 0.07, E: 0.05, F: 0.05 },
    Speed_CritD: { SSS: 0.6, SS: 0.5, S: 0.4, A: 0.3, B: 0.3, C: 0.2, D: 0.2, E: 0.1, F: 0.1 },
    Other: { SSS: 0.7, SS: 0.6, S: 0.5, A: 0.4, B: 0.4, C: 0.3, D: 0.3, E: 0.2, F: 0.2 },
  };
  const coeff = coefficients[category][rank as keyof typeof coefficients.CritR] || 0;
  return Math.round(level * coeff + 1);
};

// EXステータス値からカテゴリを取得する関数
const getExCategory = (exStatValue: string): ExCategory => {
  const option = EX_STAT_OPTIONS.find(o => o.value === exStatValue);
  return option?.category || 'Other';
};

// EXステータスの型定義
interface ExStats {
  ex1?: string;
  ex2?: string;
}

interface EquipmentSlotProps {
  slot: EquipSlot;
  equipment: Equipment | null;
  availableEquipment: Equipment[];
  onEquipmentChange: (equipment: Equipment | null) => void;
  enhancementLevel?: number;
  onEnhancementChange?: (level: number) => void;
  rank?: string;
  onRankChange?: (rank: string) => void;
  /** @deprecated smithingCountsを使用してください */
  smithingCount?: number;
  /** @deprecated onSmithingCountsChangeを使用してください */
  onSmithingCountChange?: (count: number) => void;
  // パラメータ別叩き回数
  smithingCounts?: SmithingCounts;
  onSmithingCountsChange?: (counts: SmithingCounts) => void;
  hasSmithing?: boolean;
  onSmithingChange?: (enabled: boolean) => void;
  smithingDetails?: {
    attack?: number;
    defense?: number;
    critical?: number;
  };
  onSmithingDetailsChange?: (details: Record<string, number>) => void;
  hasAlchemy?: boolean;
  onAlchemyChange?: (enabled: boolean) => void;
  // EXステータス関連（防具・アクセサリー用）
  exStats?: ExStats;
  onExStatsChange?: (exStats: ExStats) => void;
  // YAML設定データ（計算用）
  eqConst?: EqConstData;
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
  rank = 'SSS',
  onRankChange,
  smithingCount = 0,
  onSmithingCountChange,
  smithingCounts = {},
  onSmithingCountsChange,
  hasSmithing = false,
  onSmithingChange,
  smithingDetails = {},
  onSmithingDetailsChange,
  hasAlchemy = false,
  onAlchemyChange,
  exStats = {},
  onExStatsChange,
  eqConst,
  disabled = false,
  className = '',
}) => {
  // YAMLから係数を取得（フォールバック付き）
  const SMITHING_BONUS = useMemo(() => ({
    Defence: eqConst?.Armor?.Forge?.Defence ?? DEFAULT_SMITHING_BONUS.Defence,
    Other: eqConst?.Armor?.Forge?.Other ?? DEFAULT_SMITHING_BONUS.Other,
  }), [eqConst]);

  const REINFORCEMENT_BONUS = useMemo(() => ({
    Defence: eqConst?.Armor?.Reinforcement?.Defence ?? DEFAULT_REINFORCEMENT_BONUS.Defence,
    Other: eqConst?.Armor?.Reinforcement?.Other ?? DEFAULT_REINFORCEMENT_BONUS.Other,
  }), [eqConst]);

  const WEAPON_SMITHING_BONUS = useMemo(() =>
    eqConst?.Weapon?.Forge?.Other ?? DEFAULT_WEAPON_SMITHING_BONUS
  , [eqConst]);
  const [showSmithingDetails, setShowSmithingDetails] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(true);
  const [isSelectOpen, setIsSelectOpen] = useState(false);

  // 防具タイプ選択用のstate（head/body/leg スロット用）
  const [selectedArmorType, setSelectedArmorType] = useState<ArmorMaterialType | null>(null);

  // 防具スロットかどうか
  const isArmorSlot = ['head', 'body', 'leg'].includes(slot);

  // 装備からタイプを取得する関数
  const getArmorTypeFromEquipment = (eq: Equipment): ArmorMaterialType | null => {
    if (eq.sourceData?.type === 'armor') {
      const armorData = eq.sourceData.data as ArmorData;
      const type = armorData.タイプを選択;
      if (type === '布' || type === '革' || type === '金属') {
        return type;
      }
    }
    return null;
  };

  // 利用可能な防具タイプを取得（防具スロットのみ）
  const availableArmorTypes = useMemo((): ArmorMaterialType[] => {
    if (!isArmorSlot) return [];

    const types = new Set<ArmorMaterialType>();
    availableEquipment.forEach(eq => {
      const type = getArmorTypeFromEquipment(eq);
      if (type) {
        types.add(type);
      }
    });

    // 順番を保持するためにARMOR_TYPESの順でフィルタ
    return ARMOR_TYPES.filter(t => types.has(t));
  }, [availableEquipment, isArmorSlot]);

  // 選択されたタイプでフィルタされた装備リスト
  const filteredEquipmentByType = useMemo((): Equipment[] => {
    if (!isArmorSlot || !selectedArmorType) {
      return availableEquipment;
    }

    return availableEquipment.filter(eq => {
      const type = getArmorTypeFromEquipment(eq);
      return type === selectedArmorType;
    });
  }, [availableEquipment, selectedArmorType, isArmorSlot]);

  // タイプが1つしかない場合は自動選択
  useEffect(() => {
    if (isArmorSlot && availableArmorTypes.length === 1 && !selectedArmorType) {
      setSelectedArmorType(availableArmorTypes[0]);
    }
  }, [isArmorSlot, availableArmorTypes, selectedArmorType]);

  // 装備が選択されたとき、その装備のタイプを自動設定
  useEffect(() => {
    if (isArmorSlot && equipment) {
      const type = getArmorTypeFromEquipment(equipment);
      if (type && type !== selectedArmorType) {
        setSelectedArmorType(type);
      }
    }
  }, [equipment, isArmorSlot]);

  // タイプ変更時に装備をリセット
  const handleArmorTypeChange = (type: ArmorMaterialType | null) => {
    setSelectedArmorType(type);
    // タイプが変わったら装備選択をリセット（ただし同じタイプの装備が選択中の場合は維持）
    if (equipment) {
      const currentType = getArmorTypeFromEquipment(equipment);
      if (currentType !== type) {
        onEquipmentChange(null);
      }
    }
  };

  // 装備が持つパラメータに対応する叩きパラメータを取得
  const availableSmithingParams = useMemo((): SmithingParamType[] => {
    if (!equipment || !equipment.baseStats) return [];

    const params: SmithingParamType[] = [];
    for (const stat of equipment.baseStats) {
      const smithingParam = STAT_TO_SMITHING_PARAM[stat.stat];
      if (smithingParam && !params.includes(smithingParam)) {
        params.push(smithingParam);
      }
    }
    return params;
  }, [equipment]);

  // 合計叩き回数を計算
  const totalSmithingCount = useMemo((): number => {
    return Object.values(smithingCounts).reduce((sum, count) => sum + (count || 0), 0);
  }, [smithingCounts]);

  // 叩き回数変更ハンドラ
  const handleSmithingCountChange = (param: SmithingParamType, value: number) => {
    const newCounts = { ...smithingCounts, [param]: value };
    onSmithingCountsChange?.(newCounts);
  };

  const getSlotDisplayName = (): string => {
    const slotNames: Record<EquipSlot, string> = {
      weapon: '武器',
      head: '頭装備',
      body: '胴装備',
      leg: '脚装備',
      accessory1: 'ネックレス',
      accessory2: 'ブレスレット',
    };
    return slotNames[slot] || slot;
  };

  // ステータス名を日本語に変換
  const getStatDisplayName = (stat: string): string => {
    // 武器の場合の特殊マッピング
    if (slot === 'weapon') {
      const weaponNames: Record<string, string> = {
        ATK: '攻撃力',
        CRI: '会心率',
        DEX: '会心ダメージ',  // 武器のDEXは会心ダメージ
      };
      return weaponNames[stat] || stat;
    }

    // 防具の場合のマッピング（力、魔力、体力など）
    if (['head', 'body', 'leg'].includes(slot)) {
      const armorNames: Record<string, string> = {
        ATK: '力',
        MATK: '魔力',
        HP: '体力',
        MDEF: '精神',
        AGI: '素早さ',
        DEX: '器用',
        HIT: '撃力',  // HITは撃力
        DEF: '守備力',
      };
      return armorNames[stat] || stat;
    }

    // アクセサリーの場合のマッピング
    if (['accessory1', 'accessory2'].includes(slot)) {
      const accessoryNames: Record<string, string> = {
        ATK: '力',
        MATK: '魔力',
        HP: '体力',
        MDEF: '精神',
        AGI: '素早さ',
        DEX: '器用',
        HIT: '撃力',  // HITは撃力
      };
      return accessoryNames[stat] || stat;
    }

    // デフォルト
    return stat;
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

  // ランクボーナスを取得（武器用）- EqConst.yaml Weapon.Rank.[rank].Bonus の値
  const getWeaponRankBonus = (selectedRank: string): { attackP: number; critR: number; critD: number } => {
    const bonuses: Record<string, { attackP: number; critR: number; critD: number }> = {
      SSS: { attackP: 31, critR: 5, critD: 5 },
      SS: { attackP: 29, critR: 4, critD: 4 },
      S: { attackP: 27, critR: 3, critD: 3 },
      A: { attackP: 25, critR: 3, critD: 3 },
      B: { attackP: 25, critR: 2, critD: 2 },
      C: { attackP: 21, critR: 2, critD: 2 },
      D: { attackP: 21, critR: 1, critD: 1 },
      E: { attackP: 0, critR: 0, critD: 0 },
      F: { attackP: 0, critR: 0, critD: 0 },
    };
    return bonuses[selectedRank] || { attackP: 0, critR: 0, critD: 0 };
  };

  // 錬金ボーナスを取得（武器用）- EqConst.yaml Weapon.Rank.[rank].Alchemy の値
  const getAlchemyBonus = (selectedRank: string): { attackP: number; critD: number; critR: number } => {
    const alchemyData: Record<string, { attackP: number; critD: number; critR: number }> = {
      SSS: { attackP: 118, critD: 48, critR: 11 },
      SS: { attackP: 117, critD: 47, critR: 10 },
      S: { attackP: 117, critD: 47, critR: 10 },
      A: { attackP: 116, critD: 47, critR: 9 },
      B: { attackP: 116, critD: 47, critR: 9 },
      C: { attackP: 114, critD: 47, critR: 8 },
      D: { attackP: 114, critD: 47, critR: 8 },
      E: { attackP: 113, critD: 46, critR: 7 },
      F: { attackP: 113, critD: 46, critR: 7 },
    };
    return alchemyData[selectedRank] || { attackP: 0, critD: 0, critR: 0 };
  };

  // パラメータ別の叩きボーナスを計算
  const getSmithingBonusForStat = (statType: StatType): number => {
    const smithingParam = STAT_TO_SMITHING_PARAM[statType];
    if (!smithingParam) return 0;

    const count = smithingCounts[smithingParam] || 0;
    // 守備力は+1、その他は+2（EqConst.yaml Armor.Forge の定義）
    const bonusPerCount = smithingParam === '守備力' ? SMITHING_BONUS.Defence : SMITHING_BONUS.Other;
    return count * bonusPerCount;
  };

  // 計算済みステータスを取得
  const getCalculatedStats = () => {
    if (!equipment || !equipment.baseStats) return [];

    const rankMultiplier = getRankMultiplier(rank);
    const weaponRankBonus = getWeaponRankBonus(rank);
    const alchemyBonus = getAlchemyBonus(rank);

    return equipment.baseStats.map(stat => {
      const baseValue = stat.value;
      let finalValue = baseValue;
      let rankBonus = 0;
      let enhanceBonus = 0;
      let smithingBonus = 0;
      let alchemyBonusValue = 0;

      if (slot === 'weapon') {
        // 武器計算（smithingCountsからパラメータ別に取得）
        const weaponSmithingCounts = smithingCounts as Record<string, number>;
        if (stat.stat === 'ATK') {
          rankBonus = weaponRankBonus.attackP;
          enhanceBonus = enhancementLevel * 2;
          smithingBonus = (weaponSmithingCounts['攻撃力'] || 0) * WEAPON_SMITHING_BONUS;
          // 錬金ボーナス（有効な場合のみ）
          if (hasAlchemy) {
            alchemyBonusValue = alchemyBonus.attackP;
          }
        } else if (stat.stat === 'CRI') {
          rankBonus = weaponRankBonus.critR;
          // 強化ボーナス: 2lvにつき+1
          enhanceBonus = Math.floor(enhancementLevel / 2);
          smithingBonus = (weaponSmithingCounts['会心率'] || 0) * WEAPON_SMITHING_BONUS;
          // 錬金ボーナス（有効な場合のみ）
          if (hasAlchemy) {
            alchemyBonusValue = alchemyBonus.critR;
          }
        } else if (stat.stat === 'DEX') {
          rankBonus = weaponRankBonus.critD;
          enhanceBonus = enhancementLevel * 1;
          smithingBonus = (weaponSmithingCounts['会心ダメージ'] || 0) * WEAPON_SMITHING_BONUS;
          // 錬金ボーナス（有効な場合のみ）
          if (hasAlchemy) {
            alchemyBonusValue = alchemyBonus.critD;
          }
        }
      } else if (['head', 'body', 'leg'].includes(slot)) {
        // 防具計算（equipmentCalculator.tsと同じ計算式を使用）
        const isDefense = stat.stat === 'DEF';

        // 叩きボーナス: パラメータ別に計算（先に計算）
        smithingBonus = getSmithingBonusForStat(stat.stat);

        // 強化ボーナス: EqConst.yaml Armor.Reinforcement に基づく
        const reinforceBonus = isDefense ? REINFORCEMENT_BONUS.Defence : REINFORCEMENT_BONUS.Other;
        enhanceBonus = enhancementLevel * reinforceBonus;

        // ランク補正: round(baseWithTataki * (1 + baseWithTataki^0.2 * (rankValue / availableLv)))
        // 使用可能Lvを取得（equipment.requiredLevelから）
        const availableLv = equipment.requiredLevel || 1;
        const baseWithTataki = baseValue + smithingBonus;

        // ランク計算（叩き込み後の値に対して適用）
        const calculatedValue = Math.round(
          baseWithTataki * (1 + Math.pow(baseWithTataki, 0.2) * (rankMultiplier / availableLv))
        );
        // ランクボーナス = 計算後の値 - 叩き込み後の基礎値
        rankBonus = calculatedValue - baseWithTataki;
      } else {
        // アクセサリー
        // 計算式: ROUNDUP( 基礎値 + (使用可能Lv × ランク係数 / 550) )
        // ランク係数はEqConst.yaml Accessory.Rank の値
        const accessoryLevel = equipment.requiredLevel || 1;
        const rankCoeff = { SSS: 55, SS: 50, S: 45, A: 44, B: 44, C: 35, D: 35, E: 0, F: 0 }[rank] || 0;
        rankBonus = rankCoeff > 0 ? Math.ceil(accessoryLevel * rankCoeff / 550) : 0;
      }

      finalValue = baseValue + rankBonus + enhanceBonus + smithingBonus + alchemyBonusValue;

      return {
        stat: stat.stat,
        baseValue,
        rankBonus,
        enhanceBonus,
        smithingBonus,
        alchemyBonus: alchemyBonusValue,
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
  const smithingOptions: CustomSelectOption[] = Array.from({ length: MAX_SMITHING_COUNT + 1 }, (_, i) => ({
    value: i.toString(),
    label: `${i}回`,
    description: i === 0 ? '未強化' : i === MAX_SMITHING_COUNT ? '最大強化' : undefined,
  }));

  // 頭・胴・脚防具で叩き機能が使えるかどうか
  const isArmorWithSmithing = ['head', 'body', 'leg'].includes(slot);

  // アクセサリーかどうか（強化機能がない）
  const isAccessory = ['accessory1', 'accessory2'].includes(slot);

  return (
    <div className={`p-6 rounded-xl bg-glass-dark backdrop-blur-md border border-white/20 relative ${isSelectOpen ? 'z-50 overflow-visible' : 'z-auto overflow-hidden'} ${className}`}>
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
                {showAdvancedSettings ? 'ステータス非表示' : 'ステータス表示'}
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

      {/* 装備選択 - 防具の場合は2段階選択 */}
      <div className="mb-6 space-y-3">
        {/* 防具タイプ選択（防具スロットかつ複数タイプがある場合） */}
        {isArmorSlot && availableArmorTypes.length > 1 && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              防具タイプ
            </label>
            <div className="flex gap-2">
              {availableArmorTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleArmorTypeChange(type)}
                  disabled={disabled}
                  className={`flex-1 px-3 py-2 rounded-lg border transition-all duration-200 ${
                    selectedArmorType === type
                      ? 'bg-rpg-accent/30 border-rpg-accent text-white'
                      : 'bg-glass-light border-white/20 text-gray-300 hover:bg-white/10 hover:border-white/40'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-lg font-bold">{type}</div>
                    <div className="text-xs text-gray-400">{ARMOR_TYPE_INFO[type].description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 装備選択 */}
        <div>
          {isArmorSlot && availableArmorTypes.length > 1 && (
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {selectedArmorType ? `${selectedArmorType}装備` : '装備'}
            </label>
          )}
          <CustomSelect
            options={[
              { value: '', label: '装備なし', description: '装備を外す' },
              ...(isArmorSlot ? filteredEquipmentByType : availableEquipment).map(eq => {
                const armorType = isArmorSlot ? getArmorTypeFromEquipment(eq) : null;
                return {
                  value: eq.id,
                  label: eq.name,
                  description: eq.baseStats && eq.baseStats.length > 0
                    ? (armorType && availableArmorTypes.length <= 1 ? `[${armorType}] ` : '') +
                      eq.baseStats.map(s => `${s.stat}+${s.value}${s.isPercent ? '%' : ''}`).join(', ')
                    : armorType && availableArmorTypes.length <= 1 ? `[${armorType}]` : undefined,
                };
              })
            ]}
            value={equipment?.id || ''}
            onChange={(value) => {
              if (value === '') {
                onEquipmentChange(null);
              } else {
                const equipmentList = isArmorSlot ? filteredEquipmentByType : availableEquipment;
                const selected = equipmentList.find(eq => eq.id === value);
                onEquipmentChange(selected || null);
              }
            }}
            placeholder={isArmorSlot && !selectedArmorType && availableArmorTypes.length > 1
              ? 'まず防具タイプを選択してください'
              : '装備を選択してください'}
            disabled={disabled || (isArmorSlot && !selectedArmorType && availableArmorTypes.length > 1)}
            showIcon={false}
            onOpenChange={(open) => setIsSelectOpen(open)}
          />
        </div>
      </div>

      {equipment && (
        <>
          {/* 基本カスタマイズ */}
          <div className="space-y-4">
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

            {/* パラメータ別叩き回数（頭・胴・脚防具のみ） */}
            {isArmorWithSmithing && availableSmithingParams.length > 0 && (
              <div className="p-4 bg-gradient-to-br from-orange-900/30 to-amber-900/30 rounded-lg border border-orange-700/50">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-orange-300">
                    叩き回数（パラメータ別）
                  </label>
                  <span className="text-xs text-orange-400">
                    合計: {totalSmithingCount}回
                  </span>
                </div>

                <div className="space-y-3">
                  {availableSmithingParams.map((param) => {
                    const count = smithingCounts[param] || 0;
                    const bonusPerCount = param === '守備力' ? SMITHING_BONUS.Defence : SMITHING_BONUS.Other;
                    const totalBonus = count * bonusPerCount;

                    return (
                      <div key={param} className="flex items-center gap-3">
                        <div className="w-16 text-sm text-gray-300">
                          {param}
                        </div>
                        <div className="flex-1">
                          <input
                            type="range"
                            min={0}
                            max={MAX_SMITHING_COUNT}
                            value={count}
                            onChange={(e) => handleSmithingCountChange(param, parseInt(e.target.value, 10))}
                            disabled={disabled}
                            className="w-full h-2 bg-glass-light rounded-lg appearance-none cursor-pointer smithing-slider"
                          />
                        </div>
                        <div className="w-12 text-center">
                          <input
                            type="number"
                            value={count}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val) && val >= 0 && val <= MAX_SMITHING_COUNT) {
                                handleSmithingCountChange(param, val);
                              }
                            }}
                            min={0}
                            max={MAX_SMITHING_COUNT}
                            disabled={disabled}
                            className="w-full px-1 py-0.5 text-center bg-gray-800 border border-gray-600 rounded text-white text-xs"
                          />
                        </div>
                        <div className="w-16 text-right text-xs">
                          <span className={totalBonus > 0 ? 'text-green-400' : 'text-gray-500'}>
                            +{totalBonus}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 pt-3 border-t border-orange-700/30 text-xs text-gray-400">
                  <p>守備力: 1回につき+{SMITHING_BONUS.Defence} / その他: 1回につき+{SMITHING_BONUS.Other}</p>
                </div>
              </div>
            )}

            {/* 武器の叩き回数（SS以上のランクの場合のみ） - パラメータ別 */}
            {slot === 'weapon' && ['SSS', 'SS'].includes(rank) && (
              <div className="p-4 bg-gradient-to-br from-red-900/30 to-orange-900/30 rounded-lg border border-red-700/50">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-red-300">
                    叩き回数（パラメータ別）
                  </label>
                  <span className="text-xs text-red-400">
                    合計: {WEAPON_SMITHING_PARAMS.reduce((sum, param) => sum + ((smithingCounts as Record<string, number>)[param] || 0), 0)}回
                  </span>
                </div>

                <div className="space-y-3">
                  {WEAPON_SMITHING_PARAMS.map((param) => {
                    const count = (smithingCounts as Record<string, number>)[param] || 0;
                    const totalBonus = count * WEAPON_SMITHING_BONUS;

                    return (
                      <div key={param} className="flex items-center gap-3">
                        <div className="w-24 text-sm text-gray-300">
                          {param}
                        </div>
                        <div className="flex-1">
                          <input
                            type="range"
                            min={0}
                            max={MAX_SMITHING_COUNT}
                            value={count}
                            onChange={(e) => {
                              const newCounts = { ...smithingCounts, [param]: parseInt(e.target.value, 10) };
                              onSmithingCountsChange?.(newCounts as SmithingCounts);
                            }}
                            disabled={disabled}
                            className="w-full h-2 bg-glass-light rounded-lg appearance-none cursor-pointer smithing-slider"
                          />
                        </div>
                        <div className="w-12 text-center">
                          <input
                            type="number"
                            value={count}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val) && val >= 0 && val <= MAX_SMITHING_COUNT) {
                                const newCounts = { ...smithingCounts, [param]: val };
                                onSmithingCountsChange?.(newCounts as SmithingCounts);
                              }
                            }}
                            min={0}
                            max={MAX_SMITHING_COUNT}
                            disabled={disabled}
                            className="w-full px-1 py-0.5 text-center bg-gray-800 border border-gray-600 rounded text-white text-xs"
                          />
                        </div>
                        <div className="w-12 text-right text-xs">
                          <span className={totalBonus > 0 ? 'text-green-400' : 'text-gray-500'}>
                            +{totalBonus}{param === '会心率' ? '%' : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 pt-3 border-t border-red-700/30 text-xs text-gray-400">
                  <p>全パラメータ: 1回につき+{WEAPON_SMITHING_BONUS}</p>
                </div>
              </div>
            )}

            {/* 強化レベル（アクセサリーには強化機能がないため非表示） */}
            {!isAccessory && (
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
            )}

            {/* 錬金トグル（武器スロットのみ） */}
            {slot === 'weapon' && (
              <div className="p-4 bg-gradient-to-br from-purple-900/30 to-violet-900/30 rounded-lg border border-purple-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Toggle
                      label="錬金"
                      checked={hasAlchemy}
                      onChange={(val) => onAlchemyChange?.(val)}
                      disabled={disabled}
                    />
                  </div>
                  {hasAlchemy && (
                    <div className="text-xs text-purple-300">
                      ランク {rank} の錬金効果
                    </div>
                  )}
                </div>
                {hasAlchemy && (
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2 bg-purple-900/40 rounded text-center">
                      <div className="text-purple-400">攻撃力</div>
                      <div className="text-purple-200 font-semibold">+{getAlchemyBonus(rank).attackP}</div>
                    </div>
                    <div className="p-2 bg-purple-900/40 rounded text-center">
                      <div className="text-purple-400">会心率</div>
                      <div className="text-purple-200 font-semibold">+{getAlchemyBonus(rank).critR}</div>
                    </div>
                    <div className="p-2 bg-purple-900/40 rounded text-center">
                      <div className="text-purple-400">会心ダメージ</div>
                      <div className="text-purple-200 font-semibold">+{getAlchemyBonus(rank).critD}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 拡張設定（EX選択など） - 常に表示 */}
          <div className="mt-6 pt-6 border-t border-white/10 space-y-4">
            <h4 className="text-sm font-semibold text-gray-300 mb-3">拡張設定</h4>

            {/* EXステータス選択（防具のみ: 2つ） */}
              {isArmorWithSmithing && equipment && (
                <div className="p-4 bg-gradient-to-br from-cyan-900/30 to-teal-900/30 rounded-lg border border-cyan-700/50">
                  <h4 className="text-sm font-medium text-cyan-300 mb-3">EXステータス（防具）</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">EX1</label>
                      <CustomSelect
                        options={[
                          { value: '', label: '未選択' },
                          ...EX_STAT_OPTIONS.map(o => ({ value: o.value, label: o.label }))
                        ]}
                        value={exStats?.ex1 || ''}
                        onChange={(v) => onExStatsChange?.({ ...exStats, ex1: v || undefined })}
                        placeholder="EX1を選択"
                        disabled={disabled}
                        showIcon={false}
                        onOpenChange={(open) => setIsSelectOpen(open)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">EX2</label>
                      <CustomSelect
                        options={[
                          { value: '', label: '未選択' },
                          ...EX_STAT_OPTIONS.map(o => ({ value: o.value, label: o.label }))
                        ]}
                        value={exStats?.ex2 || ''}
                        onChange={(v) => onExStatsChange?.({ ...exStats, ex2: v || undefined })}
                        placeholder="EX2を選択"
                        disabled={disabled}
                        showIcon={false}
                        onOpenChange={(open) => setIsSelectOpen(open)}
                      />
                    </div>
                  </div>
                  {/* EX値の表示 */}
                  {(exStats?.ex1 || exStats?.ex2) && (
                    <div className="mt-3 pt-3 border-t border-cyan-700/30 flex flex-wrap gap-3 text-xs">
                      {exStats?.ex1 && (
                        <div className="px-2 py-1 bg-cyan-900/40 rounded">
                          <span className="text-cyan-400">EX1 {EX_STAT_OPTIONS.find(o => o.value === exStats.ex1)?.label}: </span>
                          <span className="text-cyan-200 font-semibold">
                            +{calculateExValue(equipment.requiredLevel || 1, rank, getExCategory(exStats.ex1))}
                          </span>
                        </div>
                      )}
                      {exStats?.ex2 && (
                        <div className="px-2 py-1 bg-cyan-900/40 rounded">
                          <span className="text-cyan-400">EX2 {EX_STAT_OPTIONS.find(o => o.value === exStats.ex2)?.label}: </span>
                          <span className="text-cyan-200 font-semibold">
                            +{calculateExValue(equipment.requiredLevel || 1, rank, getExCategory(exStats.ex2))}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-2 text-xs text-gray-500">
                    EX値 = ROUND(使用可能Lv x ランク係数 + 1)
                  </div>
                </div>
              )}

              {/* EXステータス選択（アクセサリーのみ: 2つ） */}
              {isAccessory && equipment && (
                <div className="p-4 bg-gradient-to-br from-cyan-900/30 to-teal-900/30 rounded-lg border border-cyan-700/50">
                  <h4 className="text-sm font-medium text-cyan-300 mb-3">EXステータス（アクセサリー）</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">EX1</label>
                      <CustomSelect
                        options={[
                          { value: '', label: '未選択' },
                          ...EX_STAT_OPTIONS.filter(o => o.value !== 'defense').map(o => ({ value: o.value, label: o.label }))
                        ]}
                        value={exStats?.ex1 || ''}
                        onChange={(v) => onExStatsChange?.({ ...exStats, ex1: v || undefined })}
                        placeholder="EX1を選択"
                        disabled={disabled}
                        showIcon={false}
                        onOpenChange={(open) => setIsSelectOpen(open)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">EX2</label>
                      <CustomSelect
                        options={[
                          { value: '', label: '未選択' },
                          ...EX_STAT_OPTIONS.filter(o => o.value !== 'defense').map(o => ({ value: o.value, label: o.label }))
                        ]}
                        value={exStats?.ex2 || ''}
                        onChange={(v) => onExStatsChange?.({ ...exStats, ex2: v || undefined })}
                        placeholder="EX2を選択"
                        disabled={disabled}
                        showIcon={false}
                        onOpenChange={(open) => setIsSelectOpen(open)}
                      />
                    </div>
                  </div>
                  {/* EX値の表示 */}
                  {(exStats?.ex1 || exStats?.ex2) && (
                    <div className="mt-3 pt-3 border-t border-cyan-700/30 flex flex-wrap gap-3 text-xs">
                      {exStats?.ex1 && (
                        <div className="px-2 py-1 bg-cyan-900/40 rounded">
                          <span className="text-cyan-400">EX1 {EX_STAT_OPTIONS.find(o => o.value === exStats.ex1)?.label}: </span>
                          <span className="text-cyan-200 font-semibold">
                            +{calculateExValue(equipment.requiredLevel || 1, rank, getExCategory(exStats.ex1))}
                          </span>
                        </div>
                      )}
                      {exStats?.ex2 && (
                        <div className="px-2 py-1 bg-cyan-900/40 rounded">
                          <span className="text-cyan-400">EX2 {EX_STAT_OPTIONS.find(o => o.value === exStats.ex2)?.label}: </span>
                          <span className="text-cyan-200 font-semibold">
                            +{calculateExValue(equipment.requiredLevel || 1, rank, getExCategory(exStats.ex2))}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-2 text-xs text-gray-500">
                    EX値 = ROUND(使用可能Lv x ランク係数 + 1)
                  </div>
                </div>
              )}
          </div>

          {/* 装備ステータス表示 - showAdvancedSettingsで制御 */}
          {showAdvancedSettings && equipment.baseStats && equipment.baseStats.length > 0 && (
            <div className="mt-6 p-4 bg-glass-light rounded-lg">
              <h4 className="text-sm font-semibold text-gray-300 mb-3">
                装備ステータス
              </h4>

              {/* 計算済みステータス表示 */}
              <div className="space-y-2">
                {getCalculatedStats().map((calcStat, index) => (
                  <div key={index} className="p-2 bg-glass-dark/50 rounded">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">{getStatDisplayName(calcStat.stat)}</span>
                      <div className="flex items-center gap-2">
                        {/* 基礎値 */}
                        <span className="text-gray-500 text-xs">
                          {calcStat.baseValue}{calcStat.isPercent ? '%' : ''}
                        </span>
                        {/* 最終値 */}
                        <span className={`font-medium ${calcStat.finalValue > calcStat.baseValue ? 'text-green-400' : 'text-white'}`}>
                          {String.fromCharCode(8594)} {calcStat.finalValue}{calcStat.isPercent ? '%' : ''}
                        </span>
                      </div>
                    </div>

                    {/* 内訳表示（変更がある場合のみ） */}
                    {(calcStat.rankBonus > 0 || calcStat.enhanceBonus > 0 || calcStat.smithingBonus > 0 || calcStat.alchemyBonus > 0) && (
                      <div className="mt-1 flex flex-wrap gap-2 text-xs">
                        {calcStat.rankBonus > 0 && (
                          <span className="px-1.5 py-0.5 bg-yellow-900/50 text-yellow-300 rounded">
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
                        {calcStat.alchemyBonus > 0 && (
                          <span className="px-1.5 py-0.5 bg-purple-900/50 text-purple-300 rounded">
                            錬金 +{calcStat.alchemyBonus}
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
                  {totalSmithingCount > 0 && isArmorWithSmithing && (
                    <span className="px-2 py-1 rounded text-orange-400 bg-orange-900/30">
                      叩き {totalSmithingCount}回
                    </span>
                  )}
                  {smithingCount > 0 && slot === 'weapon' && (
                    <span className="px-2 py-1 rounded text-orange-400 bg-orange-900/30">
                      叩き {smithingCount}回
                    </span>
                  )}
                  {slot === 'weapon' && hasAlchemy && (
                    <span className="px-2 py-1 rounded text-purple-400 bg-purple-900/30">
                      錬金済
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

    .smithing-slider::-webkit-slider-thumb {
      appearance: none;
      width: 16px;
      height: 16px;
      background: linear-gradient(135deg, #fb923c, #f97316);
      border-radius: 50%;
      cursor: pointer;
      transition: all 0.2s;
    }

    .smithing-slider::-webkit-slider-thumb:hover {
      transform: scale(1.1);
      box-shadow: 0 0 10px rgba(251, 146, 60, 0.5);
    }

    .smithing-slider::-moz-range-thumb {
      width: 16px;
      height: 16px;
      background: linear-gradient(135deg, #fb923c, #f97316);
      border: none;
      border-radius: 50%;
      cursor: pointer;
      transition: all 0.2s;
    }

    .smithing-slider::-moz-range-thumb:hover {
      transform: scale(1.1);
      box-shadow: 0 0 10px rgba(251, 146, 60, 0.5);
    }

    .smithing-slider {
      background: linear-gradient(to right,
        rgba(251, 146, 60, 0.3) 0%,
        rgba(251, 146, 60, 0.1) 100%);
    }
  `;
  document.head.appendChild(style);
}
