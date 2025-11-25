# DA_calc 技術詳細

## 修正した計算式の詳細

### 1. 武器ランク計算 (`src/lib/calc/equipmentCalculator.ts` lines 215-224)

**修正前（誤り）**:
```typescript
const attackPowerBase = roundUp(
  baseAttackP + (weapon.使用可能Lv * rankCoeff) / 320
);
```

**修正後（正しい）**:
```typescript
const rankCoeff = (eqConst.Weapon.Rank as any)?.Coeff?.[rank] || 0;
const attackPowerBase = roundUp(
  baseAttackP + weapon.使用可能Lv * rankCoeff
);
```

**k_Rank係数** (`data/formula/EqConst.yaml`):
```yaml
F: 0
E: 0
D: 0.0667   # 1/15
C: 0.0667   # 1/15
B: 0.08     # 2/25
A: 0.08     # 2/25
S: 0.0857   # 3/35
SS: 0.0909  # 1/11
SSS: 0.1    # 1/10
```

### 2. 防具ステータス計算 (`src/lib/calc/equipmentCalculator.ts` lines 325-375)

**ARMOR計算式**:
```
最終値 = ROUND((基礎値 + 叩き値) × (1 + (基礎値 + 叩き値)^0.2 × (ランク値 / Lv)))
```

**対象ステータス（8種）**:
- 力（初期値）
- 魔力（初期値）
- 体力（初期値）
- 精神（初期値）
- 素早さ（初期値）
- 器用（初期値）
- 撃力（初期値）
- 守備力（初期値）

**叩き値係数**:
- 守備力: 1
- その他: 2

### 3. アクセサリーステータス計算 (`src/lib/calc/equipmentCalculator.ts` lines 391-461)

**計算式**:
```
最終値 = 基礎値 + ランク補正値
```

**ランク補正テーブル**:
| ランク | 叩き値1 | 叩き値2 | 叩き値3 | 叩き値4 | 叩き値5 |
|--------|---------|---------|---------|---------|---------|
| 1      | 0       | 1       | 2       | 3       | 4       |
| 2      | 1       | 2       | 3       | 4       | 5       |
| ...    | ...     | ...     | ...     | ...     | ...     |

**対象ステータス（6種）**:
- 体力（初期値）
- 力（初期値）
- 魔力（初期値）
- 精神（初期値）
- 撃力（初期値）
- 素早さ（初期値）

## プレースホルダーマッピング

### 統一前後の対応表 (`src/lib/calc/placeholderMapping.ts`)

| 旧名称 | 新名称 | 説明 |
|--------|--------|------|
| HP | UserHP | ユーザーHP |
| Power | UserPower | ユーザー力 |
| Magic | UserMagic | ユーザー魔力 |
| Stamina | UserStamina | ユーザー体力 |
| Spirit | UserSpirit | ユーザー精神 |
| Agility | UserSpeed | ユーザー素早さ |
| Dex | UserCritRate | ユーザークリティカル率 |
| AttackP | UserAttackP | ユーザー撃力 |
| Defense | UserDefense | ユーザー守備力 |

### 更新したファイル
1. `src/lib/calc/damageCalculator.ts`
2. `src/lib/calc/statusCalculator.ts`
3. `data/formula/WeaponCalc.yaml`
4. `data/formula/SkillCalc.yaml`

## データ構造の変更

### ArmorData（防具）

**変更前**:
```typescript
interface ArmorData {
  HP: number;
  defense: number;
  resistances: { [key: string]: number };
}
```

**変更後**:
```typescript
interface ArmorData {
  アイテム名: string;
  使用可能Lv: number;
  部位を選択: string;
  タイプを選択: string;
  力（初期値）: number;
  魔力（初期値）: number;
  体力（初期値）: number;
  精神（初期値）: number;
  素早さ（初期値）: number;
  器用（初期値）: number;
  撃力（初期値）: number;
  守備力（初期値）: number;
}
```

### AccessoryData（アクセサリー）

**変更前**:
```typescript
interface AccessoryData {
  stat: string;
  value: number;
}
```

**変更後**:
```typescript
interface AccessoryData {
  アイテム名: string;
  使用可能Lv: number;
  タイプを選択: string;
  体力（初期値）: number;
  力（初期値）: number;
  魔力（初期値）: number;
  精神（初期値）: number;
  撃力（初期値）: number;
  素早さ（初期値）: number;
}
```

## 未実装機能の実装方針

### EXステータス機能

**必要な変更**:

1. **型定義拡張** (`src/types/data.ts`):
```typescript
interface ArmorData {
  // 既存フィールド...
  EX力?: number;
  EX魔力?: number;
  EX体力?: number;
  EX精神?: number;
  EX素早さ?: number;
  EX器用?: number;
  EX撃力?: number;
  EX守備力?: number;
}

interface AccessoryData {
  // 既存フィールド...
  EX体力?: number;
  EX力?: number;
  EX魔力?: number;
  EX精神?: number;
  EX撃力?: number;
  EX素早さ?: number;
}
```

2. **計算式** (`src/lib/calc/equipmentCalculator.ts`):
```typescript
// 防具EX
const exBonus = exValue * (tataki / 2) * (tatakiCoeff / 2);

// アクセサリーEX
const exBonus = exValue * tataki * 0.2;
```

3. **UI追加** (`src/components/build/EquipmentSlot.tsx`):
- EX成長値の表示欄追加

### 追撃システム

**必要な変更**:

1. **型定義拡張** (`src/types/data.ts`):
```typescript
interface WeaponData {
  // 既存フィールド...
  追撃フラグ?: boolean;
  追撃確率?: number;
}
```

2. **計算処理** (`src/lib/calc/damageCalculator.ts`):
```typescript
if (weapon.追撃フラグ && Math.random() < weapon.追撃確率) {
  const followUpDamage = normalAttackDamage * 0.7;
  totalDamage += followUpDamage;
}
```

### リングバフUI統合

**必要な変更**:

1. **状態管理** (`src/store/buildStore.ts`):
```typescript
interface BuildState {
  // 既存フィールド...
  selectedRings: string[];
  activeBuffs: BuffEffect[];
}
```

2. **UI** (`src/components/build/RingSelector.tsx`):
- 新規コンポーネント作成

3. **計算統合**:
- statusCalculator でバフ効果適用
- damageCalculator でバフ込み計算

## テスト情報

- **総テスト数**: 88
- **カテゴリー**:
  - 装備計算: 武器、防具、アクセサリー
  - ステータス計算: 基礎値、成長値
  - ダメージ計算: 通常攻撃、スキル
  - データローダー: CSV読み込み

## 開発環境

- **Next.js**: 14.2.33
- **TypeScript**: strict mode
- **状態管理**: Zustand
- **計算ライブラリ**: MathJS
- **設定形式**: YAML
- **データ形式**: CSV (UTF-8)
- **ポート**: 3001（3000は使用中）
