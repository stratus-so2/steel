'use client'

import {
  Cancel01Icon,
  FullScreenIcon,
  RefreshIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import * as React from 'react'
import ReactGridLayout, {
  type Layout,
  useContainerWidth,
} from 'react-grid-layout'
import { widgetTitle } from '@/app/_components/crm/dashboard/dashboard-canvas'
import { DashboardDisplayProvider } from '@/app/_components/crm/dashboard/dashboard-display'
import { WidgetView } from '@/app/_components/crm/dashboard/widget-view'
import { SteelIcon } from '@/components/icon/icon'
import { cn } from '@/lib/utils'
import { useCrmDashboardWidgets } from '@/src/hooks/use-crm-dashboard-widget'
import { useSdTicketRealtime } from '@/src/hooks/use-sd-tickets'

const COLS = 12
/** Recarrega os dados do painel sozinho (todos os widgets juntos). */
const REFRESH_MS = 30_000
/** Janela mínima entre dois recarregamentos disparados pelo tempo real. */
const REALTIME_THROTTLE_MS = 10_000
/** Sem mexer o mouse por este tempo, o cursor some (telão). */
const CURSOR_IDLE_MS = 4_000
const MIN_ROW_HEIGHT = 28
const MARGIN = 14

export interface SdTvDashboard {
  id: string
  title: string
}

const CLOCK = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})
const DAY = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
})

/** Ids válidos de `?rotate=`, sempre começando pelo painel aberto. */
export function sdTvRotation(
  dashboardId: string,
  rotate: string | undefined,
  available: SdTvDashboard[],
): string[] {
  const known = new Set(available.map((d) => d.id))
  const ids = (rotate ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0 && known.has(id))
  const unique = [dashboardId, ...ids].filter(
    (id, index, all) => all.indexOf(id) === index,
  )
  return unique
}

/** `?interval=` em segundos (10 s a 1 h); 60 s por padrão. */
export function sdTvInterval(interval: string | undefined): number {
  const seconds = Number.parseInt(interval ?? '', 10)
  if (!Number.isFinite(seconds)) return 60
  return Math.min(3600, Math.max(10, seconds))
}

function useClock(): Date {
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  return now
}

/** Esconde o cursor depois de um tempo parado (volta ao primeiro movimento). */
function useIdleCursor(): boolean {
  const [idle, setIdle] = React.useState(false)
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const schedule = () => {
      setIdle(false)
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => setIdle(true), CURSOR_IDLE_MS)
    }
    schedule()
    window.addEventListener('mousemove', schedule)
    window.addEventListener('keydown', schedule)
    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener('mousemove', schedule)
      window.removeEventListener('keydown', schedule)
    }
  }, [])
  return idle
}

function useFullscreen(): { active: boolean; toggle: () => void } {
  const [active, setActive] = React.useState(false)
  React.useEffect(() => {
    const sync = () => setActive(Boolean(document.fullscreenElement))
    sync()
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])
  const toggle = React.useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen?.()
      return
    }
    void document.documentElement.requestFullscreen?.()
  }, [])
  return { active, toggle }
}

function TvButton({
  label,
  icon,
  onClick,
}: {
  label: string
  icon: typeof RefreshIcon
  onClick: () => void
}) {
  return (
    <button
      type='button'
      aria-label={label}
      title={label}
      onClick={onClick}
      className='flex size-9 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white'
    >
      <SteelIcon icon={icon} strokeWidth={2} className='size-4' />
    </button>
  )
}

/**
 * Modo TV de um painel do ServiceDesk: tela cheia, fundo escuro de alto
 * contraste, tipografia grande, relógio ao vivo, auto-refresh de 30 s (mais
 * os eventos do SSE de chamados) e rotação opcional entre painéis
 * (`?rotate=id1,id2&interval=60`). Única tela do módulo escura por projeto.
 */
export function SdDashboardTv({
  workspaceId,
  slug,
  dashboardId,
  dashboards,
  rotate,
  interval,
}: {
  workspaceId: string
  slug: string
  dashboardId: string
  /** Painéis do workspace (nomes da rotação e título do cabeçalho). */
  dashboards: SdTvDashboard[]
  rotate?: string
  interval?: string
}) {
  const rotation = React.useMemo(
    () => sdTvRotation(dashboardId, rotate, dashboards),
    [dashboardId, rotate, dashboards],
  )
  const rotationMs = sdTvInterval(interval) * 1000
  const [index, setIndex] = React.useState(0)
  const currentId = rotation[index] ?? dashboardId
  const current = dashboards.find((d) => d.id === currentId)

  const [refreshKey, setRefreshKey] = React.useState(0)
  const [refreshedAt, setRefreshedAt] = React.useState(() => new Date())
  const lastRefresh = React.useRef(Date.now())

  const refresh = React.useCallback(() => {
    lastRefresh.current = Date.now()
    setRefreshedAt(new Date())
    setRefreshKey((key) => key + 1)
  }, [])

  React.useEffect(() => {
    const timer = setInterval(refresh, REFRESH_MS)
    return () => clearInterval(timer)
  }, [refresh])

  // Evento de chamado (SSE): recarrega na hora, no máximo a cada 10 s.
  useSdTicketRealtime(workspaceId, () => {
    if (Date.now() - lastRefresh.current < REALTIME_THROTTLE_MS) return
    refresh()
  })

  React.useEffect(() => {
    if (rotation.length < 2) return
    const timer = setInterval(
      () => setIndex((value) => (value + 1) % rotation.length),
      rotationMs,
    )
    return () => clearInterval(timer)
  }, [rotation.length, rotationMs])

  const { widgets } = useCrmDashboardWidgets(
    workspaceId,
    currentId,
    'servicedesk',
  )
  const { width, containerRef, mounted } = useContainerWidth()
  const [height, setHeight] = React.useState(0)

  React.useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const sync = () => setHeight(element.clientHeight)
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [containerRef])

  const layout: Layout = React.useMemo(
    () =>
      widgets.map((widget) => ({
        i: widget.id,
        x: widget.x,
        y: widget.y,
        w: widget.w,
        h: widget.h,
        static: true,
      })),
    [widgets],
  )

  // O painel inteiro cabe na tela: a altura da linha vem da altura útil.
  const rows = React.useMemo(
    () => widgets.reduce((max, w) => Math.max(max, w.y + w.h), 0),
    [widgets],
  )
  const rowHeight =
    rows > 0 && height > 0
      ? Math.max(MIN_ROW_HEIGHT, (height - MARGIN * (rows + 1)) / rows)
      : 48

  const now = useClock()
  const idle = useIdleCursor()
  const fullscreen = useFullscreen()

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col bg-zinc-950 text-zinc-50',
        idle && 'cursor-none',
      )}
    >
      <header className='flex shrink-0 items-center gap-4 border-zinc-800 border-b px-6 py-3'>
        <div className='min-w-0 flex-1'>
          <h1 className='truncate font-semibold text-2xl tracking-tight 2xl:text-4xl'>
            {current?.title || 'Painel'}
          </h1>
          <p className='mt-0.5 text-sm text-zinc-400 2xl:text-lg'>
            Atualizado às {CLOCK.format(refreshedAt)}
            {rotation.length > 1
              ? ` · painel ${index + 1} de ${rotation.length}`
              : ''}
          </p>
        </div>
        <div className='text-right'>
          <p className='font-semibold text-3xl tabular-nums 2xl:text-6xl'>
            <span className='sr-only'>Hora atual: </span>
            {CLOCK.format(now)}
          </p>
          <p className='text-sm text-zinc-400 capitalize 2xl:text-lg'>
            {DAY.format(now)}
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <TvButton
            label='Atualizar agora'
            icon={RefreshIcon}
            onClick={refresh}
          />
          <TvButton
            label={fullscreen.active ? 'Sair da tela cheia' : 'Tela cheia'}
            icon={FullScreenIcon}
            onClick={fullscreen.toggle}
          />
          <Link
            href={`/${slug}/servicedesk/dashboards/${dashboardId}`}
            aria-label='Sair do modo TV'
            title='Sair do modo TV'
            className='flex size-9 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white'
          >
            <SteelIcon icon={Cancel01Icon} strokeWidth={2} className='size-4' />
          </Link>
        </div>
      </header>

      <div ref={containerRef} className='min-h-0 flex-1 overflow-hidden p-3'>
        {widgets.length === 0 ? (
          <p className='flex h-full items-center justify-center text-xl text-zinc-400'>
            Este painel ainda não tem widgets.
          </p>
        ) : null}
        {mounted && width > 0 && widgets.length > 0 ? (
          <DashboardDisplayProvider variant='tv' refreshKey={refreshKey}>
            <ReactGridLayout
              width={width}
              layout={layout}
              gridConfig={{
                cols: COLS,
                rowHeight,
                margin: [MARGIN, MARGIN],
                containerPadding: [0, 0],
              }}
              dragConfig={{ enabled: false }}
              resizeConfig={{ enabled: false }}
            >
              {widgets.map((widget) => (
                <div
                  key={widget.id}
                  className='flex h-full w-full flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900'
                >
                  <div className='shrink-0 border-zinc-800 border-b px-4 py-2'>
                    <span className='truncate font-medium text-sm text-zinc-400 uppercase tracking-widest 2xl:text-lg'>
                      {widgetTitle(widget)}
                    </span>
                  </div>
                  <div className='min-h-0 flex-1 p-2'>
                    <WidgetView widget={widget} workspaceId={workspaceId} />
                  </div>
                </div>
              ))}
            </ReactGridLayout>
          </DashboardDisplayProvider>
        ) : null}
      </div>
    </div>
  )
}
