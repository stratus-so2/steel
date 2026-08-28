'use client'

import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { useRef, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { cn } from '@/lib/utils'

export type SimpleCarouselProps = {
  children: React.ReactNode
  className?: string
  /** classe do container scrollável (grid/flex + gap dos itens) */
  trackClassName?: string
}

/**
 * Carrossel horizontal sem dependência nova — scroll-snap nativo + dois
 * botões que chamam `scrollBy` num ref, desabilitados nas pontas. Não existe
 * embla/swiper no projeto; isso cobre o caso de uso (avançar/voltar uma
 * grade de cards) sem puxar uma lib inteira pra isso.
 */
export function SimpleCarousel({
  children,
  className,
  trackClassName,
}: SimpleCarouselProps) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  function updateEdges() {
    const el = trackRef.current
    if (!el) return
    setAtStart(el.scrollLeft <= 1)
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1)
  }

  function scrollByAmount(direction: 1 | -1) {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: 'smooth' })
  }

  return (
    <div className={cn('relative', className)}>
      <div
        ref={trackRef}
        onScroll={updateEdges}
        className={cn(
          'flex snap-x snap-mandatory scroll-px-6 gap-6 overflow-x-auto scrollbar-hidden',
          trackClassName,
        )}
      >
        {children}
      </div>

      <div className='mt-6 flex items-center justify-center gap-3'>
        <button
          type='button'
          onClick={() => scrollByAmount(-1)}
          disabled={atStart}
          aria-label='Anterior'
          className='flex size-10 items-center justify-center rounded-full border transition-opacity disabled:opacity-30 hover:bg-muted/50'
        >
          <SteelIcon icon={ArrowLeft01Icon} strokeWidth={2} size={18} />
        </button>
        <button
          type='button'
          onClick={() => scrollByAmount(1)}
          disabled={atEnd}
          aria-label='Próximo'
          className='flex size-10 items-center justify-center rounded-full border transition-opacity disabled:opacity-30 hover:bg-muted/50'
        >
          <SteelIcon icon={ArrowRight01Icon} strokeWidth={2} size={18} />
        </button>
      </div>
    </div>
  )
}
