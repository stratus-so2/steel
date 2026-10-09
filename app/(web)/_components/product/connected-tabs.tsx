'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { ProductPage } from '@/src/schemas/web-product-page.schema'
import { ProductVisualView } from './visuals/product-visual'

type ConnectedItem = ProductPage['connected']['items'][number]

/** Time each item stays open before the list moves on by itself. */
export const CONNECTED_INTERVAL_MS = 7000

/**
 * The "connected features" list: one item open at a time, with a progress
 * line that walks through the list on its own (paused while the pointer is
 * over it, off with reduced motion). The open item's visual sits beside it.
 */
export function ConnectedTabs({ items }: { items: ConnectedItem[] }) {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [auto, setAuto] = useState(false)

  useEffect(() => {
    setAuto(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  }, [])

  // Restart the progress line from zero whenever the open item changes or
  // the list resumes: render it empty, then fill it on the next frame.
  const [filled, setFilled] = useState(false)
  useEffect(() => {
    setFilled(false)
    if (!auto || paused) return
    const frame = requestAnimationFrame(() => setFilled(true))
    return () => cancelAnimationFrame(frame)
  }, [auto, paused, active])

  // One timer per open item: picking an item (or the timer itself moving on)
  // restarts the countdown.
  useEffect(() => {
    if (!auto || paused) return
    const timer = setTimeout(
      () => setActive((active + 1) % items.length),
      CONNECTED_INTERVAL_MS,
    )
    return () => clearTimeout(timer)
  }, [auto, paused, active, items.length])

  const current = items[active]
  const running = auto && !paused

  return (
    <div
      className='grid items-start gap-10 lg:grid-cols-2 lg:gap-16'
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      <ul className='border-t border-border'>
        {items.map((item, index) => {
          const open = index === active
          return (
            <li key={item.href} className='relative border-b border-border'>
              {open && (
                <span
                  data-testid='connected-progress'
                  className='absolute -top-px left-0 h-0.5 bg-foreground ease-linear'
                  style={{
                    width: running && !filled ? '0%' : '100%',
                    transitionProperty: 'width',
                    transitionDuration:
                      running && filled ? `${CONNECTED_INTERVAL_MS}ms` : '0ms',
                  }}
                />
              )}
              <button
                type='button'
                aria-expanded={open}
                onClick={() => setActive(index)}
                className={cn(
                  'w-full py-5 text-left text-lg font-medium transition-colors',
                  open
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.title}
              </button>
              {open && (
                <div className='-mt-2 space-y-3 pb-5'>
                  <p className='text-muted-foreground'>{item.description}</p>
                  <Link
                    href={item.href}
                    aria-label={`Saiba mais: ${item.title}`}
                    className='inline-block font-medium text-foreground underline-offset-4 hover:underline'
                  >
                    Saiba mais →
                  </Link>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <div
        data-testid='connected-visual'
        className="flex min-h-80 items-center justify-center overflow-hidden rounded-2xl bg-[url('/gradient.png')] bg-cover bg-center p-6 sm:p-12"
      >
        <div
          key={active}
          className='w-full max-w-md animate-in fade-in duration-500'
        >
          <ProductVisualView visual={current.visual} />
        </div>
      </div>
    </div>
  )
}
