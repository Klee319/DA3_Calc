'use client';

import React, { useState } from 'react';
import { CalculatedStats, StatType } from '@/types';
import { Tooltip } from '@/components/ui/Tooltip';

interface StatViewerProps {
  stats: CalculatedStats;
  className?: string;
  showBreakdown?: boolean;
}

interface StatCardProps {
  statName: string;
  statKey: StatType;
  value: number;
  breakdown: {
    base: number;
    equipment: number;
    skills: number;
    buffs: number;
    percent: number;
  };
  icon?: React.ReactNode;
  color?: string;
  showBreakdown?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({
  statName,
  statKey,
  value,
  breakdown,
  icon,
  color = 'blue',
  showBreakdown = false,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const getColorClasses = () => {
    const colors = {
      red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
      blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
      green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
      purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
      yellow: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
      gray: 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800',
      cyan: 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800',
      emerald: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
      white: 'bg-white dark:bg-gray-700/30 border-gray-300 dark:border-gray-500',
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  const getTextColorClasses = () => {
    const colors = {
      red: 'text-red-600 dark:text-red-400',
      blue: 'text-blue-600 dark:text-blue-400',
      green: 'text-green-600 dark:text-green-400',
      purple: 'text-purple-600 dark:text-purple-400',
      yellow: 'text-yellow-600 dark:text-yellow-400',
      gray: 'text-gray-600 dark:text-gray-400',
      cyan: 'text-cyan-600 dark:text-cyan-400',
      emerald: 'text-emerald-600 dark:text-emerald-400',
      white: 'text-gray-800 dark:text-white',
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  const breakdownTooltip = (
    <div className="space-y-1">
      <div className="font-semibold mb-2">{statName}の内訳</div>
      {breakdown.base > 0 && (
        <div className="flex justify-between">
          <span>基本値:</span>
          <span className="ml-4">+{breakdown.base}</span>
        </div>
      )}
      {breakdown.equipment !== 0 && (
        <div className="flex justify-between">
          <span>装備:</span>
          <span className="ml-4">{breakdown.equipment > 0 ? '+' : ''}{breakdown.equipment}</span>
        </div>
      )}
      {breakdown.skills !== 0 && (
        <div className="flex justify-between">
          <span>SP割り当て:</span>
          <span className="ml-4">{breakdown.skills > 0 ? '+' : ''}{breakdown.skills}</span>
        </div>
      )}
      {breakdown.percent !== 0 && (
        <div className="flex justify-between">
          <span>%補正:</span>
          <span className="ml-4">{breakdown.percent > 0 ? '+' : ''}{breakdown.percent}</span>
        </div>
      )}
      {breakdown.buffs !== 0 && (
        <div className="flex justify-between">
          <span>バフ:</span>
          <span className="ml-4">{breakdown.buffs > 0 ? '+' : ''}{breakdown.buffs}</span>
        </div>
      )}
      <div className="border-t pt-1 mt-2 font-semibold">
        <div className="flex justify-between">
          <span>合計:</span>
          <span className="ml-4">{value}</span>
        </div>
      </div>
    </div>
  );

  return (
    <Tooltip content={showBreakdown ? breakdownTooltip : null} position="top">
      <div
        className={`
          relative p-4 rounded-lg border-2 cursor-pointer transition-all
          hover:shadow-lg hover:scale-105 ${getColorClasses()}
          min-h-[110px] flex flex-col justify-between
        `}
        onMouseEnter={() => setShowDetails(true)}
        onMouseLeave={() => setShowDetails(false)}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center">
            {icon && (
              <div className={`mr-2 ${getTextColorClasses()}`}>
                {icon}
              </div>
            )}
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {statName}
            </h4>
          </div>
        </div>

        <div className={`text-2xl font-bold ${getTextColorClasses()}`}>
          {value.toLocaleString()}
        </div>

        {/* 変化量インジケーター - 常に高さを確保 */}
        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 min-h-[16px]">
          {(breakdown.equipment !== 0 || breakdown.skills !== 0 || breakdown.buffs !== 0 || breakdown.percent !== 0) ? (
            <>
              {breakdown.base > 0 && `基本: ${breakdown.base}`}
              {(breakdown.equipment + breakdown.skills + breakdown.buffs + breakdown.percent) !== 0 && (
                <span className={`ml-1 ${(breakdown.equipment + breakdown.skills + breakdown.buffs + breakdown.percent) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(breakdown.equipment + breakdown.skills + breakdown.buffs + breakdown.percent) > 0 ? '+' : ''}
                  {breakdown.equipment + breakdown.skills + breakdown.buffs + breakdown.percent}
                </span>
              )}
            </>
          ) : (
            <span>&nbsp;</span>
          )}
        </div>
      </div>
    </Tooltip>
  );
};

export const StatViewer: React.FC<StatViewerProps> = ({
  stats,
  className = '',
  showBreakdown = false,
}) => {
  // MP = 精神 × 2 で計算
  const mpValue = (stats.total['MDEF'] || 0) * 2;

  const statConfigs = [
    {
      key: 'HP' as StatType,
      name: '体力',
      color: 'green',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      key: 'MP' as StatType,
      name: 'MP',
      color: 'blue',
      customValue: mpValue,  // 精神×2の値を使用
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      key: 'ATK' as StatType,
      name: '力',
      color: 'red',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      key: 'MATK' as StatType,
      name: '魔力',
      color: 'purple',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
        </svg>
      ),
    },
    {
      key: 'DEF' as StatType,
      name: '守備力',
      color: 'gray',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      key: 'MDEF' as StatType,
      name: '精神',
      color: 'emerald',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      key: 'AGI' as StatType,
      name: '素早さ',
      color: 'cyan',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
    {
      key: 'DEX' as StatType,
      name: '器用さ',
      color: 'yellow',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      key: 'HIT' as StatType,
      name: '撃力',
      color: 'green',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
    },
    {
      key: 'CRI' as StatType,
      name: '会心率',
      color: 'white',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ),
    },
  ];

  return (
    <div className={`${className}`}>
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
        最終ステータス
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statConfigs.map(config => {
          // customValueがある場合はそれを使用（MP = 精神×2など）
          const displayValue = 'customValue' in config && config.customValue !== undefined
            ? config.customValue
            : (stats.total[config.key] || 0);

          return (
            <StatCard
              key={config.key}
              statName={config.name}
              statKey={config.key}
              value={displayValue}
              breakdown={{
                base: stats.base[config.key] || 0,
                equipment: stats.fromEquipment[config.key] || 0,
                skills: stats.fromSkills[config.key] || 0,
                buffs: stats.fromBuffs[config.key] || 0,
                percent: stats.fromPercent?.[config.key] || 0,
              }}
              icon={config.icon}
              color={config.color}
              showBreakdown={showBreakdown}
            />
          );
        })}
      </div>

      {/* サマリー表示 */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          ステータスサマリー
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-600 dark:text-gray-400">総合力:</span>
            <span className="ml-2 font-semibold text-gray-800 dark:text-gray-200">
              {Object.values(stats.total).reduce((sum, val) => sum + (val || 0), 0).toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">装備補正:</span>
            <span className="ml-2 font-semibold text-green-600 dark:text-green-400">
              +{Object.values(stats.fromEquipment).reduce((sum, val) => sum + (val || 0), 0).toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">SP割り当て:</span>
            <span className="ml-2 font-semibold text-blue-600 dark:text-blue-400">
              +{Object.values(stats.fromSkills).reduce((sum, val) => sum + (val || 0), 0).toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">%補正:</span>
            <span className="ml-2 font-semibold text-orange-600 dark:text-orange-400">
              +{Object.values(stats.fromPercent || {}).reduce((sum, val) => sum + (val || 0), 0).toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">バフ補正:</span>
            <span className="ml-2 font-semibold text-purple-600 dark:text-purple-400">
              +{Object.values(stats.fromBuffs).reduce((sum, val) => sum + (val || 0), 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};