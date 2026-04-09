'use client';

import { useEffect, useState, useMemo } from 'react';
import { useBuildStore } from '@/store/buildStore';
import { initializeGameData, loadAllSkillCalcData } from '@/lib/data';
import type { OptimizeGameData } from '@/lib/calc/optimize/engine';
import type { GameData, AllSkillCalcData } from '@/types/data';
import { convertJobNameToYAML } from '@/constants/jobMappings';

// 職業情報の型定義
export interface JobInfo {
  name: string;
  yamlName: string;
  availableWeapons: string[];
  availableArmors: string[];
  grade: string;
  maxLevel: number;
}

interface UseOptimizeDataReturn {
  isLoading: boolean;
  optimizeData: OptimizeGameData | null;
  localGameData: GameData | null;
  allSkillData: AllSkillCalcData | null;
  jobList: JobInfo[];
}

/**
 * 最適化ページで必要なゲームデータを読み込むカスタムフック
 */
export function useOptimizeData(): UseOptimizeDataReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [optimizeData, setOptimizeData] = useState<OptimizeGameData | null>(null);
  const [localGameData, setLocalGameData] = useState<GameData | null>(null);
  const [allSkillData, setAllSkillData] = useState<AllSkillCalcData | null>(null);
  const [localJobList, setLocalJobList] = useState<JobInfo[]>([]);

  // BuildStoreからのfallback用
  const buildStoreJobs = useBuildStore((state) => state.availableJobs);

  // 職業リストの取得（ローカルデータ優先、buildStore fallback）
  const jobList = useMemo((): JobInfo[] => {
    if (localJobList.length > 0) {
      return localJobList;
    }
    if (buildStoreJobs && buildStoreJobs.length > 0) {
      return buildStoreJobs.map((job) => ({
        name: job.name,
        yamlName: job.id,
        availableWeapons: job.availableWeapons || [],
        availableArmors: [],
        grade: 'First',
        maxLevel: (job as any).maxLevel || 100,
      }));
    }
    return [];
  }, [localJobList, buildStoreJobs]);

  // データ読み込み
  useEffect(() => {
    const loadData = async () => {
      try {
        const [data, skillData] = await Promise.all([
          initializeGameData(),
          loadAllSkillCalcData(),
        ]);

        if (skillData) {
          setAllSkillData(skillData);
        }

        if (data) {
          setLocalGameData(data);

          // AllSkillCalcData を SkillCalcData 形式に変換
          const convertedSkillCalc = skillData ? {
            SkillDefinition: {
              SkillBook: skillData.skillBook || {},
              JobSkill: {
                ...(skillData.specialJob || {}),
                ...(skillData.firstJob || {}),
                ...(skillData.secondJob || {}),
                ...(skillData.thirdJob || {}),
              },
            },
          } : data.yaml.skillCalc;

          setOptimizeData({
            weapons: data.csv.weapons,
            armors: data.csv.armors,
            accessories: data.csv.accessories,
            eqConst: data.yaml.eqConst,
            emblems: data.csv.emblems,
            jobConst: data.yaml.jobConst,
            jobSPData: data.csv.jobs,
            weaponCalc: data.yaml.weaponCalc,
            skillCalc: convertedSkillCalc,
            runestones: data.csv.runestones,
            tarots: data.csv.tarots,
            tarotCalcData: data.yaml.tarotCalc,
          });

          // 職業データを変換
          const jobs: JobInfo[] =
            Array.from(data.csv.jobs.entries()).map(([jobName, _spDataArray]) => {
              const yamlJobName = convertJobNameToYAML(jobName);
              const jobDefinition = (data.yaml.jobConst as any)?.JobDefinition?.[yamlJobName];
              const availableWeapons = jobDefinition?.AvailableWeapons || [];
              const availableArmors = jobDefinition?.AvailableArmors || [];
              const grade = jobDefinition?.Grade || 'First';
              const maxLevel = jobDefinition?.MaxLevel || 100;

              return {
                name: jobName,
                yamlName: yamlJobName,
                availableWeapons,
                availableArmors,
                grade,
                maxLevel,
              };
            });
          setLocalJobList(jobs);
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load game data:', err);
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  return {
    isLoading,
    optimizeData,
    localGameData,
    allSkillData,
    jobList,
  };
}
