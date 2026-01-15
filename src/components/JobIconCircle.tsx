'use client'

import { ReactNode, useState, useCallback, useEffect, useRef } from 'react'
import Image from 'next/image'

const JOB_COUNT = 15
const BASE_SPEED = 360 / 60 // 60秒で1回転 = 6度/秒
const FAST_SPEED = 360 / 3  // 3秒で1回転 = 120度/秒
const CLICK_THRESHOLD = 3   // 自転発動に必要なクリック数

interface Props {
  children?: ReactNode
}

export default function JobIconCircle({ children }: Props) {
  const [glowActive, setGlowActive] = useState(false)
  const [spinTrigger, setSpinTrigger] = useState(0) // 自転トリガー
  const rotationRef = useRef(0)
  const speedRef = useRef(BASE_SPEED)
  const targetSpeedRef = useRef(BASE_SPEED)
  const orbitRef = useRef<HTMLDivElement>(null)
  const iconsRef = useRef<(HTMLDivElement | null)[]>([])
  const lastTimeRef = useRef<number>(0)
  const animationRef = useRef<number>(0)
  const decayTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const clickCountRef = useRef(0)
  const clickResetTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const selfSpinRef = useRef(0) // 自転の追加角度

  const handleClick = useCallback(() => {
    // 加速
    targetSpeedRef.current = FAST_SPEED
    setGlowActive(true)

    // クリックカウント
    clickCountRef.current += 1

    // クリックカウントリセットタイマー
    if (clickResetTimeoutRef.current) {
      clearTimeout(clickResetTimeoutRef.current)
    }
    clickResetTimeoutRef.current = setTimeout(() => {
      clickCountRef.current = 0
    }, 1000)

    // 一定回数で自転発動
    if (clickCountRef.current >= CLICK_THRESHOLD) {
      clickCountRef.current = 0
      setSpinTrigger(prev => prev + 1)
    }

    // 既存の減速タイマーをクリア
    if (decayTimeoutRef.current) {
      clearTimeout(decayTimeoutRef.current)
    }

    // 2秒後に減速開始
    decayTimeoutRef.current = setTimeout(() => {
      targetSpeedRef.current = BASE_SPEED
      setTimeout(() => setGlowActive(false), 1500)
    }, 2000)
  }, [])

  // 自転アニメーション
  useEffect(() => {
    if (spinTrigger === 0) return

    const startSpin = 0
    const targetSpin = 360
    const duration = 800 // 0.8秒で1回転
    const startTime = performance.now()

    const animateSpin = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      // イーズアウト
      const eased = 1 - Math.pow(1 - progress, 3)
      selfSpinRef.current = startSpin + (targetSpin - startSpin) * eased

      if (progress < 1) {
        requestAnimationFrame(animateSpin)
      } else {
        // 完了したら0にリセット（360° = 0°）
        selfSpinRef.current = 0
      }
    }

    requestAnimationFrame(animateSpin)
  }, [spinTrigger])

  useEffect(() => {
    const animate = (currentTime: number) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = currentTime
      }

      const deltaTime = (currentTime - lastTimeRef.current) / 1000
      lastTimeRef.current = currentTime

      // 滑らかに目標速度に近づける（イージング）
      const speedDiff = targetSpeedRef.current - speedRef.current
      speedRef.current += speedDiff * 0.03

      // 回転角度を更新
      rotationRef.current += speedRef.current * deltaTime

      // DOM更新
      if (orbitRef.current) {
        orbitRef.current.style.transform = `rotate(${rotationRef.current}deg)`
      }

      // 各アイコンの逆回転 + 自転
      iconsRef.current.forEach((icon, index) => {
        if (icon) {
          const baseAngle = (360 / JOB_COUNT) * index
          const counterRotation = -rotationRef.current - baseAngle
          const selfSpin = selfSpinRef.current
          icon.style.transform = `rotate(${counterRotation + selfSpin}deg)`
        }
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (decayTimeoutRef.current) {
        clearTimeout(decayTimeoutRef.current)
      }
      if (clickResetTimeoutRef.current) {
        clearTimeout(clickResetTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div
      className="job-icon-circle-container relative select-none z-10 cursor-pointer"
      onClick={handleClick}
    >
      {/* 中央グロー */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className={`job-icon-glow rounded-full bg-gradient-radial from-rpg-accent/20 via-indigo-600/10 to-transparent blur-2xl transition-all duration-1000 ease-out ${
            glowActive ? 'scale-150 opacity-80' : 'scale-100 opacity-40'
          }`}
        />
      </div>

      {/* 中央コンテンツ */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center pointer-events-auto px-4">
          {children}
        </div>
      </div>

      {/* 回転コンテナ - JavaScript制御 */}
      <div
        ref={orbitRef}
        className="job-icon-orbit-js"
      >
        {Array.from({ length: JOB_COUNT }).map((_, index) => {
          const angleDeg = (360 / JOB_COUNT) * index

          return (
            <div
              key={index}
              className="job-icon-wrapper-js"
              style={{
                '--angle': `${angleDeg}deg`,
              } as React.CSSProperties}
            >
              <div className="job-icon-glow-inner" />
              <div
                ref={(el) => { iconsRef.current[index] = el }}
                className="job-icon-inner-js"
              >
                <Image
                  src={`/assets/job${index}_icon.svg`}
                  alt={`Job ${index}`}
                  width={96}
                  height={96}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
