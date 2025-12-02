import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 text-gradient from-white via-gray-100 to-gray-400">
          DA Build Calculator
        </h1>
        <p className="text-lg md:text-xl text-gray-400 mb-12 leading-relaxed">
          Divine Adventureのキャラクタービルドを計算・最適化するツール。
          装備・スキル・ステータスを設定し、最終ステータスやダメージをシミュレーションできます。
        </p>
        <Link
          href="/build"
          className="btn-primary text-lg px-8 py-4 inline-block"
        >
          今すぐビルドを作成
        </Link>
      </div>
    </div>
  )
}
