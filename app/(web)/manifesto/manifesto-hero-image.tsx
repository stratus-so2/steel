'use client'

import { useEffect, useRef } from 'react'

const ROTATION_DEG = 360
const RINGS = [120, 210, 300, 390, 480, 570]
const SPOKES = 24

/**
 * Decorative orbit that rotates with the page scroll progress. Drawn inline
 * (instead of a hotlinked illustration) and driven by a plain scroll listener,
 * since Steel does not ship `motion`.
 */
export function ManifestoHeroImage() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const el = ref.current
      if (!el) return
      const max = document.documentElement.scrollHeight - window.innerHeight
      const progress = max > 0 ? window.scrollY / max : 0
      el.style.transform = `rotate(${progress * ROTATION_DEG}deg)`
    }
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame !== 0) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div className='relative mt-6 w-full max-w-4xl overflow-hidden rounded-2xl aspect-2/1'>
      <div
        ref={ref}
        className='absolute inset-x-0 top-0 w-full aspect-square will-change-transform'
      >
        <svg
          viewBox='0 0 1200 1200'
          aria-hidden='true'
          className='h-full w-full text-border'
        >
          {Array.from({ length: SPOKES }, (_, index) => {
            const angle = (index / SPOKES) * Math.PI * 2
            return (
              <line
                key={`spoke-${angle}`}
                x1={600}
                y1={600}
                x2={600 + Math.cos(angle) * 570}
                y2={600 + Math.sin(angle) * 570}
                stroke='currentColor'
                strokeWidth={1}
              />
            )
          })}
          {RINGS.map((radius, index) => (
            <circle
              key={radius}
              cx={600}
              cy={600}
              r={radius}
              fill='none'
              stroke='currentColor'
              strokeWidth={index % 2 === 0 ? 2 : 1}
              strokeDasharray={index % 2 === 0 ? undefined : '6 10'}
            />
          ))}
          {RINGS.map((radius, index) => {
            const angle = (index * 67 * Math.PI) / 180
            return (
              <circle
                key={`node-${radius}`}
                cx={600 + Math.cos(angle) * radius}
                cy={600 + Math.sin(angle) * radius}
                r={10}
                className='fill-muted-foreground'
              />
            )
          })}
        </svg>
      </div>
    </div>
  )
}
