# 実装状況レポート (Implementation Status Report)
**最終更新日**: 2025-11-24  
**バージョン**: v0.3.0

---

## 1. プロジェクト概要

Minecraft RPG ダメージ計算機は、ユーザが装備構成やスキルを設定し、ダメージやステータスを検証・最適化するための Web アプリケーションです。

**技術スタック**:
- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- Zustand (状態管理)

---

## 2. 実装済みページ (Pages)

### 2.1 ページ一覧

| ページパス | ファイル名 | 完成度 | 説明 |
|-----------|-----------|--------|------|
| `/` | `src/app/page.tsx` | 60% | トップページ (Hero セクションのみ) |
| `/build` | `src/app/build/page.tsx` | 70% | ビルド編集画面 (職業選択・SP割り振り・装備スロット) |
| `/damage` | `src/app/damage/page.tsx` | 50% | ダメージ計算画面 (敵入力・スキル選択・結果表示) |
| `/optimize` | `src/app/optimize/page.tsx` | 30% | 最適装備探索画面 (枠のみ実装) |

### 2.2 テストページ

| ページパス | 用途 | 備考 |
|-----------|------|------|
| `/test-data` | データローダーのテスト表示 | 開発用 |
| `/test-loader` | CSV/YAMLローダーの動作確認 | 開発用 |

---

## 3. 実装済みコンポーネント (Components)

### 3.1 コンポーネント一覧 (12個)

| コンポーネント名 | ファイルパス | 完成度 | 主な機能 |
|----------------|-------------|--------|---------|
| **JobSelector** | `src/components/JobSelector.tsx` | 80% | 職業選択ドロップダウン |
| **LevelInput** | `src/components/LevelInput.tsx` | 90% | レベル入力 (数値入力+スライダー) |
| **SPSlider** | `src/components/SPSlider.tsx` | 75% | SP割り振りスライダー (A/B/Cライン) |
| **EquipmentSlot** | `src/components/EquipmentSlot.tsx` | 65% | 装備スロット選択UI (武器・防具・アクセ) |
| **StatViewer** | `src/components/StatViewer.tsx` | 85% | 最終ステータス表示 (HP/Power/Magic等) |
| **CustomSelect** | `src/components/CustomSelect.tsx` | 90% | 汎用プルダウン選択UI |
| **DamageResult** | `src/components/DamageResult.tsx` | 70% | ダメージ計算結果表示 |
| **EnemyInput** | `src/components/EnemyInput.tsx` | 60% | 敵ステータス入力フォーム |
| **SkillSelector** | `src/components/SkillSelector.tsx` | 50% | スキル選択UI (未完成) |
| **NumberInput** | `src/components/ui/NumberInput.tsx` | 95% | 数値入力汎用コンポーネント |
| **Toggle** | `src/components/ui/Toggle.tsx` | 95% | ON/OFFトグルスイッチ |
| **Tooltip** | `src/components/ui/Tooltip.tsx` | 90% | ツールチップ表示 |

---

## 4. 実装済み計算ロジック (Calculation Logic)

### 4.1 statusCalculator (5関数)

| 関数名 | 完成度 | 機能 |
|--------|--------|------|
| `calculateBaseStats()` | 90% | 職業・レベルによる基礎ステータス計算 |
| `calculateSPBonus()` | 70% | SP割り振りによるステータス上昇 |
| `calculateEquipmentStats()` | 60% | 装備ステータス合算 |
| `calculateFinalStats()` | 75% | 最終ステータス統合 |
| `applyPercentageModifiers()` | 50% | % 補正適用 (未完成) |

**完成度**: **70%**

### 4.2 damageCalculator (10関数)

| 関数名 | 完成度 | 機能 |
|--------|--------|------|
| `calculateBaseDamage.Sword()` | 85% | 剣の基礎ダメージ計算 |
| `calculateBaseDamage.Staff()` | 85% | 杖の基礎ダメージ計算 |
| `calculateBaseDamage.Bow()` | 85% | 弓の基礎ダメージ計算 |
| `calculateBaseDamage.Axe()` | 80% | 斧の基礎ダメージ計算 |
| `calculateBaseDamage.GreatSword()` | 80% | 大剣の基礎ダメージ計算 |
| `calculateBaseDamage.Dagger()` | 80% | 短剣の基礎ダメージ計算 |
| `calculateBaseDamage.Spear()` | 75% | 槍の基礎ダメージ計算 |
| `calculateCriticalDamage()` | 70% | 会心ダメージ補正 |
| `calculateAdditionalAttacks()` | 50% | 追撃計算 (一部実装) |
| `applyDamageCorrection()` | 80% | ダメージ補正適用 |

**完成度**: **77%**

### 4.3 equipmentCalculator

| 関数名 | 完成度 | 機能 |
|--------|--------|------|
| `calculateWeaponRank()` | 80% | 武器ランク計算 |
| `calculateArmorStats()` | 60% | 防具ステータス計算 (ARMOR式) |
| `calculateArmorEX()` | 50% | 防具EXステータス計算 |
| `calculateAccessoryStats()` | 60% | アクセサリステータス計算 |
| `calculateEmblemStats()` | 40% | 紋章ステータス計算 |
| `calculateRuneStoneStats()` | 30% | ルーンストーン計算 (未完成) |

**完成度**: **53%**

### 4.4 jobCalculator

| 関数名 | 完成度 | 機能 |
|--------|--------|------|
| `getJobBaseStats()` | 85% | 職業基礎ステータス取得 |
| `calculateLevelGrowth()` | 80% | レベル成長計算 |
| `calculateSPAllocation()` | 65% | SP割り振り計算 |
| `getUnlockedSkills()` | 50% | 解放済みスキル一覧取得 |

**完成度**: **70%**

### 4.5 optimize (最適装備探索)

| 関数名 | 完成度 | 機能 |
|--------|--------|------|
| `generateEquipmentCombinations()` | 20% | 装備組み合わせ列挙 (枠のみ) |
| `evaluateBuildDamage()` | 40% | ビルド評価 |
| `findOptimalBuild()` | 10% | 最適解探索 (未実装) |

**完成度**: **23%**

---

## 5. データローダー (Data Loaders)

### 5.1 csvLoader

| 機能 | 完成度 | 対応CSV |
|------|--------|---------|
| 武器データ読み込み | 90% | `DA_EqCalc_Data - 武器.csv` |
| 防具データ読み込み | 85% | `DA_EqCalc_Data - 防具.csv` |
| アクセサリデータ読み込み | 80% | `DA_EqCalc_Data - アクセサリー.csv` |
| 紋章データ読み込み | 70% | `DA_EqCalc_Data - 紋章.csv` |
| ルーンストーンデータ読み込み | 60% | `DA_EqCalc_Data - ルーンストーン.csv` |
| 食べ物データ読み込み | 75% | `DA_EqCalc_Data - 食べ物.csv` |
| 職業CSVデータ読み込み | 65% | 各職業CSV |

**完成度**: **75%**

### 5.2 yamlLoader

| 機能 | 完成度 | 対応YAML |
|------|--------|----------|
| 装備定数読み込み | 80% | `EqConst.yaml` |
| 職業定数読み込み | 75% | `JobConst.yaml` |
| ユーザステータス計算式読み込み | 60% | `UserStatusCalc.yaml` |
| 武器計算式読み込み | 70% | `WeaponCalc.yaml` |
| スキル計算式読み込み | 50% | `SkillCalc.yaml` |

**完成度**: **67%**

---

## 6. ストア (State Management)

### 6.1 buildStore (Zustand)

| 状態 | 完成度 | 説明 |
|------|--------|------|
| `job` | 90% | 選択中の職業 |
| `level` | 95% | 職業レベル |
| `spAllocation` | 80% | SP割り振り (A/B/Cライン) |
| `equipment` | 70% | 装備一式 (武器・防具・アクセ) |
| `food` | 60% | 食事設定 |
| `ring` | 30% | 指輪バフ (未完成) |
| `selectedSkill` | 50% | 選択中スキル |
| `enemyStats` | 60% | 敵ステータス |
| `finalStats` | 75% | 最終ステータス (計算済み) |

**完成度**: **68%**

---

## 7. 機能別完成度サマリー

| カテゴリ | 機能 | 完成度 | 備考 |
|---------|------|--------|------|
| **UI/UX** | トップページ | 60% | Hero セクションのみ |
| | ビルド編集画面 | 70% | タブ構造未完成 |
| | ダメージ計算画面 | 50% | スキル選択UI未完成 |
| | 最適装備探索画面 | 30% | 実装ほぼなし |
| **計算ロジック** | 職業ステータス計算 | 70% | SP計算が不完全 |
| | 武器ランク計算 | 80% | 基本実装済み |
| | 防具計算 (ARMOR式) | 60% | EX計算未完成 |
| | アクセサリ計算 | 60% | EX計算未完成 |
| | 紋章計算 | 40% | 基本実装のみ |
| | ルーンストーン計算 | 30% | 未完成 |
| | 通常攻撃ダメージ | 80% | 主要武器種対応 |
| | スキルダメージ | 50% | 一部スキルのみ |
| | 追撃計算 | 40% | 枠のみ |
| **データ管理** | CSVローダー | 75% | 基本実装済み |
| | YAMLローダー | 67% | 式評価が不完全 |
| | Zustand ストア | 68% | 基本構造完成 |
| **最適化** | 装備探索エンジン | 10% | ほぼ未実装 |

**プロジェクト全体の完成度**: **約 58%**

---

## 8. 未実装機能リスト

### 8.1 高優先度 (High)

- [ ] 防具EXステータス計算の完全実装
- [ ] アクセサリEXステータス計算の実装
- [ ] ルーンストーンシステムの完全実装
- [ ] 食事システムの完全実装
- [ ] 職業SP割り振りの詳細UI (スキル解放表示)
- [ ] スキルダメージ計算の拡充 (主要スキル100個以上)
- [ ] タブ構造による画面分割 (ビルド編集画面)
- [ ] 装備選択時のバリデーション

### 8.2 中優先度 (Medium)

- [ ] 武器追撃システムの完全実装 (22種類)
- [ ] 指輪バフシステム
- [ ] 最適装備探索アルゴリズム
- [ ] Hit数・マルチヒット対応
- [ ] 防具の叩き回数とランク選択UI
- [ ] 敵ステータス・属性耐性システム
- [ ] Local Storage による永続化
- [ ] ナビゲーションヘッダー

### 8.3 低優先度 (Low)

- [ ] DPS計算機能
- [ ] ケルベロス武器等の特殊能力
- [ ] 耐性システムの拡張
- [ ] プログレスバー (最適化実行時)
- [ ] エラーハンドリングの強化
- [ ] パフォーマンス最適化
- [ ] モバイル対応の最適化

---

## 9. 次のマイルストーン (Next Milestones)

### Phase 1 (完成度 70% → 85%) - 推定期間: 3週間

1. 防具・アクセサリのEX計算完全実装
2. ルーンストーン・食事システムの実装
3. SP割り振りUIの強化 (スキル解放表示)
4. スキルダメージ計算の拡充 (主要30スキル対応)
5. タブ構造の実装 (ビルド編集画面)

### Phase 2 (完成度 85% → 95%) - 推定期間: 2週間

1. 武器追撃システムの実装
2. 最適装備探索の基本アルゴリズム実装
3. バリデーション強化
4. Local Storage 永続化
5. デザインシステムの本格適用

### Phase 3 (完成度 95% → 100%) - 推定期間: 1週間

1. DPS計算機能の実装
2. 特殊武器能力の実装
3. エラーハンドリング強化
4. パフォーマンス最適化
5. モバイル対応の調整

---

## 10. 既知の問題・技術的負債

### 10.1 重要度: 高

- **YAML式評価エンジンの不完全性**: 複雑な計算式が正しく評価できない場合がある
- **型安全性の不足**: 一部のデータローダーで型チェックが不十分
- **エラーハンドリングの欠如**: CSV/YAML読み込み失敗時の処理が不完全

### 10.2 重要度: 中

- **パフォーマンス**: 大量の装備組み合わせ計算時に遅延する可能性
- **UI状態管理**: Zustand の状態が肥大化する懸念
- **テストカバレッジ**: 単体テストが不足 (現在約30%)

### 10.3 重要度: 低

- **コードの重複**: 計算ロジックの一部に重複コードあり
- **コメント不足**: 複雑な計算式の説明不足
- **デザインの不統一**: 一部コンポーネントでデザインシステム未適用

---

## 11. リソース・依存関係

### 11.1 完成済みリソース

- ✅ CSV データファイル (武器・防具・アクセ・紋章・ルーン・食事)
- ✅ 仕様書 (spec-equipment-calc.md, spec-skill-damage.md, spec-ui-flow.md)
- ✅ デザインシステム (modanui.md)
- ✅ プレースホルダーマッピング (spec-placeholder-mapping.md)

### 11.2 未完成リソース

- ⚠️ YAML 設定ファイル (EqConst.yaml, UserStatusCalc.yaml 等) - 60%
- ⚠️ 職業CSVファイル - 70%
- ⚠️ スキル計算式YAML (SkillCalc.yaml) - 40%

---

## 12. チーム・開発体制への推奨事項

本プロジェクトは **並列開発** を前提に設計されています。以下の分担が推奨されます:

### 12.1 推奨役割分担

| 担当 | 主な作業内容 | 依存関係 |
|------|-------------|---------|
| **フロントエンドA** | UI/UXコンポーネント開発 | デザインシステム |
| **フロントエンドB** | タブ構造・ナビゲーション実装 | UIコンポーネント |
| **バックエンドA** | 計算ロジック (装備・ステータス) | YAML設定ファイル |
| **バックエンドB** | 計算ロジック (ダメージ・スキル) | CSV・YAMLデータ |
| **データエンジニア** | CSV/YAMLデータ整備・検証 | 仕様書 |
| **アルゴリズムエンジニア** | 最適装備探索エンジン | 計算ロジック完成後 |

### 12.2 並列開発のキーポイント

- **インターフェース定義の厳守**: TypeScript の型定義を先に確定
- **モックデータの活用**: 計算ロジック未完成でもUI開発が進められる
- **モジュール境界の明確化**: `lib/calc/` と `components/` は独立開発可能
- **定期的な統合テスト**: 週1回の結合テストを推奨

---

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2025-11-24 | v0.3.0 | 初版作成 |

---

**次のアクション**: `implementation-plan.md` を参照して、Phase 1 の実装を開始してください。
