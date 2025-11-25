# Minecraft RPG 計算機
## 通常攻撃・スキルダメージ計算仕様書(Skill & Damage Spec)v1.0

本ドキュメントは、
武器種ごとの **通常攻撃ダメージ式** と
各種スキルの **ダメージ計算ロジック** を定義する。

ステータス・装備計算(UserXXX / WeaponXXX)の詳細は
`spec-equipment-calc.md` および `spec-placeholder-mapping.md` を参照。

---

# 1. 共通ルール

## 1.1 プレースホルダー

本仕様書中の変数はすべて以下のプレースホルダー形式で表記される:

```text
{UserPower}, {UserMagic}, {WeaponAttackPower}, {DamageCorrection}, ...
```

有効なプレースホルダー一覧は spec-placeholder-mapping.md を参照。

## 1.2 基本概念

基礎ダメージ(BasedDamage)
各武器種ごとの「通常攻撃 1 発分の基礎値」。この値をスキルが参照する。

Hit数
Multi-hit のスキルは、基礎ダメージに倍率を掛け、その結果を Hit 数分繰り返す。

追撃
武器・スキル固有の「元の攻撃のX% × n 回」等で定義。

丸め
損失を避けるため、

シングルヒット:最終結果に対して丸め

マルチヒット:Hit毎に丸めるかどうかを設定で切り替え可能(デフォルト:Hit毎)

## 2. 通常攻撃(武器種別)

### 2.1 剣(Sword)

```
BasedDamage.Sword =
  ( {WeaponAttackPower} + {UserPower} * 1.6 )
  * {DamageCorrection}
  * ( 1 + {WeaponCritDamage}/100 + {UserCritDamage} * 0.005 )
```

### 2.2 杖(Staff)

```
BasedDamage.Staff =
  ( {WeaponAttackPower} + {UserMagic} * 1.75 )
  * {DamageCorrection}
  * ( 1 + {WeaponCritDamage}/100 + {UserCritDamage} * 0.0016 )
```

### 2.3 弓(Bow)

```
BasedDamage.Bow =
  ( {WeaponAttackPower} + {UserPower} * 1.75 )
  * {DamageCorrection}
  * ( 1 + {WeaponCritDamage}/100 + {UserCritDamage} * 0.0016 )
```

### 2.4 斧(Axe)

```
BasedDamage.Axe =
  ( {WeaponAttackPower} + {UserPower} * 1.5 + {UserMind} * 2.5 )
  * {DamageCorrection}
  * ( 1 + {WeaponCritDamage}/100 + {UserCritDamage} * 0.001 )
```

### 2.5 大剣(GreatSword)

```
BasedDamage.GreatSword =
  ( {WeaponAttackPower} + {UserPower} * 1.6 + {UserHP} * 3.1 )
  * {DamageCorrection}
  * ( 1 + {WeaponCritDamage}/100 + {UserCritDamage} * 0.001 )
```

### 2.6 短剣(Dagger)

```
BasedDamage.Dagger =
  ( {WeaponAttackPower} + {UserPower} * 1.25 + {UserSpeed} * 3.5 )
  * {DamageCorrection}
  * ( 1 + {WeaponCritDamage}/100 + {UserCritDamage} * 0.0015 )
```

### 2.7 槍(Spear)

```
BasedDamage.Spear =
  (
    ( ({UserCritRate} + {WeaponCritRate} + 100) * {UserDefense} * 8 / 300 )
    + ({UserPower} / 200)
    + {WeaponAttackPower}
  )
  * {DamageCorrection}
  * ( 1 + ( {WeaponCritDamage}/100 + {UserCritDamage} * 0.001 ) / 3 )
```

※ ゲーム内仕様に合わせ、1段目・2段目の攻撃は 式結果の30%のダメージを3回 与える場合がある。
詳細な Hit 挙動は WeaponCalc.yaml で定義する。

### 2.8 フライパン

```
Base =
  ( {WeaponAttackPower} + {UserPower} * 1.6 )
  * {DamageCorrection}
  * 段数補正
  * ( 1 + {WeaponCritDamage}/100 + {UserCritDamage} * 0.005 )

Damage = ROUND(Base) / 2
```

### 2.9 ダイス

```
Damage = 0
```

## 3. 追撃(追加攻撃)

追撃は 「元の攻撃ダメージ」 を入力として定義される。

### 3.1 代表例

剣改:
追撃ダメージ = 元の攻撃 × 22% × 回数

ジェミニ:
追撃ダメージ = 元の攻撃 × 30%

幻影大剣:
追撃ダメージ = 元の攻撃 × 30%

ゼクロ弓:
追撃ダメージ = 元の攻撃 × 22% × ( {UserSpeed} * 0.011 + 2 )

夏武器:
追撃回数 = floor( 水耐性 / 5 )
追撃ダメージ = 元の攻撃 × 22% × 追撃回数

ベス剣:
追撃ダメージ = 元の攻撃 × 10% × 4回 (PvP時は1回)

盗賊斧:
追撃ダメージ = 現在MP × 0.2 × 回数

炎牙:
追撃ダメージ = 元の攻撃 × 5% × 回数(防御貫通)

「回数」の定義は WeaponCalc.yaml にて武器ごとに設定する。

## 4. スキルダメージ

### 4.1 共通ルール

基本的に全攻撃スキルは 通常攻撃のダメージ を参照する。

スキルが対応していない武器種で使用した場合はダメージ減衰 or 使用不可。

本計算機では「対応していないスキルは選択不可」とする。

武器種グループ:

グループ1:剣 / 弓 / 斧

グループ2:杖

### 4.2 代表スキル(例)

#### 4.2.1 ノービス

応急手当

```
Heal = {UserHP} * 0.3
```

戦闘態勢(BP)

```
上昇量(HP,Power,Magic) = (HP,Power,Magic) * 0.05
```

なぎはらい(1)

```
Damage = BasedDamage.Sword * 1.3
```

ぶんまわし(1)

```
Damage = BasedDamage.Bow * 1.4
```

ファイア(2)

```
Damage = (剣基礎ダメージを、Powerの代わりにMagicを用いて計算) * 1.3
```

アイス(2)

```
Damage = BasedDamage.Staff * 1.3
```

#### 4.2.2 ファイター

烈刃の炎斬撃

```
Damage_perHit = BasedDamage.Sword * 0.4
TotalDamage = Damage_perHit * 5
```

常闇斬撃

```
Damage_perHit = BasedDamage.Sword * 0.6
TotalDamage = Damage_perHit * (5〜6回)   # Hit 数はランダム or 装備依存
```

リミット・ブレイク(BP)

```
上昇量(Power, Dex, Defense) = * 0.15
```

#### 4.2.3 ウィザード

ウインド2

```
Damage_perHit = BasedDamage.Staff * 0.65 + {UserMind} * 0.12985
TotalDamage = Damage_perHit * 3
```

ウインドバースト2

```
Damage_perHit = BasedDamage.Staff * 0.65 + {UserMind} * 0.12985
TotalDamage = Damage_perHit * 8
```

ノンエレメント・エクスプロード1

```
Damage = BasedDamage.Staff * MP * 0.03115
```

ノンエレメント・エクスプロード2

```
Damage = BasedDamage.Staff * MP * 0.03185
```

#### 4.2.4 レンジャー

アローレイン2

```
Damage = BasedDamage.Bow * 0.5
```

マリーナレーン2

```
Damage_perHit = BasedDamage.Bow * 0.6
Hits = floor({UserSpeed} / 50) + 8
TotalDamage = Damage_perHit * Hits
```

#### 4.2.5 ハンター

疾風連撃

```
Damage = BasedDamage.Dagger * 0.6 + {UserSpeed} * 0.3
```

疾風の舞3

```
上昇量(Power,Speed,CritDamage) = (各ステータス) * 0.499 + 1
```

その他のスキルは SkillCalc.yaml にスキル ID / 武器種 / 式 を定義し、
同じルールで評価する。

## 5. ケルベロス武器等の固有能力

特定の武器には複雑な自己バフ・HP 消費・スタック管理がある。

例:身を焦がす焼焔

HP が最大 HP の 25% より多い場合:

通常攻撃時、自身の最大 HP の 5%(切り上げ)を消費し、スタックをリセット。

HP が最大 HP の 25% 以下の場合:

通常攻撃時、スタック +1(最大 30)。

スタックが 10 に達した次の攻撃から効果発動。
11,18,25,32,... 回目の攻撃で更新。

ステータス上昇:

```
(器用さ,素早さ)上昇量 =
  (UserCritRate, UserSpeed) * floor(スタック / 10) * 0.15
```

これらのルールは WeaponCalc.yaml に記述し、
ダメージ計算前に該当バフを {UserXXX} に反映する。

## 6. 丸め(Round / RoundUP / RoundDown)

原則:

通常攻撃:1 回分の計算結果を ROUND(四捨五入)

Multi Hit スキル:

デフォルト:Hit ごとに丸め

オプション:最後にのみ丸め(設定フラグで制御)

丸め方は EqConst.yaml の設定:

```
RoundType: Up / Down / Nearest
```

スキル・武器ごとに上書き可能。

## 7. DPS 計算枠

v1.0 では DPS 計算は枠のみ用意し、実装は保留 とする。

将来拡張用に以下を保持:

{WeaponCoolTime}(CT)

スキル CT

バフ持続時間

追撃発動タイミング(発動率・内部CT)

上記を元に「時間軸シミュレーション」ができるよう
データ構造だけ先に設計しておく。
