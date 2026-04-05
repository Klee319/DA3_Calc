'use client';

import React, { useMemo } from 'react';
import {
  calculateDynamicWeights,
  getWeightsForSkill,
  DEFAULT_STATS,
  DEFAULT_WEAPON_PARAMS,
  calculateMarinaLaneSpeedValue,
  calculateSpellRefactorBonus,
  type WeightCalculationParams,
  type WeightResult,
} from '@/lib/calc/statWeightMappingV2';

interface SkillWeightDisplayProps {
  skillId: string | null;
  skillName?: string;
  weaponType?: string;
  jobName?: string;
  currentStats?: Partial<Record<string, number>>;
}

/** ステータス名の日本語マッピング */
const STAT_LABELS: Record<string, string> = {
  Power: '力',
  Magic: '魔力',
  HP: '体力',
  Mind: '精神',
  Agility: '素早さ',
  Dex: '器用',
  CritDamage: '撃力',
  Defense: '守備力',
};

/** 重みに基づいたカラー */
function getWeightColor(weight: number): string {
  if (weight >= 0.5) return 'text-yellow-400';
  if (weight >= 0.3) return 'text-orange-400';
  if (weight >= 0.15) return 'text-blue-400';
  return 'text-white/60';
}

/** プログレスバーのカラー */
function getProgressColor(weight: number): string {
  if (weight >= 0.5) return 'bg-gradient-to-r from-yellow-500 to-amber-400';
  if (weight >= 0.3) return 'bg-gradient-to-r from-orange-500 to-yellow-500';
  if (weight >= 0.15) return 'bg-gradient-to-r from-blue-500 to-cyan-400';
  return 'bg-white/30';
}

export function SkillWeightDisplay({
  skillId,
  skillName,
  weaponType = 'Sword',
  jobName,
  currentStats,
}: SkillWeightDisplayProps) {
  // スキルIDからスキル名を抽出
  const normalizedSkillId = useMemo(() => {
    if (!skillId) return null;
    const jobMatch = skillId.match(/^job_[A-Za-z]+_(.+)$/);
    const bookMatch = skillId.match(/^book_[A-Za-z]+_(.+)$/);
    if (jobMatch) return jobMatch[1];
    if (bookMatch) return bookMatch[1];
    return skillId;
  }, [skillId]);

  // V2重みを計算
  const weights = useMemo((): WeightResult[] => {
    if (!normalizedSkillId) return [];

    const params: WeightCalculationParams = {
      currentStats: currentStats || DEFAULT_STATS,
      weaponAttackPower: DEFAULT_WEAPON_PARAMS.weaponAttackPower,
      weaponCritDamage: DEFAULT_WEAPON_PARAMS.weaponCritDamage,
      critRate: DEFAULT_WEAPON_PARAMS.critRate,
      jobName,
    };

    try {
      return getWeightsForSkill(normalizedSkillId, weaponType, params);
    } catch {
      // スキルが見つからない場合は空配列
      return [];
    }
  }, [normalizedSkillId, weaponType, jobName, currentStats]);

  // 特殊条件の情報
  const specialInfo = useMemo(() => {
    const info: string[] = [];

    // マリーナ・レーン
    if (normalizedSkillId?.includes('マリーナ')) {
      const speed = (currentStats?.Agility || DEFAULT_STATS.Agility) as number;
      const marinaInfo = calculateMarinaLaneSpeedValue(speed);
      info.push(`Speed閾値: ${marinaInfo.speedToNextHit}で+1ヒット`);
    }

    // SpellRefactor
    if (jobName === 'SpellRefactor' || jobName === 'スペルリファクター') {
      const power = (currentStats?.Power || DEFAULT_STATS.Power) as number;
      const magic = (currentStats?.Magic || DEFAULT_STATS.Magic) as number;
      const bonus = calculateSpellRefactorBonus(power, magic);
      info.push(`Bonus倍率: ${bonus.toFixed(2)}x`);
    }

    return info;
  }, [normalizedSkillId, jobName, currentStats]);

  if (!skillId || weights.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs px-2 py-0.5 rounded-full bg-rpg-accent/20 text-rpg-accent font-medium">
          V2
        </span>
        <h4 className="text-sm font-medium text-white/90">
          ステータス重み
        </h4>
      </div>

      {/* 重み表示 */}
      <div className="space-y-2">
        {weights.slice(0, 5).map((w) => (
          <div key={w.stat} className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className={getWeightColor(w.normalizedWeight)}>
                {STAT_LABELS[w.stat] || w.stat}
              </span>
              <span className={`font-mono ${getWeightColor(w.normalizedWeight)}`}>
                {(w.normalizedWeight * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full ${getProgressColor(w.normalizedWeight)} transition-all duration-300`}
                style={{ width: `${w.normalizedWeight * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* 特殊情報 */}
      {specialInfo.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/10">
          {specialInfo.map((info, i) => (
            <p key={i} className="text-xs text-rpg-accent/80">
              {info}
            </p>
          ))}
        </div>
      )}

      {/* 説明 */}
      <p className="mt-3 text-xs text-white/40">
        各ステータスの+1あたりのダメージ貢献度を示しています。
        EX選択・叩き配分の参考にしてください。
      </p>
    </div>
  );
}
