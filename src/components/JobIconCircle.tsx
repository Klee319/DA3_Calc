'use client'

import { ReactNode } from 'react'
import Image from 'next/image'

const JOB_COUNT = 15

interface Props {
  children?: ReactNode
}

export default function JobIconCircle({ children }: Props) {
  return (
    <div className="job-icon-circle-container relative select-none z-10">
      {/* 中央グロー */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="job-icon-glow rounded-full bg-gradient-radial from-rpg-accent/20 via-indigo-600/10 to-transparent blur-2xl opacity-40" />
      </div>

      {/* 中央コンテンツ */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center pointer-events-auto px-4">
          {children}
        </div>
      </div>

      {/* 回転コンテナ */}
      <div className="job-icon-orbit">
        {Array.from({ length: JOB_COUNT }).map((_, index) => {
          const angleDeg = (360 / JOB_COUNT) * index

          return (
            <div
              key={index}
              className="job-icon-wrapper"
              style={{
                '--angle': `${angleDeg}deg`,
                '--counter-start': `${-angleDeg}deg`,
                '--counter-end': `${-angleDeg - 360}deg`,
              } as React.CSSProperties}
            >
              <div className="job-icon-glow-inner" />
              <div className="job-icon-inner">
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
