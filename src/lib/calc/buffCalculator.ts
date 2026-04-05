/**
 * バフ計算モジュール
 * 武器スキル・職業スキルによるステータスバフを計算
 */

import * as mathjs from 'mathjs';
import type { StatBlock, InternalStatKey } from '@/types/calc';

// ===== 型定義 =====

/** バフ効果の定義 */
export interface BuffEffect {
  /** 対象ステータス */
  stat: InternalStatKey;
  /** 計算式（BaseStatus.<Stat>, SkillLevel等を含む） */
  formula: string;
  /** 計算済みの値 */
  value?: number;
}

/** 武器スキルバフ定義 */
export interface WeaponSkillBuff {
  id: string;
  name: string;
  weaponNames: string[];  // 対象武器名リスト
  buffs: Record<string, string>;  // ステータス名 -> 計算式
  maxLevel: number;
}

/** 職業スキルバフ定義 */
export interface JobSkillBuff {
  id: string;
  name: string;
  jobName: string;
  requiredSkills: string[];  // 必要なスキル名リスト
  buffs: Record<string, string>;  // ステータス名 -> 計算式
  maxLevel: number;
}

/** バフ計算入力 */
export interface BuffCalcInput {
  baseStats: StatBlock;        // バフ前の基礎ステータス
  skillLevel?: number;         // スキルレベル（デフォルト: 10）
  weaponName?: string;         // 装備中の武器名
  jobName?: string;            // 職業名
  unlockedSkills?: string[];   // 解放済みスキル名リスト
}

/** バフ計算結果 */
export interface BuffCalcResult {
  /** 適用されたバフの一覧 */
  appliedBuffs: Array<{
    buffId: string;
    buffName: string;
    effects: BuffEffect[];
  }>;
  /** バフによるステータス加算値 */
  buffStats: StatBlock;
  /** バフ適用後の最終ステータス */
  finalStats: StatBlock;
}

// ===== バフデータ読み込み =====

/** 武器スキルバフデータ */
let weaponSkillBuffs: WeaponSkillBuff[] = [];

/** 職業スキルバフデータ */
let jobSkillBuffs: JobSkillBuff[] = [];

/**
 * バフデータを設定
 */
export function setBuffData(
  weaponBuffs: WeaponSkillBuff[],
  jobBuffs: JobSkillBuff[]
): void {
  weaponSkillBuffs = weaponBuffs;
  jobSkillBuffs = jobBuffs;
}

/**
 * YAMLデータからバフデータを解析
 */
export function parseBuffDataFromYaml(yamlData: any): {
  weaponSkills: WeaponSkillBuff[];
  jobSkills: JobSkillBuff[];
} {
  const weaponSkills: WeaponSkillBuff[] = [];
  const jobSkills: JobSkillBuff[] = [];

  // 武器スキルの解析
  if (yamlData.WeaponSkills) {
    for (const [id, data] of Object.entries(yamlData.WeaponSkills)) {
      const skillData = data as any;
      weaponSkills.push({
        id,
        name: skillData.Name || id,
        weaponNames: skillData.WeaponNames || [],
        buffs: skillData.Buffs || {},
        maxLevel: skillData.MaxLevel || 10,
      });
    }
  }

  // 職業スキルの解析
  if (yamlData.JobSkills) {
    for (const [id, data] of Object.entries(yamlData.JobSkills)) {
      const skillData = data as any;
      jobSkills.push({
        id,
        name: skillData.Name || id,
        jobName: skillData.JobName || '',
        requiredSkills: skillData.RequiredSkills || [],
        buffs: skillData.Buffs || {},
        maxLevel: skillData.MaxLevel || 10,
      });
    }
  }

  return { weaponSkills, jobSkills };
}

// ===== 計算関数 =====

/**
 * バフ計算式を評価
 */
function evaluateBuffFormula(
  formula: string,
  baseStats: StatBlock,
  skillLevel: number
): number {
  try {
    // プレースホルダーを置換
    let evaluableFormula = formula;

    // BaseStatus.<Stat> を実際の値に置換
    evaluableFormula = evaluableFormula.replace(
      /BaseStatus\.(\w+)/g,
      (_, stat) => {
        const value = baseStats[stat as keyof StatBlock] || 0;
        return String(value);
      }
    );

    // SkillLevel を置換
    evaluableFormula = evaluableFormula.replace(/SkillLevel/g, String(skillLevel));

    // ROUND, FLOOR, MAX, MIN関数を小文字に変換（mathjsの関数名）
    evaluableFormula = evaluableFormula.replace(/ROUND/g, 'round');
    evaluableFormula = evaluableFormula.replace(/FLOOR/g, 'floor');
    evaluableFormula = evaluableFormula.replace(/MAX/g, 'max');
    evaluableFormula = evaluableFormula.replace(/MIN/g, 'min');

    // mathjsで評価
    const result = mathjs.evaluate(evaluableFormula);
    return typeof result === 'number' ? result : Number(result);
  } catch (error) {
    console.warn('[BuffCalculator] Formula evaluation failed:', formula, error);
    return 0;
  }
}

/**
 * 適用可能な武器スキルバフを取得
 */
export function getApplicableWeaponBuffs(weaponName: string): WeaponSkillBuff[] {
  return weaponSkillBuffs.filter(buff =>
    buff.weaponNames.some(name =>
      weaponName.includes(name) || name.includes(weaponName)
    )
  );
}

/**
 * 適用可能な職業スキルバフを取得
 */
export function getApplicableJobBuffs(
  jobName: string,
  unlockedSkills: string[]
): JobSkillBuff[] {
  return jobSkillBuffs.filter(buff => {
    // 職業が一致
    if (buff.jobName && buff.jobName !== jobName) {
      return false;
    }
    // 必要スキルがすべて解放されている
    return buff.requiredSkills.every(skill =>
      unlockedSkills.some(unlocked =>
        unlocked.includes(skill) || skill.includes(unlocked)
      )
    );
  });
}

/**
 * バフを計算して適用
 */
export function calculateBuffs(input: BuffCalcInput): BuffCalcResult {
  const skillLevel = input.skillLevel ?? 10;
  const appliedBuffs: BuffCalcResult['appliedBuffs'] = [];
  const buffStats: StatBlock = {};

  // 武器スキルバフの適用
  if (input.weaponName) {
    const weaponBuffs = getApplicableWeaponBuffs(input.weaponName);
    for (const buff of weaponBuffs) {
      const effects: BuffEffect[] = [];
      for (const [stat, formula] of Object.entries(buff.buffs)) {
        const value = evaluateBuffFormula(formula, input.baseStats, skillLevel);
        effects.push({
          stat: stat as InternalStatKey,
          formula,
          value,
        });
        // バフ値を加算
        buffStats[stat as keyof StatBlock] =
          ((buffStats[stat as keyof StatBlock] as number) || 0) + value;
      }
      appliedBuffs.push({
        buffId: buff.id,
        buffName: buff.name,
        effects,
      });
    }
  }

  // 職業スキルバフの適用
  if (input.jobName && input.unlockedSkills) {
    const jobBuffs = getApplicableJobBuffs(input.jobName, input.unlockedSkills);
    for (const buff of jobBuffs) {
      const effects: BuffEffect[] = [];
      for (const [stat, formula] of Object.entries(buff.buffs)) {
        const value = evaluateBuffFormula(formula, input.baseStats, skillLevel);
        effects.push({
          stat: stat as InternalStatKey,
          formula,
          value,
        });
        // バフ値を加算
        buffStats[stat as keyof StatBlock] =
          ((buffStats[stat as keyof StatBlock] as number) || 0) + value;
      }
      appliedBuffs.push({
        buffId: buff.id,
        buffName: buff.name,
        effects,
      });
    }
  }

  // 最終ステータスを計算
  const finalStats: StatBlock = { ...input.baseStats };
  for (const [stat, value] of Object.entries(buffStats)) {
    if (typeof value === 'number') {
      finalStats[stat as keyof StatBlock] =
        ((finalStats[stat as keyof StatBlock] as number) || 0) + value;
    }
  }

  return {
    appliedBuffs,
    buffStats,
    finalStats,
  };
}

/**
 * 利用可能なバフリストを取得（UI表示用）
 */
export function getAvailableBuffs(
  jobName?: string,
  weaponName?: string
): Array<{ id: string; name: string; type: 'weapon' | 'job' }> {
  const available: Array<{ id: string; name: string; type: 'weapon' | 'job' }> = [];

  // 武器スキルバフ
  if (weaponName) {
    for (const buff of weaponSkillBuffs) {
      if (buff.weaponNames.some(name => weaponName.includes(name))) {
        available.push({ id: buff.id, name: buff.name, type: 'weapon' });
      }
    }
  }

  // 職業スキルバフ
  if (jobName) {
    for (const buff of jobSkillBuffs) {
      if (!buff.jobName || buff.jobName === jobName) {
        available.push({ id: buff.id, name: buff.name, type: 'job' });
      }
    }
  }

  return available;
}
