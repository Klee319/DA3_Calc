import {
  WeaponData,
  ArmorData,
  AccessoryData,
  EmblemData,
  RunestoneData,
  RunestoneResistance,
  RunestoneGrade,
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

  // 空のエントリをフィルタリング（アイテム名が空の行を除外）
  const validWeapons = weapons.filter(weapon =>
    weapon.アイテム名 && weapon.アイテム名.toString().trim() !== ''
  );

  // 最低ランク指定がある武器のF値を逆算
  return validWeapons.map(weapon => calculateWeaponFRankValues(weapon, eqConst));
}

/**
 * 防具データを読み込む
 */
export async function loadArmors(): Promise<ArmorData[]> {
  const rawData = await loadCsvFile<any>('/data/csv/Equipment/DA_EqCalc_Data - 防具.csv');

  // 空のエントリをフィルタリング（アイテム名が空の行を除外）
  const validData = rawData.filter(item => {
    const name = item['アイテム名(種類でOK)'] || item['アイテム名'];
    return name && name.toString().trim() !== '';
  });

  // ヘッダー名の変換
  return validData.map(item => ({
    アイテム名: item['アイテム名(種類でOK)'] || item['アイテム名'],
    使用可能Lv: item['使用可能Lv'],
    部位を選択: item['部位を選択'],
    タイプを選択: item['タイプを選択'],
    '力（初期値）': item['力（初期値）'],
    '魔力（初期値）': item['魔力（初期値）'],
    '体力（初期値）': item['体力（初期値）'],
    '精神（初期値）': item['精神（初期値）'],
    '素早さ（初期値）': item['素早さ（初期値）'],
    '器用（初期値）': item['器用（初期値）'],
    '撃力（初期値）': item['撃力（初期値）'],
    '守備力（初期値）': item['守備力（初期値）']
  } as ArmorData));
}

/**
 * アクセサリーデータを読み込む
 */
export async function loadAccessories(): Promise<AccessoryData[]> {
  const rawData = await loadCsvFile<any>('/data/csv/Equipment/DA_EqCalc_Data - アクセサリー .csv');

  // 空のエントリをフィルタリング（アイテム名が空の行を除外）
  const validData = rawData.filter(item =>
    item['アイテム名'] && item['アイテム名'].toString().trim() !== ''
  );

  // 明示的なマッピングで型安全性を確保
  return validData.map(item => ({
    アイテム名: item['アイテム名'],
    使用可能Lv: item['使用可能Lv'],
    タイプを選択: item['タイプを選択'],
    '体力（初期値）': item['体力（初期値）'],
    '力（初期値）': item['力（初期値）'],
    '魔力（初期値）': item['魔力（初期値）'],
    '精神（初期値）': item['精神（初期値）'],
    '撃力（初期値）': item['撃力（初期値）'],
    '素早さ（初期値）': item['素早さ（初期値）']
  } as AccessoryData));
}

/**
 * 紋章データを読み込む
 * CSVカラム: アイテム名,使用可能Lv,力（%不要）,魔力（%不要）,体力（%不要）,精神（%不要）,素早さ（%不要）,器用（%不要）,撃力（%不要）,守備力（%不要）
 */
export async function loadEmblems(): Promise<EmblemData[]> {
  const rawData = await loadCsvFile<any>('/data/csv/Equipment/DA_EqCalc_Data - 紋章.csv');

  return rawData.map(item => {
    const itemName = item['アイテム名'] || '';
    return {
      // nameプロパティにアイテム名をコピー（プリセット保存・復元用）
      name: itemName,
      アイテム名: itemName,
      使用可能Lv: item['使用可能Lv'] || 1,
      '力（%不要）': item['力（%不要）'] || undefined,
      '魔力（%不要）': item['魔力（%不要）'] || undefined,
      '体力（%不要）': item['体力（%不要）'] || undefined,
      '精神（%不要）': item['精神（%不要）'] || undefined,
      '素早さ（%不要）': item['素早さ（%不要）'] || undefined,
      '器用（%不要）': item['器用（%不要）'] || undefined,
      '撃力（%不要）': item['撃力（%不要）'] || undefined,
      '守備力（%不要）': item['守備力（%不要）'] || undefined,
    } as EmblemData;
  });
}

/**
 * ルーンストーンデータを読み込む
 * CSVカラム: アイテム名（・<グレード>）は不要,グレード,力,魔力,体力,精神,素早さ,器用,撃力,守備力,耐性１,値(%除く),耐性２,値,耐性３,値,耐性４,値,耐性５,値,耐性６,値
 * 耐性データは対になっているため特殊な解析が必要
 */
export async function loadRunestones(): Promise<RunestoneData[]> {
  const rawData = await loadCsvFile<any>('/data/csv/Equipment/DA_EqCalc_Data - ルーンストーン.csv');

  return rawData.map(item => {
    // CSVカラム名からアイテム名を取得
    const itemName = item['アイテム名（・<グレード>）は不要'] || '';

    const runestone: RunestoneData = {
      // nameプロパティにアイテム名をコピー（プリセット保存・復元用）
      name: itemName,
      'アイテム名（・<グレード>）は不要': itemName,
      グレード: item['グレード'] as RunestoneGrade,
      力: item['力'] || undefined,
      魔力: item['魔力'] || undefined,
      体力: item['体力'] || undefined,
      精神: item['精神'] || undefined,
      素早さ: item['素早さ'] || undefined,
      器用: item['器用'] || undefined,
      撃力: item['撃力'] || undefined,
      守備力: item['守備力'] || undefined,
    };

    // 耐性データの解析（耐性1〜6）
    // CSVカラム名: 耐性１, 値(%除く), 耐性２, 値, 耐性３, 値, ... 耐性６, 値
    const resistanceKeys = [
      { typeKey: '耐性１', valueKey: '値(%除く)' },
      { typeKey: '耐性２', valueKey: '値' },
      { typeKey: '耐性３', valueKey: '値' },
      { typeKey: '耐性４', valueKey: '値' },
      { typeKey: '耐性５', valueKey: '値' },
      { typeKey: '耐性６', valueKey: '値' },
    ];

    // CSVの実際のカラム順序を考慮して耐性を解析
    // 耐性１,値(%除く),耐性２,値,耐性３,値,耐性４,値,耐性５,値,耐性６,値
    const resistanceColumns = [
      'resistance_1_type', 'resistance_1_value',
      'resistance_2_type', 'resistance_2_value',
      'resistance_3_type', 'resistance_3_value',
      'resistance_4_type', 'resistance_4_value',
      'resistance_5_type', 'resistance_5_value',
      'resistance_6_type', 'resistance_6_value',
    ];

    // 実際のCSVカラム名で耐性を取得
    // 耐性１, 値(%除く) のペア
    if (item['耐性１'] && item['値(%除く)']) {
      runestone.耐性1 = {
        type: String(item['耐性１']),
        value: Number(item['値(%除く)']) || 0
      };
    }

    // 耐性２以降は「値」カラムが複数あるため、
    // CSVパーサーが異なるキーで格納している可能性がある
    // rawDataのキーを調べて耐性データを取得
    const keys = Object.keys(item);

    // 値カラムのインデックスを取得（「値」「値.1」「値.2」...のような形式の可能性）
    const valueKeys = keys.filter(k => k === '値' || k.startsWith('値.'));

    // 耐性２〜６を解析
    for (let i = 2; i <= 6; i++) {
      const typeKey = `耐性${i === 2 ? '２' : i === 3 ? '３' : i === 4 ? '４' : i === 5 ? '５' : '６'}`;
      const typeValue = item[typeKey];

      if (typeValue && String(typeValue).trim() !== '') {
        // 対応する値カラムを探す
        // 「値」「値.1」「値.2」などの順で格納されている想定
        const valueKeyIndex = i - 2; // 0, 1, 2, 3, 4
        const valueKey = valueKeyIndex === 0 ? '値' : `値.${valueKeyIndex}`;
        const numValue = item[valueKey];

        if (numValue !== undefined && numValue !== '') {
          const resistanceKey = `耐性${i}` as keyof RunestoneData;
          (runestone as any)[resistanceKey] = {
            type: String(typeValue),
            value: Number(numValue) || 0
          };
        }
      }
    }

    return runestone;
  });
}

/**
 * 食べ物データを読み込む
 * CSVカラム: アイテム名,力,魔力,体力,精神,素早さ,器用,撃力,守備力,耐性１,値(%除く),耐性２,値,...
 */
export async function loadFoods(): Promise<FoodData[]> {
  const rawData = await loadCsvFile<any>('/data/csv/Equipment/DA_EqCalc_Data - 食べ物.csv');

  return rawData.map(item => {
    const food: FoodData = {
      アイテム名: item['アイテム名'] || '',
      力: item['力'] || undefined,
      魔力: item['魔力'] || undefined,
      体力: item['体力'] || undefined,
      精神: item['精神'] || undefined,
      素早さ: item['素早さ'] || undefined,
      器用: item['器用'] || undefined,
      撃力: item['撃力'] || undefined,
      守備力: item['守備力'] || undefined,
    };

    // 耐性データの解析（耐性1〜8）
    // CSVカラム名: 耐性１, 値(%除く), 耐性２, 値, 耐性３, 値, ... 耐性8, 値

    // 耐性１と値(%除く)のペア
    if (item['耐性１'] && item['値(%除く)'] !== undefined) {
      food.耐性1 = {
        type: String(item['耐性１']),
        value: Number(item['値(%除く)']) || 0
      };
    }

    // 耐性２以降（値カラムが複数あるため「値」「値.1」「値.2」...のような形式）
    for (let i = 2; i <= 8; i++) {
      const typeKey = `耐性${i === 2 ? '２' : i === 3 ? '３' : i === 4 ? '４' : i === 5 ? '５' : i === 6 ? '６' : i === 7 ? '7' : '8'}`;
      const typeValue = item[typeKey];

      if (typeValue && String(typeValue).trim() !== '') {
        // 対応する値カラムを探す
        const valueKeyIndex = i - 2; // 0, 1, 2, 3, 4, 5, 6
        const valueKey = valueKeyIndex === 0 ? '値' : `値.${valueKeyIndex}`;
        const numValue = item[valueKey];

        if (numValue !== undefined && numValue !== '') {
          const resistanceKey = `耐性${i}` as keyof FoodData;
          (food as any)[resistanceKey] = {
            type: String(typeValue),
            value: Number(numValue) || 0
          };
        }
      }
    }

    return food;
  });
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
    // 4次職
    'ガーディアン',
    'ステラシャフト',
    'スペルリファクター',
    'プリースト',
    // 3次職
    'ウィザード',
    'ウォーリアー',
    'クレリック',
    'ナイト',
    'ハンター',
    'レンジャー',
    // ベース職
    'ノービス',
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