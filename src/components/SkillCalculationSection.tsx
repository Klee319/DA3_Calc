'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useBuildStore } from '@/store/buildStore';
import { loadAllSkillCalcData, loadWeaponCalc, getAllAvailableSkills } from '@/lib/data';
import { calcBaseDamage, applyJobCorrection, calculateSkill, buildFormulaContext } from '@/lib/calc';
import { convertJobNameToYAML } from '@/constants/jobMappings';
import { CustomSelect, CustomSelectOption } from './CustomSelect';
import type { AllSkillCalcData, AvailableSkill, WeaponCalcData } from '@/types/data';
import type { WeaponType, StatBlock } from '@/types/calc';
import type { SkillCalculationResult } from '@/lib/calc/skillCalculator';
import type { WeaponStats } from '@/types/calc';

/**
 * 武器種をYAML形式の名前に変換する（小文字英語からYAML形式へ）
 */
function convertWeaponTypeToYamlFormat(weaponType: string): string {
  const mapping: Record<string, string> = {
    'sword': 'Sword',
    'greatsword': 'GreatSword',
    'dagger': 'Dagger',
    'axe': 'Axe',
    'spear': 'Spear',
    'bow': 'Bow',
    'staff': 'Wand',
    'wand': 'Wand',
    'frypan': 'Frypan',
    'mace': 'Sword',
    'katana': 'Sword',
    'fist': 'Sword',
    // 日本語名も対応（武器CSVから直接取得した場合）
    '剣': 'Sword',
    '大剣': 'GreatSword',
    '短剣': 'Dagger',
    '斧': 'Axe',
    '槍': 'Spear',
    '弓': 'Bow',
    '杖': 'Wand',
  };

  return mapping[weaponType.toLowerCase()] || mapping[weaponType] || 'Sword';
}

/**
 * スキル計算セクションコンポーネント
 */
export function SkillCalculationSection() {
  const { currentBuild, calculatedStats, weaponStats: storeWeaponStats, gameData } = useBuildStore();

  // データ読み込み状態
  const [skillCalcData, setSkillCalcData] = useState<AllSkillCalcData | null>(null);
  const [weaponCalcData, setWeaponCalcData] = useState<WeaponCalcData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // スキル選択状態
  const [selectedSkill, setSelectedSkill] = useState<AvailableSkill | null>(null);
  const [skillLevel, setSkillLevel] = useState<number>(1); // スキル本用
  const [customHits, setCustomHits] = useState<number | undefined>(undefined); // variableヒット用

  // 高度なオプション（敵ステータス）
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [enemyDefense, setEnemyDefense] = useState<number>(0); // 敵守備力
  const [enemyTypeResistance, setEnemyTypeResistance] = useState<number>(0); // 攻撃耐性(物理/魔力)(%)
  const [enemyAttributeResistance, setEnemyAttributeResistance] = useState<number>(0); // 属性耐性(%)

  // 計算結果
  const [calculationResult, setCalculationResult] = useState<SkillCalculationResult | null>(null);

  // 解放済みスキル名リスト（SP割り振りから取得）
  const unlockedSkillNames = useMemo(() => {
    if (!currentBuild.job || !gameData?.jobSPData) return [];

    const jobSPData = gameData.jobSPData.get(currentBuild.job.name);
    if (!jobSPData) return [];

    const spAllocation = currentBuild.spAllocation || { A: 0, B: 0, C: 0 };
    const unlockedNames: string[] = [];

    // 各ブランチのスキルをチェック
    for (const row of jobSPData) {
      const stage = row.解法段階;
      const skillName = row.解法スキル名;
      const requiredSP = Number(row.必要SP) || 0;

      if (!skillName || !stage.match(/^[ABC]-\d+$/)) continue;

      const branch = stage.charAt(0) as 'A' | 'B' | 'C';
      const currentSP = spAllocation[branch] || 0;

      if (currentSP >= requiredSP) {
        unlockedNames.push(skillName);
      }
    }

    return unlockedNames;
  }, [currentBuild.job, currentBuild.spAllocation, gameData?.jobSPData]);

  // データ読み込み
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setIsLoading(true);

      try {
        // loadAllSkillCalcDataはwithFallbackを使用しているため、常に成功する
        const skillData = await loadAllSkillCalcData();
        const weaponData = await loadWeaponCalc();

        if (isMounted) {
          setSkillCalcData(skillData);
          setWeaponCalcData(weaponData);

          // スキルデータが空かどうかチェック
          const hasSkillData =
            Object.keys(skillData.skillBook).length > 0 ||
            Object.keys(skillData.specialJob).length > 0 ||
            Object.keys(skillData.firstJob).length > 0 ||
            Object.keys(skillData.secondJob).length > 0 ||
            Object.keys(skillData.thirdJob).length > 0;

          if (!hasSkillData) {
            console.warn('No skill data loaded - skill calculation may be limited');
          }
        }
      } catch (err) {
        // 本来はwithFallbackでキャッチされるが、念のため
        console.error('Failed to load skill calc data:', err);
        if (isMounted) {
          // エラー時も空のデータで続行
          setSkillCalcData({
            skillBook: {},
            specialJob: {},
            firstJob: {},
            secondJob: {},
            thirdJob: {},
          });
          setWeaponCalcData(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  // 現在の武器種（YAML形式）
  const currentWeaponTypeYAML = useMemo((): string => {
    const weapon = currentBuild.equipment.weapon;
    if (!weapon) return '';

    // sourceDataから武器種を取得（日本語形式）またはweaponTypeから取得（小文字英語形式）
    let weaponType = '';
    if (weapon.sourceData?.type === 'weapon') {
      weaponType = weapon.sourceData.data.武器種 || '';
    }
    if (!weaponType) {
      weaponType = weapon.weaponType || 'sword';
    }

    return convertWeaponTypeToYamlFormat(weaponType);
  }, [currentBuild.equipment.weapon]);

  // 現在の職業名（YAML形式）
  const currentJobNameYAML = useMemo((): string => {
    if (!currentBuild.job) return '';
    return convertJobNameToYAML(currentBuild.job.id) || '';
  }, [currentBuild.job]);

  // 職業グレード
  const jobGrade = useMemo((): string => {
    if (!currentBuild.job || !gameData?.jobConst?.JobDefinition) return '';
    const jobDef = gameData.jobConst.JobDefinition[currentJobNameYAML];
    return jobDef?.Grade || '';
  }, [currentBuild.job, currentJobNameYAML, gameData?.jobConst]);

  // 利用可能なスキルリスト
  const availableSkills = useMemo((): AvailableSkill[] => {
    if (!skillCalcData || !currentWeaponTypeYAML || !currentJobNameYAML) {
      return [];
    }

    return getAllAvailableSkills(
      skillCalcData,
      currentWeaponTypeYAML,
      currentJobNameYAML,
      jobGrade,
      unlockedSkillNames
    );
  }, [skillCalcData, currentWeaponTypeYAML, currentJobNameYAML, jobGrade, unlockedSkillNames]);

  // 武器ステータス取得
  const weaponStats = useMemo((): WeaponStats => {
    if (storeWeaponStats) {
      return {
        attackPower: storeWeaponStats.attackPower || 0,
        magicPower: storeWeaponStats.attackPower || 0,
        critRate: storeWeaponStats.critRate || 0,
        critDamage: storeWeaponStats.critDamage || 0,
      };
    }
    return { attackPower: 0, magicPower: 0, critRate: 0, critDamage: 0 };
  }, [storeWeaponStats]);

  // ユーザーステータス取得
  const userStats = useMemo((): StatBlock => {
    const total = calculatedStats.total;
    return {
      HP: total.HP || 0,
      ATK: total.ATK || 0,
      MATK: total.MATK || 0,
      DEF: total.DEF || 0,
      MDEF: total.MDEF || 0,
      AGI: total.AGI || 0,
      DEX: total.DEX || 0,
      CRI: total.CRI || 0,
      HIT: total.HIT || 0,
      FLEE: total.FLEE || 0,
    };
  }, [calculatedStats.total]);

  // BaseDamage計算
  const baseDamages = useMemo((): Record<string, number> => {
    if (!weaponCalcData || !currentBuild.equipment.weapon) {
      return {};
    }

    const damages: Record<string, number> = {};
    const weaponTypes = ['Sword', 'Wand', 'Bow', 'Axe', 'GreatSword', 'Dagger', 'Spear', 'Frypan'];

    for (const wType of weaponTypes) {
      try {
        let baseDamage = calcBaseDamage(
          wType as WeaponType,
          weaponStats,
          userStats,
          weaponCalcData,
          1.0, // DamageCorrection 100%
          1.0  // ComboCorrection
        );

        // 職業補正適用
        if (currentJobNameYAML) {
          baseDamage = applyJobCorrection(
            baseDamage,
            currentJobNameYAML,
            wType as WeaponType,
            weaponStats,
            userStats,
            weaponCalcData,
            1.0
          );
        }

        damages[wType] = baseDamage;
      } catch {
        damages[wType] = 0;
      }
    }

    return damages;
  }, [weaponCalcData, currentBuild.equipment.weapon, weaponStats, userStats, currentJobNameYAML]);

  // スキル計算実行
  const executeCalculation = useCallback(() => {
    if (!selectedSkill || !weaponCalcData) {
      setCalculationResult(null);
      return;
    }

    const context = buildFormulaContext(
      baseDamages,
      userStats,
      weaponStats,
      skillLevel,
      0 // TargetDefense
    );

    const result = calculateSkill(
      selectedSkill,
      context,
      currentWeaponTypeYAML,
      weaponCalcData,
      customHits
    );

    setCalculationResult(result);
  }, [selectedSkill, weaponCalcData, baseDamages, userStats, weaponStats, skillLevel, currentWeaponTypeYAML, customHits]);

  // 選択スキル/レベル/ヒット数変更時に自動計算
  useEffect(() => {
    executeCalculation();
  }, [executeCalculation]);

  // スキル選択時の処理
  const handleSkillSelect = (skill: AvailableSkill | null) => {
    setSelectedSkill(skill);
    setCustomHits(undefined);
    if (skill?.source === 'book') {
      setSkillLevel(1);
    }
  };

  // スキルタイプに応じたアイコン
  const getSkillTypeIcon = (type: AvailableSkill['type']): string => {
    switch (type) {
      case 'damage': return '⚔️';
      case 'heal': return '💚';
      case 'buff': return '⬆️';
      case 'debuff': return '⬇️';
      case 'utility': return '🔧';
      default: return '✨';
    }
  };

  // スキル選択オプションを生成
  const skillSelectOptions: CustomSelectOption[] = useMemo(() => {
    return availableSkills.map((skill) => {
      const icon = getSkillTypeIcon(skill.type);
      const sourceText = skill.source === 'book' ? '📖 スキル本' : `👤 ${skill.jobName || ''}`;
      const weaponText = skill.weaponTypes.length > 0 ? `[${skill.weaponTypes.join(', ')}]` : '';

      return {
        value: skill.id,
        label: skill.name,
        icon: icon,
        description: `${sourceText} ${weaponText}`.trim(),
      };
    });
  }, [availableSkills]);

  // スキルIDから変更時の処理
  const handleSkillChange = useCallback((skillId: string) => {
    const skill = availableSkills.find(s => s.id === skillId);
    handleSkillSelect(skill || null);
  }, [availableSkills]);

  // ローディング表示
  if (isLoading) {
    return (
      <div className="glass-card p-6 mt-6">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">✨</span>
          スキル計算
        </h3>
        <div className="flex items-center justify-center py-8">
          <p className="text-gray-400">スキルデータを読み込み中...</p>
        </div>
      </div>
    );
  }

  // 職業/武器未選択時
  if (!currentBuild.job || !currentBuild.equipment.weapon) {
    return (
      <div className="glass-card p-6 mt-6">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">✨</span>
          スキル計算
        </h3>
        <div className="text-center py-8 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p>職業と武器を選択してください</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 mt-6">
      <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
        <span className="text-2xl">✨</span>
        スキル計算
      </h3>

      {/* スキル選択エリア */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-400 mb-2">
          スキル選択
        </label>

        {availableSkills.length === 0 ? (
          <div className="px-4 py-3 bg-gray-800/50 rounded-lg border border-gray-700 text-gray-500 text-center">
            使用可能なスキルがありません
          </div>
        ) : (
          <CustomSelect
            options={skillSelectOptions}
            value={selectedSkill?.id || ''}
            onChange={handleSkillChange}
            placeholder="スキルを選択してください"
            showIcon={true}
          />
        )}

        {/* スキル数表示 */}
        <p className="mt-2 text-xs text-gray-500">
          {availableSkills.length}個のスキルが使用可能
        </p>
      </div>

      {/* スキル本レベル選択 */}
      {selectedSkill?.source === 'book' && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-3">
            スキルレベル
          </label>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((lv) => (
              <button
                key={lv}
                onClick={() => setSkillLevel(lv)}
                className={`
                  relative min-w-[48px] h-10 px-3 rounded-lg font-medium
                  transition-all duration-200 ease-out
                  ${skillLevel === lv
                    ? 'bg-gradient-to-br from-rpg-accent to-purple-600 text-white shadow-lg shadow-rpg-accent/30 scale-105'
                    : 'bg-gray-700/80 text-gray-300 hover:bg-gray-600 hover:text-white hover:scale-102'
                  }
                  border ${skillLevel === lv ? 'border-rpg-accent/50' : 'border-gray-600/50'}
                `}
              >
                <span className="relative z-10">Lv.{lv}</span>
                {skillLevel === lv && (
                  <div className="absolute inset-0 bg-white/10 rounded-lg animate-pulse" />
                )}
              </button>
            ))}
          </div>
          {/* レベル効果プレビュー */}
          <div className="mt-3 px-3 py-2 bg-gray-800/50 rounded-lg border border-gray-700/50">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">現在:</span>
              <span className="text-rpg-accent font-semibold">Lv.{skillLevel}</span>
              <span className="text-gray-600">|</span>
              <span className="text-gray-500">最大:</span>
              <span className="text-gray-400">Lv.10</span>
            </div>
          </div>
        </div>
      )}

      {/* variableヒット入力 */}
      {calculationResult?.isVariableHits && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            ヒット数（敵サイズ依存）
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={customHits || ''}
            onChange={(e) => setCustomHits(Number(e.target.value) || undefined)}
            placeholder="ヒット数を入力"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
          />
        </div>
      )}

      {/* 高度なオプション（敵ステータス） */}
      <div className="mb-6">
        <button
          onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <span className={`transform transition-transform ${showAdvancedOptions ? 'rotate-90' : ''}`}>
            ▶
          </span>
          <span>高度なオプション（敵ステータス）</span>
          {(enemyDefense > 0 || enemyTypeResistance > 0 || enemyAttributeResistance > 0) && (
            <span className="px-2 py-0.5 bg-rpg-accent/30 text-rpg-accent text-xs rounded-full">
              適用中
            </span>
          )}
        </button>

        {showAdvancedOptions && (
          <div className="mt-4 p-4 bg-gray-800/50 border border-gray-700/50 rounded-lg space-y-4">
            <p className="text-xs text-gray-500 mb-3">
              敵のステータスを入力すると、最終ダメージが計算されます。
              <br />
              計算式: (HitDamage - 守備力/2) × (1 - 攻撃耐性%) × (1 - 属性耐性%)
            </p>

            {/* 敵守備力 */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                敵守備力
              </label>
              <input
                type="number"
                min={0}
                value={enemyDefense}
                onChange={(e) => setEnemyDefense(Math.max(0, Number(e.target.value) || 0))}
                placeholder="0"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              />
            </div>

            {/* 攻撃耐性（物理/魔力） */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                攻撃耐性 (%) <span className="text-gray-500">物理/魔力</span>
              </label>
              <input
                type="number"
                min={-100}
                max={100}
                value={enemyTypeResistance}
                onChange={(e) => setEnemyTypeResistance(Math.min(100, Math.max(-100, Number(e.target.value) || 0)))}
                placeholder="0"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              />
              <p className="text-xs text-gray-500 mt-1">負の値は弱点（ダメージ増加）</p>
            </div>

            {/* 属性耐性 */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                属性耐性 (%)
              </label>
              <input
                type="number"
                min={-100}
                max={100}
                value={enemyAttributeResistance}
                onChange={(e) => setEnemyAttributeResistance(Math.min(100, Math.max(-100, Number(e.target.value) || 0)))}
                placeholder="0"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              />
              <p className="text-xs text-gray-500 mt-1">負の値は弱点（ダメージ増加）</p>
            </div>

            {/* リセットボタン */}
            <button
              onClick={() => {
                setEnemyDefense(0);
                setEnemyTypeResistance(0);
                setEnemyAttributeResistance(0);
              }}
              className="w-full px-3 py-2 bg-gray-600 hover:bg-gray-500 text-gray-300 rounded-lg transition-colors text-sm"
            >
              リセット
            </button>
          </div>
        )}
      </div>

      {/* 計算結果 */}
      {calculationResult && selectedSkill && (
        <div className="mt-6 space-y-4">
          <h4 className="text-lg font-semibold text-white border-b border-gray-700 pb-2">
            計算結果: {calculationResult.skillName}
          </h4>

          {/* 武器不一致警告 */}
          {calculationResult.weaponMismatchApplied && (
            <div className="p-3 bg-yellow-900/30 border border-yellow-500/50 rounded-lg">
              <p className="text-yellow-400 text-sm flex items-center gap-2">
                <span>⚠️</span>
                武器不一致ペナルティ適用中（{Math.round(calculationResult.weaponMismatchPenalty * 100)}%）
              </p>
            </div>
          )}

          {/* ダメージ/回復系 */}
          {(calculationResult.type === 'damage' || calculationResult.type === 'heal') && (() => {
            // 会心率・ダメージ補正の期待値計算
            // calculatedStats.total.CRI は「武器会心率 + ユーザー器用さ * 0.3」で既に計算済み
            const totalCritRate = calculatedStats.total.CRI || 0;
            const critRate = Math.min(totalCritRate, 100) / 100;
            // ダメージ補正: 武器値（例: 80）~ 100%の範囲
            const damageCorrectionMin = storeWeaponStats?.damageCorrection || 80;
            const damageCorrectionMax = 100;
            const avgDamageCorrection = ((damageCorrectionMin + damageCorrectionMax) / 2) / 100;

            // 期待値計算: 合計ダメージ × ダメ補正平均
            // 注: BaseDamageに既に会心ダメージが含まれているため、会心補正は掛けない
            const expectedDamage = Math.round(
              calculationResult.totalDamage * avgDamageCorrection
            );

            // 最大ダメージ（ダメ補正100%時）
            // 注: BaseDamageに既に会心ダメージが含まれている
            const maxDamage = Math.round(
              calculationResult.totalDamage * (damageCorrectionMax / 100)
            );

            // 1hit当たりの期待値・最大ダメージ
            const expectedPerHit = Math.round(
              calculationResult.damagePerHit * avgDamageCorrection
            );
            const maxPerHit = Math.round(
              calculationResult.damagePerHit * (damageCorrectionMax / 100)
            );

            // 敵ステータスを考慮した最終ダメージ計算関数
            // FinalDamage = (HitDamage - EnemyDefence/2) * (1 - TypeRes/100) * (1 - AttrRes/100)
            // 多段攻撃は1段ごとに計算して合計
            const calculateFinalDamage = (hitDamage: number): number => {
              const afterDefense = Math.max(0, hitDamage - (enemyDefense / 2));
              const afterTypeRes = afterDefense * (1 - enemyTypeResistance / 100);
              const afterAttrRes = afterTypeRes * (1 - enemyAttributeResistance / 100);
              return Math.max(0, Math.floor(afterAttrRes));
            };

            // 敵ステータスが設定されているか
            const hasEnemyStats = enemyDefense > 0 || enemyTypeResistance !== 0 || enemyAttributeResistance !== 0;

            // 最終ダメージ（1hit単位で計算）
            const finalMaxPerHit = calculateFinalDamage(maxPerHit);
            const finalExpectedPerHit = calculateFinalDamage(expectedPerHit);

            // 多段攻撃の合計（1段ごとに計算して合計）
            const finalMaxTotal = finalMaxPerHit * calculationResult.hits;
            const finalExpectedTotal = finalExpectedPerHit * calculationResult.hits;

            return (
              <>
                {/* 基本情報 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {/* ダメージスキル: 1hit最大 / 回復スキル: 1回復量 */}
                  <div className="p-3 bg-gradient-to-br from-red-900/30 to-pink-900/30 rounded-lg border border-red-600/30">
                    <p className="text-xs text-red-400 mb-1">
                      {calculationResult.type === 'heal' ? '1回復量' : '1hit最大'}
                    </p>
                    <p className={`text-xl font-bold ${calculationResult.type === 'heal' ? 'text-green-400' : 'text-red-300'}`}>
                      {calculationResult.type === 'damage' ? maxPerHit.toLocaleString() : calculationResult.damagePerHit.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-400 mb-1">ヒット数</p>
                    <p className="text-xl font-bold text-white">
                      {calculationResult.hits}
                      {calculationResult.isVariableHits && <span className="text-xs text-yellow-400 ml-1">(要入力)</span>}
                    </p>
                  </div>
                  {/* 複数ヒット時: 合計最大 / 1ヒット時: 空欄または回復量表示 */}
                  {calculationResult.hits > 1 ? (
                    <div className="p-3 bg-gradient-to-br from-rose-900/40 to-red-900/40 rounded-lg border border-rose-500/40">
                      <p className="text-xs text-rose-400 mb-1">
                        {calculationResult.type === 'heal' ? '合計回復量' : `全段(${calculationResult.hits}hit)最大`}
                      </p>
                      <p className={`text-xl font-bold ${calculationResult.type === 'heal' ? 'text-green-400' : 'text-rose-300'}`}>
                        {calculationResult.type === 'damage' ? maxDamage.toLocaleString() : calculationResult.totalDamage.toLocaleString()}
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-gray-700/30 rounded-lg border border-gray-600/30">
                      <p className="text-xs text-gray-500 mb-1">合計</p>
                      <p className="text-xl font-bold text-gray-500">
                        -
                      </p>
                    </div>
                  )}
                  <div className="p-3 bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-400 mb-1">MP / CT</p>
                    <p className="text-lg font-bold text-blue-400">
                      {calculationResult.mpCost} / {calculationResult.coolTime.toFixed(1)}s
                    </p>
                  </div>
                </div>

                {/* 期待値（ダメージスキルのみ） */}
                {calculationResult.type === 'damage' && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="p-3 bg-gradient-to-br from-yellow-900/30 to-orange-900/30 rounded-lg border border-yellow-600/30">
                      <p className="text-xs text-yellow-400 mb-1">
                        1hit期待値
                        <span className="text-gray-500 ml-1">
                          (ダメ補正{damageCorrectionMin}〜{damageCorrectionMax}% / 会心{Math.round(critRate * 100)}%)
                        </span>
                      </p>
                      <p className="text-2xl font-bold text-yellow-300">
                        {expectedPerHit.toLocaleString()}
                      </p>
                    </div>
                    {/* 複数ヒットの場合は全段期待値も表示 */}
                    {calculationResult.hits > 1 ? (
                      <div className="p-3 bg-gradient-to-br from-amber-900/40 to-yellow-900/40 rounded-lg border border-amber-500/40">
                        <p className="text-xs text-amber-400 mb-1">
                          全段({calculationResult.hits}hit)期待値
                        </p>
                        <p className="text-2xl font-bold text-amber-300">
                          {expectedDamage.toLocaleString()}
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 bg-gray-700/30 rounded-lg border border-gray-600/30">
                        <p className="text-xs text-gray-500 mb-1">合計期待値</p>
                        <p className="text-xl font-bold text-gray-500">
                          -
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* 最終ダメージ（敵ステータス考慮、ダメージスキルのみ） */}
                {calculationResult.type === 'damage' && hasEnemyStats && (
                  <div className="mt-4 p-4 bg-gradient-to-br from-emerald-900/30 to-teal-900/30 border border-emerald-500/40 rounded-lg">
                    <h5 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                      <span>🎯</span>
                      最終ダメージ（敵ステータス考慮）
                    </h5>
                    <p className="text-xs text-gray-400 mb-3">
                      守備力: {enemyDefense} / 攻撃耐性: {enemyTypeResistance}% / 属性耐性: {enemyAttributeResistance}%
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-gray-800/50 rounded-lg">
                        <p className="text-xs text-emerald-400 mb-1">1hit期待値</p>
                        <p className="text-2xl font-bold text-emerald-300">
                          {finalExpectedPerHit.toLocaleString()}
                        </p>
                      </div>
                      <div className="p-3 bg-gray-800/50 rounded-lg">
                        <p className="text-xs text-teal-400 mb-1">1hit最大</p>
                        <p className="text-2xl font-bold text-teal-300">
                          {finalMaxPerHit.toLocaleString()}
                        </p>
                      </div>
                      {calculationResult.hits > 1 && (
                        <>
                          <div className="p-3 bg-gray-800/50 rounded-lg">
                            <p className="text-xs text-emerald-400 mb-1">全段({calculationResult.hits}hit)期待値</p>
                            <p className="text-2xl font-bold text-emerald-300">
                              {finalExpectedTotal.toLocaleString()}
                            </p>
                          </div>
                          <div className="p-3 bg-gray-800/50 rounded-lg">
                            <p className="text-xs text-teal-400 mb-1">全段({calculationResult.hits}hit)最大</p>
                            <p className="text-2xl font-bold text-teal-300">
                              {finalMaxTotal.toLocaleString()}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {/* バフ効果 */}
          {calculationResult.buffEffects && Object.keys(calculationResult.buffEffects).length > 0 && (
            <div className="p-4 bg-blue-900/30 border border-blue-500/30 rounded-lg">
              <h5 className="text-sm font-semibold text-blue-400 mb-2">バフ効果</h5>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(calculationResult.buffEffects).map(([stat, value]) => (
                  <div key={stat} className="flex justify-between text-sm">
                    <span className="text-gray-400">{stat}:</span>
                    <span className="text-blue-300">+{Math.floor(value).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              {selectedSkill.definition.Duration && (
                <p className="text-xs text-gray-500 mt-2">
                  持続時間: {selectedSkill.definition.Duration}秒
                </p>
              )}
            </div>
          )}

          {/* デバフ効果 */}
          {calculationResult.debuffEffects && Object.keys(calculationResult.debuffEffects).length > 0 && (
            <div className="p-4 bg-purple-900/30 border border-purple-500/30 rounded-lg">
              <h5 className="text-sm font-semibold text-purple-400 mb-2">デバフ効果</h5>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(calculationResult.debuffEffects).map(([stat, value]) => (
                  <div key={stat} className="flex justify-between text-sm">
                    <span className="text-gray-400">{stat}:</span>
                    <span className="text-purple-300">-{Math.floor(value).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DoT効果 */}
          {calculationResult.dotEffect && (
            <div className="p-4 bg-red-900/30 border border-red-500/30 rounded-lg">
              <h5 className="text-sm font-semibold text-red-400 mb-2">継続ダメージ (DoT)</h5>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-gray-400">回数:</span>
                  <span className="ml-2 text-red-300">{calculationResult.dotEffect.count}</span>
                </div>
                <div>
                  <span className="text-gray-400">1回:</span>
                  <span className="ml-2 text-red-300">{calculationResult.dotEffect.damagePerTick.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-400">合計:</span>
                  <span className="ml-2 text-red-300">{calculationResult.dotEffect.totalDotDamage.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Extra効果（追加ダメージなど） */}
          {calculationResult.extraEffects && Object.keys(calculationResult.extraEffects).length > 0 && (() => {
            // 敵ステータスが設定されているか
            const hasEnemyStats = enemyDefense > 0 || enemyTypeResistance !== 0 || enemyAttributeResistance !== 0;

            // Extra式文字列を取得（BaseDamage判定用）
            const extraFormulas = selectedSkill.definition.Extra || {};

            return (
              <div className="p-4 bg-gradient-to-br from-amber-900/20 to-yellow-900/20 border border-amber-500/30 rounded-lg">
                <h5 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
                  <span>⚡</span>
                  追加効果
                </h5>
                <div className="space-y-3">
                  {Object.entries(calculationResult.extraEffects).map(([key, value]) => {
                    // Extra効果の基礎値
                    const baseValue = Math.floor(value);

                    // この式がBaseDamageを含むかどうかを判定
                    const formula = extraFormulas[key] || '';
                    const containsBaseDamage = formula.includes('BaseDamage');

                    // BaseDamageを含まない式の場合：単一値のみ出力（会心/ダメージ補正なし）
                    if (!containsBaseDamage) {
                      return (
                        <div key={key} className="p-3 bg-gray-800/50 rounded-lg">
                          <p className="text-xs text-gray-400 mb-2">{key}</p>
                          <div className="text-center">
                            <p className="text-xl font-bold text-amber-300">
                              {baseValue.toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">（会心/ダメージ補正なし）</p>
                          </div>
                        </div>
                      );
                    }

                    // BaseDamageを含む式の場合：最大値と期待値を出力
                    // ※ BaseDamageには既に会心ダメージが含まれているため、会心補正は掛けない
                    // ダメージ補正: 武器値（例: 80）~ 100%の範囲
                    const damageCorrectionMin = storeWeaponStats?.damageCorrection || 80;
                    const damageCorrectionMax = 100;
                    const avgDamageCorrection = ((damageCorrectionMin + damageCorrectionMax) / 2) / 100;

                    // 1hit最大（ダメ補正100%）
                    const maxDamage = Math.floor(baseValue * (damageCorrectionMax / 100));

                    // 1hit期待値（ダメ補正平均）
                    const expectedDamage = Math.floor(baseValue * avgDamageCorrection);

                    return (
                      <div key={key} className="p-3 bg-gray-800/50 rounded-lg">
                        <p className="text-xs text-gray-400 mb-2">{key}</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="text-center">
                            <p className="text-xs text-amber-400 mb-1">1hit最大</p>
                            <p className="text-xl font-bold text-amber-300">
                              {maxDamage.toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500">補正100%</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-yellow-400 mb-1">1hit期待値</p>
                            <p className="text-xl font-bold text-yellow-300">
                              {expectedDamage.toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500">補正{damageCorrectionMin}%-100%</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ユーティリティスキル */}
          {calculationResult.type === 'utility' && (
            <div className="p-4 bg-gray-700/50 rounded-lg text-center">
              <p className="text-gray-400">
                このスキルはダメージ・回復・バフ/デバフを持たないユーティリティスキルです
              </p>
              {calculationResult.mpCost > 0 && (
                <p className="text-sm text-blue-400 mt-2">
                  MP消費: {calculationResult.mpCost}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
