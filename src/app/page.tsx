import Link from 'next/link'

export default function Home() {
  return (
    <div className="container mx-auto px-4 max-w-7xl">
      {/* Hero Section */}
      <div className="text-center mb-20">
        <h1 className="text-6xl md:text-7xl lg:text-8xl font-thin mb-6 text-gradient from-white via-gray-100 to-gray-400">
          Build Your Legend
        </h1>
        <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
          Minecraft RPG の最強ビルドを科学的に構築。
          装備・スキル・ステータスを最適化し、圧倒的な火力を手に入れよう。
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/build" className="btn-primary">
            今すぐビルドを作成
          </Link>
          <Link href="/optimize" className="glass-card px-6 py-3 rounded-xl hover:bg-glass-medium transition-all">
            最適化ツールを試す
          </Link>
        </div>
      </div>

      {/* Bento Features Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
        {features.map((feature, i) => (
          <Link
            key={i}
            href={feature.href}
            className="stat-card hover:border-rpg-accent/50"
          >
            <div className="text-4xl mb-4">{feature.icon}</div>
            <h3 className="text-2xl font-semibold mb-2 text-gradient from-white to-gray-300">
              {feature.title}
            </h3>
            <p className="text-gray-400 leading-relaxed">
              {feature.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}

const features = [
  {
    icon: '🛠️',
    title: 'キャラビルド',
    description: '職業・装備・SPを自由に設定し、最終ステータスをリアルタイム計算',
    href: '/build',
  },
  {
    icon: '⚡',
    title: '火力計算',
    description: 'スキル・武器・敵パラメータから正確なダメージを算出',
    href: '/damage',
  },
  {
    icon: '🎯',
    title: '装備最適化',
    description: 'AI探索で最大火力を出す装備構成を自動発見',
    href: '/optimize',
  },
]
