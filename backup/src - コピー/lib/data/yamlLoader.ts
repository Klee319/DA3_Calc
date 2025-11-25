import * as yaml from 'js-yaml';
import {
  EqConstData,
  JobConstData,
  WeaponCalcData,
  UserStatusCalcData,
  SkillCalcData
} from '@/types/data';
import { Skill } from '@/types';
import { 
  YamlParseError, 
  FileNotFoundError,
  DataLoadErrorHandler,
  withFallback 
} from './errors';

/**
 * パラメータ名のマッピング定義
 * <AgilityFactor>等の未定義パラメータを実際のステータス名に置き換える
 */
const PARAMETER_MAPPINGS: Record<string, string> = {
  '<AgilityFactor>': 'UserAgility',
  '<Level>': 'SkillLevel',
  '<JobLevel>': 'JobLevel',
  '<ReinforcementLevel>': 'ReinforcementLevel',
  '<ForgeCount>': 'ForgeCount',
  '<ForgeCritRAmount>': 'ForgeCritR',
  '<ForgeCritDAmount>': 'ForgeCritD',
  '<ForgeAttackPAmount>': 'ForgeAttackP',
  '<Stat>': 'StatName' // 動的に置き換え
};

/**
 * 計算式内のパラメータを置き換える
 */
function replaceFormulaParameters(formula: string | unknown): string | unknown {
  if (typeof formula !== 'string') {
    return formula;
  }
  
  let result = formula;
  for (const [placeholder, replacement] of Object.entries(PARAMETER_MAPPINGS)) {
    result = result.replace(new RegExp(placeholder.replace(/[<>]/g, '\\$&'), 'g'), replacement);
  }
  
  return result;
}

/**
 * オブジェクト内の全ての文字列値にパラメータ置き換えを適用
 */
function replaceParametersInObject<T>(obj: T): T {
  if (typeof obj === 'string') {
    return replaceFormulaParameters(obj) as T;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => replaceParametersInObject(item)) as T;
  }
  
  if (typeof obj === 'object' && obj !== null) {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = replaceParametersInObject(value);
    }
    return result as T;
  }
  
  return obj;
}

/**
 * YAMLファイルを読み込む共通関数
 */
async function loadYamlFile<T>(path: string, replaceParams: boolean = false): Promise<T> {
  const fileName = path.split('/').pop() || path;
  
  try {
    const response = await fetch(path);
    if (!response.ok) {
      if (response.status === 404) {
        const error = new FileNotFoundError(fileName);
        DataLoadErrorHandler.addError(error);
        throw error;
      }
      throw new Error(`Failed to load ${path}: ${response.statusText}`);
    }
    const text = await response.text();
    console.log(`Loaded YAML text from ${path}, length: ${text.length}`);
    
    // YAMLのパースを試みる
    let data: T;
    try {
      data = yaml.load(text) as T;
      console.log(`Successfully parsed YAML from ${path}`);
      
      // パラメータ置き換えが必要な場合
      if (replaceParams) {
        data = replaceParametersInObject(data);
      }
    } catch (parseError) {
      const yamlError = new YamlParseError(
        fileName,
        parseError instanceof Error ? parseError : undefined
      );
      DataLoadErrorHandler.addError(yamlError);
      throw yamlError;
    }
    
    return data;
  } catch (error) {
    // 既にカスタムエラーの場合はそのまま投げる
    if (error instanceof FileNotFoundError || error instanceof YamlParseError) {
      throw error;
    }
    
    // その他のエラーの場合
    console.error(`Error loading YAML file ${path}:`, error);
    const loadError = new YamlParseError(
      fileName,
      error instanceof Error ? error : undefined
    );
    DataLoadErrorHandler.addError(loadError);
    throw loadError;
  }
}

/**
 * EqConst.yamlを読み込む
 */
export async function loadEqConst(): Promise<EqConstData> {
  return loadYamlFile<EqConstData>('/data/formula/EqConst.yaml');
}

/**
 * JobConst.yamlを読み込む
 */
export async function loadJobConst(): Promise<JobConstData> {
  return loadYamlFile<JobConstData>('/data/formula/JobConst.yaml');
}

/**
 * WeaponCalc.yamlを読み込む
 */
export async function loadWeaponCalc(): Promise<WeaponCalcData> {
  return loadYamlFile<WeaponCalcData>('/data/formula/WeaponCalc.yaml', true);
}

/**
 * UserStatusCalc.yamlを読み込む
 */
export async function loadUserStatusCalc(): Promise<UserStatusCalcData> {
  return loadYamlFile<UserStatusCalcData>('/data/formula/UserStatusCalc.yaml', true);
}

/**
 * SkillCalc.yamlを読み込む
 */
export async function loadSkillCalc(): Promise<SkillCalcData> {
  return loadYamlFile<SkillCalcData>('/data/formula/SkillCalc.yaml', true);
}

/**
 * SkillCalcデータからスキル一覧を生成
 */
export function extractSkillsFromCalcData(skillCalc: SkillCalcData): Skill[] {
  const skills: Skill[] = [];
  
  // 通常攻撃を追加
  skills.push({
    id: 'basic_attack',
    name: '通常攻撃',
    description: '基本的な武器攻撃',
    type: 'physical',
    element: 'none',
    mpCost: 0,
    cooldown: 0,
    range: 'melee'
  });

  // SkillCalcDataから全スキルを抽出
  function extractSkillsRecursive(data: any, prefix: string = '') {
    if (!data || typeof data !== 'object') return;
    
    for (const [key, value] of Object.entries(data)) {
      if (!value || typeof value !== 'object') continue;
      
      // スキルデータの判定（Damageフィールドがある、またはMPフィールドがある）
      const val = value as Record<string, unknown>;
      if ('Damage' in val || 'damage' in val || 'MP' in val || 'mp' in val) {
        const skillName = prefix ? `${prefix}.${key}` : key;
        const mpValue = val.MP || val.mp || '0';
        const ctValue = val.CT || val.ct || '0';
        
        // MP/CTが数式の場合、デフォルト値を使用
        let mpCost = 0;
        let cooldown = 0;
        
        if (typeof mpValue === 'number') {
          mpCost = mpValue;
        } else if (typeof mpValue === 'string' && !mpValue.includes('Level')) {
          mpCost = parseInt(mpValue) || 0;
        } else {
          mpCost = 10; // デフォルト値
        }
        
        if (typeof ctValue === 'number') {
          cooldown = ctValue;
        } else if (typeof ctValue === 'string' && !ctValue.includes('Level')) {
          cooldown = parseFloat(ctValue) || 0;
        } else {
          cooldown = 3; // デフォルト値
        }
        
        // スキルタイプと属性の推定
        let type: 'physical' | 'magical' | 'hybrid' = 'physical';
        let element = 'none';
        
        const nameLower = skillName.toLowerCase();
        if (nameLower.includes('magic') || nameLower.includes('spell') || 
            nameLower.includes('魔法') || nameLower.includes('マジック')) {
          type = 'magical';
        }
        
        if (nameLower.includes('fire') || nameLower.includes('flame') || 
            nameLower.includes('炎') || nameLower.includes('火')) {
          element = 'fire';
        } else if (nameLower.includes('ice') || nameLower.includes('frost') || 
                   nameLower.includes('氷') || nameLower.includes('冷')) {
          element = 'ice';
        } else if (nameLower.includes('thunder') || nameLower.includes('lightning') || 
                   nameLower.includes('雷')) {
          element = 'thunder';
        } else if (nameLower.includes('heal') || nameLower.includes('cure') || 
                   nameLower.includes('回復') || nameLower.includes('治癒')) {
          element = 'light';
        } else if (nameLower.includes('dark') || nameLower.includes('shadow') || 
                   nameLower.includes('闇')) {
          element = 'dark';
        }
        
        skills.push({
          id: skillName.replace(/\s+/g, '_').toLowerCase(),
          name: skillName,
          description: `${skillName}の説明`,
          type,
          element,
          mpCost,
          cooldown,
          range: type === 'magical' ? 'ranged' : 'melee'
        });
      } else {
        // ネストされたオブジェクトを再帰的に探索
        extractSkillsRecursive(value, prefix ? `${prefix}.${key}` : key);
      }
    }
  }
  
  extractSkillsRecursive(skillCalc);
  
  return skills;
}

/**
 * 全てのYAMLファイルを一括で読み込む
 */
export async function loadAllYamlData() {
  const [eqConst, jobConst, weaponCalc, userStatusCalc, skillCalc] = await Promise.all([
    loadEqConst(),
    loadJobConst(),
    loadWeaponCalc(),
    loadUserStatusCalc(),
    loadSkillCalc()
  ]);

  return {
    eqConst,
    jobConst,
    weaponCalc,
    userStatusCalc,
    skillCalc
  };
}