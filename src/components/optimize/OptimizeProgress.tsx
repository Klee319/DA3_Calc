'use client';

import React from 'react';
import { OptimizeProgress as ProgressType } from '@/types/optimize';

interface OptimizeProgressProps {
  progress: ProgressType;
  onCancel?: () => void;
}

const PHASE_LABELS: Record<string, string> = {
  initializing: '初期化中',
  filtering: 'フィルタリング中',
  building_pool: '候補プール構築中',
  greedy: '初期解構築中',
  local_search: 'ルーン×紋章 探索中',
  beam_search: 'Beam Search 探索中',
  beam_refine: '詳細化中',
  finalizing: '多様解生成中',
  completed: '完了',
  cancelled: 'キャンセル',
  error: 'エラー',
};

// スロット名の日本語変換
const SLOT_LABELS: Record<string, string> = {
  weapon: '武器',
  head: '頭',
  body: '胴',
  leg: '脚',
  accessory1: 'ネック',
  accessory2: 'ブレス',
  emblem: '紋章',
  tarot: 'タロット',
};

export function OptimizeProgress({ progress, onCancel }: OptimizeProgressProps) {
  const isRunning = progress.phase !== 'completed' &&
                    progress.phase !== 'cancelled' &&
                    progress.phase !== 'error';

  return (
    <div
      className="glass-card p-6 space-y-4"
      role="region"
      aria-label="最適化進捗"
      aria-live="polite"
    >
      {/* フェーズ表示 */}
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-white" aria-label="現在のフェーズ">
          {PHASE_LABELS[progress.phase] || progress.phase}
        </span>
        <span className="text-sm text-white/60" aria-label="経過時間">
          {Math.round(progress.elapsedTime / 1000)}秒
        </span>
      </div>

      {/* プログレスバー */}
      <div
        className="relative h-2 bg-white/10 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={progress.percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`最適化進捗: ${progress.percentage}%`}
      >
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300
            ${progress.phase === 'error' ? 'bg-red-500' :
              progress.phase === 'cancelled' ? 'bg-yellow-500' :
              'bg-gradient-to-r from-rpg-accent to-indigo-500'}`}
          style={{ width: `${progress.percentage}%` }}
        />
      </div>

      {/* Beam Search スロット進捗 */}
      {(progress.phase === 'beam_search' || progress.phase === 'beam_refine') && (
        <div className="flex flex-wrap gap-1 text-[10px]">
          {['weapon', 'head', 'body', 'leg', 'accessory1', 'accessory2', 'emblem', 'tarot'].map((slot) => {
            const isCurrent = progress.currentSlot === slot;
            const isCompleted = progress.current > ['weapon', 'head', 'body', 'leg', 'accessory1', 'accessory2', 'emblem', 'tarot'].indexOf(slot);
            return (
              <span
                key={slot}
                className={`px-1.5 py-0.5 rounded ${
                  isCurrent ? 'bg-rpg-accent/30 text-rpg-accent font-bold' :
                  isCompleted ? 'bg-emerald-500/20 text-emerald-400' :
                  'bg-white/5 text-white/30'
                }`}
              >
                {SLOT_LABELS[slot] || slot}
              </span>
            );
          })}
        </div>
      )}

      {/* Beam統計 */}
      {progress.beamSize !== undefined && progress.phase === 'beam_search' && (
        <div className="flex gap-3 text-[10px] text-white/50">
          <span>Beam幅: <span className="text-white/70">{progress.beamSize}</span></span>
          {progress.prunedCount !== undefined && (
            <span>枝刈り: <span className="text-white/70">{progress.prunedCount}</span></span>
          )}
          {progress.slotPhase && (
            <span>段階: <span className="text-white/70">{progress.slotPhase === 'coarse' ? '粗い探索' : '詳細化'}</span></span>
          )}
        </div>
      )}

      {/* メッセージ */}
      <div className="flex justify-between items-center">
        <span className="text-sm text-white/60" aria-label="進捗メッセージ">
          {progress.message}
        </span>
        <span className="text-sm text-rpg-accent font-medium">{progress.percentage}%</span>
      </div>

      {/* 現在の最良期待ダメージ */}
      {progress.currentBest > 0 && (
        <div className="text-sm text-white/60" aria-label="現在の最良期待ダメージ">
          現在の最良期待ダメージ: <span className="text-emerald-400 font-medium">
            {Math.round(progress.currentBest).toLocaleString()}
          </span>
        </div>
      )}

      {/* 中間結果：現在の最良装備構成（30秒ごとに更新） */}
      {progress.intermediateEquipment && (
        <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <div className="text-xs text-emerald-400 font-medium mb-2">
            📊 現在の最良装備構成
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {Object.entries(progress.intermediateEquipment).map(([slot, name]) => (
              name && (
                <div key={slot} className="flex items-center gap-1.5">
                  <span className="text-white/40">{SLOT_LABELS[slot] || slot}:</span>
                  <span className="text-white/80 truncate">{name}</span>
                </div>
              )
            ))}
          </div>
          {/* 中間ステータス */}
          {progress.intermediateStats && (
            <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-emerald-500/20">
              {progress.intermediateStats.Power !== undefined && progress.intermediateStats.Power > 0 && (
                <span className="text-[10px] text-red-300">力:{progress.intermediateStats.Power}</span>
              )}
              {progress.intermediateStats.Magic !== undefined && progress.intermediateStats.Magic > 0 && (
                <span className="text-[10px] text-blue-300">魔:{progress.intermediateStats.Magic}</span>
              )}
              {progress.intermediateStats.HP !== undefined && progress.intermediateStats.HP > 0 && (
                <span className="text-[10px] text-green-300">体:{progress.intermediateStats.HP}</span>
              )}
              {progress.intermediateStats.Agility !== undefined && progress.intermediateStats.Agility > 0 && (
                <span className="text-[10px] text-yellow-300">速:{progress.intermediateStats.Agility}</span>
              )}
              {progress.intermediateStats.CritDamage !== undefined && progress.intermediateStats.CritDamage > 0 && (
                <span className="text-[10px] text-purple-300">撃:{progress.intermediateStats.CritDamage}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* キャンセルボタン */}
      {isRunning && onCancel && (
        <button
          type="button"
          onClick={onCancel}
          aria-label="最適化をキャンセル"
          className="w-full py-2.5 px-4 bg-red-500/10 border border-red-500/30 rounded-xl
                     text-red-400 hover:bg-red-500/20 transition-all text-sm
                     focus:outline-none focus:ring-2 focus:ring-red-500/30"
        >
          キャンセル
        </button>
      )}
    </div>
  );
}
