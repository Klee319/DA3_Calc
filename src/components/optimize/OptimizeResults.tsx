'use client';

import React from 'react';
import { useOptimizeStore } from '@/store/optimizeStore';
import { OptimizeResultItem } from '@/types/optimize';
import { generateOptimizeResultCSV } from '@/lib/calc/optimize';

interface OptimizeResultsProps {
  results?: OptimizeResultItem[];
  onApplyResult?: (result: OptimizeResultItem) => void;
  totalUsedSP?: number;
}

export function OptimizeResults({ results: propResults, onApplyResult, totalUsedSP }: OptimizeResultsProps) {
  const {
    output,
    selectedResultIndex,
    selectResult,
    // 入力設定（サマリー表示用）
    selectedJobName,
    jobGrade,
    runestoneBonus,
  } = useOptimizeStore();

  if (!output || output.results.length === 0) {
    // 警告がある場合は表示
    if (output?.warnings && output.warnings.length > 0) {
      return (
        <div className="text-center py-12">
          <div className="mb-4 p-4 bg-yellow-500/20 border border-yellow-500/40 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-400 mb-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-bold">警告</span>
            </div>
            {output.warnings.map((warning, idx) => (
              <p key={idx} className="text-yellow-300 text-sm">{warning}</p>
            ))}
          </div>
          <p className="text-white/40">条件を変更して再度最適化を実行してください。</p>
        </div>
      );
    }
    return (
      <div className="text-center py-12 text-white/40">
        結果がありません。最適化を実行してください。
      </div>
    );
  }

  const handleExportCSV = () => {
    // OptimizeResultItem を OptimizeResult 形式に変換
    const results = output.results.map(r => ({
      rank: r.rank,
      build: {} as any,
      equipment: {},
      expectedDamage: r.evaluationScore,
      calculatedStats: r.breakdown as any,
      damageDetails: {
        baseDamage: r.breakdown.expectedDamage || 0,
        critRate: 0,
        hitRate: 100,
      },
    }));

    const csv = generateOptimizeResultCSV(results);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `optimize_results_${Date.now()}.csv`;
    link.click();
  };

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gradient from-white to-gray-300">
          結果 ({output.results.length}件)
        </h3>
        <button
          onClick={handleExportCSV}
          className="text-sm text-white/50 hover:text-white transition-colors"
        >
          CSVエクスポート
        </button>
      </div>

      {/* 統計情報 */}
      <div className="grid grid-cols-3 gap-3 text-sm text-white/50 bg-white/5 rounded-xl p-3">
        <div>
          候補数: <span className="text-white/70">{output.searchStats.totalCandidates.toLocaleString()}</span>
        </div>
        <div>
          評価数: <span className="text-white/70">{output.searchStats.evaluatedCombinations.toLocaleString()}</span>
        </div>
        <div>
          時間: <span className="text-white/70">{Math.round(output.searchStats.elapsedTime / 1000)}秒</span>
        </div>
      </div>

      {/* 入力設定サマリー */}
      <div className="p-3 bg-white/5 rounded-xl border border-white/10">
        <h4 className="text-xs font-medium text-white/50 mb-2">計算設定</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          {/* 職業 */}
          {selectedJobName && (
            <div className="flex items-center gap-1.5">
              <span className="text-white/40">職業:</span>
              <span className="text-white/70">{selectedJobName}</span>
              {jobGrade && <span className="text-white/30">({jobGrade})</span>}
            </div>
          )}
          {/* SP振り分け */}
          {totalUsedSP !== undefined && totalUsedSP > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-white/40">SP:</span>
              <span className="text-blue-400/80">
                {totalUsedSP}P使用
              </span>
            </div>
          )}
          {/* ルーンストーン */}
          {runestoneBonus && Object.keys(runestoneBonus).length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-white/40">ルーン:</span>
              <span className="text-purple-400/80">
                {Object.entries(runestoneBonus)
                  .filter(([_, v]) => v !== 0)
                  .map(([k, v]) => `${k.slice(0, 2)}+${v}`)
                  .slice(0, 3)
                  .join(' ')}
                {Object.entries(runestoneBonus).filter(([_, v]) => v !== 0).length > 3 && '...'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 結果リスト */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
        {output.results.map((result, index) => (
          <div
            key={result.rank}
            onClick={() => selectResult(index)}
            className={`p-4 rounded-xl border cursor-pointer transition-all duration-200
              ${selectedResultIndex === index
                ? 'bg-rpg-accent/10 border-rpg-accent/50 shadow-glow'
                : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'
              }`}
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <span className={`text-lg font-bold
                  ${result.rank === 1 ? 'text-yellow-400' :
                    result.rank === 2 ? 'text-gray-300' :
                    result.rank === 3 ? 'text-orange-400' :
                    'text-white/40'}`}
                >
                  #{result.rank}
                </span>
                <div>
                  <div className="text-sm font-medium text-white">
                    スコア: {Math.round(result.evaluationScore).toLocaleString()}
                  </div>
                  {result.breakdown.expectedDamage && (
                    <div className="text-xs text-white/60">
                      期待ダメージ: {Math.round(result.breakdown.expectedDamage).toLocaleString()}
                    </div>
                  )}
                  {(result.calculatedStats as Record<string, number> | undefined)?.MaxDamage ? (
                    <div className="text-xs text-white/60">
                      最大ダメージ: {Math.round((result.calculatedStats as Record<string, number>).MaxDamage).toLocaleString()}
                    </div>
                  ) : null}
                  {result.breakdown.dps && (
                    <div className="text-xs text-white/60">
                      DPS: {Math.round(result.breakdown.dps).toLocaleString()}
                    </div>
                  )}
                  {result.breakdown.targetStatValue !== undefined && (
                    <div className="text-xs text-white/60">
                      {result.breakdown.targetStatName}: {result.breakdown.targetStatValue}
                    </div>
                  )}
                </div>
              </div>

              {onApplyResult && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onApplyResult(result);
                  }}
                  className="px-3 py-1.5 text-xs bg-emerald-500/10 border border-emerald-500/30
                             rounded-lg text-emerald-400 hover:bg-emerald-500/20 transition-all"
                >
                  適用
                </button>
              )}
            </div>

            {/* 差分表示 */}
            {result.diff && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <span className={`text-xs ${result.diff.scoreDiff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {result.diff.scoreDiff >= 0 ? '+' : ''}{Math.round(result.diff.scoreDiff).toLocaleString()}
                  (現在比)
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 選択中の結果詳細 */}
      {selectedResultIndex !== null && output.results[selectedResultIndex] && (
        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          {/* 紋章・ルーンストーンの表示 */}
          {(() => {
            const result = output.results[selectedResultIndex] as any;
            const emblem = result.selectedEmblem;
            const selectedRunestones = result.selectedRunestones;
            if (!emblem && (!selectedRunestones || selectedRunestones.runestones?.length === 0)) return null;
            return (
              <div className="mb-4 p-3 bg-gradient-to-r from-emerald-500/10 to-purple-500/10 rounded-lg border border-emerald-500/20">
                <div className="flex flex-wrap gap-4 items-center">
                  {emblem && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/50">紋章:</span>
                      <span className="text-sm font-medium text-emerald-400">{emblem.アイテム名}</span>
                      {/* 紋章のボーナス表示 */}
                      <div className="flex flex-wrap gap-1 ml-2">
                        {emblem['力（%不要）'] > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-300 rounded">力+{emblem['力（%不要）']}%</span>
                        )}
                        {emblem['魔力（%不要）'] > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded">魔力+{emblem['魔力（%不要）']}%</span>
                        )}
                        {emblem['体力（%不要）'] > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-300 rounded">体力+{emblem['体力（%不要）']}%</span>
                        )}
                        {emblem['撃力（%不要）'] > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded">撃力+{emblem['撃力（%不要）']}%</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {/* ルーンストーン表示 */}
                {selectedRunestones && selectedRunestones.runestones?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-white/50">ルーンストーン:</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedRunestones.runestones.map((rune: { name: string; grade: string }, idx: number) => (
                        <span
                          key={idx}
                          className="text-xs px-2 py-1 bg-purple-500/20 text-purple-300 rounded-lg border border-purple-500/30"
                        >
                          {rune.name} <span className="text-purple-400/60">({rune.grade})</span>
                        </span>
                      ))}
                    </div>
                    {/* ルーンストーン合計ボーナス */}
                    {selectedRunestones.totalBonus && Object.keys(selectedRunestones.totalBonus).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(selectedRunestones.totalBonus)
                          .filter(([, value]) => value && (value as number) > 0)
                          .map(([stat, value]) => (
                            <span key={stat} className="text-[10px] px-1.5 py-0.5 bg-purple-500/10 text-purple-300/80 rounded">
                              {stat}+{value as number}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          <h4 className="text-sm font-medium text-white mb-3">装備構成</h4>
          <div className="space-y-3">
            {Object.entries((output.results[selectedResultIndex] as any).equipmentSet || {}).map(([slot, detail]) => {
              if (!detail) return null;
              const equipDetail = detail as any;
              const config = equipDetail?.configuration;
              const stats = equipDetail?.stats;
              const rawEquipName = equipDetail?.equipment?.name || equipDetail?.name || '-';
              const equipType = equipDetail?.equipment?.type || equipDetail?.type || '';
              // sourceDataは equipDetail.sourceData に格納されている
              // equipDetailの構造: { name, type, sourceData, configuration, stats }
              const armorType = equipDetail?.sourceData?.['タイプを選択'];

              // 防具の場合は「タイプ-名前」形式で表示（例: 革-砂塵）
              let equipName = rawEquipName;
              if (equipType === 'armor' && armorType) {
                equipName = `${armorType}-${rawEquipName}`;
              }

              // スロット名の日本語マッピング
              const slotNameMap: Record<string, string> = {
                weapon: '武器',
                head: '頭',
                body: '胴',
                leg: '脚',
                accessory1: 'ネックレス',
                accessory2: 'ブレスレット',
              };

              return (
                <div key={slot} className="p-2 bg-white/5 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white/40 font-medium">{slotNameMap[slot] || slot}</span>
                    <span className="text-sm text-white/90 font-medium">{equipName}</span>
                  </div>

                  {/* 構成詳細 */}
                  {config && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {/* ランク */}
                      {config.rank && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-300 rounded">
                          {config.rank}
                        </span>
                      )}
                      {/* 強化値 */}
                      {config.enhancement > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded">
                          +{config.enhancement}
                        </span>
                      )}
                      {/* 叩き配分（武器用：攻撃力/会心率/会心ダメージ） */}
                      {config.smithing && typeof config.smithing === 'object' && (
                        <>
                          {config.smithing.attackPower !== undefined && config.smithing.attackPower > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-300 rounded">
                              攻撃力叩き×{config.smithing.attackPower}
                            </span>
                          )}
                          {config.smithing.critRate !== undefined && config.smithing.critRate > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/20 text-orange-300 rounded">
                              会心率叩き×{config.smithing.critRate}
                            </span>
                          )}
                          {config.smithing.critDamage !== undefined && config.smithing.critDamage > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded">
                              会心ダメ叩き×{config.smithing.critDamage}
                            </span>
                          )}
                          {/* 防具の叩き回数（ステータス別表示） */}
                          {config.smithing.tatakiCount !== undefined && config.smithing.tatakiCount > 0 && (
                            stats._smithingBreakdown?.details?.length > 0 ? (
                              // 新形式：ステータス別配分表示
                              stats._smithingBreakdown.details.map((detail: { stat: string; count: number }, statIdx: number) => (
                                <span
                                  key={statIdx}
                                  className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-300 rounded"
                                >
                                  {detail.stat}×{detail.count}
                                </span>
                              ))
                            ) : stats._smithingBreakdown?.affectedStats?.length > 0 ? (
                              // 旧形式互換：全ステータスに同じ回数（非推奨）
                              stats._smithingBreakdown.affectedStats.map((stat: string, statIdx: number) => (
                                <span
                                  key={statIdx}
                                  className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-300 rounded"
                                >
                                  {stat}×{stats._smithingBreakdown.tatakiCount}
                                </span>
                              ))
                            ) : (
                              // フォールバック：従来表示
                              <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-300 rounded">
                                防具叩き×{config.smithing.tatakiCount}
                              </span>
                            )
                          )}
                        </>
                      )}
                      {/* 錬金 */}
                      {config.alchemyEnabled && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded">
                          錬金
                        </span>
                      )}
                    </div>
                  )}

                  {/* EXステータス（防具・アクセサリー） */}
                  {stats && stats._ex1Type && (() => {
                    // EXステータス名の日本語変換
                    const exStatNameMap: Record<string, string> = {
                      Power: '力',
                      Magic: '魔力',
                      HP: '体力',
                      Mind: '精神',
                      Agility: '素早さ',
                      Speed: '素早さ',
                      Dex: '器用',
                      Dexterity: '器用',
                      CritDamage: '撃力',
                      Defense: '守備力',
                    };
                    const ex1JP = exStatNameMap[stats._ex1Type] || stats._ex1Type;
                    const ex2JP = stats._ex2Type ? (exStatNameMap[stats._ex2Type] || stats._ex2Type) : null;
                    return (
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className="text-[10px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded">
                          EX1: {ex1JP} +{stats._ex1Value || 0}
                        </span>
                        {ex2JP && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded">
                            EX2: {ex2JP} +{stats._ex2Value || 0}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>

          {/* 最終ステータス */}
          {output.results[selectedResultIndex].calculatedStats && (
            <div className="mt-4 pt-3 border-t border-white/10">
              <h5 className="text-xs font-medium text-white/50 mb-2">最終ステータス</h5>
              <div className="grid grid-cols-4 gap-2 text-[10px]">
                {['Power', 'Magic', 'HP', 'Mind', 'Agility', 'Dex', 'CritDamage', 'Defense'].map(stat => {
                  const calcStats = output.results[selectedResultIndex].calculatedStats as unknown as Record<string, number> | undefined;
                  const value = calcStats?.[stat];
                  if (!value && value !== 0) return null;
                  const statNameMap: Record<string, string> = {
                    Power: '力',
                    Magic: '魔力',
                    HP: '体力',
                    Mind: '精神',
                    Agility: '素早さ',
                    Dex: '器用',
                    CritDamage: '撃力',
                    Defense: '守備力',
                  };
                  return (
                    <div key={stat} className="flex justify-between text-white/60">
                      <span>{statNameMap[stat] || stat}</span>
                      <span className="text-white/80">{Math.round(value)}</span>
                    </div>
                  );
                })}
              </div>
              {/* デバッグ: ステータス内訳 */}
              {(() => {
                const calcStats = output.results[selectedResultIndex].calculatedStats as unknown as Record<string, number> | undefined;
                const dexFinal = calcStats?.['Dex'] ?? 0;
                const dexEquip = calcStats?.['_debug_Dex_equipment'] ?? -1;
                const dexRune = calcStats?.['_debug_Dex_runestone'] ?? -1;
                const dexJob = calcStats?.['_debug_Dex_job'] ?? -1;
                const dexSP = calcStats?.['_debug_Dex_sp'] ?? -1;
                const spA = calcStats?.['_debug_SP_A'] ?? -1;
                const spB = calcStats?.['_debug_SP_B'] ?? -1;
                const spC = calcStats?.['_debug_SP_C'] ?? -1;
                const spBonusPower = calcStats?.['_debug_spBonus_Power'] ?? -1;
                const spBonusMagic = calcStats?.['_debug_spBonus_Magic'] ?? -1;
                const jobBonusDex = calcStats?.['_debug_jobBonus_Dex'] ?? -1;
                const emblemBonusDex = calcStats?.['_debug_emblemBonus_Dex'] ?? -1;
                const hasEmblem = calcStats?.['_debug_hasEmblem'] ?? 0;
                // ルーンストーンボーナス
                const runePower = calcStats?.['_debug_rune_Power'] ?? 0;
                const runeMagic = calcStats?.['_debug_rune_Magic'] ?? 0;
                const runeCritDmg = calcStats?.['_debug_rune_CritDamage'] ?? 0;
                // 職業基礎
                const jobPower = calcStats?.['_debug_job_Power'] ?? 0;
                const jobMagic = calcStats?.['_debug_job_Magic'] ?? 0;
                // 装備合計
                const equipPower = calcStats?.['_debug_equip_Power'] ?? 0;
                const equipMagic = calcStats?.['_debug_equip_Magic'] ?? 0;
                const equipCritDmg = calcStats?.['_debug_equip_CritDamage'] ?? 0;
                // 武器パラメータ
                const wpAtk = calcStats?.['_debug_weapon_attackPower'] ?? 0;
                const wpCrit = calcStats?.['_debug_weapon_critRate'] ?? 0;
                const wpCritDmg = calcStats?.['_debug_weapon_critDamage'] ?? 0;
                const wpCT = calcStats?.['_debug_weapon_coolTime'] ?? 0;
                const wpDmgCorr = calcStats?.['_debug_weapon_damageCorrection'] ?? 0;
                // 各スロットの力
                const slotPower = {
                  weapon: calcStats?.['_debug_slot_weapon_Power'] ?? 0,
                  head: calcStats?.['_debug_slot_head_Power'] ?? 0,
                  body: calcStats?.['_debug_slot_body_Power'] ?? 0,
                  leg: calcStats?.['_debug_slot_leg_Power'] ?? 0,
                  acc1: calcStats?.['_debug_slot_acc1_Power'] ?? 0,
                  acc2: calcStats?.['_debug_slot_acc2_Power'] ?? 0,
                };
                // 各スロットの魔力
                const slotMagic = {
                  weapon: calcStats?.['_debug_slot_weapon_Magic'] ?? 0,
                  head: calcStats?.['_debug_slot_head_Magic'] ?? 0,
                  body: calcStats?.['_debug_slot_body_Magic'] ?? 0,
                  leg: calcStats?.['_debug_slot_leg_Magic'] ?? 0,
                  acc1: calcStats?.['_debug_slot_acc1_Magic'] ?? 0,
                  acc2: calcStats?.['_debug_slot_acc2_Magic'] ?? 0,
                };
                // 各スロットの守備力
                const slotDef = {
                  head: calcStats?.['_debug_slot_head_Defense'] ?? 0,
                  body: calcStats?.['_debug_slot_body_Defense'] ?? 0,
                  leg: calcStats?.['_debug_slot_leg_Defense'] ?? 0,
                };
                // 防具タイプ（1=布, 2=革, 3=金属）
                const armorTypeMap = (t: number) => t === 1 ? '布' : t === 2 ? '革' : t === 3 ? '金属' : '?';
                const armorTypes = {
                  head: armorTypeMap(calcStats?.['_debug_armor_head_type'] ?? 0),
                  body: armorTypeMap(calcStats?.['_debug_armor_body_type'] ?? 0),
                  leg: armorTypeMap(calcStats?.['_debug_armor_leg_type'] ?? 0),
                };
                return (
                  <div className="mt-2 p-2 bg-yellow-500/10 rounded text-[10px]">
                    <div className="text-yellow-400 font-medium mb-1">デバッグ情報</div>
                    <div className="text-white/60">SP配分: A={spA}, B={spB}, C={spC}</div>
                    <div className="text-white/60">SPボーナス: 力={spBonusPower}, 魔={spBonusMagic}</div>
                    <div className="text-white/60 mt-1">ルーンストーン: 力={runePower}, 魔={runeMagic}, 撃力={runeCritDmg}</div>
                    <div className="text-white/60">職業基礎: 力={jobPower}, 魔={jobMagic}</div>
                    <div className="text-white/60">装備合計: 力={equipPower}, 魔={equipMagic}, 撃力={equipCritDmg}</div>
                    <div className="text-white/60 mt-1">器用さ内訳:</div>
                    <div className="text-white/60 pl-2">最終={dexFinal}, 装備={dexEquip}, ルーン={dexRune}, 職業={dexJob}, SP={dexSP}</div>
                    <div className="text-white/60 mt-1">%補正:</div>
                    <div className="text-white/60 pl-2">職業Dex={jobBonusDex}%, 紋章Dex={emblemBonusDex}%, 紋章あり={hasEmblem}</div>
                    <div className="text-white/60 mt-1">武器:</div>
                    <div className="text-white/60 pl-2">攻撃力={wpAtk}, 会心率={wpCrit}%, 会心ダメ={wpCritDmg}%, CT={wpCT}, 補正={wpDmgCorr}</div>
                    <div className="text-white/60 mt-1">スロット別 [タイプ] 力/魔/守:</div>
                    <div className="text-white/60 pl-2">武器: {slotPower.weapon}/{slotMagic.weapon}</div>
                    <div className="text-white/60 pl-2">頭[{armorTypes.head}]: {slotPower.head}/{slotMagic.head}/{slotDef.head}</div>
                    <div className="text-white/60 pl-2">胴[{armorTypes.body}]: {slotPower.body}/{slotMagic.body}/{slotDef.body}</div>
                    <div className="text-white/60 pl-2">脚[{armorTypes.leg}]: {slotPower.leg}/{slotMagic.leg}/{slotDef.leg}</div>
                    <div className="text-white/60 pl-2">装飾1: {slotPower.acc1}/{slotMagic.acc1}</div>
                    <div className="text-white/60 pl-2">装飾2: {slotPower.acc2}/{slotMagic.acc2}</div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* 警告メッセージ */}
      {output.warnings && output.warnings.length > 0 && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
          <div className="text-sm text-yellow-400 font-medium mb-2">警告</div>
          <ul className="text-xs text-yellow-300/70 list-disc list-inside space-y-1">
            {output.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
