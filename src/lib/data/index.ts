/**
 * データローダーのエントリポイント
 * YAMLとCSVのデータローダー関数をエクスポートし、
 * ゲームデータの初期化ユーティリティを提供
 */

// YAMLローダーをエクスポート
export {
  loadEqConst,
  loadJobConst,
  loadWeaponCalc,
  loadUserStatusCalc,
  loadSkillCalc,
  loadWeaponSkillCalc,
  loadAllYamlData,
  extractSkillsFromCalcData,
  // 新スキル計算システム
  loadAllSkillCalcData,
  getAvailableBookSkills,
  getAvailableJobSkills,
  getAllAvailableSkills,
} from './yamlLoader';

// CSVローダーをエクスポート
export {
  loadWeapons,
  loadArmors,
  loadAccessories,
  loadEmblems,
  loadRunestones,
  loadFoods,
  loadJobData,
  loadAllEquipmentData,
  loadAllJobData
} from './csvLoader';

import { loadAllYamlData } from './yamlLoader';
import { loadAllEquipmentData, loadAllJobData } from './csvLoader';
import { GameData } from '@/types/data';
import { DataLoadErrorHandler, withFallback } from './errors';

/**
 * 全てのゲームデータを初期化時に読み込む
 * @returns Promise<GameData> - 全てのゲームデータ
 */
export async function initializeGameData(): Promise<GameData> {
  try {
    // エラーハンドラーをクリア
    DataLoadErrorHandler.clearErrors();

    // まずYAMLデータを読み込む（CSVの処理に必要なため）
    // フォールバック処理を適用
    const yamlData = await withFallback(
      () => loadAllYamlData(),
      {
        eqConst: {} as any,
        jobConst: {} as any,
        weaponCalc: {} as any,
        userStatusCalc: {} as any,
        skillCalc: {} as any,
        weaponSkillCalc: {} as any
      },
      'Warning: Failed to load some YAML files, using default values'
    );

    // CSVデータを読み込む（EqConstDataを渡す）
    const [equipmentData, jobData] = await Promise.all([
      withFallback(
        () => loadAllEquipmentData(yamlData.eqConst),
        {
          weapons: [],
          armors: [],
          accessories: [],
          emblems: [],
          runestones: [],
          foods: []
        },
        'Warning: Failed to load some equipment CSV files'
      ),
      withFallback(
        () => loadAllJobData(),
        new Map(),
        'Warning: Failed to load job CSV files'
      )
    ]);

    const gameData: GameData = {
      yaml: yamlData,
      csv: {
        ...equipmentData,
        jobs: jobData
      }
    };

    // データ検証
    validateGameData(gameData);

    // エラーサマリーを表示
    if (DataLoadErrorHandler.hasErrors()) {
      console.warn('Some data files failed to load:');
      console.warn(DataLoadErrorHandler.getErrorSummary());
    }

    return gameData;
  } catch (error) {
    console.error('Failed to initialize game data:', error);
    
    // 最小限のデフォルトデータを返す
    return {
      yaml: {
        eqConst: {} as any,
        jobConst: {} as any,
        weaponCalc: {} as any,
        userStatusCalc: {} as any,
        skillCalc: {} as any,
        weaponSkillCalc: {} as any
      },
      csv: {
        weapons: [],
        armors: [],
        accessories: [],
        emblems: [],
        runestones: [],
        foods: [],
        jobs: new Map()
      }
    };
  }
}

/**
 * ゲームデータの整合性を検証
 */
function validateGameData(gameData: GameData): void {
  // YAMLデータの検証
  if (!gameData.yaml.eqConst || Object.keys(gameData.yaml.eqConst).length === 0) {
    console.warn('EqConst data is empty or missing');
  }
  
  if (!gameData.yaml.weaponCalc || Object.keys(gameData.yaml.weaponCalc).length === 0) {
    console.warn('WeaponCalc data is empty or missing');
  }

  if (!gameData.yaml.userStatusCalc || Object.keys(gameData.yaml.userStatusCalc).length === 0) {
    console.warn('UserStatusCalc data is empty or missing');
  }

  // CSVデータの検証
  if (gameData.csv.weapons.length === 0) {
    console.warn('No weapon data loaded');
  }

  if (gameData.csv.armors.length === 0) {
    console.warn('No armor data loaded');
  }

  // 職業データの検証
  if (gameData.csv.jobs.size === 0) {
    console.warn('No job data loaded');
  }

}

/**
 * データのキャッシュ管理用のシングルトンインスタンス
 */
let cachedGameData: GameData | null = null;

/**
 * キャッシュされたゲームデータを取得（存在しない場合は初期化）
 * @returns Promise<GameData> - キャッシュされたまたは新規に読み込まれたゲームデータ
 */
export async function getGameData(): Promise<GameData> {
  if (!cachedGameData) {
    cachedGameData = await initializeGameData();
  }
  return cachedGameData;
}

/**
 * キャッシュをクリアして再読み込みを強制
 */
export function clearGameDataCache(): void {
  cachedGameData = null;
}