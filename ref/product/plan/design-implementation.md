# デザインシステム実装計画 (Design System Implementation Plan)
**最終更新日**: 2025-11-24  
**バージョン**: v1.0  
**ベース**: modanui.md (Apple-like デザインシステム)

---

## 1. デザインシステム概要

### 1.1 コンセプト

本プロジェクトは **Apple-like の洗練されたデザイン** を採用し、以下の原則に従う:

- **洗練 (Sophistication)**: 余白を贅沢に使い、装飾より構造美を優先
- **静寂 (Calmness)**: ミニマルな視線誘導、控えめなアニメーション
- **高級感 (Premium)**: ハードエッジ + ソフトな光沢、微グラデーション
- **秩序 (Order)**: 8px グリッドシステム、厳格なタイポグラフィ
- **精密 (Precision)**: 計算結果を美しく見せる、データの可読性重視

### 1.2 デザイン哲学

> "RPG ダメージ計算機は複雑なデータを扱うが、UI は複雑であってはならない。"

- 1画面 = 1タスク
- 階層は最大3段まで
- 情報密度より可読性を優先

---

## 2. レイアウトルール (Layout Rules)

### 2.1 グリッドシステム

```css
/* Tailwind Config 拡張 */
module.exports = {
  theme: {
    extend: {
      spacing: {
        '8': '0.5rem',    /* 8px */
        '16': '1rem',     /* 16px */
        '24': '1.5rem',   /* 24px */
        '32': '2rem',     /* 32px */
        '120': '7.5rem',  /* 120px */
        '200': '12.5rem', /* 200px */
      },
      maxWidth: {
        'container': '1280px',
      },
    },
  },
};
```

**原則**:
- すべての余白・サイズは **8の倍数**
- セクション間の余白: `120px` または `200px`
- カード間隔: `32px`
- コンテナ最大幅: `1280px`

### 2.2 ブレークポイント

```css
/* Tailwind Default + カスタム */
screens: {
  'sm': '375px',   /* Mobile */
  'md': '744px',   /* Tablet */
  'lg': '1280px',  /* Desktop */
}
```

### 2.3 レスポンシブレイアウト例

```tsx
<div className="container mx-auto max-w-container px-4 md:px-8 lg:px-16">
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
    {/* カード要素 */}
  </div>
</div>
```

---

## 3. タイポグラフィ (Typography)

### 3.1 フォント設定

```css
/* Tailwind Config */
fontFamily: {
  sans: ['Inter', 'SF Pro Text', 'Noto Sans JP', 'sans-serif'],
},
```

### 3.2 タイポグラフィスケール

| クラス名 | サイズ | 用途 | Tailwind |
|---------|-------|------|----------|
| **display-1** | clamp(48px, 6vw, 80px) | Hero タイトル | `text-6xl lg:text-8xl font-thin` |
| **display-2** | clamp(32px, 4.5vw, 56px) | セクションタイトル | `text-4xl lg:text-6xl font-light` |
| **headline** | 32px → 40px | ページタイトル | `text-3xl lg:text-5xl font-normal` |
| **subhead** | 20px → 24px | サブタイトル | `text-xl lg:text-2xl font-normal` |
| **body** | 17px | 本文 | `text-base` |
| **caption** | 14px | キャプション | `text-sm` |

### 3.3 タイポグラフィルール

```css
/* グローバルスタイル */
h1, h2, h3 {
  font-weight: 300; /* Light */
  letter-spacing: -0.02em; /* タイトルは詰める */
}

p, li {
  letter-spacing: 0.01em; /* 本文は広げる */
  line-height: 1.6; /* 行間は広めに */
}
```

---

## 4. カラーシステム (Color System)

### 4.1 カラーパレット

```css
/* Tailwind Config */
colors: {
  bg: {
    DEFAULT: '#FFFFFF',
    soft: '#F5F5F7',
  },
  text: {
    primary: '#111111',
    secondary: '#555555',
    tertiary: '#7A7A7A',
  },
  accent: {
    DEFAULT: '#0071E3', /* Apple Blue */
    hover: '#005BB5',
  },
  border: {
    DEFAULT: '#E5E5E7',
  },
}
```

### 4.2 カラー使用ルール

| 要素 | カラー | 用途 |
|------|-------|------|
| **背景 (メイン)** | `bg` (#FFFFFF) | ページ全体 |
| **背景 (サブ)** | `bg-soft` (#F5F5F7) | カード・セクション |
| **テキスト (1次)** | `text-primary` | 見出し・重要テキスト |
| **テキスト (2次)** | `text-secondary` | 本文 |
| **テキスト (3次)** | `text-tertiary` | キャプション・補足 |
| **アクセント** | `accent` | ボタン・リンク・強調 |
| **境界線** | `border` | カード枠・区切り線 |

### 4.3 微グラデーション

```css
/* 背景に subtle gradient を適用 */
.bg-gradient-subtle {
  background: linear-gradient(
    180deg,
    #FFFFFF 0%,
    #F8F8F9 100%
  );
}
```

**原則**: 色変化幅は **±8% 以内** (肉眼でわからない範囲)。

---

## 5. コンポーネント設計 (Components)

### 5.1 共通ルール

| 属性 | 値 | Tailwind |
|------|-----|----------|
| **角丸** | 12px または 16px | `rounded-xl` または `rounded-2xl` |
| **シャドウ** | 0 4px 24px rgba(0,0,0,0.08) | `shadow-lg` (カスタム) |
| **境界線** | 1px solid #E5E5E7 | `border border-border` |
| **ホバー** | opacity 0.8 または lift | `hover:opacity-80 hover:-translate-y-1` |

```css
/* Tailwind Config - カスタムシャドウ */
boxShadow: {
  'apple': '0 4px 24px rgba(0, 0, 0, 0.08)',
  'apple-hover': '0 8px 32px rgba(0, 0, 0, 0.12)',
}
```

---

### 5.2 Hero Section (トップページ)

#### 構造

```tsx
<section className="h-[75vh] flex items-center justify-between px-16 bg-gradient-subtle">
  <div className="max-w-2xl">
    <h1 className="text-8xl font-thin mb-6">
      Minecraft RPG<br />ダメージ計算機
    </h1>
    <p className="text-2xl text-text-secondary mb-10">
      装備構成を最適化し、最大火力を引き出す。
    </p>
    <div className="flex gap-4">
      <Button variant="primary">火力検証を開始</Button>
      <Button variant="secondary">最適装備を探索</Button>
    </div>
  </div>
  <div className="w-1/2">
    <img src="/hero-image.png" alt="Hero" className="w-full" />
  </div>
</section>
```

#### ルール
- Hero 高さ: `75vh`
- 画像は **右寄せ** (左右どちらかに寄せる)
- ボタンは最大2つまで

---

### 5.3 Card (Feature Card)

#### 構造

```tsx
<div className="bg-white border border-border rounded-2xl p-8 shadow-apple hover:shadow-apple-hover transition-all duration-200 hover:-translate-y-1">
  <div className="w-12 h-12 mb-6 text-accent">
    {/* アイコン */}
  </div>
  <h3 className="text-2xl font-normal mb-3">火力検証モード</h3>
  <p className="text-text-secondary mb-6 leading-relaxed">
    任意の装備・スキルを設定し、ダメージを計算。
  </p>
  <a href="/build" className="text-accent hover:underline">
    詳細を見る →
  </a>
</div>
```

#### グリッド配置

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
  <Card />
  <Card />
  <Card />
</div>
```

---

### 5.4 Button (ボタン)

#### バリアント

```tsx
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost';
  size: 'sm' | 'md' | 'lg';
}
```

#### スタイル定義

```tsx
const buttonStyles = {
  primary: 'bg-accent text-white hover:bg-accent-hover',
  secondary: 'bg-white border-2 border-accent text-accent hover:bg-bg-soft',
  ghost: 'bg-transparent text-accent hover:bg-bg-soft',
};

const buttonSizes = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
};
```

#### 実装例

```tsx
<button className={`
  rounded-xl font-medium transition-all duration-200
  ${buttonStyles[variant]}
  ${buttonSizes[size]}
`}>
  {children}
</button>
```

---

### 5.5 Input (入力フォーム)

#### 構造

```tsx
<div className="space-y-2">
  <label className="block text-sm font-medium text-text-primary">
    レベル
  </label>
  <input
    type="number"
    className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent transition-all"
    placeholder="100"
  />
</div>
```

#### ルール
- フォーカス時: `ring-2 ring-accent`
- プレースホルダー: `text-text-tertiary`
- エラー時: `border-red-500 ring-red-500`

---

### 5.6 Tab (タブ構造)

#### 構造

```tsx
<div className="border-b border-border">
  <nav className="flex space-x-8">
    <button className={`
      pb-4 border-b-2 transition-colors
      ${activeTab === 'job' 
        ? 'border-accent text-accent' 
        : 'border-transparent text-text-secondary hover:text-text-primary'}
    `}>
      職業
    </button>
    {/* 他のタブ */}
  </nav>
</div>
```

#### タブコンテンツ

```tsx
<div className="py-8">
  {activeTab === 'job' && <JobTab />}
  {activeTab === 'sp' && <SPTab />}
  {/* ... */}
</div>
```

---

### 5.7 Table (データ表示)

#### 構造

```tsx
<table className="w-full">
  <thead className="bg-bg-soft">
    <tr>
      <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">
        装備名
      </th>
      <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">
        攻撃力
      </th>
    </tr>
  </thead>
  <tbody className="divide-y divide-border">
    <tr className="hover:bg-bg-soft transition-colors">
      <td className="px-6 py-4 text-text-primary">炎剣</td>
      <td className="px-6 py-4 text-text-primary">1250</td>
    </tr>
  </tbody>
</table>
```

---

## 6. アニメーション (Motion Rules)

### 6.1 タイミング設定

```css
/* Tailwind Config */
transitionDuration: {
  '160': '160ms',
  '220': '220ms',
}

transitionTimingFunction: {
  'apple': 'cubic-bezier(0.25, 0.1, 0.25, 1)', /* ease-out */
}
```

### 6.2 アニメーション定義

| アニメーション | 用途 | Tailwind |
|---------------|------|----------|
| **Fade In** | 要素の登場 | `opacity-0 animate-fade-in` |
| **Slide Up** | カードの登場 | `translate-y-3 opacity-0 animate-slide-up` |
| **Hover Lift** | カードホバー | `hover:-translate-y-1 transition-transform duration-220` |

### 6.3 カスタムアニメーション

```css
/* tailwind.config.js */
keyframes: {
  'fade-in': {
    '0%': { opacity: '0' },
    '100%': { opacity: '1' },
  },
  'slide-up': {
    '0%': { transform: 'translateY(12px)', opacity: '0' },
    '100%': { transform: 'translateY(0)', opacity: '1' },
  },
}

animation: {
  'fade-in': 'fade-in 220ms ease-out',
  'slide-up': 'slide-up 220ms ease-out',
}
```

---

## 7. 実装優先順位 (Implementation Priority)

### 7.1 Phase 1: 基盤整備 (Week 1-2)

| タスク | 担当 | 工数 | 優先度 |
|--------|------|------|--------|
| Tailwind カスタムテーマ設定 | フロントエンドB | 6h | High |
| カラーパレット・タイポグラフィ定義 | フロントエンドB | 4h | High |
| グリッドシステム設定 | フロントエンドB | 4h | High |
| グローバルスタイル適用 | フロントエンドB | 4h | Medium |

**成果物**: `tailwind.config.js` と `globals.css` の完成。

---

### 7.2 Phase 2: コンポーネント実装 (Week 3-4)

| タスク | 担当 | 工数 | 優先度 |
|--------|------|------|--------|
| Button コンポーネント実装 | フロントエンドA | 6h | High |
| Input コンポーネント実装 | フロントエンドA | 6h | High |
| Card コンポーネント実装 | フロントエンドA | 8h | High |
| Tab コンポーネント実装 | フロントエンドA | 8h | High |
| Table コンポーネント実装 | フロントエンドA | 6h | Medium |
| Tooltip コンポーネント改善 | フロントエンドA | 4h | Medium |

**成果物**: 汎用UIコンポーネントライブラリ完成。

---

### 7.3 Phase 3: ページ適用 (Week 5)

| タスク | 担当 | 工数 | 優先度 |
|--------|------|------|--------|
| トップページのデザイン適用 | フロントエンドB | 8h | High |
| ビルド編集画面のデザイン適用 | フロントエンドB | 10h | High |
| ダメージ計算画面のデザイン適用 | フロントエンドB | 8h | High |
| 最適装備探索画面のデザイン適用 | フロントエンドB | 6h | Medium |

**成果物**: 全ページにデザインシステム適用完了。

---

### 7.4 Phase 4: アニメーション・仕上げ (Week 6)

| タスク | 担当 | 工数 | 優先度 |
|--------|------|------|--------|
| Fade In / Slide Up アニメーション実装 | フロントエンドB | 6h | Medium |
| Hover エフェクトの統一 | フロントエンドB | 4h | Medium |
| レスポンシブ対応の調整 | フロントエンドB | 8h | High |
| ダークモード対応 (オプション) | フロントエンドB | 10h | Low |

**成果物**: 洗練されたアニメーション・レスポンシブ対応完了。

---

## 8. コンポーネント実装例 (Code Examples)

### 8.1 Button コンポーネント

```tsx
// src/components/ui/Button.tsx
import { ButtonHTMLAttributes, FC } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

const Button: FC<ButtonProps> = ({ 
  variant = 'primary', 
  size = 'md', 
  children, 
  className = '',
  ...props 
}) => {
  const baseStyles = 'rounded-xl font-medium transition-all duration-220 ease-apple';
  
  const variantStyles = {
    primary: 'bg-accent text-white hover:bg-accent-hover',
    secondary: 'bg-white border-2 border-accent text-accent hover:bg-bg-soft',
    ghost: 'bg-transparent text-accent hover:bg-bg-soft',
  };
  
  const sizeStyles = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };
  
  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
```

---

### 8.2 Card コンポーネント

```tsx
// src/components/ui/Card.tsx
import { FC, ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  hover?: boolean;
}

const Card: FC<CardProps> = ({ children, hover = true }) => {
  return (
    <div className={`
      bg-white border border-border rounded-2xl p-8 
      shadow-apple transition-all duration-220
      ${hover ? 'hover:shadow-apple-hover hover:-translate-y-1 cursor-pointer' : ''}
    `}>
      {children}
    </div>
  );
};

export default Card;
```

---

### 8.3 Tab コンポーネント

```tsx
// src/components/ui/Tab.tsx
import { FC, useState } from 'react';

interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabProps {
  tabs: TabItem[];
  defaultTab?: string;
}

const Tab: FC<TabProps> = ({ tabs, defaultTab }) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0].id);
  
  return (
    <div>
      <div className="border-b border-border">
        <nav className="flex space-x-8">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                pb-4 border-b-2 transition-colors duration-160
                ${activeTab === tab.id 
                  ? 'border-accent text-accent' 
                  : 'border-transparent text-text-secondary hover:text-text-primary'}
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="py-8">
        {tabs.find(tab => tab.id === activeTab)?.content}
      </div>
    </div>
  );
};

export default Tab;
```

---

## 9. デザインレビューチェックリスト

### 9.1 レイアウト

- [ ] すべての余白が 8px の倍数か?
- [ ] コンテナ幅が 1280px を超えていないか?
- [ ] セクション間の余白が 120px または 200px か?
- [ ] カード間隔が 32px か?

### 9.2 タイポグラフィ

- [ ] フォントは Inter または SF Pro Text か?
- [ ] タイトルは Light または Thin か?
- [ ] 本文の行間が 1.6 以上か?
- [ ] letter-spacing が適切か?

### 9.3 カラー

- [ ] カラーパレット以外の色を使用していないか?
- [ ] アクセントカラーが #0071E3 か?
- [ ] グラデーションの色変化幅が ±8% 以内か?

### 9.4 コンポーネント

- [ ] 角丸が 12px または 16px か?
- [ ] シャドウが subtle (控えめ) か?
- [ ] ホバー時のアニメーションが 160-220ms か?
- [ ] ボタンのバリアントが 3種類以内か?

### 9.5 アニメーション

- [ ] アニメーションが 220ms 以内か?
- [ ] ease-out が使われているか?
- [ ] 過剰なアニメーションがないか?

---

## 10. 禁止事項 (AI 破綻を防ぐ)

以下の行為は **デザインシステム違反** とし、厳守する:

- ❌ **グリッド無視の配置** (8px 以外の余白)
- ❌ **過剰な色の使用** (カラーパレット以外の色)
- ❌ **ラディウスのバラバラ適用** (12px と 16px 以外)
- ❌ **カードのテキスト量 > 100字** (情報過多)
- ❌ **装飾的すぎるボタン** (グラデーション・影の過剰使用)
- ❌ **複雑すぎるアニメーション** (3秒以上の長いアニメーション)

---

## 11. 次のアクション

1. **Tailwind Config の設定**: `tailwind.config.js` を編集
2. **グローバルスタイルの適用**: `globals.css` を編集
3. **Button / Card / Input の実装**: `src/components/ui/` に配置
4. **トップページへの適用**: Hero セクションをデザインシステムに準拠

---

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2025-11-24 | v1.0 | 初版作成 |

---

**次のアクション**: `feature-roadmap.md` を参照して、未実装機能の実装計画を確認してください。
