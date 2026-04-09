/**
 * ステータス重みづけマッピングローダー
 *
 * 事前計算されたマッピングJSONを読み込み、最適化処理で使用
 */

import type { InternalStatKey } from '@/types/calc';
import type {
  StatWeight,
  SkillStatMapping,
  JobSkillMapping,
  SkillBookMapping,
  WeaponBaseDamageMapping,
  StatWeightMappingData,
} from './statWeightMapping';
import { AVAILABLE_EX_TYPES } from './optimize/constants';

// ===== キャッシュ =====

let cachedMapping: StatWeightMappingData | null = null;
let loadPromise: Promise<StatWeightMappingData> | null = null;

// ===== ローダー =====

/**
 * マッピングJSONを読み込み（ブラウザ用）
 */
export async function loadStatWeightMapping(): Promise<StatWeightMappingData> {
  if (cachedMapping) {
    return cachedMapping;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      const response = await fetch('/data/mapping/statWeightMapping.json');
      if (!response.ok) {
        throw new Error(`Failed to load stat weight mapping: ${response.status}`);
      }
      cachedMapping = await response.json();
      return cachedMapping!;
    } catch (error) {
      console.error('[StatWeightLoader] Failed to load mapping:', error);
      // フォールバック: 空のマッピング
      cachedMapping = {
        version: '0.0.0',
        generatedAt: new Date().toISOString(),
        weaponBaseDamage: [],
        jobMappings: [],
        skillBooks: [],
      };
      return cachedMapping;
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

/**
 * マッピングを同期的に取得（事前にloadが必要）
 */
export function getStatWeightMappingSync(): StatWeightMappingData | null {
  return cachedMapping;
}

/**
 * キャッシュをクリア
 */
export function clearStatWeightMappingCache(): void {
  cachedMapping = null;
  loadPromise = null;
}

// ===== アクセサ関数 =====

/**
 * 職業のスキルマッピングを取得
 */
export function getJobSkillMappingFromCache(jobName: string): JobSkillMapping | undefined {
  if (!cachedMapping) return undefined;

  return cachedMapping.jobMappings.find(
    jm => jm.jobNameYaml === jobName || jm.jobNameJa === jobName
  );
}

/**
 * 武器種の基礎ダメージマッピングを取得
 */
export function getWeaponBaseDamageMappingFromCache(weaponType: string): WeaponBaseDamageMapping | undefined {
  if (!cachedMapping) return undefined;

  return cachedMapping.weaponBaseDamage.find(wb => wb.weaponType === weaponType);
}

/**
 * スキルブックマッピングを取得
 */
export function getSkillBookMappingFromCache(weaponType: string): SkillBookMapping | undefined {
  if (!cachedMapping) return undefined;

  return cachedMapping.skillBooks.find(sb => sb.weaponType === weaponType);
}

/**
 * スキルのステータス重みを高速取得
 *
 * @param jobName 職業名（YAML形式または日本語）
 * @param skillName スキル名
 * @param weaponType 武器種（通常攻撃の場合に必要）
 */
export function getSkillWeightsFromCache(
  jobName: string,
  skillName: string,
  weaponType?: string
): StatWeight[] {
  const jobMapping = getJobSkillMappingFromCache(jobName);
  if (!jobMapping) {
    console.warn(`[StatWeightLoader] Job not found: ${jobName}`);
    return [];
  }

  // 通常攻撃
  if ((skillName === '通常攻撃' || skillName === 'basic_attack' || skillName === 'normal_attack') && weaponType) {
    const basicAttack = jobMapping.basicAttack[weaponType];
    if (basicAttack) {
      return basicAttack.weights;
    }
    // 武器種が見つからない場合は最初の武器を返す
    const firstWeapon = Object.keys(jobMapping.basicAttack)[0];
    if (firstWeapon) {
      return jobMapping.basicAttack[firstWeapon].weights;
    }
    return [];
  }

  // 職業スキル
  const skill = jobMapping.skills.find(
    s => s.skillName === skillName || s.skillId === skillName
  );
  if (skill) {
    return skill.weights;
  }

  // スキルブックから検索
  if (cachedMapping) {
    for (const book of cachedMapping.skillBooks) {
      const bookSkill = book.skills.find(s => s.skillName === skillName);
      if (bookSkill) {
        return bookSkill.weights;
      }
    }
  }

  console.warn(`[StatWeightLoader] Skill not found: ${skillName} in job ${jobName}`);
  return [];
}

/**
 * EX選択の推奨順位を高速取得
 */
export function getRecommendedEXOrderFromCache(
  jobName: string,
  skillName: string,
  slotType: 'armor' | 'accessory',
  weaponType?: string
): string[] {
  const weights = getSkillWeightsFromCache(jobName, skillName, weaponType);

  if (weights.length === 0) {
    // デフォルトの順序を返す
    return slotType === 'armor'
      ? ['Power', 'Magic', 'CritDamage', 'HP', 'Mind', 'Speed', 'Dex', 'Defense']
      : ['Power', 'Magic', 'CritDamage', 'HP', 'Mind', 'Speed', 'Dex'];
  }

  // EXで選択可能なステータス（定数から参照）
  const availableTypes = [...AVAILABLE_EX_TYPES];

  // ステータス → EXタイプ
  const statToEx: Record<string, string> = {
    'Power': 'Power',
    'Magic': 'Magic',
    'HP': 'HP',
    'Mind': 'Mind',
    'Agility': 'Speed',
    'Dex': 'Dex',
    'CritDamage': 'CritDamage',
    'Defense': 'Defense',
  };

  // 重みでソート
  const prioritized: { exType: string; weight: number }[] = availableTypes.map(exType => {
    let totalWeight = 0;
    for (const w of weights) {
      if (statToEx[w.stat] === exType) {
        totalWeight += w.normalizedWeight;
      }
    }
    return { exType, weight: totalWeight };
  });

  prioritized.sort((a, b) => b.weight - a.weight);

  return prioritized.map(p => p.exType);
}

/**
 * スキルの完全なマッピング情報を取得
 */
export function getFullSkillMappingFromCache(
  jobName: string,
  skillName: string,
  weaponType?: string
): SkillStatMapping | undefined {
  const jobMapping = getJobSkillMappingFromCache(jobName);
  if (!jobMapping) return undefined;

  // 通常攻撃
  if ((skillName === '通常攻撃' || skillName === 'basic_attack' || skillName === 'normal_attack') && weaponType) {
    return jobMapping.basicAttack[weaponType];
  }

  // 職業スキル
  const skill = jobMapping.skills.find(
    s => s.skillName === skillName || s.skillId === skillName
  );
  if (skill) return skill;

  // スキルブックから検索
  if (cachedMapping) {
    for (const book of cachedMapping.skillBooks) {
      const bookSkill = book.skills.find(s => s.skillName === skillName);
      if (bookSkill) return bookSkill;
    }
  }

  return undefined;
}

/**
 * 職業で使用可能な全スキルを取得
 */
export function getAllJobSkillsFromCache(jobName: string): SkillStatMapping[] {
  const jobMapping = getJobSkillMappingFromCache(jobName);
  if (!jobMapping) return [];

  const skills: SkillStatMapping[] = [];

  // 通常攻撃
  for (const basicAttack of Object.values(jobMapping.basicAttack)) {
    skills.push(basicAttack);
  }

  // 職業スキル
  skills.push(...jobMapping.skills);

  // 使用可能な武器種のスキルブック
  if (cachedMapping) {
    for (const weaponType of jobMapping.availableWeapons) {
      const book = cachedMapping.skillBooks.find(sb => sb.weaponType === weaponType);
      if (book) {
        skills.push(...book.skills);
      }
    }
  }

  return skills;
}

/**
 * ダメージ貢献度の高いステータスを取得
 *
 * @param jobName 職業名
 * @param skillName スキル名
 * @param topN 上位N個を取得
 */
export function getTopDamageContributingStats(
  jobName: string,
  skillName: string,
  topN: number = 3,
  weaponType?: string
): { stat: InternalStatKey; normalizedWeight: number }[] {
  const weights = getSkillWeightsFromCache(jobName, skillName, weaponType);

  return weights
    .slice(0, topN)
    .map(w => ({ stat: w.stat, normalizedWeight: w.normalizedWeight }));
}

/**
 * 防具叩き配分の推奨を取得
 *
 * @param jobName 職業名
 * @param skillName スキル名
 * @param maxCount 最大叩き回数
 */
export function getRecommendedArmorSmithingFromCache(
  jobName: string,
  skillName: string,
  maxCount: number = 12,
  weaponType?: string
): Record<string, number> {
  const weights = getSkillWeightsFromCache(jobName, skillName, weaponType);

  if (weights.length === 0) {
    // デフォルト: 力に全振り
    return { Power: maxCount };
  }

  const distribution: Record<string, number> = {};
  let remaining = maxCount;

  // 上位3ステータスに配分
  const topStats = weights.slice(0, 3);

  for (let i = 0; i < topStats.length && remaining > 0; i++) {
    const stat = topStats[i];
    // 正規化重みに基づいて配分
    const allocation = i === topStats.length - 1
      ? remaining  // 最後は残り全て
      : Math.round(maxCount * stat.normalizedWeight);

    if (allocation > 0 && allocation <= remaining) {
      distribution[stat.stat] = allocation;
      remaining -= allocation;
    }
  }

  // 残りがあれば最上位に追加
  if (remaining > 0 && topStats.length > 0) {
    distribution[topStats[0].stat] = (distribution[topStats[0].stat] || 0) + remaining;
  }

  return distribution;
}

// ===== 初期化 =====

/**
 * アプリ起動時にマッピングを事前ロード
 */
export async function initializeStatWeightMapping(): Promise<void> {
  await loadStatWeightMapping();
}
