import {
  WeaponData,
  ArmorData,
  AccessoryData,
  EmblemData,
  RunestoneData,
  FoodData,
  JobSPData,
  EqConstData
} from '@/types/data';
import {
  CsvParseError,
  FileNotFoundError,
  DataLoadErrorHandler,
  withFallback
} from './errors';

/**
 * CSVテキストを解析してオブジェクト配列に変換
 */
function parseCSV<T>(csvText: string, fileName: string = 'unknown'): T[] {
  try {
    const lines = csvText.trim().split('\n');
    if (lines.length === 0) return [];

    // BOMを除去
    const firstLine = lines[0].replace(/^\uFEFF/, '');
    lines[0] = firstLine;

    // ヘッダー行を取得
    const headers = lines[0].split(',').map(h => h.trim());

    // データ行をパース
    const data: T[] = [];
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(',');
        const row: any = {};

        for (let j = 0; j < headers.length; j++) {
          const header = headers[j];
          const value = values[j]?.trim() || '';

          // 数値として解析可能な場合は数値に変換
          if (value !== '' && !isNaN(Number(value))) {
            row[header] = Number(value);
          } else if (value === 'TRUE' || value === 'FALSE') {
            row[header] = value === 'TRUE';
          } else {
            row[header] = value;
          }
        }

        data.push(row as T);
      } catch (error) {
        console.warn(`Failed to parse CSV row ${i + 1} in ${fileName}:`, error);
        // 行のパースに失敗してもスキップして続行
      }
    }

    return data;
  } catch (error) {
    const csvError = new CsvParseError(
      fileName,
      undefined,
      error instanceof Error ? error : undefined
    );
    DataLoadErrorHandler.addError(csvError);
    throw csvError;
  }
}

/**
 * CSVファイルを読み込む共通関数
 */
async function loadCsvFile<T>(path: string): Promise<T[]> {
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
    console.log(`Loaded CSV from ${path}, length: ${text.length}`);
    
    const data = parseCSV<T>(text, fileName);
    console.log(`Parsed ${data.length} rows from ${path}`);
    return data;
  } catch (error) {
    // 既にカスタムエラーの場合はそのまま投げる
    if (error instanceof FileNotFoundError || error instanceof CsvParseError) {
      throw error;
    }
    
    // その他のエラーの場合
    console.error(`Error loading CSV file ${path}:`, error);
    const csvError = new CsvParseError(
      fileName,
      undefined,
      error instanceof Error ? error : undefined
    );
    DataLoadErrorHandler.addError(csvError);
    throw csvError;
  }
}

/**
 * ランクごとの係数を計算
 * SSS = 8, SS = 7, ... F = 0 のような係数
 */
function getRankCoefficient(rank: string): number {
  const rankMap: Record<string, number> = {
    'SSS': 8,
    'SS': 7,
    'S': 6,
    'A': 5,
    'B': 4,
    'C': 3,
    'D': 2,
    'E': 1,
    'F': 0
  };
  return rankMap[rank] || 0;
}

/**
 * 最低ランクが指定されている武器のF値を逆算
 */
function calculateWeaponFRankValues(weapon: WeaponData, eqConst?: EqConstData): WeaponData {
  if (!weapon.最低ランク || weapon.最低ランク === '' || weapon.最低ランク === 'F') {
    return weapon;
  }

  const minRank = weapon.最低ランク;
  const minRankCoeff = getRankCoefficient(minRank);
  const fRankCoeff = getRankCoefficient('F');
  
  // 係数の差分を計算
  const coeffDiff = minRankCoeff - fRankCoeff;
  
  if (coeffDiff <= 0) {
    return weapon;
  }

  // Fランクの値を逆算
  // 簡略化のため、線形的に逆算（実際の計算式に基づいて調整が必要）
  const adjustedWeapon = { ...weapon };
  
  // 攻撃力の逆算（仮の計算式）
  if (adjustedWeapon['攻撃力（初期値）']) {
    const attackPowerPerRank = 10; // 仮の値
    adjustedWeapon['攻撃力（初期値）'] = adjustedWeapon['攻撃力（初期値）'] - (attackPowerPerRank * coeffDiff);
  }
  
  // 会心率の逆算
  if (adjustedWeapon['会心率（初期値）']) {
    const critRatePerRank = 1; // 仮の値
    adjustedWeapon['会心率（初期値）'] = adjustedWeapon['会心率（初期値）'] - (critRatePerRank * coeffDiff);
  }
  
  // 会心ダメージの逆算
  if (adjustedWeapon['会心ダメージ（初期値）']) {
    const critDamagePerRank = 2; // 仮の値
    adjustedWeapon['会心ダメージ（初期値）'] = adjustedWeapon['会心ダメージ（初期値）'] - (critDamagePerRank * coeffDiff);
  }
  
  return adjustedWeapon;
}

/**
 * 武器データを読み込む
 */
export async function loadWeapons(eqConst?: EqConstData): Promise<WeaponData[]> {
  const weapons = await loadCsvFile<WeaponData>('/data/csv/Equipment/DA_EqCalc_Data - 武器.csv');
  
  // 最低ランク指定がある武器のF値を逆算
  return weapons.map(weapon => calculateWeaponFRankValues(weapon, eqConst));
}

/**
 * 防具データを読み込む
 */
export async function loadArmors(): Promise<ArmorData[]> {
  return loadCsvFile<ArmorData>('/data/csv/Equipment/DA_EqCalc_Data - 防具.csv');
}

/**
 * アクセサリーデータを読み込む
 */
export async function loadAccessories(): Promise<AccessoryData[]> {
  return loadCsvFile<AccessoryData>('/data/csv/Equipment/DA_EqCalc_Data - アクセサリー .csv');
}

/**
 * 紋章データを読み込む
 */
export async function loadEmblems(): Promise<EmblemData[]> {
  return loadCsvFile<EmblemData>('/data/csv/Equipment/DA_EqCalc_Data - 紋章.csv');
}

/**
 * ルーンストーンデータを読み込む
 */
export async function loadRunestones(): Promise<RunestoneData[]> {
  return loadCsvFile<RunestoneData>('/data/csv/Equipment/DA_EqCalc_Data - ルーンストーン.csv');
}

/**
 * 食べ物データを読み込む
 */
export async function loadFoods(): Promise<FoodData[]> {
  return loadCsvFile<FoodData>('/data/csv/Equipment/DA_EqCalc_Data - 食べ物.csv');
}

/**
 * ジョブデータを読み込む
 */
export async function loadJobData(jobName: string): Promise<JobSPData[]> {
  return loadCsvFile<JobSPData>(`/data/csv/Job/${jobName}.csv`);
}

/**
 * 全ての装備CSVデータを一括で読み込む
 */
export async function loadAllEquipmentData(eqConst?: EqConstData) {
  const [weapons, armors, accessories, emblems, runestones, foods] = await Promise.all([
    loadWeapons(eqConst),
    loadArmors(),
    loadAccessories(),
    loadEmblems(),
    loadRunestones(),
    loadFoods()
  ]);

  return {
    weapons,
    armors,
    accessories,
    emblems,
    runestones,
    foods
  };
}

/**
 * 全てのジョブデータを読み込む
 */
export async function loadAllJobData(): Promise<Map<string, JobSPData[]>> {
  const jobNames = [
    'ガーディアン',
    'ステラシャフト',
    'スペルリファクター',
    'ノービス',
    'プリースト'
  ];

  const jobDataMap = new Map<string, JobSPData[]>();

  await Promise.all(
    jobNames.map(async (jobName) => {
      try {
        const data = await loadJobData(jobName);
        jobDataMap.set(jobName, data);
      } catch (error) {
        console.warn(`Failed to load job data for ${jobName}:`, error);
      }
    })
  );

  return jobDataMap;
}