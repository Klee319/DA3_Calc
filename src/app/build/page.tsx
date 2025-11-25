'use client';

import { useEffect, useState } from 'react';
import { useBuildStore, UserOption, RingOption, Food } from '@/store/buildStore';
import { initializeGameData } from '@/lib/data';
import { JobSelector } from '@/components/JobSelector';
import { LevelInput } from '@/components/LevelInput';
import { SPSlider } from '@/components/SPSlider';
import { EquipmentSlot } from '@/components/EquipmentSlot';
import { StatViewer } from '@/components/StatViewer';
import { CustomSelect, CustomSelectOption } from '@/components/CustomSelect';
import { EquipSlot, Job, Equipment, Skill, StatType, WeaponType, ArmorType, StatEffect } from '@/types';
import { FoodData } from '@/types/data';
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

  // タブ定義
  const tabs = [
    { id: 0, label: '職業', icon: '👤' },
    { id: 1, label: 'SP割り振り', icon: '📊' },
    { id: 2, label: '装備', icon: '⚔️' },
    { id: 3, label: '食事・指輪', icon: '🍖' },
    { id: 4, label: '最終ステータス', icon: '📈' },
    { id: 5, label: 'スキル/通常攻撃', icon: '✨' },
    { id: 6, label: '結果', icon: '🎯' },
  ];

  const {
    currentBuild,
    calculatedStats,
    availableJobs,
    availableEquipment,
    availableFoods,
    userOption,
    ringOption,
    selectedFood,
    foodEnabled,
    weaponSkillEnabled,
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
    setAvailableJobs,
    setAvailableEquipment,
    setAvailableFoods,
    setGameData,
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
              stats.push({ stat: 'CRI', value: a['撃力（初期値）'], isPercent: false });
            }

            // 部位のマッピング
            const slotMap: Record<string, EquipSlot> = {
              '頭': 'head',
              '胴': 'body',
              '腕': 'arm',
              '脚': 'leg',
            };

            // 防具タイプのマッピング
            const armorTypeMap: Record<string, ArmorType> = {
              '頭': 'head',
              '胴': 'body',
              '腕': 'arm',
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
              stats.push({ stat: 'CRI', value: a['撃力（初期値）'], isPercent: false });
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
            };
          }),
        ];

        // 食べ物データの変換（効果マッピングを改善）
        const foods: Food[] = gameData.csv.foods.map((f, index) => {
          const effects: Array<{ stat: StatType; value: number; isPercent: boolean }> = [];

          // 効果マッピング関数
          const mapFoodEffect = (effectName: string): StatType | null => {
            const effectMap: Record<string, StatType> = {
              'HP': 'HP',
              '体力': 'HP',
              'MP': 'MP',
              '魔力': 'MATK',
              '攻撃力': 'ATK',
              '力': 'ATK',
              '防御力': 'DEF',
              '守備力': 'DEF',
              '魔法攻撃力': 'MATK',
              '魔法防御力': 'MDEF',
              '精神': 'MDEF',
              '素早さ': 'AGI',
              '器用': 'DEX',
              '器用さ': 'DEX',
              '撃力': 'CRI',
              '会心率': 'CRI',
            };

            for (const [key, stat] of Object.entries(effectMap)) {
              if (effectName && effectName.includes(key)) {
                return stat;
              }
            }
            return null;
          };

          // 効果1の処理
          if (f.効果1 && f.数値1) {
            const stat = mapFoodEffect(f.効果1);
            if (stat) {
              effects.push({
                stat,
                value: Number(f.数値1) || 0,
                isPercent: Boolean(typeof f.効果1 === 'string' && f.効果1.includes('%')),
              });
            }
          }

          // 効果2の処理
          if (f.効果2 && f.数値2) {
            const stat = mapFoodEffect(f.効果2);
            if (stat) {
              effects.push({
                stat,
                value: Number(f.数値2) || 0,
                isPercent: Boolean(typeof f.効果2 === 'string' && f.効果2.includes('%')),
              });
            }
          }

          return {
            id: `food_${index}_${f.アイテム名}`,
            name: f.アイテム名,
            effects,
            duration: f.持続時間 || 30,
          };
        });

        setAvailableJobs(jobs);
        setAvailableEquipment(equipments);
        setAvailableFoods(foods);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load game data:', error);
        setIsLoading(false);
      }
    };

    loadGameData();
  }, [setAvailableJobs, setAvailableEquipment, setAvailableFoods, setGameData]);

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

    // 1. 武器未選択チェック
    if (!currentBuild.equipment.weapon) {
      errors.push({
        type: 'error',
        message: '武器を選択してください。武器は必須です。'
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
    const armorSlots: Array<'head' | 'body' | 'arm' | 'leg'> = ['head', 'body', 'arm', 'leg'];
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
    { slot: 'arm', name: '腕' },
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
      <div className="mb-12">
        <h1 className="text-5xl md:text-6xl font-thin mb-4 text-gradient from-white to-gray-300">
          キャラクタービルド
        </h1>
        <p className="text-lg text-gray-400 line-clamp-2">
          職業・装備・SPを設定して、最強のキャラクターを構築しよう
        </p>
      </div>

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
                    onEquipmentChange={(equipment) => setEquipment(slot, equipment)}
                    rank={currentEquipment?.rank || 'F'}
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
                    disabled={!currentBuild.job}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* タブ3: 食事・指輪 */}
        {activeTab === 3 && (
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

        {/* タブ4: 最終ステータス */}
        {activeTab === 4 && (
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
                  {/* 武器固有能力 */}
                  <div>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={weaponSkillEnabled}
                        onChange={(e) => toggleWeaponSkill(e.target.checked)}
                        className="checkbox-primary mr-3"
                      />
                      <span className="text-gray-700 dark:text-gray-300 font-medium">武器固有能力</span>
                    </label>
                  </div>

                  {/* 手動ステータス調整 */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      手動ステータス調整
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {(['ATK', 'MATK', 'DEF', 'MDEF', 'HP', 'MP'] as const).map(stat => (
                        <div key={stat} className="flex items-center">
                          <label className="text-sm text-gray-600 dark:text-gray-400 w-16">
                            {stat}:
                          </label>
                          <input
                            type="number"
                            className="input-secondary w-24"
                            value={userOption.manualStats[stat] || 0}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 0;
                              setUserOption({
                                ...userOption,
                                manualStats: {
                                  ...userOption.manualStats,
                                  [stat]: value,
                                },
                              });
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* タブ5: スキル/通常攻撃 */}
        {activeTab === 5 && (
          <div className="space-y-6">
            {/* 通常攻撃設定 */}
            <div className="glass-card p-8">
              <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                <span className="text-3xl">⚔️</span>
                <span className="truncate">通常攻撃</span>
              </h2>

              {currentBuild.equipment.weapon ? (
                <div className="space-y-4">
                  <div className="p-4 bg-glass-light rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-gray-400">装備中の武器</span>
                      <span className="text-white font-medium">
                        {currentBuild.equipment.weapon.name}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-glass-dark/50 rounded">
                        <span className="text-xs text-gray-500 block mb-1">武器タイプ</span>
                        <span className="text-sm text-white font-medium">
                          {currentBuild.equipment.weapon.weaponType === 'sword' && '剣'}
                          {currentBuild.equipment.weapon.weaponType === 'greatsword' && '大剣'}
                          {currentBuild.equipment.weapon.weaponType === 'dagger' && '短剣'}
                          {currentBuild.equipment.weapon.weaponType === 'axe' && '斧'}
                          {currentBuild.equipment.weapon.weaponType === 'spear' && '槍'}
                          {currentBuild.equipment.weapon.weaponType === 'bow' && '弓'}
                          {currentBuild.equipment.weapon.weaponType === 'staff' && '杖'}
                          {!currentBuild.equipment.weapon.weaponType && '不明'}
                        </span>
                      </div>
                      <div className="p-3 bg-glass-dark/50 rounded">
                        <span className="text-xs text-gray-500 block mb-1">通常攻撃倍率</span>
                        <span className="text-sm text-green-400 font-medium">100%</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500">
                    ※ 通常攻撃のダメージは「ダメージ計算」ページで確認できます
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p>武器を装備してください</p>
                </div>
              )}
            </div>

            {/* 解放済みスキル一覧 */}
            <div className="glass-card p-8">
              <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                <span className="text-3xl">✨</span>
                <span className="truncate">解放済みスキル</span>
              </h2>

              {currentBuild.job ? (
                <>
                  {unlockedSkills.length > 0 ? (
                    <div className="space-y-4">
                      {/* ブランチ別でグループ化して表示 */}
                      {(['A', 'B', 'C'] as const).map(branch => {
                        const branchSkills = unlockedSkills.filter(s => s.branch === branch);
                        if (branchSkills.length === 0) return null;

                        const branchColor = branch === 'A' ? 'red' : branch === 'B' ? 'green' : 'blue';

                        return (
                          <div key={branch} className="p-4 bg-glass-light rounded-lg">
                            <h3 className={`text-lg font-semibold mb-3 text-${branchColor}-400`}>
                              {branch}軸スキル ({branchSkills.length}個)
                            </h3>
                            <div className="space-y-2">
                              {branchSkills.map((skill, idx) => (
                                <div
                                  key={`${skill.branch}-${skill.tier}-${idx}`}
                                  className="flex items-center justify-between p-3 bg-glass-dark/50 rounded hover:bg-glass-dark/70 transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    <span className={`px-2 py-1 text-xs font-mono rounded bg-${branchColor}-900/50 text-${branchColor}-300`}>
                                      {skill.branch}-{skill.tier}
                                    </span>
                                    <span className="text-white font-medium">
                                      {skill.skillName}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">
                                      必要SP: {skill.requiredSP}
                                    </span>
                                    <span className="text-green-400 text-sm">✓ 解放済み</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}

                      <div className="text-xs text-gray-500 mt-4">
                        ※ スキルのダメージ計算は「ダメージ計算」ページで行えます
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <p className="mb-2">まだスキルが解放されていません</p>
                      <p className="text-sm">SP割り振りタブでSPを配分してスキルを解放してください</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <p>まず職業を選択してください</p>
                </div>
              )}
            </div>

            {/* 次のスキル解放情報 */}
            {nextSkillInfo && (
              <div className="glass-card p-8">
                <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                  <span className="text-3xl">🎯</span>
                  <span className="truncate">次に解放可能なスキル</span>
                </h2>

                <div className="p-4 bg-gradient-to-br from-yellow-900/30 to-amber-900/30 rounded-lg border border-yellow-700/50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 text-xs font-mono rounded bg-yellow-900/50 text-yellow-300">
                        {nextSkillInfo.branch}軸
                      </span>
                      <span className="text-white font-medium text-lg">
                        {nextSkillInfo.skillName}
                      </span>
                    </div>
                    <span className="text-yellow-400 font-semibold">
                      あと {nextSkillInfo.needMoreSP} SP
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-yellow-500 to-amber-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${(nextSkillInfo.currentSP / nextSkillInfo.requiredSP) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-gray-400">
                    <span>現在: {nextSkillInfo.currentSP} SP</span>
                    <span>必要: {nextSkillInfo.requiredSP} SP</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* タブ6: 結果 */}
        {activeTab === 6 && (
          <div className="glass-card p-8">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <span className="text-3xl">🎯</span>
              <span className="truncate">結果</span>
            </h2>
            <div className="text-gray-600 dark:text-gray-400">
              <p className="mb-4">ダメージ計算結果は「ダメージ計算」ページで確認できます。</p>
              <a
                href="/damage"
                className="btn-primary inline-block"
              >
                ダメージ計算ページへ
              </a>
            </div>
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
    </main>
  );
}