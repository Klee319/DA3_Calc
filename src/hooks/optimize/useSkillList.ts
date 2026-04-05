'use client';

import { useMemo } from 'react';
import { getAllAvailableSkills } from '@/lib/data';
import type { AllSkillCalcData, AvailableSkill } from '@/types/data';
import type { JobInfo } from './useOptimizeData';
import { convertJobNameToYAML } from '@/constants/jobMappings';

// スキルリストアイテムの型
export interface SkillListItem {
  id: string;
  name: string;
  weaponType: string;
  source: string;
  type: string;
  multiplier: number;
  hits: number;
  coolTime: number;
  baseDamageType: string[];
}

interface UseSkillListParams {
  allSkillData: AllSkillCalcData | null;
  selectedJobName: string | null;
  jobList: JobInfo[];
}

/**
 * 選択中の職業に基づいてスキルリストを生成するカスタムフック
 */
export function useSkillList({
  allSkillData,
  selectedJobName,
  jobList,
}: UseSkillListParams): SkillListItem[] {
  return useMemo(() => {
    if (!allSkillData || !selectedJobName) {
      return [];
    }

    // 選択中の職業から使用可能武器を取得
    const selectedJob = jobList.find(
      (j) => j.yamlName === selectedJobName || j.name === selectedJobName
    );
    const availableWeapons = selectedJob?.availableWeapons || [];

    // 職業名をYAML形式に変換
    const yamlJobName = selectedJob?.yamlName || convertJobNameToYAML(selectedJobName);
    const jobGrade = selectedJob?.grade || 'First';

    // 全使用可能武器種のスキルを収集
    const allSkills: AvailableSkill[] = [];
    const seenSkillIds = new Set<string>();

    // 武器ごとにスキルを取得
    for (const weaponType of availableWeapons) {
      // "All"の場合は主要武器種を全て追加
      const weaponTypes =
        weaponType === 'All'
          ? ['Sword', 'GreatSword', 'Dagger', 'Axe', 'Spear', 'Bow', 'Wand']
          : [weaponType];

      for (const wt of weaponTypes) {
        const skills = getAllAvailableSkills(
          allSkillData,
          wt,
          yamlJobName,
          jobGrade,
          []
        );

        // 重複を避けて追加
        for (const skill of skills) {
          if (!seenSkillIds.has(skill.id)) {
            seenSkillIds.add(skill.id);
            allSkills.push(skill);
          }
        }
      }
    }

    // 武器が設定されていない場合はデフォルトでSword
    if (availableWeapons.length === 0) {
      const skills = getAllAvailableSkills(
        allSkillData,
        'Sword',
        yamlJobName,
        jobGrade,
        []
      );
      allSkills.push(...skills);
    }

    return allSkills.map((skill: AvailableSkill) => {
      const def = skill.definition;

      // CT（クールタイム）を取得
      let coolTime = 5;
      if (def?.CT !== undefined && def?.CT !== null) {
        if (typeof def.CT === 'number') {
          coolTime = def.CT;
        } else if (typeof def.CT === 'string') {
          const ctMatch = def.CT.match(/^(\d+(?:\.\d+)?)/);
          if (ctMatch) coolTime = parseFloat(ctMatch[1]);
        }
      }

      // Hits（ヒット数）を取得
      let hits = 1;
      if (def?.Hits !== undefined) {
        if (typeof def.Hits === 'number') {
          hits = def.Hits;
        } else if (Array.isArray(def.Hits)) {
          hits = Math.round((def.Hits[0] + def.Hits[1]) / 2);
        }
      }

      // ダメージ倍率を取得
      let multiplier = 1.0;
      if (def?.Damage && typeof def.Damage === 'string') {
        const multMatch = def.Damage.match(/\*\s*(\d+(?:\.\d+)?)/);
        if (multMatch) {
          multiplier = parseFloat(multMatch[1]);
        }
        const levelExpr = def.Damage.match(
          /\(<Level>\s*\+\s*(\d+)\)\s*\*\s*(\d+(?:\.\d+)?)/
        );
        if (levelExpr) {
          multiplier = (10 + parseInt(levelExpr[1])) * parseFloat(levelExpr[2]);
        }
      }

      return {
        id: skill.id,
        name: skill.name,
        weaponType: skill.weaponTypes[0] || 'any',
        source: skill.source,
        type: skill.type,
        multiplier,
        hits,
        coolTime,
        baseDamageType: def?.BaseDamageType || [],
      };
    });
  }, [allSkillData, selectedJobName, jobList]);
}
