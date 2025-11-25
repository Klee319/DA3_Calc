Minecraft RPG 計算機 – UI / 機能仕様書
0. 全体仕様
0-1. ページ構成

キャラビルド / ステータスページ

URL例：/build

職業・SP・装備・バフ・高度設定 → 最終ステータスをリアルタイム算出

火力計算ページ

URL例：/damage

①のビルドを前提に、
敵パラメータ＋使用スキル / 通常攻撃から単発 / コンボ火力を算出

最適化ページ（装備探索）

URL例：/optimize

①の職業・スキル・条件を固定しつつ、
装備・バフ構成の組み合わせ探索 → 期待ダメージ最大のビルド候補を列挙

（任意）装備図鑑ページ /encyclopedia

（任意）管理ページ /admin

0-2. 共通 UI コンポーネント
要素	入力形式
数値入力	number + ステッパー
スライダー	SP割り振り、探索条件の閾値など
トグル	ON/OFF（リング、ご飯バフ等）
ドロップダウン	装備・スキル・職業選択
0-3. 非表示ルール（全ページ共通）

装備

職業が装備できない 武器種 / 防具種は候補に出さない

スキル

現在の職業で取得できない

SP不足で取得条件を満たさない

武器種非対応

武器固有能力

対応武器以外のときは 自動OFF＋グレーアウト

0-4. 計算トリガー

ステータス計算（UserStatusFormula）

職業・レベル・SP・装備・ルーン・バフ・高度設定を変更するたび

キャラビルドページ上で 即時計算

火力計算

火力計算ページの「再計算」ボタン押下で実行

利用する式：

WeaponCalc.BasedDamage

WeaponCalc.JobCorrection

SkillCalc.SkillDefinition

WeaponCalc.FinalDamage

最適化（探索）

最適化ページの「探索開始」押下で実行

内部的には火力計算ロジックを繰り返し呼び出す

1. キャラビルド / ステータスページ（/build）
1-1. 職業・レベル

職業ドロップダウン

JobConst.JobDefinition から読込

選択すると：

その職業の MaxLevel をレベル入力の上限に設定

装備候補（武器/防具）を AvailableWeapons / AvailableArmors でフィルタ

レベル入力

1〜JobDefinition.<Job>.MaxLevel の整数

1-2. SP割り振り

スライダー + 数値ボックス（例：A/B/C 3軸）

合計制約：A + B + C <= JobごとのSP_MAX

エラー時：

赤枠 + エラーメッセージ

ステータス計算は直前の有効値を維持

※ 実際に反映する先は Job.SP.<Stat> にマッピングされる想定（YAML側のJob.Initial / Job.SP を利用）。

1-3. 装備スロット

スロット：
武器 / 頭 / 胴 / 足 / ネックレス / ブレスレット / 紋章 / リング

各スロット UI:

装備名ドロップダウン（職業・部位でフィルタ済み）

[ランク]（SSS〜F）

[叩き（Forge設定）]

「叩きON」チェックで詳細欄展開

各ステータスごとに叩き回数 <ForgeCount> を指定

[強化値（Reinforcement）]

武器：0〜80

頭/胴/足：0〜40

アクセ/紋章/リングなど：強化不可（UI非表示 or disabled）

[錬金の有無] トグル

[使用可能Lv] 表示のみ

計算との対応：

武器 → EquipmentStatusFormula.Weapon.*

防具 → EquipmentStatusFormula.Armor.MainStatus

アクセ → EquipmentStatusFormula.Jewel.MainStatus

EX → EquipmentStatusFormula.EX.RealValue

装備値の合計は SumEquipment.<Stat> として UserStatusFormula に渡す

1-4. 紋章 / ルーン設定

紋章スロット：紋章カテゴリのみ選択可

ルーンを複数スロットで選択

バリデーション：

同カテゴリルーンが重複 →

赤枠＋警告メッセージ

火力計算 / 最適化ボタンを disabled

ルーン・紋章の効果は Emblem.Bonus.<Stat> に集約され、
UserStatusFormula の (1 + Job.Bonus + Emblem.Bonus) に乗算される前提。

1-5. リングバフ

トグル：リングバフ ON/OFF

ON の場合のみリング詳細設定 UI を表示：

ステータス毎の%増加値 Ring.<Stat> 入力

計算：

BaseStatus を計算

RingOption.IterativeApply で収束処理

repeat(round(Current * (1 + Ring.<Stat>/100)), until no change)

1-6. ご飯（Foodバフ）

トグル：Foodバフ ON/OFF

ON時のみバフ選択（Foodプリセット or 手入力）

計算：

Food.<Stat> として BaseStatus 内の加算項へ反映

(SumEquipment + Job.Initial*Lv + Job.SP + Food + UserOption) * ...

1-7. 高度設定（折りたたみ）

手動ステータス調整

UserOption.<Stat> として扱う

±入力可能、整数のみ

武器固有能力

利用可能武器種に応じてトグル表示

対応しない武器が装備されると自動OFF＋グレーアウト

効果は UserOption または Job.Bonus に加算して表現

1-8. 最終ステータス表示

表示項目：HP / MP / 力 / 魔力 / 精神 / 素早さ / 器用さ / 守備力 / 撃力 / 会心率 等

計算式：UserStatusFormula.BaseStatus＋リング収束後の値

内訳ツールチップ：

装備合計

職業初期値＋レベル

SP

Food

UserOption

JobBonus / EmblemBonus
などを分解表示

2. 火力計算ページ（/damage）

キャラビルドページで構築した「現在のビルド」を読み込み、
指定した 敵情報 + スキル / 通常攻撃 から火力を計算するページ。

2-1. ビルド読み込み

現在編集中のビルドを自動反映

もしくはプリセットから選択（将来的拡張）

2-2. 敵パラメータ入力

敵防御力：EnemyDefence

種族耐性：EnemyTypeResistance (%)

属性耐性：EnemyAttributeResistance (%)

敵HP（任意）：DPS計算やTTKに使う場合

2-3. 使用スキル / 通常攻撃の選択

ドロップダウン：

職業と武器種からフィルタされた SkillDefinition.JobSkill / SkillBook

表示項目：

消費MP、CT、持続時間、ヒット数、説明

複数スキルを ローテーションリスト として並べてもよい（V2.1以降でもOK）。

2-4. 計算仕様

基礎ダメージ取得

選択武器種から WeaponCalc.BasedDamage.<Weapon> を計算

ノービスなど JobCorrection があれば上書き or 乗算

スキル倍率適用

SkillCalc.SkillDefinition の Damage 式を使用

{BaseDamage.Sword, BaseDamage.Wand, NormalAttack.Dagger ...} 等を参照

ヒット数がある場合：1ヒットダメージ × Hits

最終ダメージ

WeaponCalc.FinalDamage を適用

(HitDamage-(EnemyDefence/2)) * (1 - EnemyTypeResistance/100) * (1 - EnemyAttributeResistance/100)

出力：

1発あたりダメージ

総ダメージ（多段ヒット含む）

MP効率（1MPあたりダメージ）

秒間火力（CT・持続時間を考慮するなら）

2-5. UI

「再計算」ボタン押下で上記処理

結果表示：

大きめの数字で「最終ダメージ」

サマリカード（基礎ダメージ、ヒット数、耐性補正など）

3. 最適化ページ（/optimize）

現在の職業・スキル・条件を固定して、
装備構成の候補を探索し、火力の高いビルドを一覧表示するページ。

3-1. 探索条件入力

対象職業（/build と同期）

使用スキル or 通常攻撃（火力評価の指標）

探索対象スロット：

武器 / 頭 / 胴 / 足 / アクセ / 紋章 / リング / Food

チェックボックスで「固定する / 探索対象にする」を指定

制約：

武器ランクの上限

防具ランクの下限

指定した装備を固定する（例：武器だけ固定して他を探索）

3-2. 探索実行

「探索開始」ボタン押下で実行

内部動作：

指定レンジ内の装備組み合わせを列挙（or スマート探索）

各候補ごとに：

UserStatusFormula で最終ステータス算出

火力計算ロジック（/damage と同じ）で評価値を求める

3-3. 結果一覧

rule.md の 3-3 / 3-4 に書かれていた内容を「最適化ページ」に紐付け直し。

テーブル形式：

順位	期待ダメージ	武器	頭	胴	足	ネックレス	ブレスレット	紋章/ルーン	リング	ご飯	詳細

アクション：

CSV出力

「このビルドを開く」

/build ページにビルドを読み込む

3-4. 詳細ビュー

行の「詳細」を押すと：

装備カード一覧

最終ステータス

火力計算サマリ（どのスキルで評価したか）

[プリセット保存] ボタン

4. 装備図鑑（閲覧専用）

装備一覧をグリッド or テーブル表示

絞り込み：カテゴリ、ランク、武器種、防具種

非対応職業装備は薄色表示（装備情報だけ見たいケース用）

5. 管理者ページ（Admin）

装備CSVアップロード（EqConst・装備本体）

職業CSV / 職業スキルCSV のアップロード

スキル定義（SkillCalc.yaml 相当）アップロード

ダメージ式辞書（WeaponCalc / UserStatusCalc）更新

デバッグログ（ON/OFF、およびDL
