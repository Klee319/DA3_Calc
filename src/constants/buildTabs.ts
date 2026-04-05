/**
 * ビルドページのタブ設定
 */

export interface BuildTab {
  id: number;
  label: string;
  icon: string;
}

export const BUILD_TABS: BuildTab[] = [
  { id: 0, label: '職業', icon: '👤' },
  { id: 1, label: 'SP割り振り', icon: '📊' },
  { id: 2, label: '武器', icon: '⚔️' },
  { id: 3, label: '防具', icon: '🛡️' },
  { id: 4, label: 'アクセサリー', icon: '💍' },
  { id: 5, label: '紋章・タロット', icon: '🃏' },
  { id: 6, label: 'バフ設定', icon: '✨' },
  { id: 7, label: '最終ステータス', icon: '📈' },
  { id: 8, label: '結果', icon: '🎯' },
];

export const TAB_IDS = {
  JOB: 0,
  SP: 1,
  WEAPON: 2,
  ARMOR: 3,
  ACCESSORY: 4,
  EMBLEM_TAROT: 5,
  BUFF: 6,
  STATS: 7,
  RESULT: 8,
} as const;
