# Minecraft RPG 計算機
## 装備計算仕様書(Equipment Calculation Spec)v1.0

本ドキュメントは、「Minecraft RPG ダメージ計算機」における
**装備関連の全計算ロジック** を定義する。

- 対象:武器、防具、アクセサリ、紋章、ルーンストーン、EX ステータス、食事(料理)、強化・叩き・クオリティ
- 入力:CSV(DA_EqCalc_Data 系)、各種 YAML(EqConst.yaml / UserStatusCalc.yaml / WeaponCalc.yaml / JobConst.yaml など)
- 出力:ユーザ最終ステータス(UserXXX)および、武器最終ステータス(WeaponXXX)

プレースホルダー名やステータス名の詳細は
`spec-placeholder-mapping.md` を参照すること。

---

## 1. データフロー概要

1. CSV を読み込み、装備単体の「基礎値(F ランク)」を取得
2. ランク・叩き・強化・EX などの式を適用して「装備最終値」を算出
3. 全装備(武器、防具、アクセ、紋章、ルーン、食事)を合算
4. 職業初期値・レベル固定成長・SP 割当による職業補正を加算
5. 指輪・料理などの収束型バフを適用
6. ゲーム内ルールに基づく％補正を適用
7. 最終的なユーザステータス `{UserHP}`, `{UserPower}`, `{UserCritDamage}` などが決まる
8. 武器に関しては、ランクによる攻撃力補正などを行い、`{WeaponAttackPower}` などが決まる

---

## 2. 武器計算

### 2.1 入力(武器 CSV)

DA_EqCalc_Data - 武器.csv

| カラム名 | 説明 |
|----------|------|
| アイテム名 | 武器名(一意キー) |
| ドロップかどうか | TRUE/FALSE。ドロップなら叩き不可 |
| 武器種 | 剣 / 弓 / 杖 / 斧 / 大剣 / 短剣 / 槍 |
| 使用可能Lv | AvailableLv。ランク計算で使用 |
| 攻撃力(F) | WeaponAttackP(基礎攻撃力・Fランク) |
| 会心率(F) | WeaponCritR |
| 会心ダメージ(F) | WeaponCritD |
| ダメージ補正(初期値) | DamageCorrection の基礎値 |
| ct(クオリティF) | WeaponCoolT(クールタイム) |

※ 変数名マッピングは `spec-placeholder-mapping.md` を参照。

### 2.2 武器ランク計算式

武器の攻撃力は、F ランクの基礎値とレベルからランクごとに計算する。

#### 2.2.1 ランク係数

係数 k_Rank は以下のとおり:

| Rank | k_Rank (分数) | 小数 |
|------|---------------|------|
| F    | 0             | 0          |
| E    | 0             | 0          |
| D    | 1/15          | ≒ 0.0667  |
| C    | 1/15          | ≒ 0.0667  |
| B    | 2/25          | 0.08      |
| A    | 2/25          | 0.08      |
| S    | 3/35          | ≒ 0.0857  |
| SS   | 1/11          | ≒ 0.0909  |
| SSS  | 1/10          | 0.1       |

#### 2.2.2 計算式(攻撃力)

```text
Atk(Rank) = ROUNDUP( WeaponAttackP + AvailableLv * k_Rank )
```

ROUNDUP は小数点以下切り上げ

WeaponAttackP は CSV の「攻撃力(F)」

AvailableLv は CSV の「使用可能Lv」

計算結果を {WeaponAttackPower} として扱う。

#### 2.2.3 その他の武器ステータス

{WeaponCritRate}
= WeaponCritR(※ランクによる補正を掛ける場合は EqConst.yaml / UserStatusCalc.yaml のルールに従う)

{WeaponCritDamage}
= WeaponCritD

{WeaponCoolTime}
= WeaponCoolT(ランクや強化による変化がある場合は設定ファイルで別途式を定義)

{DamageCorrection}
= ダメージ補正(基礎値 + ランク・強化等の補正)

これらの補正ロジック(ランク補正・強化による Correction 上昇など)は
EqConst.yaml および UserStatusCalc.yaml の定義に従って実装する。

## 3. 防具計算(頭・胴・足)

### 3.1 入力(防具 CSV)

DA_EqCalc_Data - 防具.csv

カラム名	説明
アイテム名	防具名
使用可能Lv	Lv
部位を選択	Head / Body / Leg
タイプ	布 / 革 / 金属
力(初期値)	Power
魔力(初期値)	Magic
体力(初期値)	HP
精神(初期値)	Mind
素早さ(初期値)	Speed
器用(初期値)	CritRate
撃力(初期値)	CritDamage
守備力(初期値)	Defense

### 3.2 叩き回数とランクの考慮

ゲーム仕様:

ランク:F〜SSS

叩き回数:0〜12(SS を超えると叩きを増やせる)

叩き値 はランクと部位により変わる:

通常ステータス:叩き回数 × 2

守備力:叩き回数 × 1

### 3.3 ARMOR ステータス計算式

式(確定):

```
実数値 = ROUND( (基礎値 + 叩き) × ( 1 + (基礎値 + 叩き)^0.2 × (ランク値 / Lv) ) )
```

ROUND は四捨五入

基礎値:CSV の F ランク値

叩き:叩き回数 × 2(守備は ×1)

ランク値:
SSS=8, SS=7, S=6, A=5, B=4, C=3, D=2, E=1, F=0

Lv:使用可能レベル

この計算を、防具が持つ全ステータス(Power / Magic / HP / Mind / Speed / CritRate / CritDamage / Defense)に対して適用する。

## 4. 防具 EX ステータス

防具には EX ステータスが 2 種類付与される(例:器用 + 撃力 など)。

EX 計算式(確定):

```
EX実数値 = ROUND( Lv × ランクEX係数 + 1 )
```

### 4.1 ランクEX係数

器用:

ランク	係数
SSS	0.15
SS	0.13
S	0.11
AB	0.09
CD	0.07
EF	0.05

撃力・素早さ:

ランク	係数
SSS	0.6
SS	0.5
S	0.4
AB	0.3
CD	0.2
EF	0.1

その他(HP, Power など):

ランク	係数
SSS	0.7
SS	0.6
S	0.5
AB	0.4
CD	0.3
EF	0.2

EX の種類とそのランクは CSV または別設定で管理し、
UserStatusCalc.yaml に従って {UserHP}, {UserPower} などに加算する。

## 5. アクセサリ(ネックレス・ブレスレット)

### 5.1 入力(アクセサリ CSV)

DA_EqCalc_Data - アクセサリー.csv

カラム名	説明
アイテム名	アクセ名
使用可能Lv	Lv
タイプ	Necklace / Bracelet
体力(初期値)	HP
力(初期値)	Power
魔力(初期値)	Magic
精神(初期値)	Mind
撃力(初期値)	CritDamage
素早さ(初期値)	Speed

### 5.2 メインステータス式

```
実数値 = ROUND( 基礎値 + (Lv / ランク補正) )
```

ランク補正テーブル:

ランク	補正値
SSS	10
SS	11
S	12
A/B	13
C/D	15
E/F	基礎値そのまま(補正なし)

### 5.3 アクセ EX 計算式

```
EX実数値 = ROUND( ランク係数 × Lv ) + 1
```

EX のランク係数は防具 EX の「EX 実数値 = ROUND(Lv × ランクEX係数 + 1)」と同様のルール(器用 / 撃力 / その他)に従う。

## 6. 紋章

### 6.1 入力(紋章 CSV)

DA_EqCalc_Data - 紋章.csv

カラム名	説明
アイテム名	紋章名
使用可能Lv	Lv
各ステータス	HP / Power / Magic / Mind / Speed / CritRate / CritDamage / Defense

### 6.2 計算

紋章のステータスは % ではなく実数値 であり、
装備と同様に {UserXXX} に単純加算する。

## 7. ルーンストーン

### 7.1 入力(ルーンストーン CSV)

DA_EqCalc_Data - ルーンストーン.csv

カラム名	説明
グレード	Normal / Buster / Great / Replica
力〜守備力	各種ステータス加算
耐性1〜3	属性耐性 + 値

### 7.2 装着制限

紋章にはルーンストーンを最大 4 つまで嵌められる。

グレードカテゴリごとに 1 個まで:
Normal / Buster / Great / Replica それぞれ 1つまで。

### 7.3 計算ルール

ステータス:
ルーンの Power / Magic / HP などは単純加算して {UserXXX} に加算。

耐性:
耐性システムは別モジュール。
ここでは「耐性配列」として持ち、ダメージ軽減計算側で参照する。

## 8. 食事(料理)

### 8.1 入力(食べ物 CSV)

DA_EqCalc_Data - 食べ物.csv

カラム名	説明
アイテム名	食事名
力〜守備力	各種ステータス加算
耐性1〜n	各種耐性加算

### 8.2 適用

ユーザが食事を選択している場合のみ適用。

切り替え:ON/OFF トグル。

計算上は全ステータスを {UserXXX} に加算する。

## 9. 職業と SP によるステータス

職業関連の詳細は JobConst.yaml と職業 CSV にて管理される。

### 9.1 基本ルール

Lv1 あたり SP を 2 獲得。

レベルアップにより HP/Power/Magic/Mind などの基礎値も増加。

SP は A/B/C ラインに自由に割り振り可能。

行単位で「必要 SP」と「増加ステータス」が職業 CSV で定義される。

### 9.2 職業 CSV 例

```
解放段階,必要SP,解放スキル名,体力,力,精神,...
初期値,,10,,6
補正値(%),,3,-3
A-1,10,スキルA1,10,0,...
A-2,20,スキルA2,20,5,...
...
B-1,10,スキルB1,...
```

### 9.3 計算

各ライン(A/B/C)に割り当てた SP 合計を元に解放された段階までの
ステータスを合算し、最終的に {UserHP}, {UserPower} などに加算する。

スキル解放条件(必要SP)は spec-skill-damage.md 側で参照される。

## 10. 最終ステータス合成順序

最終的な {UserXXX} は以下の順に合成される:

1. 職業初期値
2. 職業レベルによる固定成長
3. 職業 SP 割当による補正
4. 武器(武器自体のステータス)
5. 防具(ARMOR + EX)
6. アクセサリ(メイン + EX)
7. 紋章
8. ルーンストーン
9. 食事
10. 指輪(収束型バフ。例:特定ステータスの%上昇)
11. 職業固有の％ボーナス(例:全ステータス+X% など)

この順序を守って {UserXXX} を計算することで、
ダメージ計算側(通常攻撃・スキル計算)で矛盾なく利用できる。
