import Link from 'next/link'
import JobIconCircle from '@/components/JobIconCircle'
import FloatingOrbs from '@/components/FloatingOrbs'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-2 sm:px-4 overflow-hidden">
      {/* 背景の浮遊オーブ */}
      <FloatingOrbs />
      {/* 職業アイコンの回転アニメーション（タイトルを中央に配置） */}
      <JobIconCircle>
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-2 sm:mb-4 text-gradient from-white via-gray-100 to-gray-400">
          DA Build Calculator
        </h1>
        <p className="text-xs sm:text-sm md:text-base lg:text-lg text-gray-400 mb-4 sm:mb-6 md:mb-8 leading-relaxed max-w-xs sm:max-w-sm md:max-w-md mx-auto">
          キャラクタービルドを計算・最適化
        </p>
        <Link
          href="/build"
          className="btn-primary text-sm sm:text-base md:text-lg px-4 sm:px-6 md:px-8 py-2 sm:py-3 md:py-4 inline-block"
        >
          ビルドを作成
        </Link>
      </JobIconCircle>
    </div>
  )
}
