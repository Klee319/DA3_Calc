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
      calculatedStats: r.calculatedStats as any,
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

      {/* 結果リスト（折り畳み式） */}
      <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
        {output.results.map((result, index) => {
          const isExpanded = selectedResultIndex === index;

          return (
            <div
              key={result.rank}
              className={`rounded-xl border transition-all duration-200
                ${isExpanded
                  ? 'bg-rpg-accent/10 border-rpg-accent/50 shadow-glow'
                  : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'
                }`}
            >
              {/* ヘッダー（クリックで展開/折り畳み） */}
              <div
                onClick={() => selectResult(isExpanded ? null : index)}
                className="p-4 cursor-pointer flex justify-between items-center"
              >
                <div className="flex items-center gap-3">
                  <span className="text-white/40 text-sm">{isExpanded ? '▼' : '►'}</span>
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
                      期待ダメージ: {Math.round(result.evaluationScore).toLocaleString()}
                    </div>
                    {(() => {
                      const cs = result.calculatedStats as Record<string, number> | undefined;
                      const minDmg = cs?.MinDamage;
                      const maxDmg = cs?.MaxDamage;
                      if (minDmg || maxDmg) {
                        return (
                          <div className="text-xs text-white/50">
                            {minDmg ? `最小: ${Math.round(minDmg).toLocaleString()}` : ''}
                            {minDmg && maxDmg ? ' / ' : ''}
                            {maxDmg ? `最大: ${Math.round(maxDmg).toLocaleString()}` : ''}
                          </div>
                        );
                      }
                      return null;
                    })()}
                    {result.breakdown.dps && (
                      <div className="text-xs text-white/50">
                        DPS: {Math.round(result.breakdown.dps).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
                {!result.meetsMinimum && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
                    制約未達
                  </span>
                )}
              </div>

              {/* 展開時: 装備詳細 */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-2 border-t border-white/5 pt-3">
                  {/* 装備構成 */}
                  {Object.entries((result as any).equipmentSet || {}).map(([slot, detail]) => {
                    if (!detail) return null;
                    const equipDetail = detail as any;
                    const config = equipDetail?.configuration;
                    const stats = equipDetail?.stats;
                    const rawEquipName = equipDetail?.equipment?.name || equipDetail?.name || '-';
                    const equipType = equipDetail?.equipment?.type || equipDetail?.type || '';
                    const armorType = equipDetail?.sourceData?.['タイプを選択'];

                    let equipName = rawEquipName;
                    if (equipType === 'armor' && armorType) {
                      equipName = `${armorType}-${rawEquipName}`;
                    }

                    const slotNameMap: Record<string, string> = {
                      weapon: '武器', head: '頭', body: '胴', leg: '脚',
                      accessory1: 'ネック', accessory2: 'ブレス',
                    };

                    return (
                      <div key={slot} className="p-2 bg-white/5 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-white/40 font-medium">{slotNameMap[slot] || slot}</span>
                          <span className="text-sm text-white/90 font-medium">{equipName}</span>
                        </div>
                        {config && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {config.rank && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-300 rounded">
                                {config.rank}
                              </span>
                            )}
                            {config.enhancement > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded">
                                +{config.enhancement}
                              </span>
                            )}
                            {config.smithing && typeof config.smithing === 'object' && (
                              <>
                                {config.smithing.attackPower > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-300 rounded">
                                    攻撃力叩き×{config.smithing.attackPower}
                                  </span>
                                )}
                                {config.smithing.critRate > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/20 text-orange-300 rounded">
                                    会心率叩き×{config.smithing.critRate}
                                  </span>
                                )}
                                {config.smithing.critDamage > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded">
                                    撃力叩き×{config.smithing.critDamage}
                                  </span>
                                )}
                                {config.smithing.tatakiCount > 0 && stats?._smithingBreakdown?.details?.length > 0 && (
                                  stats._smithingBreakdown.details.map((d: { stat: string; count: number }, idx: number) => (
                                    <span key={idx} className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-300 rounded">
                                      {d.stat}×{d.count}
                                    </span>
                                  ))
                                )}
                              </>
                            )}
                            {config.alchemyEnabled && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded">
                                錬金
                              </span>
                            )}
                          </div>
                        )}
                        {/* EXステータス */}
                        {stats?._ex1Type && (() => {
                          const exNameMap: Record<string, string> = {
                            Power: '力', Magic: '魔力', HP: '体力', Mind: '精神',
                            Agility: '素早さ', Speed: '素早さ', Dex: '器用',
                            Dexterity: '器用', CritDamage: '撃力', Defense: '守備力',
                          };
                          return (
                            <div className="flex flex-wrap gap-1 mt-1">
                              <span className="text-[10px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded">
                                EX1: {exNameMap[stats._ex1Type] || stats._ex1Type} +{stats._ex1Value || 0}
                              </span>
                              {stats._ex2Type && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded">
                                  EX2: {exNameMap[stats._ex2Type] || stats._ex2Type} +{stats._ex2Value || 0}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}

                  {/* 紋章 */}
                  {(() => {
                    const emblem = (result as any).selectedEmblem;
                    if (!emblem) return null;
                    return (
                      <div className="p-2 bg-emerald-500/10 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-white/40 font-medium">紋章</span>
                          <span className="text-sm text-emerald-400 font-medium">{emblem.アイテム名}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {emblem['力（%不要）'] > 0 && <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-300 rounded">力+{emblem['力（%不要）']}%</span>}
                          {emblem['魔力（%不要）'] > 0 && <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded">魔力+{emblem['魔力（%不要）']}%</span>}
                          {emblem['撃力（%不要）'] > 0 && <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded">撃力+{emblem['撃力（%不要）']}%</span>}
                          {emblem['体力（%不要）'] > 0 && <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-300 rounded">体力+{emblem['体力（%不要）']}%</span>}
                        </div>
                        {/* ルーンストーン */}
                        {(result as any).selectedRunestones?.runestones?.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-white/10">
                            <div className="flex flex-wrap gap-1">
                              {(result as any).selectedRunestones.runestones.map((r: { name: string; grade: string }, i: number) => (
                                <span key={i} className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded-lg border border-purple-500/30">
                                  [{i + 1}] {r.name} ({r.grade})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* タロット */}
                  {(() => {
                    const tarot = (result as any).selectedTarot;
                    if (!tarot) return null;
                    return (
                      <div className="p-2 bg-indigo-500/10 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-white/40 font-medium">タロット</span>
                          <span className="text-sm text-indigo-400 font-medium">{tarot.cardName || 'タロット'} Lv20</span>
                        </div>
                        {tarot.subOptions && (
                          <div className="flex flex-wrap gap-1">
                            {tarot.subOptions.map((opt: { name: string; value: number }, i: number) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded">
                                [{i + 1}] {opt.name}+{opt.value}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* SP自動配分 */}
                  {(() => {
                    const cs = result.calculatedStats as Record<string, number> | undefined;
                    const spA = cs?.['_SP_A'];
                    const spB = cs?.['_SP_B'];
                    const spC = cs?.['_SP_C'];
                    if (!spA && !spB && !spC) return null;
                    return (
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/40 font-medium">SP配分</span>
                          <div className="flex gap-2 text-[10px]">
                            {spA ? <span className="px-1.5 py-0.5 bg-red-500/20 text-red-300 rounded">A: {spA}</span> : null}
                            {spB ? <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded">B: {spB}</span> : null}
                            {spC ? <span className="px-1.5 py-0.5 bg-green-500/20 text-green-300 rounded">C: {spC}</span> : null}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 最終ステータス */}
                  {result.calculatedStats && (
                    <div className="pt-2 border-t border-white/10">
                      <h5 className="text-xs font-medium text-white/50 mb-1">最終ステータス</h5>
                      <div className="grid grid-cols-4 gap-2 text-[10px]">
                        {['Power', 'Magic', 'HP', 'Mind', 'Agility', 'Dex', 'CritDamage', 'Defense', 'CritRate'].map(stat => {
                          const calcStats = result.calculatedStats as unknown as Record<string, number> | undefined;
                          const value = calcStats?.[stat];
                          if (!value && value !== 0) return null;
                          const nameMap: Record<string, string> = {
                            Power: '力', Magic: '魔力', HP: '体力', Mind: '精神',
                            Agility: '速さ', Dex: '器用', CritDamage: '撃力', Defense: '守備',
                            CritRate: '会心率',
                          };
                          const isPercent = stat === 'CritRate';
                          return (
                            <div key={stat} className="flex justify-between text-white/60">
                              <span>{nameMap[stat]}</span>
                              <span className={`text-white/80 ${stat === 'CritRate' ? 'text-yellow-400' : ''}`}>
                                {isPercent ? `${Math.round(value * 10) / 10}%` : Math.round(value)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

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
