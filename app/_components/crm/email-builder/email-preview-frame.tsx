'use client'

import { useEffect, useRef, useState } from 'react'

export const DESKTOP_WIDTH = 680
export const MOBILE_WIDTH = 375

/** Rough simulation of clients that force dark mode (Gmail app, Outlook):
 * the whole message is inverted and images are flipped back. */
const DARK_SIMULATION =
  'html{filter:invert(1) hue-rotate(180deg);background:#fff}img{filter:invert(1) hue-rotate(180deg)}'

function selectionCss(selectedId: string | null) {
  const base =
    '[data-section-id]{cursor:pointer;transition:outline-color .1s}' +
    '[data-section-id]:hover{outline:2px dashed rgba(40,147,204,.55);outline-offset:-2px}'
  if (!selectedId) return base
  const id = selectedId.replace(/["\\]/g, '')
  return `${base}[data-section-id="${id}"],[data-section-id="${id}"]:hover{outline:2px solid #2893CC;outline-offset:-2px}`
}

/**
 * The rendered e-mail inside a same-origin, script-less iframe (the HTML is
 * the exact `@react-email/render` output). Clicking a section selects it;
 * links never navigate. The frame is scaled to fit the available width.
 */
export function EmailPreviewFrame({
  html,
  width,
  zoom,
  dark,
  selectedId,
  onSelect,
}: {
  html: string
  width: number
  zoom: number
  dark: boolean
  selectedId: string | null
  onSelect: (sectionId: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const [height, setHeight] = useState(600)
  const [available, setAvailable] = useState<number | null>(null)

  useEffect(() => {
    const node = containerRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      setAvailable(entry.contentRect.width)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // Write the document and wire clicks whenever the HTML changes.
  useEffect(() => {
    const doc = frameRef.current?.contentDocument
    if (!doc) return
    doc.open()
    doc.write(html)
    doc.close()

    const style = doc.createElement('style')
    style.id = 'builder-selection'
    doc.head?.appendChild(style)
    const darkStyle = doc.createElement('style')
    darkStyle.id = 'builder-dark'
    doc.head?.appendChild(darkStyle)

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (target?.closest('a')) event.preventDefault()
      const section = target?.closest('[data-section-id]')
      const id = section?.getAttribute('data-section-id')
      if (id) onSelectRef.current(id)
    }
    doc.addEventListener('click', handleClick)

    const measure = () =>
      setHeight(Math.max(doc.documentElement?.scrollHeight ?? 0, 200))
    measure()
    const images = Array.from(doc.images ?? [])
    for (const image of images) image.addEventListener('load', measure)
    return () => {
      doc.removeEventListener('click', handleClick)
      for (const image of images) image.removeEventListener('load', measure)
    }
  }, [html])

  // Selection and dark mode only touch the injected <style> tags.
  useEffect(() => {
    const doc = frameRef.current?.contentDocument
    const style = doc?.getElementById('builder-selection')
    if (style) style.textContent = selectionCss(selectedId)
    const darkStyle = doc?.getElementById('builder-dark')
    if (darkStyle) darkStyle.textContent = dark ? DARK_SIMULATION : ''
  }, [selectedId, dark, html])

  const fit = available ? Math.max((available - 16) / width, 0.2) : 1
  const scale = Math.min(zoom, fit)

  return (
    <div ref={containerRef} className='flex w-full justify-center'>
      <div
        className='shrink-0 overflow-hidden rounded-lg shadow-sm ring-1 ring-border'
        style={{ width: width * scale, height: height * scale }}
      >
        <iframe
          ref={frameRef}
          title='Pré-visualização do e-mail'
          sandbox='allow-same-origin'
          className='block border-0 bg-white'
          style={{
            width,
            height,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
          data-testid='email-preview-frame'
          data-width={width}
          data-dark={dark ? 'true' : 'false'}
        />
      </div>
    </div>
  )
}
