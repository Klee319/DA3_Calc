'use client';

import React, { useState, useMemo } from 'react';
import { Job } from '@/types';
import { CustomSelect, CustomSelectOption } from './CustomSelect';
import { convertJobNameToYAML } from '@/constants/jobMappings';

// 職業グレードの型定義
type JobGrade = 'all' | 'Special' | 'First' | 'Second' | 'Third';

interface JobSelectorProps {
  jobs: Job[];
  selectedJob: Job | null;
  onChange: (job: Job | null) => void;
  disabled?: boolean;
  className?: string;
  jobConst?: {
    JobDefinition?: Record<string, {
      Grade?: string;
      MaxLevel?: number;
      AvailableWeapons?: string[];
      AvailableArmors?: string[];
    }>;
  };
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
  // 追加
  'ファイター': '⚔️',
  'アコライト': '🕯️',
  'アーチャー': '🏹',
  'メイジ': '🔮',
  'クレリック': '✝️',
  'ハンター': '🎯',
  'レンジャー': '🌲',
  'ウィザード': '🧙‍♂️',
  'ナイト': '🗡️',
  'ウォリアー': '💪',
};

// グレードの表示名マップ
const gradeLabels: Record<JobGrade, string> = {
  'all': 'すべて',
  'Special': '特殊職',
  'First': '1次職',
  'Second': '2次職',
  'Third': '3次職',
};

// グレードの順序（フィルターボタン表示用）
const gradeOrder: JobGrade[] = ['all', 'Special', 'First', 'Second', 'Third'];

export const JobSelector: React.FC<JobSelectorProps> = ({
  jobs,
  selectedJob,
  onChange,
  disabled = false,
  className = '',
  jobConst,
}) => {
  // 選択中のグレードフィルター
  const [selectedGrade, setSelectedGrade] = useState<JobGrade>('all');

  // 職業のグレードを取得する関数
  const getJobGrade = (job: Job): string | null => {
    if (!jobConst?.JobDefinition) return null;

    const yamlJobName = convertJobNameToYAML(job.id);
    const jobDef = jobConst.JobDefinition[yamlJobName];
    return jobDef?.Grade || null;
  };

  // グレードでフィルタリングされた職業リスト
  const filteredJobs = useMemo(() => {
    if (selectedGrade === 'all') {
      return jobs;
    }
    return jobs.filter(job => getJobGrade(job) === selectedGrade);
  }, [jobs, selectedGrade, jobConst]);

  // 各グレードに属する職業数をカウント
  const gradeCounts = useMemo(() => {
    const counts: Record<JobGrade, number> = {
      'all': jobs.length,
      'Special': 0,
      'First': 0,
      'Second': 0,
      'Third': 0,
    };

    jobs.forEach(job => {
      const grade = getJobGrade(job) as JobGrade | null;
      if (grade && grade in counts) {
        counts[grade]++;
      }
    });

    return counts;
  }, [jobs, jobConst]);

  const options: CustomSelectOption[] = filteredJobs.map(job => {
    const grade = getJobGrade(job);
    const gradeLabel = grade ? gradeLabels[grade as JobGrade] : '';

    return {
      value: job.id,
      label: job.name,
      icon: jobIcons[job.name] || '👤',
      description: `${gradeLabel ? `[${gradeLabel}] ` : ''}Lv.${job.maxLevel}まで成長可能`
    };
  });

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
      {/* グレードフィルター */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-400 mb-2">
          職業グレードで絞り込み
        </label>
        <div className="flex flex-wrap gap-2">
          {gradeOrder.map(grade => {
            const count = gradeCounts[grade];
            const isSelected = selectedGrade === grade;

            return (
              <button
                key={grade}
                onClick={() => setSelectedGrade(grade)}
                disabled={disabled || count === 0}
                className={`
                  px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                  ${isSelected
                    ? 'bg-rpg-accent text-white shadow-lg shadow-rpg-accent/30'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }
                  ${(disabled || count === 0) ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {gradeLabels[grade]}
                <span className={`ml-1.5 text-xs ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 職業選択 */}
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
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-400">
              使用可能武器:
            </p>
            {getJobGrade(selectedJob) && (
              <span className="text-xs px-2 py-0.5 rounded bg-rpg-accent/20 text-rpg-accent border border-rpg-accent/30">
                {gradeLabels[getJobGrade(selectedJob) as JobGrade]}
              </span>
            )}
          </div>
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
