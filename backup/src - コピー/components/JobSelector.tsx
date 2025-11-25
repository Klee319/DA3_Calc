'use client';

import React from 'react';
import { Job } from '@/types';
import { CustomSelect, CustomSelectOption } from './CustomSelect';

interface JobSelectorProps {
  jobs: Job[];
  selectedJob: Job | null;
  onChange: (job: Job | null) => void;
  disabled?: boolean;
  className?: string;
}

// 職業のアイコンマップ
const jobIcons: Record<string, string> = {
  'ガーディアン': '🛡️',
  'ステラシャフト': '⭐',
  'スペルリファクター': '🔮',
  'ノービス': '👤',
  'プリースト': '✨',
  '戦士': '⚔️',
  '魔法使い': '🧙',
  '弓使い': '🏹',
  '盗賊': '🗡️',
};

export const JobSelector: React.FC<JobSelectorProps> = ({
  jobs,
  selectedJob,
  onChange,
  disabled = false,
  className = '',
}) => {
  const options: CustomSelectOption[] = jobs.map(job => ({
    value: job.id,
    label: job.name,
    icon: jobIcons[job.name] || '👤',
    description: `Lv.${job.maxLevel}まで成長可能`
  }));

  const handleChange = (jobId: string) => {
    if (jobId === '') {
      onChange(null);
    } else {
      const job = jobs.find(j => j.id === jobId);
      onChange(job || null);
    }
  };

  return (
    <div className={`${className}`}>
      <CustomSelect
        options={options}
        value={selectedJob?.id || ''}
        onChange={handleChange}
        placeholder="職業を選択してください"
        disabled={disabled}
        label="職業選択"
      />

      {selectedJob && (
        <div className="mt-3 p-3 glass-card-secondary rounded-lg animate-fadeIn">
          <p className="text-sm text-gray-400 mb-2">
            使用可能武器:
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedJob.availableWeapons.map(weapon => (
              <span
                key={weapon}
                className="px-2 py-1 text-xs bg-rpg-accent/20 text-rpg-accent border border-rpg-accent/30 rounded"
              >
                {getWeaponName(weapon)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// 武器タイプの表示名を取得するヘルパー関数
const getWeaponName = (type: string): string => {
  const weaponNames: Record<string, string> = {
    sword: '剣',
    greatsword: '大剣',
    dagger: '短剣',
    axe: '斧',
    spear: '槍',
    bow: '弓',
    staff: '杖',
    mace: 'メイス',
    katana: '刀',
    fist: '拳',
  };
  return weaponNames[type] || type;
};