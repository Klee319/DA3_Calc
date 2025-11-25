# Minecraft RPG 計算機
## CSV / YAML / 日本語名 → プレースホルダー マッピング仕様書 v1.0

本仕様書は、
**CSV(ゲームデータ) → YAML(計算式) → プレースホルダー({...}) → コード(内部変数)**
の変換ルールを完全に統一し、システム実装時のデータ整合性を保証するためのものである。

ここに記載される名称は、ステータス計算、装備合算、スキルダメージ式、武器ダメージ式など、
すべての計算処理における公式な変数名として扱う。

---

# 1. マッピングルール概要

- **CSV のカラム名**(日本語)
　= ゲームデータの入力形式
- **装備単体の内部名**
　= 合算前のその装備固有のステータス名(User は付かない)
- **最終ユーザステータス(UserXXX)**
　= 装備 + 食事 + 職業補正 + スキル補正を全て合算した後に参照される
- **プレースホルダー({VarName})**
　= YAML 内のダメージ式・計算式で使用される正式変数
- **camelCase**
　= コード内部(TS/Python)で管理される変数名

---

# 2. プレースホルダー基本ルール

- プレースホルダーは必ず **`{VariableName}` 形式**に統一する。
- User の付く変数は「最終ステータス」であり、装備単体の値ではない。
- 装備単体名は CamelCase で管理し、合算後 UserXXX に反映される。

---

# 3. ステータス(共通:防具/アクセ/紋章/ルーン/食事)

| CSV 日本語名 | 装備単体内部名 | 最終ステータス名 (User) | プレースホルダー | camelCase |
|--------------|----------------|--------------------------|-------------------|-----------|
| 体力 | HP | UserHP | `{UserHP}` | `userHp` |
| 力 | Power | UserPower | `{UserPower}` | `userPower` |
| 魔力 | Magic | UserMagic | `{UserMagic}` | `userMagic` |
| 精神 | Mind | UserMind | `{UserMind}` | `userMind` |
| 素早さ | Speed | UserSpeed | `{UserSpeed}` | `userSpeed` |
| 器用 | CritRate | UserCritRate | `{UserCritRate}` | `userCritRate` |
| 撃力 | CritDamage | UserCritDamage | `{UserCritDamage}` | `userCritDamage` |
| 守備力 | Defense | UserDefense | `{UserDefense}` | `userDefense` |
| MP | MP | UserMP | `{UserMP}` | `userMp` |
| BP(職業内部値) | BP | UserBP | `{UserBP}` | `userBp` |

**注意:器用(DEX)は UserCritRate に統合する(ゲームルールによる仕様変更)。**

---

# 4. 武器(攻撃計算に使用する単体ステータス)

| CSV 日本語名 | 装備内部名 | 最終ステータス名 | プレースホルダー | camelCase |
|--------------|------------|-------------------|-------------------|-----------|
| 攻撃力(F) | WeaponAttackP | WeaponAttackPower | `{WeaponAttackPower}` | `weaponAttackPower` |
| 会心率(F) | WeaponCritR | WeaponCritRate | `{WeaponCritRate}` | `weaponCritRate` |
| 会心ダメ(F) | WeaponCritD | WeaponCritDamage | `{WeaponCritDamage}` | `weaponCritDamage` |
| ダメージ補正 | DamageCorrection | DamageCorrection | `{DamageCorrection}` | `damageCorrection` |
| CT(F) | WeaponCoolT | WeaponCoolTime | `{WeaponCoolTime}` | `weaponCoolTime` |
| 使用可能Lv | AvailableLv | (直接使用) | - | `availableLv` |
| 武器種 | WeaponType | (直接使用) | - | `weaponType` |

---

# 5. 防具(叩き・クオリティ補正前)

| CSV 日本語名 | 装備内部名 | 合算後 User プレースホルダ |
|--------------|------------|-----------------------------|
| 力 | Power | `{UserPower}` |
| 魔力 | Magic | `{UserMagic}` |
| 精神 | Mind | `{UserMind}` |
| 体力 | HP | `{UserHP}` |
| 素早さ | Speed | `{UserSpeed}` |
| 器用 | CritRate | `{UserCritRate}` |
| 撃力 | CritDamage | `{UserCritDamage}` |
| 守備力 | Defense | `{UserDefense}` |

防具は EqConst.yaml の式によって「ランク → 叩き → 強化 → EX2種」を順に適用し、
最終的に UserXXX に加算される。

---

# 6. アクセサリ(ネックレス・ブレスレット)

防具と同一のマッピングルールを適用する。

| CSV 日本語名 | 装備内部名 | User合算先 |
|--------------|------------|------------|
| 全ステータス項目 | (防具と同じ) | 対応する `{UserXXX}` |

---

# 7. 紋章

| CSV 日本語 | 合算先(User) |
|-------------|----------------|
| 力 | `{UserPower}` |
| 魔力 | `{UserMagic}` |
| 体力 | `{UserHP}` |
| 精神 | `{UserMind}` |
| 素早さ | `{UserSpeed}` |
| 器用 | `{UserCritRate}` |
| 撃力 | `{UserCritDamage}` |
| 守備力 | `{UserDefense}` |

---

# 8. ルーンストーン

| CSV 日本語名 | 合算先(User) | 備考 |
|--------------|-----------------|------|
| 全ステータス | 対応する `{UserXXX}` | |
| 耐性1〜3 | ResistX | 耐性は別システム |

---

# 9. 食べ物(料理)

料理によるバフも全て UserXXX に加算する。

| CSV 日本語名 | User合算先 |
|--------------|------------|
| 力 | `{UserPower}` |
| 魔力 | `{UserMagic}` |
| 体力 | `{UserHP}` |
| 精神 | `{UserMind}` |
| 素早さ | `{UserSpeed}` |
| 器用 | `{UserCritRate}` |
| 撃力 | `{UserCritDamage}` |
| 守備力 | `{UserDefense}` |

---

# 10. 職業(JobConst)

職業スキルツリー CSV の増加値は全て User 側へ加算する。

| CSV 項目 | User合算先 |
|----------|------------|
| HP | `{UserHP}` |
| 力 | `{UserPower}` |
| 魔力 | `{UserMagic}` |
| 精神 | `{UserMind}` |
| 素早さ | `{UserSpeed}` |
| 器用(DEX) | `{UserCritRate}` |
| 撃力 | `{UserCritDamage}` |
| 守備力 | `{UserDefense}` |

---

# 11. 公式プレースホルダー一覧(最終版)

```
{UserHP}
{UserMP}
{UserBP}

{UserPower}
{UserMagic}
{UserMind}
{UserSpeed}
{UserCritRate}
{UserCritDamage}
{UserDefense}

{WeaponAttackPower}
{WeaponCritRate}
{WeaponCritDamage}
{WeaponCoolTime}
{DamageCorrection}
```

---

# 12. 付録:命名規則

### プレースホルダー

```
{CamelCaseStartingWithUppercase}
例: {UserPower}, {WeaponAttackPower}
```

### 内部コード変数

```
camelCaseStartingLowercase
例: userPower, weaponAttackPower
```
