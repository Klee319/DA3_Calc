'use client';

import { useEffect, useState } from 'react';
import { useBuildStore, UserOption, RingOption, Food, BuildPreset } from '@/store/buildStore';
import { initializeGameData } from '@/lib/data';
import { JobSelector } from '@/components/JobSelector';
import { LevelInput } from '@/components/LevelInput';
import { SPSlider } from '@/components/SPSlider';
import { EquipmentSlot } from '@/components/EquipmentSlot';
import { EmblemSlot } from '@/components/EmblemSlot';
import { RunestoneSlot } from '@/components/RunestoneSlot';
import { StatViewer } from '@/components/StatViewer';
import { CustomSelect, CustomSelectOption } from '@/components/CustomSelect';
import { DamageCalculationSection } from '@/components/DamageCalculationSection';
import { SkillCalculationSection } from '@/components/SkillCalculationSection';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EquipSlot, Job, Equipment, Skill, StatType, WeaponType, ArmorType, StatEffect, SmithingCounts, ExStats } from '@/types';
import { FoodData, EmblemData, RunestoneData } from '@/types/data';
import { calculateUnlockedSkills, getReachedTier, getNextSkillInfo, calculateBranchBonus, getMaxSPByBranch } from '@/lib/calc/jobCalculator';
import {
  convertJobNameToYAML,
  convertWeaponTypeToYAML,
  convertArmorTypeToYAML
} from '@/constants/jobMappings';

export default function BuildPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [unlockedSkills, setUnlockedSkills] = useState<Array<{
    skillName: string;
    branch: 'A' | 'B' | 'C';
    tier: number;
    requiredSP: number;
  }>>([]);

  const [nextSkillInfo, setNextSkillInfo] = useState<{
    branch: 'A' | 'B' | 'C';
    skillName: string;
    requiredSP: number;
    currentSP: number;
    needMoreSP: number;
  } | null>(null);

  const [branchBonus, setBranchBonus] = useState<{
    A: { 力: number; 体力: number; 魔力: number; 精神: number; 素早さ: number; 器用さ: number; 撃力: number; 守備力: number };
    B: { 力: number; 体力: number; 魔力: number; 精神: number; 素早さ: number; 器用さ: number; 撃力: number; 守備力: number };
    C: { 力: number; 体力: number; 魔力: number; 精神: number; 素早さ: number; 器用さ: number; 撃力: number; 守備力: number };
  } | undefined>();

  const [maxSPByBranch, setMaxSPByBranch] = useState<{A: number, B: number, C: number}>({A: 100, B: 100, C: 100});

  // バリデーションエラー管理用のstate
  const [validationErrors, setValidationErrors] = useState<Array<{
    type: 'error' | 'warning';
    message: string;
  }>>([]);

  // プリセット管理用のstate
  const [showPresetPanel, setShowPresetPanel] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editingPresetName, setEditingPresetName] = useState('');

  // 確認ダイアログ用のstate
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    confirmVariant: 'primary' | 'danger' | 'warning';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '確認',
    confirmVariant: 'primary',
    onConfirm: () => {},
  });

  // タブ定義
  const tabs = [
    { id: 0, label: '職業', icon: '👤' },
    { id: 1, label: 'SP割り振り', icon: '📊' },
    { id: 2, label: '装備', icon: '⚔️' },
    { id: 3, label: '紋章・ルーンストーン', icon: '💎' },
    { id: 4, label: '食事・指輪', icon: '🍖' },
    { id: 5, label: '最終ステータス', icon: '📈' },
    { id: 6, label: '結果', icon: '🎯' },
  ];

  const {
    currentBuild,
    calculatedStats,
    availableJobs,
    availableEquipment,
    availableFoods,
    availableEmblems,
    availableRunestones,
    userOption,
    ringOption,
    selectedFood,
    foodEnabled,
    weaponSkillEnabled,
    selectedEmblem,
    selectedRunestones,
    gameData,
    setJob,
    setLevel,
    setEquipment,
    setSPAllocation,
    setUserOption,
    setRingOption,
    setFood,
    toggleFood,
    toggleWeaponSkill,
    setEmblem,
    setRunestones,
    setAvailableJobs,
    setAvailableEquipment,
    setAvailableFoods,
    setAvailableEmblems,
    setAvailableRunestones,
    setGameData,
    // プリセット関連
    presets,
    savePreset,
    loadPreset,
    deletePreset,
    updatePreset,
    loadPresetsFromStorage,
  } = useBuildStore();

  // データ初期化
  useEffect(() => {
    const loadGameData = async () => {
      try {
        const gameData = await initializeGameData();
        
        // ゲームデータをストアに設定
        setGameData({
          eqConst: gameData.yaml.eqConst,
          jobConst: gameData.yaml.jobConst,
          jobSPData: gameData.csv.jobs, // CSV読み込み時のMap<string, JobSPData[]>をそのまま設定
          userStatusCalc: gameData.yaml.userStatusCalc, // 武器計算式を含む
        });

        // 職業データの変換（CSVから取得したSPデータから適切に変換）
        const jobs: Job[] = Array.from(gameData.csv.jobs.entries()).map(([jobName, spDataArray]) => {
          // 初期値行を探す
          const initialRow = spDataArray.find(row => row.解法段階 === '初期値');
          const correctionRow = spDataArray.find(row => row.解法段階 === '職業補正(%)');

          // 基本ステータスを計算（初期値から）
          const baseStats: Record<StatType, number> = {
            HP: Number(initialRow?.体力) || 50,
            MP: Number(initialRow?.魔力) || 30,
            ATK: Number(initialRow?.力) || 10,
            DEF: Number(initialRow?.守備力) || 10,
            MATK: Number(initialRow?.魔力) || 10,
            MDEF: Number(initialRow?.精神) || 10,
            AGI: Number(initialRow?.素早さ) || 10,
            DEX: Number(initialRow?.器用さ) || 10,
            LUK: 0, // LUKはCSVにないため固定値
            CRI: Number(initialRow?.器用さ) || 5,
            HIT: 95, // HITは固定値
            FLEE: Number(initialRow?.素早さ) || 10,
          };

          // ステータス成長量を計算（全SPデータから集計）
          const statGrowth: Record<StatType, number> = {
            HP: 0,
            MP: 0,
            ATK: 0,
            DEF: 0,
            MATK: 0,
            MDEF: 0,
            AGI: 0,
            DEX: 0,
            LUK: 0,
            CRI: 0,
            HIT: 0,
            FLEE: 0,
          };

          // 利用可能な武器種の取得（日本語からYAML定義名へのマッピング）
          const yamlJobName = convertJobNameToYAML(jobName);
          const jobConstData = gameData.yaml.jobConst?.JobDefinition?.[yamlJobName];
          // 使用可能武器種を取得
          const availableWeaponTypes = jobConstData?.AvailableWeapons || ['Sword'];

          // A, B, Cブランチのデータを集計してステータス成長量を算出
          spDataArray.forEach(row => {
            if (row.解法段階.match(/^[ABC]-\d+$/)) {
              statGrowth.HP += Number(row.体力) || 0;
              statGrowth.MP += Number(row.魔力) || 0;
              statGrowth.ATK += Number(row.力) || 0;
              statGrowth.DEF += Number(row.守備力) || 0;
              statGrowth.MATK += Number(row.魔力) || 0;
              statGrowth.MDEF += Number(row.精神) || 0;
              statGrowth.AGI += Number(row.素早さ) || 0;
              statGrowth.DEX += Number(row.器用さ) || 0;
              statGrowth.CRI += Number(row.器用さ) || 0;
              statGrowth.FLEE += Number(row.素早さ) || 0;
            }
          });

          // レベルごとの平均成長率を算出
          const maxLevel = jobConstData?.MaxLevel || 100; // JobConstDataから最大レベルを取得
          Object.keys(statGrowth).forEach(key => {
            statGrowth[key as StatType] = Math.floor(statGrowth[key as StatType] / maxLevel * 10) / 10;
          });

          // 武器種の変換（YAML形式からシステム内部形式へ）
          const weaponTypeMap: Record<string, WeaponType> = {
            'Sword': 'sword',
            'GreatSword': 'greatsword',
            'Dagger': 'dagger',
            'Axe': 'axe',
            'Spear': 'spear',
            'Bow': 'bow',
            'Wand': 'staff',
            'Staff': 'staff',
            'Grimoire': 'staff',
            'Shield': 'sword', // シールドは剣として扱う
            'All': 'sword', // Allの場合は全武器種を含める処理が必要
          };

          const availableWeapons: WeaponType[] = availableWeaponTypes
            .map((type: string) => weaponTypeMap[type] || 'sword')
            .filter((type, index, self) => self.indexOf(type) === index); // 重複を削除

          // スキル情報の抽出
          const skills: Skill[] = spDataArray
            .filter(row => row.解法スキル名 && row.解法スキル名 !== '')
            .map(row => ({
              id: row.解法スキル名!,
              name: row.解法スキル名!,
              description: `${row.解法段階}で解放されるスキル`,
              spCost: Number(row.必要SP) || 0,
              type: 'active',
            }));

          return {
            id: jobName,
            name: jobName,
            baseStats,
            statGrowth,
            availableWeapons,
            skills,
            maxLevel,
          };
        });

        // 装備データの変換（CSVの全カラムを活かして詳細に変換）
        const equipments: Equipment[] = [
          // 武器データの変換
          ...gameData.csv.weapons.map((w, index) => {
            const stats: StatEffect[] = [];

            // 攻撃力
            if (w['攻撃力（初期値）'] > 0) {
              stats.push({ stat: 'ATK', value: w['攻撃力（初期値）'], isPercent: false });
            }

            // 会心率
            if (w['会心率（初期値）'] > 0) {
              stats.push({ stat: 'CRI', value: w['会心率（初期値）'], isPercent: false });
            }

            // 会心ダメージ（DEXとして扱う）
            if (w['会心ダメージ（初期値）'] > 0) {
              stats.push({ stat: 'DEX', value: w['会心ダメージ（初期値）'], isPercent: false });
            }

            // 武器種の変換
            const weaponTypeMap: Record<string, WeaponType> = {
              '剣': 'sword',
              '大剣': 'greatsword',
              '短剣': 'dagger',
              '斧': 'axe',
              '槍': 'spear',
              '弓': 'bow',
              '杖': 'staff',
            };

            // 職業制限を動的に判定
            const requiredJob = (() => {
              const allowedJobs: string[] = [];

              if (gameData.yaml.jobConst?.JobDefinition) {
                const csvWeaponType = w.武器種;
                const yamlWeaponTypes = convertWeaponTypeToYAML(csvWeaponType);

                Object.entries(gameData.yaml.jobConst.JobDefinition).forEach(([yamlJobName, jobDef]: [string, any]) => {
                  const availableWeapons = jobDef.AvailableWeapons || [];

                  // "All"を持つ職業、または該当武器種を持つ職業を許可
                  const canUse = availableWeapons.includes('All') ||
                                yamlWeaponTypes.some(wType => availableWeapons.includes(wType));

                  if (canUse) {
                    // YAML職業名をそのまま格納（後でマッピングして比較）
                    allowedJobs.push(yamlJobName);
                  }
                });
              }

              // 職業制限なし、または全職業が使用可能な場合
              return allowedJobs.length > 0 ? allowedJobs : ['All'];
            })();

            return {
              id: `weapon_${index}_${w.アイテム名}`,
              name: w.アイテム名,
              slot: 'weapon' as EquipSlot,
              weaponType: weaponTypeMap[w.武器種] || 'sword',
              baseStats: stats,
              requiredLevel: w.使用可能Lv || 1,
              requiredJob,
              description: `${w.制作 === 'TRUE' ? '制作可能' : 'ドロップ'} / 最低ランク: ${w.最低ランク || 'F'}`,
              // 計算システム用の元データ参照
              sourceData: {
                type: 'weapon' as const,
                data: w,
              },
            };
          }),

          // 防具データの変換
          ...gameData.csv.armors.map((a, index) => {
            const stats: StatEffect[] = [];

            // 各ステータスをチェックして追加
            if (a['守備力（初期値）'] > 0) {
              stats.push({ stat: 'DEF', value: a['守備力（初期値）'], isPercent: false });
            }
            if (a['体力（初期値）'] > 0) {
              stats.push({ stat: 'HP', value: a['体力（初期値）'], isPercent: false });
            }
            if (a['力（初期値）'] > 0) {
              stats.push({ stat: 'ATK', value: a['力（初期値）'], isPercent: false });
            }
            if (a['魔力（初期値）'] > 0) {
              stats.push({ stat: 'MATK', value: a['魔力（初期値）'], isPercent: false });
            }
            if (a['精神（初期値）'] > 0) {
              stats.push({ stat: 'MDEF', value: a['精神（初期値）'], isPercent: false });
            }
            if (a['素早さ（初期値）'] > 0) {
              stats.push({ stat: 'AGI', value: a['素早さ（初期値）'], isPercent: false });
            }
            if (a['器用（初期値）'] > 0) {
              stats.push({ stat: 'DEX', value: a['器用（初期値）'], isPercent: false });
            }
            if (a['撃力（初期値）'] > 0) {
              stats.push({ stat: 'HIT', value: a['撃力（初期値）'], isPercent: false });  // 撃力はHIT
            }

            // 部位のマッピング（腕装備は削除）
            const slotMap: Record<string, EquipSlot> = {
              '頭': 'head',
              '胴': 'body',
              '脚': 'leg',
            };

            // 防具タイプのマッピング（腕装備は削除）
            const armorTypeMap: Record<string, ArmorType> = {
              '頭': 'head',
              '胴': 'body',
              '脚': 'leg',
            };

            // 職業制限を動的に判定
            const requiredJob = (() => {
              const allowedJobs: string[] = [];

              if (gameData.yaml.jobConst?.JobDefinition) {
                const csvArmorType = a.タイプを選択;
                const yamlArmorType = convertArmorTypeToYAML(csvArmorType);

                Object.entries(gameData.yaml.jobConst.JobDefinition).forEach(([yamlJobName, jobDef]: [string, any]) => {
                  const availableArmors = jobDef.AvailableArmors || [];

                  if (availableArmors.includes(yamlArmorType)) {
                    allowedJobs.push(yamlJobName);
                  }
                });
              }

              return allowedJobs.length > 0 ? allowedJobs : ['All'];
            })();

            return {
              id: `armor_${index}_${a.アイテム名}`,
              name: a.アイテム名,
              slot: slotMap[a.部位を選択] || 'body',
              armorType: armorTypeMap[a.部位を選択] || 'body',
              baseStats: stats,
              requiredLevel: a.使用可能Lv || 1,
              requiredJob,
              description: `${a.タイプを選択}装備 / 最低ランク: ${a.最低ランク || 'F'}`,
              // 計算システム用の元データ参照
              sourceData: {
                type: 'armor' as const,
                data: a,
              },
            };
          }),

          // アクセサリーデータの変換
          ...gameData.csv.accessories.map((a, index) => {
            const stats: StatEffect[] = [];

            // 各ステータスをチェックして追加（0より大きい値のみ）
            if (a['体力（初期値）'] > 0) {
              stats.push({ stat: 'HP', value: a['体力（初期値）'], isPercent: false });
            }
            if (a['力（初期値）'] > 0) {
              stats.push({ stat: 'ATK', value: a['力（初期値）'], isPercent: false });
            }
            if (a['魔力（初期値）'] > 0) {
              stats.push({ stat: 'MATK', value: a['魔力（初期値）'], isPercent: false });
            }
            if (a['精神（初期値）'] > 0) {
              stats.push({ stat: 'MDEF', value: a['精神（初期値）'], isPercent: false });
            }
            if (a['撃力（初期値）'] > 0) {
              stats.push({ stat: 'HIT', value: a['撃力（初期値）'], isPercent: false });  // 撃力はHIT
            }
            if (a['素早さ（初期値）'] > 0) {
              stats.push({ stat: 'AGI', value: a['素早さ（初期値）'], isPercent: false });
            }

            // アクセサリータイプによってスロットを決定
            const isNecklace = a.タイプを選択 === 'ネックレス';

            return {
              id: `accessory_${index}_${a.アイテム名}`,
              name: a.アイテム名,
              slot: (isNecklace ? 'accessory1' : 'accessory2') as EquipSlot,
              armorType: 'accessory' as ArmorType,
              baseStats: stats,
              requiredLevel: a.使用可能Lv || 1,
              requiredJob: [], // 職業制限は後で実装
              description: `${a.タイプを選択} / 最低ランク: ${a.最低ランク || 'F'}`,
              // 計算システム用の元データ参照
              sourceData: {
                type: 'accessory' as const,
                data: a,
              },
            };
          }),
        ];

        // 食べ物データの変換（新フォーマット対応）
        // CSVカラム: アイテム名,力,魔力,体力,精神,素早さ,器用,撃力,守備力,耐性１,値(%除く),...
        const foods: Food[] = gameData.csv.foods.map((f, index) => {
          const effects: Array<{ stat: StatType; value: number; isPercent: boolean }> = [];

          // 各ステータスを直接変換
          if (f.力 && f.力 !== 0) {
            effects.push({ stat: 'ATK', value: f.力, isPercent: false });
          }
          if (f.魔力 && f.魔力 !== 0) {
            effects.push({ stat: 'MATK', value: f.魔力, isPercent: false });
          }
          if (f.体力 && f.体力 !== 0) {
            effects.push({ stat: 'HP', value: f.体力, isPercent: false });
          }
          if (f.精神 && f.精神 !== 0) {
            effects.push({ stat: 'MDEF', value: f.精神, isPercent: false });
          }
          if (f.素早さ && f.素早さ !== 0) {
            effects.push({ stat: 'AGI', value: f.素早さ, isPercent: false });
          }
          if (f.器用 && f.器用 !== 0) {
            effects.push({ stat: 'DEX', value: f.器用, isPercent: false });
          }
          if (f.撃力 && f.撃力 !== 0) {
            effects.push({ stat: 'HIT', value: f.撃力, isPercent: false });
          }
          if (f.守備力 && f.守備力 !== 0) {
            effects.push({ stat: 'DEF', value: f.守備力, isPercent: false });
          }

          return {
            id: `food_${index}_${f.アイテム名}`,
            name: f.アイテム名,
            effects,
            duration: 30, // 持続時間は固定（CSVに持続時間カラムがないため）
          };
        });

        setAvailableJobs(jobs);
        setAvailableEquipment(equipments);
        setAvailableFoods(foods);

        // 紋章とルーンストーンデータを設定
        setAvailableEmblems(gameData.csv.emblems);
        setAvailableRunestones(gameData.csv.runestones);

        // プリセットをlocalStorageから読み込み
        loadPresetsFromStorage();

        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load game data:', error);
        setIsLoading(false);
      }
    };

    loadGameData();
  }, [setAvailableJobs, setAvailableEquipment, setAvailableFoods, setAvailableEmblems, setAvailableRunestones, setGameData]);

  // SP割り振りが変更されたら解放スキルを再計算
  useEffect(() => {
    if (currentBuild.job && currentBuild.spAllocation && gameData?.jobSPData) {
      const jobName = currentBuild.job.name;
      const jobSPData = gameData.jobSPData.get(jobName);


      if (jobSPData) {
        const spAllocation = {
          A: currentBuild.spAllocation.A || 0,
          B: currentBuild.spAllocation.B || 0,
          C: currentBuild.spAllocation.C || 0,
        };

        const skills = calculateUnlockedSkills(jobName, spAllocation, jobSPData);
        setUnlockedSkills(skills);

        // 次のスキル解放情報を取得
        const nextSkill = getNextSkillInfo(spAllocation, jobSPData);
        setNextSkillInfo(nextSkill);

        // ステータスボーナスを計算
        const bonus = calculateBranchBonus(spAllocation, jobSPData);
        setBranchBonus(bonus);

        // 各軸の最大SPを取得
        const maxSP = getMaxSPByBranch(jobSPData);
        setMaxSPByBranch(maxSP);
      }
    } else {
      setUnlockedSkills([]);
      setNextSkillInfo(null);
      setBranchBonus(undefined);
      setMaxSPByBranch({A: 100, B: 100, C: 100}); // デフォルト値にリセット
    }
  }, [currentBuild.job, currentBuild.spAllocation, gameData]);

  // バリデーションチェック
  useEffect(() => {
    const errors: Array<{ type: 'error' | 'warning'; message: string }> = [];

    // 1. 職業未選択チェック
    if (!currentBuild.job) {
      errors.push({
        type: 'error',
        message: '職業を選択してください。職業は必須です。'
      });
    }

    // 2. SP超過チェック（仕様書§9.1: Lv1あたりSP2獲得）
    if (currentBuild.job && currentBuild.spAllocation) {
      const totalSP = (currentBuild.spAllocation.A || 0) +
                      (currentBuild.spAllocation.B || 0) +
                      (currentBuild.spAllocation.C || 0);
      const maxSP = currentBuild.level * 2;

      if (totalSP > maxSP) {
        errors.push({
          type: 'error',
          message: `SPが上限を超えています（現在: ${totalSP} / 上限: ${maxSP}）`
        });
      }
    }

    // 3. 職業制限違反チェック（武器）
    if (currentBuild.job && currentBuild.equipment.weapon) {
      const weapon = currentBuild.equipment.weapon;
      const requiredJobs = weapon.requiredJob || [];
      const currentJobYaml = convertJobNameToYAML(currentBuild.job.id);

      if (requiredJobs.length > 0 &&
          !requiredJobs.includes('All') &&
          !requiredJobs.includes(currentJobYaml)) {
        errors.push({
          type: 'error',
          message: `${weapon.name}は ${currentBuild.job.name} では使用できません`
        });
      }
    }

    // 4. 職業制限違反チェック（防具）
    const armorSlots: Array<'head' | 'body' | 'leg'> = ['head', 'body', 'leg'];
    armorSlots.forEach((slot) => {
      const armor = currentBuild.equipment[slot];
      if (armor && currentBuild.job) {
        const requiredJobs = armor.requiredJob || [];
        const currentJobYaml = convertJobNameToYAML(currentBuild.job.id);

        if (requiredJobs.length > 0 &&
            !requiredJobs.includes('All') &&
            !requiredJobs.includes(currentJobYaml)) {
          errors.push({
            type: 'error',
            message: `${armor.name}は ${currentBuild.job.name} では装備できません`
          });
        }
      }
    });

    // 5. レベル制限チェック（警告）
    Object.values(currentBuild.equipment).forEach((equip) => {
      if (equip && equip.requiredLevel && currentBuild.level < equip.requiredLevel) {
        errors.push({
          type: 'warning',
          message: `${equip.name}の必要レベル（Lv.${equip.requiredLevel}）に達していません`
        });
      }
    });

    setValidationErrors(errors);
  }, [
    currentBuild.job,
    currentBuild.level,
    currentBuild.equipment,
    currentBuild.spAllocation
  ]);

  if (isLoading) {
    return (
      <main className="p-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-600 dark:text-gray-400">データを読み込み中...</p>
        </div>
      </main>
    );
  }

  // 装備スロットの定義
  const equipmentSlots: Array<{ slot: EquipSlot; name: string }> = [
    { slot: 'weapon', name: '武器' },
    { slot: 'head', name: '頭' },
    { slot: 'body', name: '胴' },
    { slot: 'leg', name: '脚' },
    { slot: 'accessory1', name: 'ネックレス' },
    { slot: 'accessory2', name: 'ブレスレット' },
  ];

  // 職業に応じた装備可能フィルタ
  const getFilteredEquipment = (slot: EquipSlot): Equipment[] => {
    return availableEquipment.filter(eq => {
      // スロット一致チェック
      if (eq.slot !== slot) return false;

      // レベル制限チェック
      if (eq.requiredLevel && currentBuild.level < eq.requiredLevel) return false;

      // 職業制限チェック
      if (currentBuild.job && eq.requiredJob && eq.requiredJob.length > 0) {
        // currentBuild.job.idは日本語名なので、YAML名に変換
        const currentJobYaml = convertJobNameToYAML(currentBuild.job.id);

        // "All"または該当職業が含まれているかチェック
        return eq.requiredJob.includes('All') ||
               eq.requiredJob.includes(currentJobYaml);
      }

      return true;
    });
  };

  // 食べ物アイコンを取得
  const getFoodIcon = (foodName: string): string => {
    const lowerName = foodName.toLowerCase();
    if (lowerName.includes('肉') || lowerName.includes('ステーキ')) return '🍖';
    if (lowerName.includes('魚')) return '🐟';
    if (lowerName.includes('パン') || lowerName.includes('bread')) return '🍞';
    if (lowerName.includes('野菜') || lowerName.includes('サラダ')) return '🥗';
    if (lowerName.includes('スープ')) return '🍲';
    if (lowerName.includes('酒') || lowerName.includes('ワイン')) return '🍷';
    if (lowerName.includes('ポーション')) return '🧪';
    if (lowerName.includes('果物') || lowerName.includes('フルーツ')) return '🍎';
    if (lowerName.includes('甘') || lowerName.includes('デザート')) return '🍰';
    return '🍽️';
  };

  return (
    <main className="container mx-auto px-4 max-w-7xl">
      {/* ページヘッダー */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-5xl md:text-6xl font-thin text-gradient from-white to-gray-300">
            キャラクタービルド
          </h1>
          <button
            onClick={() => setShowPresetPanel(!showPresetPanel)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            プリセット {presets.length > 0 && `(${presets.length})`}
          </button>
        </div>
        <p className="text-lg text-gray-400 line-clamp-2">
          職業・装備・SPを設定して、最強のキャラクターを構築しよう
        </p>
      </div>

      {/* プリセットパネル */}
      {showPresetPanel && (
        <div className="mb-8 bg-gray-800 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">ビルドプリセット</h2>
            <button
              onClick={() => setShowPresetPanel(false)}
              className="text-gray-400 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 新規プリセット保存 */}
          <div className="flex gap-3 mb-6">
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="プリセット名を入力..."
              className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => {
                if (presetName.trim()) {
                  savePreset(presetName.trim());
                  setPresetName('');
                }
              }}
              disabled={!presetName.trim()}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              保存
            </button>
          </div>

          {/* プリセット一覧 */}
          {presets.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p>保存されたプリセットはありません</p>
              <p className="text-sm mt-1">現在のビルドを保存してみましょう</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="flex items-center justify-between p-4 bg-gray-700 rounded-lg hover:bg-gray-650 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    {editingPresetId === preset.id ? (
                      <input
                        type="text"
                        value={editingPresetName}
                        onChange={(e) => setEditingPresetName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            updatePreset(preset.id, editingPresetName);
                            setEditingPresetId(null);
                          } else if (e.key === 'Escape') {
                            setEditingPresetId(null);
                          }
                        }}
                        className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    ) : (
                      <>
                        <h3 className="font-medium text-white truncate">{preset.name}</h3>
                        <p className="text-sm text-gray-400">
                          {preset.build.job?.name || '未設定'} Lv.{preset.build.level}
                          {' - '}
                          {new Date(preset.updatedAt).toLocaleString('ja-JP', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {editingPresetId === preset.id ? (
                      <>
                        <button
                          onClick={() => {
                            updatePreset(preset.id, editingPresetName);
                            setEditingPresetId(null);
                          }}
                          className="p-2 text-green-400 hover:text-green-300 hover:bg-gray-600 rounded"
                          title="保存"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setEditingPresetId(null)}
                          className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-600 rounded"
                          title="キャンセル"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setConfirmDialog({
                              isOpen: true,
                              title: 'プリセットの読み込み',
                              message: `プリセット「${preset.name}」を読み込みます。現在のビルドは上書きされます。よろしいですか？`,
                              confirmText: '読み込む',
                              confirmVariant: 'primary',
                              onConfirm: () => {
                                loadPreset(preset.id);
                                setShowPresetPanel(false);
                                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                              },
                            });
                          }}
                          className="p-2 text-blue-400 hover:text-blue-300 hover:bg-gray-600 rounded"
                          title="読み込み"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            setConfirmDialog({
                              isOpen: true,
                              title: 'プリセットの上書き',
                              message: `プリセット「${preset.name}」を現在のビルドで上書きします。よろしいですか？`,
                              confirmText: '上書き',
                              confirmVariant: 'warning',
                              onConfirm: () => {
                                updatePreset(preset.id);
                                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                              },
                            });
                          }}
                          className="p-2 text-yellow-400 hover:text-yellow-300 hover:bg-gray-600 rounded"
                          title="現在のビルドで上書き"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            setEditingPresetId(preset.id);
                            setEditingPresetName(preset.name);
                          }}
                          className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-600 rounded"
                          title="名前変更"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            setConfirmDialog({
                              isOpen: true,
                              title: 'プリセットの削除',
                              message: `プリセット「${preset.name}」を削除します。この操作は元に戻せません。よろしいですか？`,
                              confirmText: '削除',
                              confirmVariant: 'danger',
                              onConfirm: () => {
                                deletePreset(preset.id);
                                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                              },
                            });
                          }}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-gray-600 rounded"
                          title="削除"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* タブナビゲーション */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-2 overflow-x-auto" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap
                border-b-2 transition-colors
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }
              `}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              <span className="text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* バリデーションエラー表示 */}
      {validationErrors.length > 0 && (
        <div className="mb-6 space-y-3">
          {/* エラー表示 */}
          {validationErrors.filter(e => e.type === 'error').length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-r-lg p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-red-800 dark:text-red-200 font-semibold mb-2">
                    入力エラー
                  </h3>
                  <ul className="space-y-1.5">
                    {validationErrors
                      .filter(e => e.type === 'error')
                      .map((error, i) => (
                        <li key={i} className="text-red-700 dark:text-red-300 text-sm flex items-start gap-2">
                          <span className="flex-shrink-0 mt-0.5">•</span>
                          <span>{error.message}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* 警告表示 */}
          {validationErrors.filter(e => e.type === 'warning').length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 rounded-r-lg p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-yellow-800 dark:text-yellow-200 font-semibold mb-2">
                    警告
                  </h3>
                  <ul className="space-y-1.5">
                    {validationErrors
                      .filter(e => e.type === 'warning')
                      .map((warning, i) => (
                        <li key={i} className="text-yellow-700 dark:text-yellow-300 text-sm flex items-start gap-2">
                          <span className="flex-shrink-0 mt-0.5">•</span>
                          <span>{warning.message}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* タブコンテンツ */}
      <div className="space-y-6">
        {/* タブ0: 職業 */}
        {activeTab === 0 && (
          <div className="glass-card p-8">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <span className="text-3xl">👤</span>
              <span className="truncate">職業・レベル</span>
            </h2>
            <div className="space-y-4">
              <JobSelector
                jobs={availableJobs}
                selectedJob={currentBuild.job}
                onChange={setJob}
                jobConst={gameData?.jobConst}
              />
              {currentBuild.job && (
                <LevelInput
                  level={currentBuild.level}
                  onChange={(level) => {
                    // 選択中の職業のMaxLevelを取得
                    if (!currentBuild.job) return;
                    const yamlJobName = convertJobNameToYAML(currentBuild.job.id);
                    const maxLevel = gameData?.jobConst?.JobDefinition?.[yamlJobName]?.MaxLevel || 100;
                    // MaxLevelの範囲内に制限
                    const validLevel = Math.max(1, Math.min(maxLevel, level));
                    setLevel(validLevel);
                  }}
                  maxLevel={(() => {
                    // 選択中の職業のMaxLevelを取得
                    if (!currentBuild.job) return 100;
                    const yamlJobName = convertJobNameToYAML(currentBuild.job.id);
                    return gameData?.jobConst?.JobDefinition?.[yamlJobName]?.MaxLevel || 100;
                  })()}
                />
              )}
            </div>
          </div>
        )}

        {/* タブ1: SP割り振り */}
        {activeTab === 1 && currentBuild.job && (
          <div className="glass-card p-8">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <span className="text-3xl">📊</span>
              <span className="truncate">SP割り振り</span>
            </h2>
            <SPSlider
                spValues={{
                  A: currentBuild.spAllocation?.A || 0,
                  B: currentBuild.spAllocation?.B || 0,
                  C: currentBuild.spAllocation?.C || 0,
                }}
                maxSP={currentBuild.level * 2}
                maxSPByBranch={maxSPByBranch}
                onChange={(values) => setSPAllocation(values)}
                unlockedSkills={unlockedSkills}
                nextSkillInfo={nextSkillInfo}
                branchBonus={branchBonus}
                reachedTier={(() => {
                  // 各ブランチの最大到達段階を取得
                  if (!currentBuild.job || !gameData?.jobSPData) return undefined;
                  const jobSPData = gameData.jobSPData.get(currentBuild.job.name);
                  if (!jobSPData) return undefined;

                  const tierA = getReachedTier('A', currentBuild.spAllocation?.A || 0, jobSPData);
                  const tierB = getReachedTier('B', currentBuild.spAllocation?.B || 0, jobSPData);
                  const tierC = getReachedTier('C', currentBuild.spAllocation?.C || 0, jobSPData);

                  // 最も進んでいるブランチを表示
                  const tiers = [
                    { branch: 'A', tier: tierA },
                    { branch: 'B', tier: tierB },
                    { branch: 'C', tier: tierC },
                  ].filter(t => !t.tier.endsWith('-0'));

                  if (tiers.length === 0) return undefined;

                  return tiers.map(t => t.tier).join(', ');
                })()}
              />
          </div>
        )}

        {/* タブ2: 装備 */}
        {activeTab === 2 && (
          <div className="glass-card p-8">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <span className="text-3xl">⚔️</span>
              <span className="truncate">装備</span>
            </h2>
            <div className="space-y-3">
              {equipmentSlots.map(({ slot, name }) => {
                const currentEquipment = currentBuild.equipment[slot];
                return (
                  <EquipmentSlot
                    key={slot}
                    slot={slot}
                    equipment={currentEquipment || null}
                    availableEquipment={getFilteredEquipment(slot)}
                    onEquipmentChange={(equipment) => {
                      if (equipment) {
                        // 新しい装備を選択した場合、デフォルト値を設定
                        let defaultRank = 'SSS';
                        let defaultEnhancement = 0;

                        if (slot === 'weapon') {
                          // 検証武器かどうかを判定
                          const isVerificationWeapon = equipment.sourceData?.type === 'weapon' &&
                            equipment.sourceData.data?.アイテム名?.includes('検証');

                          if (isVerificationWeapon) {
                            // 検証武器: ランクF固定、強化なし
                            defaultRank = 'F';
                            defaultEnhancement = 0;
                          } else {
                            // 通常武器: ランクSSS、強化値80
                            defaultRank = 'SSS';
                            defaultEnhancement = 80;
                          }
                        } else if (['head', 'body', 'leg'].includes(slot)) {
                          defaultEnhancement = 40;
                        }
                        setEquipment(slot, {
                          ...equipment,
                          rank: equipment.rank || defaultRank as Equipment['rank'],
                          enhancementLevel: equipment.enhancementLevel ?? defaultEnhancement,
                        });
                      } else {
                        setEquipment(slot, equipment);
                      }
                    }}
                    rank={currentEquipment?.rank || 'SSS'}
                    onRankChange={(rank) => {
                      if (currentEquipment) {
                        setEquipment(slot, { ...currentEquipment, rank: rank as Equipment['rank'] });
                      }
                    }}
                    enhancementLevel={currentEquipment?.enhancementLevel || 0}
                    onEnhancementChange={(level) => {
                      if (currentEquipment) {
                        setEquipment(slot, { ...currentEquipment, enhancementLevel: level });
                      }
                    }}
                    smithingCount={currentEquipment?.smithingCount || 0}
                    onSmithingCountChange={(count) => {
                      if (currentEquipment) {
                        setEquipment(slot, { ...currentEquipment, smithingCount: count });
                      }
                    }}
                    smithingCounts={currentEquipment?.smithingCounts || {}}
                    onSmithingCountsChange={(counts: SmithingCounts) => {
                      if (currentEquipment) {
                        setEquipment(slot, { ...currentEquipment, smithingCounts: counts });
                      }
                    }}
                    hasAlchemy={slot === 'weapon' ? (currentEquipment?.alchemyEnabled || false) : false}
                    onAlchemyChange={(enabled) => {
                      if (currentEquipment && slot === 'weapon') {
                        setEquipment(slot, { ...currentEquipment, alchemyEnabled: enabled });
                      }
                    }}
                    exStats={currentEquipment?.exStats || {}}
                    onExStatsChange={(exStats) => {
                      if (currentEquipment) {
                        setEquipment(slot, { ...currentEquipment, exStats });
                      }
                    }}
                    eqConst={gameData?.eqConst}
                    disabled={!currentBuild.job}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* タブ3: 紋章・ルーンストーン */}
        {activeTab === 3 && (
          <div className="space-y-6">
            {/* 紋章セクション */}
            <EmblemSlot
              emblem={selectedEmblem}
              availableEmblems={availableEmblems}
              onEmblemChange={setEmblem}
              disabled={!currentBuild.job}
              characterLevel={currentBuild.level}
            />

            {/* ルーンストーンセクション */}
            <RunestoneSlot
              selectedRunes={selectedRunestones}
              availableRunes={availableRunestones}
              onRunesChange={setRunestones}
              disabled={!currentBuild.job}
            />
          </div>
        )}

        {/* タブ4: 食事・指輪 */}
        {activeTab === 4 && (
          <div className="glass-card p-8">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <span className="text-3xl">🍖</span>
              <span className="truncate">食事・指輪</span>
            </h2>

            {/* リングバフ */}
            <div className="mb-6">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={ringOption.enabled}
                  onChange={(e) => setRingOption({ ...ringOption, enabled: e.target.checked })}
                  className="checkbox-primary mr-3"
                />
                <span className="text-gray-700 dark:text-gray-300 font-medium">リングバフ</span>
              </label>
              {ringOption.enabled && (
                <div className="mt-3 ml-6 p-4 glass-card-secondary rounded-lg animate-fadeIn">
                  <CustomSelect
                    options={[
                      { value: 'attack_1', label: '攻撃リング Lv1', icon: '⚔️', description: '攻撃力 +10%' },
                      { value: 'magic_1', label: '魔法リング Lv1', icon: '🔮', description: '魔法攻撃力 +10%' },
                      { value: 'defense_1', label: '防御リング Lv1', icon: '🛡️', description: '防御力 +10%' },
                    ]}
                    value={ringOption.rings.length > 0 ? `${ringOption.rings[0].type}_${ringOption.rings[0].level}` : ''}
                    onChange={(value) => {
                      const [type, level] = value.split('_');
                      setRingOption({ 
                        ...ringOption, 
                        rings: [{
                          type: type as 'attack' | 'magic' | 'defense',
                          level: parseInt(level) || 1
                        }]
                      });
                    }}
                    placeholder="リングを選択"
                    label="リング設定"
                  />
                </div>
              )}
            </div>

            {/* 食べ物バフ */}
            <div>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={foodEnabled}
                  onChange={(e) => toggleFood(e.target.checked)}
                  className="checkbox-primary mr-3"
                />
                <span className="text-gray-700 dark:text-gray-300 font-medium">食べ物バフ</span>
              </label>
              {foodEnabled && (
                <div className="mt-3 ml-6 p-4 glass-card-secondary rounded-lg animate-fadeIn">
                  <CustomSelect
                    options={[
                      { value: '', label: '選択してください', icon: '🍽️' },
                      ...availableFoods.map(food => ({
                        value: food.id,
                        label: food.name,
                        icon: getFoodIcon(food.name),
                        description: food.effects.map(e => 
                          `${e.stat} +${e.value}${e.isPercent ? '%' : ''}`
                        ).join(', ')
                      }))
                    ]}
                    value={selectedFood?.id || ''}
                    onChange={(value) => {
                      const food = availableFoods.find(f => f.id === value);
                      setFood(food || null);
                    }}
                    placeholder="食べ物を選択"
                    label="食べ物選択"
                  />
                  {selectedFood && (
                    <div className="mt-2 text-xs text-gray-400">
                      持続時間: {selectedFood.duration}分
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* タブ5: 最終ステータス */}
        {activeTab === 5 && (
          <div className="space-y-6">
            {/* 最終ステータス表示 */}
            <div className="glass-card p-8">
              <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                <span className="text-3xl">📈</span>
                <span className="truncate">最終ステータス</span>
              </h2>
              <StatViewer
                stats={calculatedStats}
                showBreakdown={true}
              />
            </div>

            {/* 高度な設定 */}
            <div className="glass-card p-8">
              <button
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="flex items-center justify-between w-full text-left mb-4"
              >
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <span className="text-2xl">⚙️</span>
                  <span className="truncate">高度な設定</span>
                </h2>
                <span className="text-gray-400 text-2xl transition-transform duration-200" style={{
                  transform: showAdvancedSettings ? 'rotate(90deg)' : 'rotate(0deg)'
                }}>
                  ▶
                </span>
              </button>

              {showAdvancedSettings && (
                <div className="space-y-6 animate-fadeIn">
                  {/* 再帰収束計算ON/OFF */}
                  <div>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={userOption.recursiveEnabled || false}
                        onChange={(e) => setUserOption({
                          ...userOption,
                          recursiveEnabled: e.target.checked,
                        })}
                        className="checkbox-primary mr-3"
                      />
                      <span className="text-gray-700 dark:text-gray-300 font-medium">再帰収束計算</span>
                      <span className="text-xs text-gray-500 ml-2">（%ボーナスを変化が1未満になるまで繰り返し適用）</span>
                    </label>
                  </div>

                  {/* 手動追加ステータス（固定値） */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      手動追加ステータス（固定値）
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {([
                        { key: 'HP', label: '体力' },
                        { key: 'ATK', label: '力' },
                        { key: 'MATK', label: '魔力' },
                        { key: 'DEF', label: '守備力' },
                        { key: 'MDEF', label: '精神' },
                        { key: 'AGI', label: '素早さ' },
                        { key: 'DEX', label: '器用さ' },
                        { key: 'HIT', label: '撃力' },
                      ] as const).map(stat => (
                        <div key={stat.key} className="flex items-center">
                          <label className="text-sm text-gray-600 dark:text-gray-400 w-16 truncate">
                            {stat.label}:
                          </label>
                          <input
                            type="number"
                            className="input-secondary w-20"
                            value={userOption.manualStats[stat.key] || 0}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 0;
                              setUserOption({
                                ...userOption,
                                manualStats: {
                                  ...userOption.manualStats,
                                  [stat.key]: value,
                                },
                              });
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ユーザー指定%ボーナス */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      %ボーナス（職業・紋章補正とは別）
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {([
                        { key: 'HP', label: '体力' },
                        { key: 'ATK', label: '力' },
                        { key: 'MATK', label: '魔力' },
                        { key: 'DEF', label: '守備力' },
                        { key: 'MDEF', label: '精神' },
                        { key: 'AGI', label: '素早さ' },
                        { key: 'DEX', label: '器用さ' },
                        { key: 'HIT', label: '撃力' },
                      ] as const).map(stat => (
                        <div key={stat.key} className="flex items-center">
                          <label className="text-sm text-gray-600 dark:text-gray-400 w-16 truncate">
                            {stat.label}:
                          </label>
                          <input
                            type="number"
                            className="input-secondary w-16"
                            value={userOption.percentBonus?.[stat.key] || 0}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 0;
                              setUserOption({
                                ...userOption,
                                percentBonus: {
                                  ...userOption.percentBonus,
                                  [stat.key]: value,
                                },
                              });
                            }}
                          />
                          <span className="text-sm text-gray-500 ml-1">%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* タブ6: 結果 */}
        {activeTab === 6 && (
          <div className="space-y-6">
            {/* 火力計算セクション */}
            <DamageCalculationSection />

            {/* スキル計算セクション */}
            <SkillCalculationSection />
          </div>
        )}
      </div>


      {/* タブナビゲーションボタン */}
      <div className="flex justify-between mt-6">
        <button
          onClick={() => setActiveTab(Math.max(0, activeTab - 1))}
          disabled={activeTab === 0}
          className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← 前へ
        </button>

        <button
          onClick={() => setActiveTab(Math.min(tabs.length - 1, activeTab + 1))}
          disabled={activeTab === tabs.length - 1}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          次へ →
        </button>
      </div>

      {/* 確認ダイアログ */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        confirmVariant={confirmDialog.confirmVariant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </main>
  );
}