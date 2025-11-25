1. ブランド・コンセプト
・洗練、静寂、高級感、秩序、精密
・余白を贅沢に使う
・視線誘導はミニマルに
・装飾より「構造美」を優先
・ハードエッジ + ソフトな光沢（ニュアンスグラデ）

2. レイアウトルール（layout rules）
2.1 グリッド
・8px base grid
・コンテナ幅: 1280px (max-width)
・セクション上下余白: 120–200px
・カード間隔: 32px

2.2 ブレークポイント
・mobile: 375px
・tablet: 744px
・desktop: 1280px

2.3 レイアウト原則
・1 セクション 1 メッセージ
・階層は最大 3 段
・画像は左右どちらかに寄せ、中央にしすぎない

3. タイポグラフィ（typography）
使用フォント
primary: Inter or SF Pro Text
fallback: Noto Sans JP

スケール
display-1: clamp(48px, 6vw, 80px) / thin
display-2: clamp(32px, 4.5vw, 56px)
headline: 32px → 40px
subhead: 20px → 24px
body: 17px
caption: 14px

タイポ規則
・タイトルは “軽いフォント + 大きいサイズ”
・本文は letter-spacing を少し広めに
・行間は 1.6–1.75 倍

4. カラーシステム
アップル系モノクロ + 微グラデーション
--bg: #FFFFFF
--bg-soft: #F5F5F7
--text-primary: #111111
--text-secondary: #555555
--text-tertiary: #7A7A7A
--accent: #0071E3   // Apple ブルー

グラデーション（AI に与える指示）
・肉眼でわからない範囲の subtle gradient を背景にうっすら入れる
・色変化幅は ±8% 以内

5. コンポーネント（Components）
共通ルール
・角丸: 12px or 16px
・シャドウ: 0 4px 24px rgba(0,0,0,0.08) （控えめ）
・境界線: #E5E5E7 の 1px
・アクセントは最小限
・ホバー時の変化は opacity か lift + subtle shadow

5.1 ヒーロー（Hero Section）
構造:
- 大見出し（最大級 font）
- サブ見出し（短い説明）
- CTA ボタン 1 or 2
- 背景は subtle gradient or 写真 1つ

ルール:
- hero の高さは 75vh 程度
- 画像は中央ではなく左右どちらかへ寄せる

5.2 カード（Feature Card）
構造:
- アイコンまたは小画像
- タイトル
- 短い本文 (max 80 字)
- more/arrow リンク（薄い）

レイアウト:
- 3 列 or 2 列
- モバイルは 1 列

スタイル:
- 白 + 薄い影
- 角丸 12px

5.3 ストーリーセクション（Story Split Layout）
構造:
- 左: 文章
- 右: 大きな画像
（左右反転しながら複数セクションを並べる）

ルール:
- 画像は 16:9 or 4:3
- テキストブロックは max 540px

6. アニメーション（motion rules）
Apple 的モーション
duration: 160–220ms
timing: ease-out
transform: translateY(12px) → 0
opacity: 0 → 1

要素入場時にわずかな遅延 (30–45ms)

ホバー
transform: translateY(-2px)
shadow: subtle up

7. AI が UI を生成するためのプロンプトルール
禁止（AI が破綻するポイント）
× グリッド無視の配置
× 過剰な色
× ラディウスのバラバラ適用
× カードのテキスト量 > 100 字
× 装飾的すぎるボタン

生成時の強制ルール
1. まず構造（section → container → grid → component hierarchy）を作る
2. その後スタイルを Tailwind class として適用する
3. 最後に微調整（余白・フォント・shadow）

8. AI に渡すテンプレプロンプト例
🧱 ページ生成用
以下のデザインシステムに従って、Apple-like の洗練された Web UI を生成しなさい。

【Design System】
（DS全文を貼る）

【要求】
・トップページ構造（Hero, Features, Story, CTA）
・Next.js + Tailwind で記述
・shadcn/radix は必要に応じて使用
・純粋なコンポーネント構造を優先
・ミニマルかつ高級感ある Apple 風にする