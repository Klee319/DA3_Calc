'use client';

import React, { useMemo } from 'react';
import { useOptimizeStore } from '@/store/optimizeStore';
import { SPSlider } from '@/components/SPSlider';
import { getMaxSPByBranch, calculateUnlockedSkills, getNextSkillInfo, calculateBranchBonus, getReachedTier } from '@/lib/calc/jobCalculator';
import type { JobSPData } from '@/types/data';

interface OptimizeSPAllocationProps {
  jobSPData?: JobSPData[];
}

export function OptimizeSPAllocation({ jobSPData }: OptimizeSPAllocationProps) {
  const {
    selectedJobName,
    jobMaxLevel,
    spAllocation,
    setSPAllocation,
  } = useOptimizeStore();

  // 最大SP計算（レベル×2、ビルドツール準拠）
  const maxSP = useMemo(() => {
    return jobMaxLevel * 2;
  }, [jobMaxLevel]);

  // 各軸の最大SPを取得
  const maxSPByBranch = useMemo(() => {
    if (!jobSPData) return { A: 100, B: 100, C: 100 };
    return getMaxSPByBranch(jobSPData);
  }, [jobSPData]);

  // 解放スキル情報
  const unlockedSkills = useMemo(() => {
    if (!jobSPData || !selectedJobName) return [];
    const allocation = {
      A: spAllocation.A || 0,
      B: spAllocation.B || 0,
      C: spAllocation.C || 0,
    };
    return calculateUnlockedSkills(selectedJobName, allocation, jobSPData);
  }, [jobSPData, selectedJobName, spAllocation]);

  // 次のスキル情報
  const nextSkillInfo = useMemo(() => {
    if (!jobSPData) return null;
    const allocation = {
      A: spAllocation.A || 0,
      B: spAllocation.B || 0,
      C: spAllocation.C || 0,
    };
    return getNextSkillInfo(allocation, jobSPData);
  }, [jobSPData, spAllocation]);

  // ブランチボーナス
  const branchBonus = useMemo(() => {
    if (!jobSPData) return undefined;
    const allocation = {
      A: spAllocation.A || 0,
      B: spAllocation.B || 0,
      C: spAllocation.C || 0,
    };
    return calculateBranchBonus(allocation, jobSPData);
  }, [jobSPData, spAllocation]);

  // 到達ティア
  const reachedTier = useMemo(() => {
    if (!jobSPData) return undefined;
    const tierA = getReachedTier('A', spAllocation.A || 0, jobSPData);
    const tierB = getReachedTier('B', spAllocation.B || 0, jobSPData);
    const tierC = getReachedTier('C', spAllocation.C || 0, jobSPData);
    const tiers = [
      { branch: 'A', tier: tierA },
      { branch: 'B', tier: tierB },
      { branch: 'C', tier: tierC },
    ].filter(t => !t.tier.endsWith('-0'));
    if (tiers.length === 0) return undefined;
    return tiers.map(t => t.tier).join(', ');
  }, [jobSPData, spAllocation]);

  if (!selectedJobName) {
    return (
      <div className="text-center text-white/40 py-4">
        職業を選択してください
      </div>
    );
  }

  // jobSPDataがない場合は簡易版を表示
  if (!jobSPData) {
    return <SimpleSPAllocation maxSP={maxSP} />;
  }

  return (
    <SPSlider
      spValues={{
        A: spAllocation.A || 0,
        B: spAllocation.B || 0,
        C: spAllocation.C || 0,
      }}
      maxSP={maxSP}
      maxSPByBranch={maxSPByBranch}
      onChange={(values) => setSPAllocation(values)}
      unlockedSkills={unlockedSkills}
      nextSkillInfo={nextSkillInfo}
      branchBonus={branchBonus}
      jobSPData={jobSPData}
      reachedTier={reachedTier}
    />
  );
}

// jobSPDataがない場合の簡易版SP入力
function SimpleSPAllocation({ maxSP }: { maxSP: number }) {
  const { spAllocation, setSPAllocation } = useOptimizeStore();

  const handleSPChange = (branch: 'A' | 'B' | 'C', value: number) => {
    const currentTotal = (spAllocation.A || 0) + (spAllocation.B || 0) + (spAllocation.C || 0);
    const currentBranchValue = spAllocation[branch] || 0;
    const newTotal = currentTotal - currentBranchValue + value;

    if (newTotal <= maxSP) {
      setSPAllocation({ ...spAllocation, [branch]: value });
    }
  };

  const currentTotal = (spAllocation.A || 0) + (spAllocation.B || 0) + (spAllocation.C || 0);
  const remainingSP = maxSP - currentTotal;

  const branches: Array<{ key: 'A' | 'B' | 'C'; label: string }> = [
    { key: 'A', label: 'A軸' },
    { key: 'B', label: 'B軸' },
    { key: 'C', label: 'C軸' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between text-sm">
        <span className="text-white/60">使用可能SP</span>
        <span className="text-white font-medium">
          {currentTotal} / {maxSP}
          {remainingSP > 0 && (
            <span className="text-rpg-accent ml-2">(残り {remainingSP})</span>
          )}
        </span>
      </div>

      <div className="space-y-3">
        {branches.map(({ key, label }) => (
          <div key={key} className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-sm text-white/70">{label}</label>
              <span className="text-xs text-white/40">{spAllocation[key] || 0}</span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.min(100, (spAllocation[key] || 0) + remainingSP)}
              value={spAllocation[key] || 0}
              onChange={(e) => handleSPChange(key, Number(e.target.value))}
              aria-label={`${label}のSP値`}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        ))}
      </div>

      <button
        onClick={() => setSPAllocation({ A: 0, B: 0, C: 0 })}
        className="w-full py-2 text-sm text-white/40 hover:text-white border border-white/10 rounded-lg hover:border-white/20 transition-all"
      >
        リセット
      </button>

      <p className="text-xs text-white/50">
        余った分（残り {remainingSP} SP）は最適化時に自動で振り分けられます
      </p>
    </div>
  );
}
