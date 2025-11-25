# DA_calc プロジェクト進捗記録

## 現在の状態（2025-11-24）
- **テスト**: 全88テスト合格 ✅
- **ビルド**: エラーなし ✅
- **開発サーバー**: localhost:3001で稼働中
- **Web動作確認**: 全4ページ正常動作 ✅

## 完了した作業

### 仕様書不一致の修正（優先度S）- 全て完了 ✅

#### 1. データ型定義修正 (`src/types/data.ts`)
- **ArmorData**: 8ステータス構造（力、魔力、体力、精神、素早さ、器用、撃力、守備力）
- **AccessoryData**: 6ステータス構造（体力、力、魔力、精神、撃力、素早さ）

#### 2. 設定ファイル追加 (`data/formula/EqConst.yaml`)
- 武器ランク係数 (k_Rank): F～SSS各ランクの係数追加
- 叩き値係数: Defense=1, Others=2

#### 3. 装備計算修正 (`src/lib/calc/equipmentCalculator.ts`)
- **武器ランク計算**: 誤った`/320`除算を削除、正しいk_Rank係数適用
- **防具計算**: 全8ステータスにARMOR計算式適用
- **アクセサリー計算**: 6ステータスにランク補正テーブル適用

#### 4. プレースホルダー名統一
- `src/lib/calc/placeholderMapping.ts` 新規作成
- 全YAML/TSファイルで `{UserXXX}` 形式に統一
- `UserAgility`→`UserSpeed`, `UserDex`→`UserCritRate` 等

#### 5. CSVローダー更新 (`src/lib/data/csvLoader.ts`)
- 新しい型定義に合わせて更新

### Web動作確認 - 全て完了 ✅
1. **トップページ (/)**: 正常表示
2. **ビルドページ (/build)**: 職業選択、装備スロット全て動作
3. **火力計算ページ (/damage)**: スキル選択、敵パラメータ入力動作
4. **最適化ページ (/optimize)**: 探索条件設定、制約設定動作

## 未実装機能（優先度A）

### A1. EXステータス機能
**仕様書**: `docs/specs/spec-ex-stats.md`
- ArmorData/AccessoryDataにEX成長値フィールド追加
- EX計算式実装:
  - 防具: `EX成長値 × (叩き値 / 2) × (叩き値係数 / 2)`
  - アクセサリー: `EX成長値 × 叩き値 × 0.2`
- UI表示追加

### A2. 追撃システム
**仕様書**: `docs/specs/spec-follow-up-attack.md`
- WeaponDataに追撃フラグ/確率フィールド追加
- 追撃ダメージ計算（通常攻撃の70%）
- 追撃込みダメージのUI表示

### A3. リングバフUI統合
**仕様書**: `docs/specs/spec-ring-buff.md`
- リング選択UI実装（ビルドページ）
- Zustandストアにバフ状態追加
- 計算ロジックへのバフ効果統合

### A4. プレースホルダー名統一の完全適用
- 全YAMLファイルの再確認
- 全計算ロジックでの使用確認
- テストケース更新

## 軽微な問題
- React重複キー警告（`src/components/build/EquipmentSlot.tsx`）
  - 機能には影響なし、優先度低

## 推奨実装順序
1. EXステータス機能（A1）
2. 追撃システム（A2）
3. リングバフUI統合（A3）
4. プレースホルダー完全統一（A4）
5. React警告修正（軽微）

## 重要ファイルパス
```
src/types/data.ts                          # データ型定義
src/lib/calc/equipmentCalculator.ts       # 装備計算ロジック
src/lib/calc/damageCalculator.ts          # ダメージ計算ロジック
src/lib/calc/statusCalculator.ts          # ステータス計算ロジック
src/lib/calc/placeholderMapping.ts        # プレースホルダーマッピング
src/lib/data/csvLoader.ts                 # CSVローダー
data/formula/EqConst.yaml                 # 装備定数設定
data/formula/WeaponCalc.yaml              # 武器計算式
data/formula/SkillCalc.yaml               # スキル計算式
docs/specs/仕様書.txt                      # メイン仕様書
```

## 開発コマンド
- 開発サーバー: `npm run dev`
- ビルド: `npm run build`
- テスト: `npm test`
- 現在の開発サーバーポート: 3001 (3000は使用中)
