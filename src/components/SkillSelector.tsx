'use client';

import React, { useState, useMemo } from 'react';
import { Skill, Job, WeaponType } from '@/types';
import { Tooltip } from '@/components/ui/Tooltip';

interface SkillSelectorProps {
  skills: Skill[];
  selectedSkill: Skill | null;
  onSkillSelect: (skill: Skill | null) => void;
  job?: Job | null;
  weaponType?: WeaponType | null;
  disabled?: boolean;
  className?: string;
}

interface SkillDetailsProps {
  skill: Skill;
  mpCost?: number;
  cooldown?: number;
  hits?: number;
}

const SkillDetails: React.FC<SkillDetailsProps> = ({
  skill,
  mpCost = 0,
  cooldown = 0,
  hits = 1,
}) => {
  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-2">
      <h4 className="font-medium text-gray-800 dark:text-gray-200">
        {skill.name}
      </h4>
      {skill.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {skill.description}
        </p>
      )}
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="flex flex-col">
          <span className="text-gray-500 dark:text-gray-400">MP消費</span>
          <span className="font-semibold text-blue-600 dark:text-blue-400">
            {mpCost || skill.spCost}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-gray-500 dark:text-gray-400">CT</span>
          <span className="font-semibold text-orange-600 dark:text-orange-400">
            {cooldown}秒
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-gray-500 dark:text-gray-400">ヒット数</span>
          <span className="font-semibold text-green-600 dark:text-green-400">
            {hits}回
          </span>
        </div>
      </div>
    </div>
  );
};

export const SkillSelector: React.FC<SkillSelectorProps> = ({
  skills,
  selectedSkill,
  onSkillSelect,
  job,
  weaponType,
  disabled = false,
  className = '',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'job' | 'weapon'>('all');

  // フィルタリングされたスキルリスト
  const filteredSkills = useMemo(() => {
    let filtered = skills;

    // 職業・武器でフィルタリング
    if (filterType === 'job' && job) {
      filtered = filtered.filter(skill =>
        job.skills?.some(jobSkill => jobSkill.id === skill.id)
      );
    } else if (filterType === 'weapon' && weaponType) {
      // 武器スキルのフィルタリング（武器タイプに基づくスキルの判定ロジックが必要）
      filtered = filtered.filter(skill =>
        skill.name.toLowerCase().includes(weaponType.toLowerCase())
      );
    }

    // 検索語でフィルタリング
    if (searchTerm) {
      filtered = filtered.filter(skill =>
        skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        skill.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [skills, job, weaponType, filterType, searchTerm]);

  const handleSkillClick = (skill: Skill) => {
    if (disabled) return;

    if (selectedSkill?.id === skill.id) {
      onSkillSelect(null);
    } else {
      onSkillSelect(skill);
    }
  };

  const getCategoryColor = (skill: Skill): string => {
    // スキルタイプに基づく色分け（仮のロジック）
    if (skill.name.includes('攻撃')) return 'border-red-500 bg-red-50 dark:bg-red-900/20';
    if (skill.name.includes('回復')) return 'border-green-500 bg-green-50 dark:bg-green-900/20';
    if (skill.name.includes('補助')) return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20';
    if (skill.name.includes('魔法')) return 'border-purple-500 bg-purple-50 dark:bg-purple-900/20';
    return 'border-gray-300 dark:border-gray-600';
  };

  return (
    <div className={`${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
          スキル選択
        </h3>

        {/* フィルター */}
        <div className="space-y-3">
          {/* 検索ボックス */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="スキルを検索..."
              disabled={disabled}
              className={`
                w-full px-4 py-2 pl-10 rounded-lg border border-gray-300 dark:border-gray-600
                bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                focus:ring-2 focus:ring-blue-500 focus:border-transparent
                disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:opacity-50
              `}
            />
            <svg
              className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* フィルタータブ */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              disabled={disabled}
              className={`
                px-3 py-1 text-sm rounded transition-colors
                ${filterType === 'all'
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              すべて
            </button>
            {job && (
              <button
                type="button"
                onClick={() => setFilterType('job')}
                disabled={disabled}
                className={`
                  px-3 py-1 text-sm rounded transition-colors
                  ${filterType === 'job'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                職業スキル
              </button>
            )}
            {weaponType && (
              <button
                type="button"
                onClick={() => setFilterType('weapon')}
                disabled={disabled}
                className={`
                  px-3 py-1 text-sm rounded transition-colors
                  ${filterType === 'weapon'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                武器スキル
              </button>
            )}
          </div>
        </div>
      </div>

      {/* スキルリスト */}
      <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
        {filteredSkills.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            該当するスキルがありません
          </div>
        ) : (
          filteredSkills.map(skill => (
            <div
              key={skill.id}
              onClick={() => handleSkillClick(skill)}
              className={`
                p-3 rounded-lg border-2 cursor-pointer transition-all
                ${selectedSkill?.id === skill.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-md'
                  : getCategoryColor(skill)
                }
                hover:shadow-lg hover:scale-[1.02]
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800 dark:text-gray-200">
                    {skill.name}
                  </h4>
                  {skill.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {skill.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <Tooltip content={`SP消費: ${skill.spCost}`}>
                    <div className="flex items-center gap-1">
                      <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {skill.spCost}
                      </span>
                    </div>
                  </Tooltip>
                  {(skill.maxLevel ?? 1) > 1 && (
                    <Tooltip content={`最大レベル: ${skill.maxLevel ?? 1}`}>
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                          Lv.{skill.maxLevel}
                        </span>
                      </div>
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 選択されたスキルの詳細 */}
      {selectedSkill && (
        <div className="mt-4">
          <SkillDetails
            skill={selectedSkill}
            mpCost={(selectedSkill.spCost ?? 0) * 10} // 仮の計算
            cooldown={3} // 仮の値
            hits={1} // 仮の値
          />
        </div>
      )}
    </div>
  );
};