# Minecraft RPG 計算機
## データ構造仕様書(Data Structure Spec)v1.0

本ドキュメントは、本システムが扱う **CSV ファイル・YAML 設定・内部データ構造** の仕様を定義する。

---

# 1. データファイル一覧

## 1.1 CSV ファイル

- `DA_EqCalc_Data - 武器.csv`
- `DA_EqCalc_Data - 防具.csv`
- `DA_EqCalc_Data - アクセサリー.csv`
- `DA_EqCalc_Data - 紋章.csv`
- `DA_EqCalc_Data - ルーンストーン.csv`
- `DA_EqCalc_Data - 食べ物.csv`
- 各職業用スキルツリー CSV(例:`ガーディアン.csv` など)

## 1.2 YAML ファイル

- `EqConst.yaml`:係数・丸め・ランク定義などの定数
- `JobConst.yaml`:職業関連の共通定義
- `UserStatusCalc.yaml`:ユーザステータス合成ロジック
- `WeaponCalc.yaml`:武器ランク・固有能力・攻撃関連
- `SkillCalc.yaml`:スキルダメージ式

---

# 2. CSV 共通仕様

- 文字コード:UTF-8
- 区切り文字:`,`(カンマ)
- 1 行目:ヘッダ行(**必須**)
- 2 行目以降:データ行
- 空欄:数値項目の場合は `0` として扱う

---

# 3. 各 CSV 構造

## 3.1 武器(DA_EqCalc_Data - 武器.csv)

| カラム名 | 型 | 説明 |
|----------|----|------|
| アイテム名 | string | 武器名 |
| ドロップかどうか | bool (TRUE/FALSE) | ドロップ武器かどうか |
| 武器種 | string | 剣 / 弓 / 杖 / 斧 / 大剣 / 短剣 / 槍 |
| 使用可能Lv | int | AvailableLv |
| 攻撃力(F) | int | WeaponAttackP |
| 会心率(F) | int | WeaponCritR |
| 会心ダメージ(F) | int | WeaponCritD |
| ダメージ補正(初期値) | float | DamageCorrection |
| ct(クオリティF) | float | WeaponCoolT |

### 内部データ構造(例:TypeScript)

```ts
interface WeaponData {
  itemName: string;
  isDrop: boolean;
  weaponType: "Sword" | "Bow" | "Staff" | "Axe" | "GreatSword" | "Dagger" | "Spear";
  availableLv: number;
  weaponAttackP: number;
  weaponCritR: number;
  weaponCritD: number;
  weaponCorrectionV: number;
  weaponCoolT: number;
}
```

## 3.2 防具(DA_EqCalc_Data - 防具.csv)

| カラム名 | 型 | 説明 |
|----------|----|------|
| アイテム名 | string | 防具名 |
| 使用可能Lv | int | Lv |
| 部位を選択 | string | Head / Body / Leg |
| タイプ | string | 布 / 革 / 金属 |
| 力(初期値) | int | Power |
| 魔力(初期値) | int | Magic |
| 体力(初期値) | int | HP |
| 精神(初期値) | int | Mind |
| 素早さ(初期値) | int | Speed |
| 器用(初期値) | int | CritRate |
| 撃力(初期値) | int | CritDamage |
| 守備力(初期値) | int | Defense |

## 3.3 アクセサリ(DA_EqCalc_Data - アクセサリー.csv)

| カラム名 | 型 | 説明 |
|----------|----|------|
| アイテム名 | string | アクセ名 |
| 使用可能Lv | int | Lv |
| タイプ | string | Necklace / Bracelet |
| 体力(初期値) | int | HP |
| 力(初期値) | int | Power |
| 魔力(初期値) | int | Magic |
| 精神(初期値) | int | Mind |
| 撃力(初期値) | int | CritDamage |
| 素早さ(初期値) | int | Speed |

## 3.4 紋章(DA_EqCalc_Data - 紋章.csv)

| カラム名 | 型 | 説明 |
|----------|----|------|
| アイテム名 | string | 紋章名 |
| 使用可能Lv | int | Lv |
| 力 | int | Power |
| 魔力 | int | Magic |
| 体力 | int | HP |
| 精神 | int | Mind |
| 素早さ | int | Speed |
| 器用 | int | CritRate |
| 撃力 | int | CritDamage |
| 守備力 | int | Defense |

## 3.5 ルーンストーン(DA_EqCalc_Data - ルーンストーン.csv)

| カラム名 | 型 | 説明 |
|----------|----|------|
| グレード | string | Normal / Buster / Great / Replica |
| 力 | int | Power |
| 魔力 | int | Magic |
| 体力 | int | HP |
| 精神 | int | Mind |
| 素早さ | int | Speed |
| 器用 | int | CritRate |
| 撃力 | int | CritDamage |
| 守備力 | int | Defense |
| 耐性1 | string | ResistType1 |
| 値1 | int | ResistValue1 |
| 耐性2 | string | ResistType2 |
| 値2 | int | ResistValue2 |
| 耐性3 | string | ResistType3 |
| 値3 | int | ResistValue3 |

## 3.6 食べ物(DA_EqCalc_Data - 食べ物.csv)

| カラム名 | 型 | 説明 |
|----------|----|------|
| アイテム名 | string | 食事名 |
| 力 | int | Power |
| 魔力 | int | Magic |
| 体力 | int | HP |
| 精神 | int | Mind |
| 素早さ | int | Speed |
| 器用 | int | CritRate |
| 撃力 | int | CritDamage |
| 守備力 | int | Defense |
| 耐性1 | string | ResistType1 |
| 値1 | int | ResistValue1 |
| 耐性2 | string | ResistType2 |
| 値2 | int | ResistValue2 |
| ... | ... | 必要に応じて増加 |

## 3.7 職業 CSV(例:ガーディアン.csv)

| カラム名 | 型 | 説明 |
|----------|----|------|
| 解放段階 | string | A-1, A-2, B-1, C-1 など |
| 必要SP | int | その段階を解放するための必要 SP |
| 解放スキル名 | string | スキル ID / 名前 |
| 体力 | int | HP 増加量 |
| 力 | int | Power 増加量 |
| 精神 | int | Mind 増加量 |
| ... | ... | 他ステータス増加量 |

# 4. YAML 構造概要

## 4.1 EqConst.yaml

ランク係数

防具ランク、EX ランク、アクセランク補正

丸めタイプ(RoundType)

その他、定数群

例:

```yaml
WeaponRank:
  Coeff:
    D: "1/15"
    C: "1/15"
    B: "2/25"
    A: "2/25"
    S: "3/35"
    SS: "1/11"
    SSS: "1/10"
  RoundType: ROUNDUP
```

## 4.2 UserStatusCalc.yaml

ユーザ最終ステータス {UserXXX} の合成ロジック

Initial(初期値)、Equipment(装備)、Food(食事)、Job(職業)、Ring(指輪)などの加算順

防具 ARMOR 式、EX 式、アクセ式など

## 4.3 WeaponCalc.yaml

武器ランク計算ロジック

特殊武器能力(スタック制・HP消費・自己バフ)

武器種ごとの BasedDamage 式

## 4.4 SkillCalc.yaml

スキルごとのダメージ式

対応武器種・Hit 数・CT・消費 MP

スキルカテゴリ(ノービス / ファイター / ウィザード / レンジャー / ハンター 等)

## 4.5 JobConst.yaml

職業ごとの基本定義(最大レベル、使用可能武器、防具タイプ)

職業補正(最終％ボーナスなど)

# 5. 内部オブジェクト構造(例)

```typescript
interface UserStatus {
  hp: number;
  mp: number;
  bp: number;
  power: number;
  magic: number;
  mind: number;
  speed: number;
  critRate: number;
  critDamage: number;
  defense: number;
  // 耐性など
}

interface EquipmentSet {
  weapon: WeaponData | null;
  armorHead: ArmorData | null;
  armorBody: ArmorData | null;
  armorLeg: ArmorData | null;
  necklace: AccessoryData | null;
  bracelet: AccessoryData | null;
  emblem: EmblemData | null;
  runes: {
    normal?: RuneStoneData;
    buster?: RuneStoneData;
    great?: RuneStoneData;
    replica?: RuneStoneData;
  };
  food: FoodData | null;
}
```

# 6. 将来的拡張

敵キャラ用のステータス CSV / YAML

属性・状態異常・耐性システムの拡張

DPS シミュレーション用に「スキル回しシナリオ」構造を追加
