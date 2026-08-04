'use client'

import {
  Add01Icon,
  Delete02Icon,
  PencilEdit02Icon,
  Tick02Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import * as React from 'react'
import ReactGridLayout, {
  type Layout,
  useContainerWidth,
} from 'react-grid-layout'
import { WIDGET_TYPE_META } from '@/app/_components/crm/dashboard/widget-meta'
import { WidgetPanel } from '@/app/_components/crm/dashboard/widget-panel'
import { WidgetView } from '@/app/_components/crm/dashboard/widget-view'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  applyCrmDashboardWidgetLayout,
  deleteCrmDashboardWidget,
  useCrmDashboardWidgets,
} from '@/src/hooks/use-crm-dashboard-widget'
import type { CrmDashboardWidgetDTO } from '@/types/crm-dashboard'

const COLS = 12
const ROW_HEIGHT = 40

function layoutSignature(layout: Layout): string {
  return layout
    .map((item) => `${item.i}:${item.x},${item.y},${item.w},${item.h}`)
    .sort()
    .join('|')
}

function typeLabel(type: CrmDashboardWidgetDTO['type']): string {
  return WIDGET_TYPE_META.find((meta) => meta.type === type)?.label ?? type
}

export function DashboardCanvas({
  workspaceId,
  dashboardId,
  basePath = 'crm',
}: {
  workspaceId: string
  dashboardId: string
  /** Segmento de módulo da API (`crm` ou `whatsapp`). */
  basePath?: string
}) {
  const { widgets, setWidgets, isLoading } = useCrmDashboardWidgets(
    workspaceId,
    dashboardId,
    basePath,
  )
  const { width, containerRef, mounted } = useContainerWidth()

  const [editMode, setEditMode] = React.useState(false)
  const [panelOpen, setPanelOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<CrmDashboardWidgetDTO | null>(
    null,
  )

  const layout: Layout = React.useMemo(
    () =>
      widgets.map((w) => ({
        i: w.id,
        x: w.x,
        y: w.y,
        w: w.w,
        h: w.h,
        minW: 2,
        // CHART precisa de altura mínima maior: com menos espaço, eixo/legenda
        // dos gráficos nivo se sobrepõem aos tick labels.
        minH: w.type === 'CHART' ? 5 : 3,
      })),
    [widgets],
  )

  const lastSig = React.useRef('')
  React.useEffect(() => {
    lastSig.current = layoutSignature(layout)
  }, [layout])

  const persistTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleLayoutChange = React.useCallback(
    (next: Layout) => {
      if (!editMode) return
      const sig = layoutSignature(next)
      if (sig === lastSig.current) return
      lastSig.current = sig

      setWidgets((prev) =>
        prev.map((w) => {
          const item = next.find((n) => n.i === w.id)
          return item ? { ...w, x: item.x, y: item.y, w: item.w, h: item.h } : w
        }),
      )

      if (persistTimer.current) clearTimeout(persistTimer.current)
      persistTimer.current = setTimeout(() => {
        void applyCrmDashboardWidgetLayout(
          workspaceId,
          dashboardId,
          next.map((item) => ({
            id: item.i,
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
          })),
          basePath,
        )
      }, 600)
    },
    [editMode, workspaceId, dashboardId, basePath, setWidgets],
  )

  const nextY = React.useMemo(
    () => widgets.reduce((max, w) => Math.max(max, w.y + w.h), 0),
    [widgets],
  )

  function openNew() {
    setEditing(null)
    setPanelOpen(true)
  }

  function openEdit(widget: CrmDashboardWidgetDTO) {
    setEditing(widget)
    setPanelOpen(true)
  }

  async function handleDelete(widget: CrmDashboardWidgetDTO) {
    const previous = widgets
    setWidgets((prev) => prev.filter((w) => w.id !== widget.id))
    const res = await deleteCrmDashboardWidget(
      workspaceId,
      dashboardId,
      widget.id,
      basePath,
    )
    if (!res.ok) {
      setWidgets(previous)
      notify.error(res.message ?? 'Não foi possível remover o widget.')
    }
  }

  return (
    <div className='flex h-full flex-col'>
      <div className='flex shrink-0 items-center justify-end gap-2 border-b px-4 py-2'>
        <Button variant='outline' size='sm' onClick={openNew}>
          <SteelIcon icon={Add01Icon} strokeWidth={2} />
          Adicionar widget
        </Button>
        <Button
          variant={editMode ? 'default' : 'outline'}
          size='sm'
          onClick={() => setEditMode((v) => !v)}
        >
          <SteelIcon
            icon={editMode ? Tick02Icon : PencilEdit02Icon}
            strokeWidth={2}
          />
          {editMode ? 'Concluir' : 'Editar layout'}
        </Button>
      </div>

      <div ref={containerRef} className='min-h-0 flex-1 overflow-auto p-3'>
        {widgets.length === 0 && !isLoading ? (
          <div className='flex h-[60vh] flex-col items-center justify-center gap-3 text-center'>
            <p className='text-muted-foreground text-sm'>
              Este dashboard ainda não tem widgets.
            </p>
            <Button variant='outline' size='sm' onClick={openNew}>
              <SteelIcon icon={Add01Icon} strokeWidth={2} />
              Adicionar primeiro widget
            </Button>
          </div>
        ) : null}

        {mounted && width > 0 && widgets.length > 0 ? (
          <ReactGridLayout
            width={width}
            layout={layout}
            gridConfig={{
              cols: COLS,
              rowHeight: ROW_HEIGHT,
              margin: [12, 12],
              containerPadding: [0, 0],
            }}
            dragConfig={{ enabled: editMode, handle: '.widget-drag-handle' }}
            resizeConfig={{ enabled: editMode }}
            onLayoutChange={handleLayoutChange}
          >
            {widgets.map((widget) => (
              <div
                key={widget.id}
                className='flex h-full w-full flex-col overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm'
              >
                <div
                  className={cn(
                    'flex shrink-0 items-center justify-between border-b border-border/60 px-3 py-1.5',
                    editMode && 'widget-drag-handle cursor-move bg-muted/40',
                  )}
                >
                  <span className='truncate font-medium text-muted-foreground text-xs uppercase tracking-wide'>
                    {typeLabel(widget.type)}
                  </span>
                  {editMode ? (
                    <div className='flex items-center gap-0.5'>
                      <Button
                        variant='ghost'
                        size='icon-xs'
                        onClick={() => openEdit(widget)}
                        aria-label='Editar widget'
                      >
                        <SteelIcon icon={PencilEdit02Icon} strokeWidth={2} />
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon-xs'
                        className='text-muted-foreground hover:text-destructive'
                        onClick={() => handleDelete(widget)}
                        aria-label='Remover widget'
                      >
                        <SteelIcon icon={Delete02Icon} strokeWidth={2} />
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div className='min-h-0 flex-1 p-2'>
                  <WidgetView widget={widget} workspaceId={workspaceId} />
                </div>
              </div>
            ))}
          </ReactGridLayout>
        ) : null}
      </div>

      <WidgetPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        workspaceId={workspaceId}
        dashboardId={dashboardId}
        basePath={basePath}
        editing={editing}
        nextY={nextY}
        onCreated={(widget) => setWidgets((prev) => [...prev, widget])}
        onUpdated={(widget) =>
          setWidgets((prev) =>
            prev.map((w) => (w.id === widget.id ? widget : w)),
          )
        }
      />
    </div>
  )
}
