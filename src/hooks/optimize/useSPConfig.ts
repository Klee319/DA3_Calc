'use client';

import { useMemo, useCallback } from 'react';
import type { GameData } from '@/types/data';

interface SPValues {
  A: number;
  B: number;
  C: number;
}

interface SPConfig {
  maxSP: number;
  maxSPByBranch: { A: number; B: number; C: number };
}

interface UseSPConfigParams {
  selectedJobName: string | null;
  localGameData: GameData | null;
  jobMaxLevel: number;
  spAllocation: Record<string, number>;
  setSPAllocation: (allocation: Record<string, number>) => void;
}

interface UseSPConfigReturn {
  selectedJobSPData: any[] | null;
  spConfig: SPConfig;
  spValues: SPValues;
  handleSPChange: (values: SPValues) => void;
}

/**
 * SP設定関連のロジックを提供するカスタムフック
 */
export function useSPConfig({
  selectedJobName,
  localGameData,
  jobMaxLevel,
  spAllocation,
  setSPAllocation,
}: UseSPConfigParams): UseSPConfigReturn {
  // 選択した職業のSPツリーデータを取得
  const selectedJobSPData = useMemo(() => {
    if (!selectedJobName || !localGameData?.csv?.jobs) {
      return null;
    }
    return localGameData.csv.jobs.get(selectedJobName) || null;
  }, [selectedJobName, localGameData]);

  // SP最大値と各軸の最大値を計算
  const spConfig = useMemo((): SPConfig => {
    if (!selectedJobSPData) {
      return { maxSP: 0, maxSPByBranch: { A: 0, B: 0, C: 0 } };
    }

    // 職業レベルに応じた最大SP（レベル1あたり2SP）
    const maxSP = (jobMaxLevel || 100) * 2;

    // 各軸の最大SP
    const maxSPByBranch = { A: 0, B: 0, C: 0 };
    for (const row of selectedJobSPData) {
      const stage = row.解法段階;
      const match = stage.match(/^([A-C])-(\d+)$/);
      if (match) {
        const branch = match[1] as 'A' | 'B' | 'C';
        const requiredSP =
          typeof row.必要SP === 'string'
            ? parseFloat(row.必要SP) || 0
            : row.必要SP || 0;
        maxSPByBranch[branch] = Math.max(maxSPByBranch[branch], requiredSP);
      }
    }

    return { maxSP, maxSPByBranch };
  }, [selectedJobSPData, jobMaxLevel]);

  // SP値をSPSliderの形式に変換
  const spValues = useMemo((): SPValues => {
    const values = { A: 0, B: 0, C: 0 };
    if (spAllocation && selectedJobSPData) {
      for (const [key, value] of Object.entries(spAllocation)) {
        if (value !== 1) continue;
        const match = key.match(/^([A-C])-(\d+)$/);
        if (match) {
          const branch = match[1] as 'A' | 'B' | 'C';
          const tierData = selectedJobSPData.find((row) => row.解法段階 === key);
          if (tierData) {
            const requiredSP =
              typeof tierData.必要SP === 'string'
                ? parseFloat(tierData.必要SP) || 0
                : tierData.必要SP || 0;
            values[branch] = Math.max(values[branch], requiredSP);
          }
        }
      }
    }
    return values;
  }, [spAllocation, selectedJobSPData]);

  // SP変更ハンドラ
  const handleSPChange = useCallback(
    (values: SPValues) => {
      if (!selectedJobSPData) return;

      const newAllocation: Record<string, number> = {};
      for (const row of selectedJobSPData) {
        const stage = row.解法段階;
        const match = stage.match(/^([A-C])-(\d+)$/);
        if (match) {
          const branch = match[1] as 'A' | 'B' | 'C';
          const requiredSP =
            typeof row.必要SP === 'string'
              ? parseFloat(row.必要SP) || 0
              : row.必要SP || 0;
          if (values[branch] >= requiredSP) {
            newAllocation[stage] = 1;
          }
        }
      }
      setSPAllocation(newAllocation);
    },
    [selectedJobSPData, setSPAllocation]
  );

  return {
    selectedJobSPData,
    spConfig,
    spValues,
    handleSPChange,
  };
}
