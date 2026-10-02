'use client'

import { Eraser01Icon, Undo02Icon } from '@hugeicons-pro/core-stroke-rounded'
import {
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Point = { x: number; y: number }
type Stroke = Point[]

/** Altura lógica do quadro (CSS px); a largura segue o contêiner. */
const HEIGHT = 180

/**
 * Quadro de assinatura em canvas (pointer events: mouse, caneta e toque),
 * nítido em telas de alta densidade. Fundo branco para o PNG ser legível em
 * qualquer tema. `onChange` recebe o PNG (data URL) ou `null` se vazio.
 */
export function SdSignaturePad({
  onChange,
  disabled,
  className,
}: {
  onChange: (dataUrl: string | null) => void
  disabled?: boolean
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const strokes = useRef<Stroke[]>([])
  const current = useRef<Stroke | null>(null)
  const [count, setCount] = useState(0)

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr)
    ctx.strokeStyle = '#111827'
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const stroke of strokes.current) {
      const [first, ...rest] = stroke
      if (!first) continue
      ctx.beginPath()
      ctx.moveTo(first.x, first.y)
      if (rest.length === 0) ctx.lineTo(first.x + 0.1, first.y + 0.1)
      for (const p of rest) ctx.lineTo(p.x, p.y)
      ctx.stroke()
    }
  }, [])

  const resize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const width = canvas.parentElement?.clientWidth || 480
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(HEIGHT * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${HEIGHT}px`
    redraw()
  }, [redraw])

  useEffect(() => {
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [resize])

  const emit = useCallback(() => {
    setCount(strokes.current.length)
    const canvas = canvasRef.current
    onChange(
      strokes.current.length > 0 && canvas
        ? canvas.toDataURL('image/png')
        : null,
    )
  }, [onChange])

  function point(e: PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function onPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    if (disabled) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    current.current = [point(e)]
    strokes.current.push(current.current)
    redraw()
  }

  function onPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (!current.current) return
    current.current.push(point(e))
    redraw()
  }

  function onPointerUp() {
    if (!current.current) return
    current.current = null
    emit()
  }

  function undo() {
    strokes.current.pop()
    redraw()
    emit()
  }

  function clear() {
    strokes.current = []
    redraw()
    emit()
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className='relative w-full overflow-hidden rounded-lg border border-border border-dashed bg-white'>
        <canvas
          ref={canvasRef}
          aria-label='Quadro de assinatura'
          role='img'
          className={cn(
            'block touch-none',
            disabled ? 'cursor-not-allowed' : 'cursor-crosshair',
          )}
          style={{ height: HEIGHT }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerUp}
        />
        {count === 0 ? (
          <span className='pointer-events-none absolute inset-x-0 bottom-8 text-center text-muted-foreground text-sm'>
            Assine aqui
          </span>
        ) : null}
        <div className='pointer-events-none absolute inset-x-6 bottom-6 border-border border-b' />
      </div>
      <div className='flex gap-1.5'>
        <Button
          type='button'
          size='xs'
          variant='outline'
          onClick={undo}
          disabled={disabled || count === 0}
        >
          <SteelIcon icon={Undo02Icon} />
          Desfazer
        </Button>
        <Button
          type='button'
          size='xs'
          variant='ghost'
          onClick={clear}
          disabled={disabled || count === 0}
        >
          <SteelIcon icon={Eraser01Icon} />
          Limpar
        </Button>
      </div>
    </div>
  )
}
