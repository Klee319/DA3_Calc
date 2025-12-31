import * as yaml from 'js-yaml';
import {
  EqConstData,
  JobConstData,
  WeaponCalcData,
  UserStatusCalcData,
  SkillCalcData,
  WeaponSkillCalcData,
  AllSkillCalcData,
  SkillBookData,
  JobSkillData,
  SkillDefinition,
  AvailableSkill,
  TarotCalcData
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

    // YAMLのパースを試みる
    let data: T;
    try {
      data = yaml.load(text) as T;
      
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
 * SkillCalc.yamlを読み込む（旧形式、後方互換性のため維持）
 * 注: SkillCalc.yamlは廃止され、SkillCalcフォルダに移行しています
 *     404エラーを避けるため、空オブジェクトを返します
 */
export async function loadSkillCalc(): Promise<SkillCalcData> {
  // 旧ファイルは削除されたため、空オブジェクトを返す
  return {} as SkillCalcData;
}

/**
 * WeaponSkillCalc.yamlを読み込む（武器スキルバフ定義）
 */
export async function loadWeaponSkillCalc(): Promise<WeaponSkillCalcData> {
  return loadYamlFile<WeaponSkillCalcData>('/data/formula/WeaponSkillCalc.yaml', true);
}

/**
 * TarotCalc.yamlを読み込む（タロット定義）
 */
export async function loadTarotCalc(): Promise<TarotCalcData> {
  return loadYamlFile<TarotCalcData>('/data/formula/TarotCalc.yaml', true);
}

/**
 * SkillCalcフォルダ内の全YAMLファイルを読み込む
 */
export async function loadAllSkillCalcData(): Promise<AllSkillCalcData> {
  const basePath = '/data/formula/SkillCalc';

  // 各ファイルを並列で読み込む
  const [skillBook, specialJob, firstJob, secondJob, thirdJob] = await Promise.all([
    withFallback(
      () => loadYamlFile<SkillBookData>(`${basePath}/SkillBook.yaml`, true),
      {} as SkillBookData,
      'Warning: Failed to load SkillBook.yaml'
    ),
    withFallback(
      () => loadYamlFile<JobSkillData>(`${basePath}/SkillSpecialJob.yaml`, true),
      {} as JobSkillData,
      'Warning: Failed to load SkillSpecialJob.yaml'
    ),
    withFallback(
      () => loadYamlFile<JobSkillData>(`${basePath}/SkillFirstJob.yaml`, true),
      {} as JobSkillData,
      'Warning: Failed to load SkillFirstJob.yaml'
    ),
    withFallback(
      () => loadYamlFile<JobSkillData>(`${basePath}/SkillSecondJob.yaml`, true),
      {} as JobSkillData,
      'Warning: Failed to load SkillSecondJob.yaml'
    ),
    withFallback(
      () => loadYamlFile<JobSkillData>(`${basePath}/SkillThirdJob.yaml`, true),
      {} as JobSkillData,
      'Warning: Failed to load SkillThirdJob.yaml'
    ),
  ]);

  // 空のYAMLファイルをパースするとnullが返される可能性があるため、
  // 各値がnullの場合は空のオブジェクトに置き換える
  const safeSkillBook = skillBook || {};
  const safeSpecialJob = specialJob || {};
  const safeFirstJob = firstJob || {};
  const safeSecondJob = secondJob || {};
  const safeThirdJob = thirdJob || {};

  return {
    skillBook: safeSkillBook,
    specialJob: safeSpecialJob,
    firstJob: safeFirstJob,
    secondJob: safeSecondJob,
    thirdJob: safeThirdJob,
  };
}

/**
 * スキル定義からスキルタイプを判定
 */
function determineSkillType(def: SkillDefinition): AvailableSkill['type'] {
  if (def.Heal) return 'heal';
  if (def.Buff && Object.keys(def.Buff).length > 0) return 'buff';
  if (def.Debuff && Object.keys(def.Debuff).length > 0) return 'debuff';
  if (def.Damage) return 'damage';
  return 'utility';
}

/**
 * スキル本データから利用可能スキルリストを生成
 * @param skillBook スキル本データ
 * @param currentWeaponType 現在装備中の武器種（YAML形式: Sword, Wand等）
 */
export function getAvailableBookSkills(
  skillBook: SkillBookData,
  currentWeaponType: string
): AvailableSkill[] {
  const skills: AvailableSkill[] = [];

  // 武器種に対応するスキルを取得
  const weaponSkills = skillBook[currentWeaponType];
  if (!weaponSkills) return skills;

  for (const [skillName, definition] of Object.entries(weaponSkills)) {
    skills.push({
      id: `book_${currentWeaponType}_${skillName}`,
      name: skillName,
      source: 'book',
      weaponTypes: definition.BaseDamageType || [currentWeaponType],
      definition,
      type: determineSkillType(definition),
    });
  }

  return skills;
}

/**
 * 職業スキルデータから利用可能スキルリストを生成
 * @param jobSkillData 職業スキルデータ
 * @param currentJobName 現在の職業名（YAML形式: Fighter, Mage等）
 * @param unlockedSkillNames 解放済みスキル名のリスト
 */
export function getAvailableJobSkills(
  jobSkillData: JobSkillData,
  currentJobName: string,
  unlockedSkillNames: string[]
): AvailableSkill[] {
  const skills: AvailableSkill[] = [];

  // 職業に対応するスキルを取得
  const jobSkills = jobSkillData[currentJobName];
  if (!jobSkills) return skills;

  for (const [skillName, definition] of Object.entries(jobSkills)) {
    // 解放済みスキルのみを追加
    if (unlockedSkillNames.includes(skillName)) {
      skills.push({
        id: `job_${currentJobName}_${skillName}`,
        name: skillName,
        source: 'job',
        jobName: currentJobName,
        weaponTypes: definition.BaseDamageType || [],
        definition,
        type: determineSkillType(definition),
      });
    }
  }

  return skills;
}

/**
 * 全スキルデータから利用可能なスキルを取得
 * @param allSkillData 全スキルデータ
 * @param currentWeaponType 現在の武器種（YAML形式）
 * @param currentJobName 現在の職業名（YAML形式）
 * @param jobGrade 職業のグレード（Special, First, Second, Third）
 * @param unlockedSkillNames 解放済みスキル名のリスト
 */
export function getAllAvailableSkills(
  allSkillData: AllSkillCalcData,
  currentWeaponType: string,
  currentJobName: string,
  jobGrade: string,
  unlockedSkillNames: string[]
): AvailableSkill[] {
  const skills: AvailableSkill[] = [];

  // 1. スキル本スキル（武器種が一致するもの）
  const bookSkills = getAvailableBookSkills(allSkillData.skillBook, currentWeaponType);
  skills.push(...bookSkills);

  // 2. 職業スキル（グレードに応じたデータから取得）
  let jobSkillData: JobSkillData = {};
  switch (jobGrade) {
    case 'Special':
      jobSkillData = allSkillData.specialJob;
      break;
    case 'First':
      jobSkillData = allSkillData.firstJob;
      break;
    case 'Second':
      jobSkillData = allSkillData.secondJob;
      break;
    case 'Third':
      jobSkillData = allSkillData.thirdJob;
      break;
  }

  const jobSkills = getAvailableJobSkills(jobSkillData, currentJobName, unlockedSkillNames);
  skills.push(...jobSkills);

  return skills;
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
 * 各ファイルにフォールバック処理を適用し、個別のエラーが全体に影響しないようにする
 */
export async function loadAllYamlData() {
  const [eqConst, jobConst, weaponCalc, userStatusCalc, skillCalc, weaponSkillCalc, tarotCalc] = await Promise.all([
    withFallback(
      () => loadEqConst(),
      {} as EqConstData,
      'Warning: Failed to load EqConst.yaml'
    ),
    withFallback(
      () => loadJobConst(),
      {} as JobConstData,
      'Warning: Failed to load JobConst.yaml'
    ),
    withFallback(
      () => loadWeaponCalc(),
      {} as WeaponCalcData,
      'Warning: Failed to load WeaponCalc.yaml'
    ),
    withFallback(
      () => loadUserStatusCalc(),
      {} as UserStatusCalcData,
      'Warning: Failed to load UserStatusCalc.yaml'
    ),
    // SkillCalc.yamlは廃止され、SkillCalcフォルダに移行
    // 後方互換性のため空オブジェクトを返す
    withFallback(
      () => loadSkillCalc(),
      {} as SkillCalcData,
      'Info: SkillCalc.yaml not found (migrated to SkillCalc folder)'
    ),
    withFallback(
      () => loadWeaponSkillCalc(),
      {} as WeaponSkillCalcData,
      'Warning: Failed to load WeaponSkillCalc.yaml'
    ),
    withFallback(
      () => loadTarotCalc(),
      {} as TarotCalcData,
      'Warning: Failed to load TarotCalc.yaml'
    )
  ]);

  return {
    eqConst,
    jobConst,
    weaponCalc,
    userStatusCalc,
    skillCalc,
    weaponSkillCalc,
    tarotCalc
  };
}