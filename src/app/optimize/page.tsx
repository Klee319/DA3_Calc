'use client';

import React, { useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useOptimizeStore } from '@/store/optimizeStore';
import { useOptimizeData } from '@/hooks/optimize/useOptimizeData';
import { OptimizeForm } from '@/components/optimize/OptimizeForm';
import { OptimizeConstraints } from '@/components/optimize/OptimizeConstraints';
import { OptimizeResults } from '@/components/optimize/OptimizeResults';
import { OptimizeProgress } from '@/components/optimize/OptimizeProgress';
import { OptimizeSPAllocation } from '@/components/optimize/OptimizeSPAllocation';
import { OptionStatsInput } from '@/components/optimize/OptionStatsInput';

export default function OptimizePage() {
  const {
    isOptimizing,
    output,
    progress,
    error,
    selectedJobName,
    selectedWeaponType,
    availableWeaponTypes,
    spAllocation,
    startOptimization,
    cancelOptimization,
  } = useOptimizeStore();

  // SP合計を計算
  const totalUsedSP = useMemo(() => {
    if (!spAllocation) return 0;
    return Object.values(spAllocation).reduce((sum, sp) => sum + (sp || 0), 0);
  }, [spAllocation]);

  const { isLoading: dataLoading, optimizeData, localGameData, allSkillData, jobList } = useOptimizeData();

  // 選択中の職業のjobSPDataを取得
  const currentJobSPData = useMemo(() => {
    if (!localGameData || !selectedJobName) return undefined;
    return localGameData.csv.jobs.get(selectedJobName);
  }, [localGameData, selectedJobName]);

  // 使用可能なスキルリストを生成（ビルドツール準拠）
  const availableSkills = useMemo(() => {
    if (!allSkillData) return [];

    const skills: Array<{
      id: string;
      name: string;
      weaponType?: string;
      source?: string;
      type?: string;
      multiplier?: number;
      hits?: number;
      coolTime?: number;
      baseDamageType?: string[];
      jobName?: string;
    }> = [];

    // 通常攻撃
    skills.push({
      id: 'normal_attack',
      name: '通常攻撃',
      type: 'normal',
      multiplier: 1.0,
      hits: 1,
      coolTime: 0,
    });

    // 使用する武器種を決定（選択されていればそれ、なければ職業の使用可能武器種）
    const targetWeaponTypes: string[] = selectedWeaponType
      ? [selectedWeaponType]
      : availableWeaponTypes;

    // SkillBookから武器スキルを追加（武器種でフィルタリング）
    if (allSkillData.skillBook) {
      for (const [weaponType, weaponSkills] of Object.entries(allSkillData.skillBook)) {
        // 職業が使用可能な武器種のスキルのみ追加
        if (targetWeaponTypes.length === 0 || targetWeaponTypes.includes(weaponType)) {
          if (weaponSkills && typeof weaponSkills === 'object') {
            for (const [skillName, skillDef] of Object.entries(weaponSkills as Record<string, any>)) {
              const def = skillDef as Record<string, unknown>;
              // ダメージスキルのみ追加（Damageプロパティがあるもの）
              if (def.Damage) {
                const hits = def.Hits;
                let hitsValue = 1;
                if (typeof hits === 'number') {
                  hitsValue = hits;
                } else if (Array.isArray(hits) && hits.length >= 1) {
                  hitsValue = hits[0]; // 最小ヒット数
                }

                skills.push({
                  id: `book_${weaponType}_${skillName}`,
                  name: skillName,
                  weaponType: weaponType,
                  source: 'SkillBook',
                  type: 'weapon',
                  hits: hitsValue,
                  coolTime: typeof def.CT === 'number' ? def.CT : 5,
                  baseDamageType: def.BaseDamageType as string[] | undefined,
                });
              }
            }
          }
        }
      }
    }

    // 職業スキルを追加（選択した職業に対応するスキル）
    const addJobSkills = (jobSkillData: Record<string, Record<string, any>> | undefined, sourceLabel: string) => {
      if (!jobSkillData || !selectedJobName) return;

      // 職業名のマッピング（日本語名→英語名）
      const jobNameMap: Record<string, string> = {
        'ファイター': 'Fighter',
        'メイジ': 'Mage',
        'アーチャー': 'Archer',
        'プリースト': 'Priest',
        'シーフ': 'Thief',
        'ウォリアー': 'Warrior',
        'ナイト': 'Knight',
        'ソーサラー': 'Sorcerer',
        'エレメンタリスト': 'Elementalist',
        'レンジャー': 'Ranger',
        'アサシン': 'Assassin',
        'クレリック': 'Cleric',
        'モンク': 'Monk',
        'パラディン': 'Paladin',
        'ダークナイト': 'DarkKnight',
        'アークメイジ': 'ArchMage',
        'サモナー': 'Summoner',
        'スナイパー': 'Sniper',
        'バード': 'Bard',
        'ハイプリースト': 'HighPriest',
        'セージ': 'Sage',
        'ガーディアン': 'Guardian',
        'スペルリファクター': 'SpellRefactor',
        'ノービス': 'Novice',
        'ステラシャフト': 'StellaShaft',
      };

      const englishJobName = jobNameMap[selectedJobName] || selectedJobName;
      const jobSkills = jobSkillData[englishJobName];

      if (jobSkills && typeof jobSkills === 'object') {
        for (const [skillName, skillDef] of Object.entries(jobSkills)) {
          const def = skillDef as Record<string, unknown>;
          // ダメージスキルのみ追加（Damageプロパティがあるもの）
          if (def.Damage) {
            const hits = def.Hits;
            let hitsValue = 1;
            if (typeof hits === 'number') {
              hitsValue = hits;
            } else if (Array.isArray(hits) && hits.length >= 1) {
              hitsValue = hits[0];
            }

            skills.push({
              id: `job_${sourceLabel}_${skillName}`,
              name: skillName,
              source: sourceLabel,
              type: 'job',
              jobName: selectedJobName,
              hits: hitsValue,
              coolTime: typeof def.CT === 'number' ? def.CT : 5,
              baseDamageType: def.BaseDamageType as string[] | undefined,
            });
          }
        }
      }
    };

    // 各職業スキルを追加
    addJobSkills(allSkillData.specialJob, '特殊職');
    addJobSkills(allSkillData.firstJob, '1次職');
    addJobSkills(allSkillData.secondJob, '2次職');
    addJobSkills(allSkillData.thirdJob, '3次職');

    return skills;
  }, [allSkillData, selectedJobName, selectedWeaponType, availableWeaponTypes]);

  // 最適化開始
  const handleStartOptimization = useCallback(async () => {
    if (!optimizeData) {
      return;
    }
    await startOptimization(optimizeData);
  }, [optimizeData, startOptimization]);

  const isLoading = dataLoading;
  const canStart = !isLoading && !isOptimizing && selectedJobName && optimizeData;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-black/30 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-white/60 hover:text-white transition-colors">
                DA Calculator
              </Link>
              <span className="text-white/30">/</span>
              <h1 className="text-xl font-bold text-gradient from-rpg-accent to-indigo-400">
                装備最適化
              </h1>
            </div>
            <Link
              href="/build"
              className="px-4 py-2 text-sm text-white/70 hover:text-white border border-white/20 rounded-lg hover:border-white/40 transition-all"
            >
              ビルドツール
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-rpg-accent mx-auto mb-4" />
              <p className="text-white/60">データを読み込み中...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 左カラム: 設定 */}
            <div className="lg:col-span-1 space-y-6">
              {/* 基本設定 */}
              <section className="glass-panel p-6 rounded-2xl">
                <h2 className="text-lg font-semibold text-white mb-4">基本設定</h2>
                <OptimizeForm
                  availableJobs={jobList}
                  availableSkills={availableSkills}
                />
              </section>

              {/* SP振り分け */}
              {selectedJobName && (
                <section className="glass-panel p-6 rounded-2xl">
                  <h2 className="text-lg font-semibold text-white mb-4">SP振り分け</h2>
                  <OptimizeSPAllocation jobSPData={currentJobSPData} />
                </section>
              )}

              {/* オプション値 */}
              <section className="glass-panel p-6 rounded-2xl">
                <h2 className="text-lg font-semibold text-white mb-4">オプション値</h2>
                <OptionStatsInput />
              </section>
            </div>

            {/* 中央カラム: 制約条件 */}
            <div className="lg:col-span-1 space-y-6">
              <section className="glass-panel p-6 rounded-2xl">
                <OptimizeConstraints />
              </section>

              {/* 最適化実行ボタン */}
              <div className="space-y-4">
                {error && (
                  <div className="p-4 bg-red-500/20 border border-red-500/40 rounded-xl text-red-300 text-sm">
                    {error}
                  </div>
                )}

                <button
                  onClick={isOptimizing ? cancelOptimization : handleStartOptimization}
                  disabled={!canStart && !isOptimizing}
                  className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 ${
                    isOptimizing
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : canStart
                      ? 'bg-gradient-to-r from-rpg-accent to-indigo-600 hover:from-rpg-accent/90 hover:to-indigo-700 text-white shadow-glow'
                      : 'bg-white/10 text-white/40 cursor-not-allowed'
                  }`}
                >
                  {isOptimizing ? '最適化を中止' : '最適化を開始'}
                </button>

                {!selectedJobName && (
                  <p className="text-center text-white/50 text-sm">
                    職業を選択してください
                  </p>
                )}
              </div>

              {/* 進捗表示 */}
              {isOptimizing && progress && (
                <section className="glass-panel p-6 rounded-2xl">
                  <OptimizeProgress progress={progress} />
                </section>
              )}
            </div>

            {/* 右カラム: 結果 */}
            <div className="lg:col-span-1">
              <section className="glass-panel p-6 rounded-2xl">
                <h2 className="text-lg font-semibold text-white mb-4">最適化結果</h2>
                {output && output.results.length > 0 ? (
                  <OptimizeResults results={output.results} totalUsedSP={totalUsedSP} />
                ) : (
                  <div className="text-center text-white/40 py-8">
                    {isOptimizing
                      ? '最適化中...'
                      : '最適化を実行すると結果がここに表示されます'}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
