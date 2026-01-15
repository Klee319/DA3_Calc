'use client'

export default function FloatingOrbs() {
  const orbs = [
    { size: 12, x: 8, y: 15, duration: 18, delay: 0 },
    { size: 16, x: 88, y: 12, duration: 22, delay: 3 },
    { size: 10, x: 15, y: 75, duration: 16, delay: 1 },
    { size: 14, x: 92, y: 65, duration: 20, delay: 5 },
    { size: 8, x: 3, y: 45, duration: 19, delay: 2 },
    { size: 10, x: 97, y: 35, duration: 17, delay: 4 },
    { size: 12, x: 25, y: 8, duration: 21, delay: 0 },
    { size: 10, x: 75, y: 88, duration: 18, delay: 6 },
    { size: 8, x: 12, y: 30, duration: 15, delay: 1 },
    { size: 16, x: 82, y: 50, duration: 23, delay: 7 },
    { size: 10, x: 55, y: 5, duration: 19, delay: 2 },
    { size: 12, x: 45, y: 92, duration: 20, delay: 4 },
    { size: 8, x: 5, y: 85, duration: 16, delay: 3 },
    { size: 14, x: 95, y: 20, duration: 22, delay: 5 },
    { size: 10, x: 35, y: 60, duration: 17, delay: 1 },
    { size: 12, x: 65, y: 25, duration: 21, delay: 6 },
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
