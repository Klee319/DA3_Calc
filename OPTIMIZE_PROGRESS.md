# 装備最適化ページ実装進捗

## 最終更新
2025-01-22 - 全フェーズ完了（ビルド成功）

## 概要
`装備最適化仕様書.md` に基づいた最適化ページの実装

## 固定値設定（確認済み）
- 叩き回数上限: **12**
- 武器強化値: **80**
- 防具強化値: **40**
- 装備ランク: **SSS**
- 錬金: **有効**

## フェーズ進捗

### Phase 1: 型定義 [完了]
- [x] `src/types/optimize.ts` の型定義完備
- [x] OptimizeMode, MinimumStatRequirements, CandidateEquipment 等

### Phase 2: UIコンポーネント [完了]
- [x] `src/app/optimize/page.tsx` - 最適化ページ本体（214行）
  - 3カラムレイアウト
  - データ読み込み、職業選択、スキル選択
  - 最適化実行ボタン、進捗表示
- [x] `src/components/optimize/OptimizeSPAllocation.tsx` - SP振り分け（103行）
  - A/B/C軸のスライダー入力
  - 最大SP制限付き
- [x] `src/components/optimize/OptionStatsInput.tsx` - オプション値入力（102行）
  - 食べ物・バフ等からの追加ステータス
  - クイック設定プリセット

### Phase 3-4: 紋章・ルーンストーン [既存実装活用]
- [x] `src/lib/calc/optimize/emblemRunestone.ts`
  - Pareto支配フィルタリング
  - ルーンストーン組み合わせ生成

### Phase 5-6: 探索アルゴリズム [既存実装活用]
- [x] `src/lib/calc/optimize/search.ts`
  - exhaustiveSearchAsync - 全探索
  - greedyInitialSolution - 貪欲法
  - multiStartGreedyAsync - マルチスタート貪欲法
- [x] `src/lib/calc/optimize/localSearch.ts`
  - 局所探索（改善フェーズ）

### Phase 7: 結果表示 [既存実装活用]
- [x] `src/components/optimize/OptimizeResults.tsx` - 結果表示（469行）
  - 順位表示、スコア表示
  - 装備構成詳細（叩き、EX、紋章、ルーンストーン）
  - CSVエクスポート

### Phase 8: エンジン統合 [既存実装活用]
- [x] `src/lib/calc/optimize/engine.ts` - 最適化エンジン
  - optimizeEquipment() メイン関数
  - 進捗コールバック
  - 依存ステータス分析

### Phase 9: 最終確認 [完了]
- [x] ビルド成功
- [x] /optimize ページアクセス可能

## 主要ファイル一覧

### 新規作成
| ファイル | 説明 | 行数 |
|----------|------|------|
| `src/app/optimize/page.tsx` | 最適化ページ本体 | 214 |
| `src/components/optimize/OptimizeSPAllocation.tsx` | SP振り分けコンポーネント | 103 |
| `src/components/optimize/OptionStatsInput.tsx` | オプション値入力 | 102 |

### 既存活用
| ファイル | 説明 |
|----------|------|
| `src/components/optimize/OptimizeForm.tsx` | 基本設定フォーム |
| `src/components/optimize/OptimizeConstraints.tsx` | 制約条件設定 |
| `src/components/optimize/OptimizeResults.tsx` | 結果表示 |
| `src/components/optimize/OptimizeProgress.tsx` | 進捗表示 |
| `src/lib/calc/optimize/engine.ts` | 最適化エンジン |
| `src/lib/calc/optimize/search.ts` | 探索アルゴリズム |
| `src/lib/calc/optimize/emblemRunestone.ts` | 紋章・ルーンストーン |
| `src/store/optimizeStore.ts` | Zustand状態管理 |
| `src/hooks/optimize/useOptimizeData.ts` | データ読み込みフック |

## 使い方

1. `/optimize` にアクセス
2. 職業を選択（最大レベル自動設定）
3. SP振り分けを設定（余りは自動最適化）
4. 最適化モードを選択（期待値/ステータス/DPS）
5. 必要に応じてオプション値、最小ステータスを設定
6. 「最適化を開始」をクリック
7. 結果が1〜10位まで表示される

## 注意事項

### インポートパス
- `OptimizeGameData` は `@/lib/calc/optimize/engine` から直接インポート
- `optimizeEquipment` は `@/lib/calc/optimize/engine` から直接インポート
- 古い `@/lib/calc/optimize` (optimize.ts) は使用しない

### GameData構造
- ジョブデータ: `gameData.csv.jobs` (Map<string, JobSPData[]>)
- 武器データ: `gameData.csv.weapons`
- 防具データ: `gameData.csv.armors`

### ストアのAPI
- `setSPAllocation()` - 大文字SP
- `cancelOptimization()` - stopではなくcancel
- `userOption` - オプション値（StatBlock型）
