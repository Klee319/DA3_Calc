'use client'

export default function FloatingOrbs() {
  const orbs = [
    { size: 4, x: 10, y: 20, duration: 20, delay: 0 },
    { size: 6, x: 85, y: 15, duration: 25, delay: 5 },
    { size: 3, x: 20, y: 80, duration: 18, delay: 2 },
    { size: 5, x: 90, y: 70, duration: 22, delay: 8 },
    { size: 4, x: 5, y: 50, duration: 24, delay: 3 },
    { size: 3, x: 95, y: 40, duration: 19, delay: 6 },
    { size: 5, x: 30, y: 10, duration: 21, delay: 1 },
    { size: 4, x: 70, y: 85, duration: 23, delay: 4 },
    { size: 3, x: 15, y: 35, duration: 17, delay: 7 },
    { size: 6, x: 80, y: 55, duration: 26, delay: 9 },
    { size: 4, x: 50, y: 5, duration: 20, delay: 2 },
    { size: 3, x: 40, y: 90, duration: 18, delay: 5 },
  ]

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {orbs.map((orb, index) => (
        <div
          key={index}
          className="floating-orb"
          style={{
            '--orb-size': `${orb.size}px`,
            '--orb-x': `${orb.x}vw`,
            '--orb-y': `${orb.y}vh`,
            '--orb-duration': `${orb.duration}s`,
            '--orb-delay': `${orb.delay}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}
