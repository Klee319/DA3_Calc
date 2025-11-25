'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useBuildStore } from '@/store/buildStore';
import { EnemyInput } from '@/components/EnemyInput';
import { SkillSelector } from '@/components/SkillSelector';
import { DamageResult } from '@/components/DamageResult';
import Link from 'next/link';
import { 
  Skill, 
  EnemyStats, 
  DamageCalculationDetails,
  Equipment,
  Job,
  StatType
} from '@/types';
import { 
  calcBaseDamage, 
  applyJobCorrection, 
  calcFinalDamage, 
  calcSkillDamage,
  calcWeaponDamage
} from '@/lib/calc';
import { WeaponType } from '@/types/calc';
import { WeaponCalcData, SkillCalcData } from '@/types/data';
import { 
  loadWeaponCalc, 
  loadSkillCalc, 
  extractSkillsFromCalcData,
  loadAllEquipmentData, 
  loadAllJobData 
} from '@/lib/data';

interface SelectedSkill extends Skill {
  order?: number;  // ローテーション順序
}

export default function DamagePage() {
  // ビルド情報
  const { 
    currentBuild, 
    calculatedStats,
    availableJobs,
    setAvailableJobs,
    availableEquipment,
    setAvailableEquipment
  } = useBuildStore();

  // 敵パラメータ
  const [enemyStats, setEnemyStats] = useState<EnemyStats>({
    defense: 100,
    speciesResistance: 0,
    elementResistance: 0,
  });

  // スキル関連
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<SelectedSkill[]>([]);
  const [weaponCalcData, setWeaponCalcData] = useState<WeaponCalcData | null>(null);
  const [skillCalcData, setSkillCalcData] = useState<SkillCalcData | null>(null);

  // 計算結果
  const [damageResults, setDamageResults] = useState<{
    perSkill: Array<{
      skill: Skill;
      damagePerHit: number;
      totalDamage: number;
      hits: number;
      mpCost: number;
      cooldown: number;
      details?: DamageCalculationDetails;
    }>;
    totalDamage: number;
    totalMP: number;
    avgDPS: number;
    mpEfficiency: number;
  } | null>(null);

  // 計算中フラグ
  const [isCalculating, setIsCalculating] = useState(false);

  // データ読み込み
  useEffect(() => {
    const loadData = async () => {
      try {
        // YAML データの読み込み
        const [weaponData, skillData] = await Promise.all([
          loadWeaponCalc(),
          loadSkillCalc()
        ]);
        setWeaponCalcData(weaponData);
        setSkillCalcData(skillData);

        // CSV データの読み込み（装備とジョブ）
        if (!availableEquipment || availableEquipment.length === 0) {
          const equipmentData = await loadAllEquipmentData();
          const allEquipment: Equipment[] = [];
          
          // 武器データの変換
          equipmentData.weapons.forEach(weapon => {
            allEquipment.push({
              id: weapon.アイテム名,
              name: weapon.アイテム名,
              slot: 'weapon',
              weaponType: weapon.武器種 as any,
              baseStats: [
                { stat: 'ATK', value: weapon['攻撃力（初期値）'] },
                { stat: 'CRI', value: weapon['会心率（初期値）'] }
              ],
              requiredLevel: weapon.使用可能Lv
            });
          });
          
          // 防具データの変換 (仮にbodyスロットとして設定)
          equipmentData.armors.forEach(armor => {
            allEquipment.push({
              id: armor.アイテム名,
              name: armor.アイテム名,
              slot: 'body',  // 実際の部位情報がないため仮にbodyを設定
              baseStats: [
                { stat: 'DEF', value: armor['守備力（初期値）'] },
                { stat: 'HP', value: armor['体力（初期値）'] }
              ],
              requiredLevel: armor.使用可能Lv
            });
          });
          
          // アクセサリーデータの変換
          equipmentData.accessories.forEach(accessory => {
            const stats: { stat: StatType; value: number }[] = [];
            
            if (accessory['体力（初期値）'] > 0) {
              stats.push({ stat: 'HP' as StatType, value: accessory['体力（初期値）'] });
            }
            if (accessory['力（初期値）'] > 0) {
              stats.push({ stat: 'ATK' as StatType, value: accessory['力（初期値）'] });
            }
            if (accessory['魔力（初期値）'] > 0) {
              stats.push({ stat: 'MATK' as StatType, value: accessory['魔力（初期値）'] });
            }
            if (accessory['精神（初期値）'] > 0) {
              stats.push({ stat: 'MDEF' as StatType, value: accessory['精神（初期値）'] });
            }
            if (accessory['撃力（初期値）'] > 0) {
              stats.push({ stat: 'CRI' as StatType, value: accessory['撃力（初期値）'] });
            }
            if (accessory['素早さ（初期値）'] > 0) {
              stats.push({ stat: 'AGI' as StatType, value: accessory['素早さ（初期値）'] });
            }
            
            allEquipment.push({
              id: accessory.アイテム名,
              name: accessory.アイテム名,
              slot: 'accessory1',  // アクセサリーは accessory1 または accessory2
              baseStats: stats,
              requiredLevel: accessory.使用可能Lv
            });
          });
          
          setAvailableEquipment(allEquipment);
        }

        if (!availableJobs || availableJobs.length === 0) {
          const jobDataMap = await loadAllJobData();
          const jobs: Job[] = [];
          jobDataMap.forEach((_, jobName) => {
            jobs.push({
              id: jobName,
              name: jobName,
              skills: [], // スキルデータは別途読み込み必要
              baseStats: {
                HP: 100, MP: 50, ATK: 10, MATK: 10, 
                DEF: 10, MDEF: 10, AGI: 10, DEX: 10, 
                LUK: 10, CRI: 0, HIT: 95, FLEE: 5
              },
              statGrowth: {
                HP: 5, MP: 2, ATK: 1, MATK: 1,
                DEF: 1, MDEF: 1, AGI: 1, DEX: 1,
                LUK: 1, CRI: 0, HIT: 0, FLEE: 0
              },
              availableWeapons: [],
              maxLevel: 100
            });
          });
          setAvailableJobs(jobs);
        }

        // スキルデータをSkillCalc.yamlから抽出
        if (skillData) {
          const extractedSkills = extractSkillsFromCalcData(skillData);
          // 型の不一致を一時的に解決（実際にはSkillインターフェースに合わせて変換が必要）
          setAvailableSkills(extractedSkills as any);
        }

      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };

    loadData();
  }, [availableEquipment, setAvailableEquipment, availableJobs, setAvailableJobs]);

  // 現在の武器種を取得
  const currentWeaponType = useMemo((): WeaponType | undefined => {
    const weapon = currentBuild.equipment.weapon;
    if (!weapon) return undefined;
    
    // 武器名から武器種を推定（実際は武器データに武器種フィールドが必要）
    const name = weapon.name.toLowerCase();
    if (name.includes('剣') || name.includes('ソード')) return 'sword' as WeaponType;
    if (name.includes('大剣')) return 'greatsword' as WeaponType;
    if (name.includes('短剣') || name.includes('ダガー')) return 'dagger' as WeaponType;
    if (name.includes('斧') || name.includes('アックス')) return 'axe' as WeaponType;
    if (name.includes('槍') || name.includes('スピア')) return 'spear' as WeaponType;
    if (name.includes('弓')) return 'bow' as WeaponType;
    if (name.includes('杖') || name.includes('スタッフ')) return 'staff' as WeaponType;
    if (name.includes('鎚') || name.includes('メイス')) return 'mace' as WeaponType;
    
    return 'sword' as WeaponType; // デフォルト
  }, [currentBuild.equipment.weapon]);

  // ビルドサマリ
  const buildSummary = useMemo(() => {
    const weapon = currentBuild.equipment.weapon;
    const body = currentBuild.equipment.body;
    const accessory1 = currentBuild.equipment.accessory1;
    
    return {
      job: currentBuild.job?.name || '未選択',
      level: currentBuild.level,
      weapon: weapon?.name || '未装備',
      armor: body?.name || '未装備',
      accessory: accessory1?.name || '未装備',
      totalATK: calculatedStats.total.ATK,
      totalMATK: calculatedStats.total.MATK,
    };
  }, [currentBuild, calculatedStats]);

  // スキル選択/解除
  const handleSkillToggle = useCallback((skill: Skill | null) => {
    if (!skill) {
      setSelectedSkills([]);
      return;
    }

    setSelectedSkills(prev => {
      const exists = prev.findIndex(s => s.id === skill.id);
      if (exists >= 0) {
        // 既に選択されている場合は削除
        return prev.filter(s => s.id !== skill.id);
      } else {
        // 新規追加（最大5スキルまで）
        if (prev.length >= 5) {
          return prev;
        }
        return [...prev, { ...skill, order: prev.length + 1 }];
      }
    });
  }, []);

  // ダメージ計算実行
  const calculateDamage = useCallback(async () => {
    if (!weaponCalcData || !skillCalcData) {
      console.error('Calculation data not loaded');
      return;
    }

    if (selectedSkills.length === 0) {
      // デフォルトで通常攻撃を使用
      const basicAttack = availableSkills.find(s => s.id === 'basic_attack');
      if (basicAttack) {
        setSelectedSkills([basicAttack]);
      }
      return;
    }

    setIsCalculating(true);

    try {
      const results = selectedSkills.map(skill => {
        // 基礎ダメージ計算（武器ベース）
        const getStatValue = (stats: { stat: StatType; value: number }[] | undefined, statType: StatType) => {
          const statEffect = stats?.find(s => s.stat === statType);
          return statEffect?.value || 0;
        };
        
        const weaponStats = {
          attackPower: getStatValue(currentBuild.equipment.weapon?.baseStats, 'ATK'),
          magicPower: getStatValue(currentBuild.equipment.weapon?.baseStats, 'MATK'),
          critRate: getStatValue(currentBuild.equipment.weapon?.baseStats, 'CRI'),
          critDamage: getStatValue(currentBuild.equipment.weapon?.baseStats, 'CRI'),
        };

        // 基礎ダメージ
        const baseDamage = calcBaseDamage(
          currentWeaponType || 'sword',  // デフォルト値を設定
          weaponStats,
          calculatedStats.total, // userStatsとして使用
          weaponCalcData
        );

        // 職業補正
        let jobCorrectedDamage = baseDamage;
        if (currentBuild.job) {
          jobCorrectedDamage = applyJobCorrection(
            baseDamage,
            currentBuild.job.name,
            currentWeaponType || 'sword',
            weaponStats,
            calculatedStats.total,
            weaponCalcData
          );
        }

        // スキルダメージ計算
        let skillResult = {
          damage: jobCorrectedDamage,
          hits: 1,
          totalDamage: jobCorrectedDamage,
          mp: skill.spCost || 0,
          ct: 0  // デフォルト値を使用
        };

        // スキル倍率適用（スキル名がスキルデータに存在する場合）
        if (skill.name !== '通常攻撃') {
          skillResult = calcSkillDamage(
            skill.name,
            currentBuild.level, // スキルレベル = キャラレベル（仮）
            jobCorrectedDamage,
            weaponStats,
            calculatedStats.total,
            skillCalcData,
            currentWeaponType || 'sword'
          );
        }

        // 最終ダメージ（敵耐性考慮）
        const finalDamage = calcFinalDamage(
          skillResult.damage,
          enemyStats.defense,
          enemyStats.speciesResistance,
          enemyStats.elementResistance
        );

        // 計算詳細
        const details: DamageCalculationDetails = {
          baseDamage,
          skillMultiplier: skillResult.damage / baseDamage,
          jobCorrected: jobCorrectedDamage,
          enemyDefReduction: enemyStats.defense / 2,
          typeResistance: enemyStats.speciesResistance,
          elementResistance: enemyStats.elementResistance,
          finalDamage
        };

        return {
          skill,
          damagePerHit: finalDamage,
          totalDamage: finalDamage * skillResult.hits,
          hits: skillResult.hits,
          mpCost: skillResult.mp,
          cooldown: skillResult.ct,
          details
        };
      });

      // 総合計算
      const totalDamage = results.reduce((sum, r) => sum + r.totalDamage, 0);
      const totalMP = results.reduce((sum, r) => sum + r.mpCost, 0);
      const avgCooldown = results.reduce((sum, r) => sum + r.cooldown, 0) / results.length;
      const avgDPS = avgCooldown > 0 ? totalDamage / avgCooldown : totalDamage;
      const mpEfficiency = totalMP > 0 ? totalDamage / totalMP : Infinity;

      setDamageResults({
        perSkill: results,
        totalDamage,
        totalMP,
        avgDPS,
        mpEfficiency
      });

    } catch (error) {
      console.error('Damage calculation failed:', error);
    } finally {
      setIsCalculating(false);
    }
  }, [
    weaponCalcData,
    skillCalcData,
    selectedSkills,
    availableSkills,
    currentBuild,
    calculatedStats,
    currentWeaponType,
    enemyStats
  ]);

  // 選択スキル変更時に自動計算
  useEffect(() => {
    if (selectedSkills.length > 0 && weaponCalcData && skillCalcData) {
      calculateDamage();
    }
  }, [selectedSkills, enemyStats]); // calculateDamage を依存配列から除外（無限ループ防止）

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* ページヘッダー */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            火力計算
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            ビルドとスキルを組み合わせて最適なダメージ出力を計算
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 左カラム: 入力セクション */}
          <div className="space-y-6">
            {/* ビルド情報セクション */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  現在のビルド
                </h2>
                <Link 
                  href="/build"
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                >
                  編集 →
                </Link>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">職業:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">
                    {buildSummary.job}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">レベル:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">
                    {buildSummary.level}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">武器:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">
                    {buildSummary.weapon}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">防具:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">
                    {buildSummary.armor}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">攻撃力:</span>
                  <span className="ml-2 font-medium text-orange-600 dark:text-orange-400">
                    {buildSummary.totalATK}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">魔法攻撃:</span>
                  <span className="ml-2 font-medium text-purple-600 dark:text-purple-400">
                    {buildSummary.totalMATK}
                  </span>
                </div>
              </div>
            </div>

            {/* 敵パラメータセクション */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                敵パラメータ
              </h2>
              <EnemyInput
                enemyStats={enemyStats}
                onStatsChange={setEnemyStats}
                disabled={isCalculating}
              />
            </div>

            {/* スキル選択セクション */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                スキル選択
              </h2>
              
              {/* 選択済みスキル表示 */}
              {selectedSkills.length > 0 && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    選択中のスキル ({selectedSkills.length}/5):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedSkills.map((skill, index) => (
                      <span
                        key={skill.id}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100"
                      >
                        {index + 1}. {skill.name}
                        <button
                          onClick={() => handleSkillToggle(skill)}
                          className="ml-2 text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <SkillSelector
                skills={availableSkills}
                selectedSkill={selectedSkills[selectedSkills.length - 1] || null}
                onSkillSelect={handleSkillToggle}
                job={currentBuild.job}
                weaponType={currentWeaponType as any}
                disabled={isCalculating}
              />
            </div>
          </div>

          {/* 右カラム: 結果セクション */}
          <div className="space-y-6">
            {/* 計算ボタン */}
            <div className="flex justify-center">
              <button
                onClick={calculateDamage}
                disabled={isCalculating || selectedSkills.length === 0}
                className={`
                  px-8 py-3 rounded-lg font-semibold text-white
                  ${isCalculating || selectedSkills.length === 0
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg transform hover:scale-105 transition-all'
                  }
                `}
              >
                {isCalculating ? '計算中...' : '再計算'}
              </button>
            </div>

            {/* 計算結果表示 */}
            {damageResults && (
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  計算結果
                </h2>

                {/* 総合結果 */}
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg shadow-lg p-6 text-white">
                  <h3 className="text-xl font-semibold mb-4">総合ダメージ</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-purple-100">合計ダメージ</p>
                      <p className="text-3xl font-bold">
                        {damageResults.totalDamage.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-purple-100">平均DPS</p>
                      <p className="text-3xl font-bold">
                        {Math.floor(damageResults.avgDPS).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-purple-100">消費MP</p>
                      <p className="text-2xl font-bold">
                        {damageResults.totalMP}
                      </p>
                    </div>
                    <div>
                      <p className="text-purple-100">MP効率</p>
                      <p className="text-2xl font-bold">
                        {damageResults.mpEfficiency === Infinity 
                          ? '∞' 
                          : damageResults.mpEfficiency.toFixed(1)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* スキル別結果 */}
                {damageResults.perSkill.map((result, index) => (
                  <DamageResult
                    key={`${result.skill.id}-${index}`}
                    damagePerHit={result.damagePerHit}
                    totalDamage={result.totalDamage}
                    dps={result.cooldown > 0 ? result.totalDamage / result.cooldown : result.totalDamage}
                    mpEfficiency={result.mpCost > 0 ? result.totalDamage / result.mpCost : 0}
                    hits={result.hits}
                    mpCost={result.mpCost}
                    cooldown={result.cooldown}
                    calculationDetails={result.details ? {
                      baseDamage: result.details.baseDamage,
                      attackPower: 0, // デフォルト値
                      defense: result.details.enemyDefReduction * 2, // 逆算
                      skillMultiplier: result.details.skillMultiplier,
                      criticalMultiplier: 1, // デフォルト値
                      elementMultiplier: 1 - result.details.elementResistance / 100,
                      speciesMultiplier: 1 - result.details.typeResistance / 100,
                      buffMultiplier: 1, // デフォルト値
                      finalMultiplier: result.details.finalDamage / result.details.baseDamage
                    } : undefined}
                    className="shadow-lg"
                  />
                ))}
              </div>
            )}

            {/* 結果がない場合の表示 */}
            {!damageResults && (
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-12 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  スキルを選択して計算を実行してください
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
