'use client';

import React, { useMemo } from 'react';
import { useOptimizeStore } from '@/store/optimizeStore';
import { OPTIMIZE_MODE_LABELS, OptimizeMode } from '@/types/optimize';
import { InternalStatKey } from '@/types/calc';
import { CustomSelect, CustomSelectOption } from '@/components/CustomSelect';
import { WEAPON_TYPE_YAML_TO_JP } from '@/constants/jobMappings';

interface JobInfo {
  name: string;
  yamlName: string;
  availableWeapons: string[];
  availableArmors?: string[];
  grade?: string;  // Special/First/Second/Third
  maxLevel?: number;  // 職業最大レベル（JobConstData.MaxLevel）
}

interface SkillInfo {
  id: string;
  name: string;
  weaponType?: string;
  source?: string;
  type?: string;
  jobName?: string;
  // スキルデータ（最適化用）
  multiplier?: number;
  hits?: number;
  coolTime?: number;
  baseDamageType?: string[];
}

interface OptimizeFormProps {
  availableJobs: JobInfo[];
  availableSkills: SkillInfo[];
}

const STAT_OPTIONS: { value: InternalStatKey; label: string }[] = [
  { value: 'Power', label: '力' },
  { value: 'Magic', label: '魔力' },
  { value: 'HP', label: '体力' },
  { value: 'Mind', label: '精神' },
  { value: 'Agility', label: '素早さ' },
  { value: 'Dex', label: '器用' },
  { value: 'CritDamage', label: '撃力' },
  { value: 'Defense', label: '守備力' },
];

export function OptimizeForm({ availableJobs, availableSkills }: OptimizeFormProps) {
  const {
    selectedJobName,
    setSelectedJobName,
    jobMaxLevel,
    availableWeaponTypes,
    selectedWeaponType,
    setSelectedWeaponType,
    selectedSkillId,
    setSelectedSkillId,
    skillLevel,
    setSkillLevel,
    optimizeMode,
    setOptimizeMode,
    targetStat,
    setTargetStat,
  } = useOptimizeStore();

  // 職業選択時のハンドラ
  const handleJobChange = (value: string | null) => {
    const selectedJob = availableJobs.find(j => j.name === value);
    setSelectedJobName(
      value || null,
      selectedJob?.availableWeapons || [],
      selectedJob?.availableArmors || [],
      selectedJob?.grade || 'First',
      selectedJob?.maxLevel
    );
  };

  // スキル選択時のハンドラ
  const handleSkillChange = (value: string | null) => {
    const selectedSkill = availableSkills.find(s => s.id === value);
    const skillData = selectedSkill ? {
      id: selectedSkill.id,
      name: selectedSkill.name,
      multiplier: selectedSkill.multiplier ?? 1.0,
      hits: selectedSkill.hits ?? 1,
      coolTime: selectedSkill.coolTime ?? 5,
      baseDamageType: selectedSkill.baseDamageType || [],
    } : null;
    setSelectedSkillId(value || null, skillData);
  };

  // CustomSelect用のオプション変換
  const jobOptions: CustomSelectOption[] = availableJobs.map((job) => ({
    value: job.name,
    label: job.name,
    icon: '👤',
  }));

  const skillOptions: CustomSelectOption[] = availableSkills.map((skill) => {
    // スキルの種類に応じた説明文を生成
    let description: string | undefined;
    let icon = '⚔️';

    if (skill.type === 'normal') {
      description = '基本攻撃';
      icon = '🗡️';
    } else if (skill.source === 'SkillBook' && skill.weaponType) {
      description = `武器スキル (${WEAPON_TYPE_YAML_TO_JP[skill.weaponType] || skill.weaponType})`;
      icon = '📕';
    } else if (skill.source && skill.type === 'job') {
      description = `職業スキル (${skill.source})`;
      icon = '📘';
    }

    return {
      value: skill.id,
      label: skill.name,
      icon,
      description,
    };
  });

  const statOptions: CustomSelectOption[] = STAT_OPTIONS.map((stat) => ({
    value: stat.value,
    label: stat.label,
    icon: '📊',
  }));

  // 武器種オプション（複数武器種対応職業用）
  const weaponTypeOptions: CustomSelectOption[] = availableWeaponTypes.map((wt) => ({
    value: wt,
    label: WEAPON_TYPE_YAML_TO_JP[wt] || wt,
    icon: '⚔️',
  }));

  // 複数武器種が使える職業かどうか
  const hasMultipleWeaponTypes = availableWeaponTypes.length > 1;

  return (
    <div className="space-y-6" role="form" aria-label="最適化設定フォーム">
      {/* 職業選択 */}
      <CustomSelect
        options={jobOptions}
        value={selectedJobName || ''}
        onChange={handleJobChange}
        placeholder="職業を選択してください"
        label="職業"
        showIcon={true}
      />

      {/* レベル表示（固定値） */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          職業Lv（最大値固定）
        </label>
        <div className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/80">
          {jobMaxLevel || '-'}
        </div>
      </div>

      {/* 最適化モード */}
      <fieldset className="space-y-2">
        <legend className="block text-sm font-medium text-gray-300 mb-2">
          最適化モード
        </legend>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="最適化モード選択">
          {(Object.keys(OPTIMIZE_MODE_LABELS) as OptimizeMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setOptimizeMode(mode)}
              aria-pressed={optimizeMode === mode}
              aria-label={`${OPTIMIZE_MODE_LABELS[mode]}モードを選択`}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-rpg-accent/30
                ${optimizeMode === mode
                  ? 'bg-gradient-to-r from-rpg-accent to-indigo-600 text-white shadow-glow'
                  : 'bg-glass-dark border border-white/20 text-white/70 hover:border-white/40 hover:text-white'
                }`}
            >
              {OPTIMIZE_MODE_LABELS[mode]}
            </button>
          ))}
        </div>
      </fieldset>

      {/* ステータスモード時のターゲット選択 */}
      {optimizeMode === 'stat' && (
        <div className="animate-fadeIn">
          <CustomSelect
            options={statOptions}
            value={targetStat || ''}
            onChange={(value) => setTargetStat((value || null) as InternalStatKey | null)}
            placeholder="ステータスを選択してください"
            label="最大化するステータス"
            showIcon={true}
          />
        </div>
      )}

      {/* スキル選択（ダメージ/DPSモード時） */}
      {optimizeMode !== 'stat' && (
        <div className="space-y-6 animate-fadeIn">
          <CustomSelect
            options={skillOptions}
            value={selectedSkillId || ''}
            onChange={handleSkillChange}
            placeholder="スキルを選択してください"
            label="評価スキル"
            showIcon={true}
          />

          <div className="space-y-2">
            <label htmlFor="skill-level" className="block text-sm font-medium text-gray-300">
              スキルLv
            </label>
            <input
              id="skill-level"
              type="number"
              min={1}
              max={10}
              value={skillLevel}
              onChange={(e) => setSkillLevel(Number(e.target.value))}
              aria-label="スキルレベル"
              className="w-full input-primary"
            />
          </div>

          {/* 武器種選択（複数武器種対応職業の場合） */}
          {hasMultipleWeaponTypes && (
            <CustomSelect
              options={weaponTypeOptions}
              value={selectedWeaponType || ''}
              onChange={(value) => setSelectedWeaponType(value || null)}
              placeholder="武器種を選択してください"
              label="評価武器種"
              showIcon={true}
            />
          )}
        </div>
      )}
    </div>
  );
}
