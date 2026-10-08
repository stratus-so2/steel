'use client'

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { Alert02Icon, PlusSignIcon } from '@hugeicons-pro/core-stroke-rounded'
import { type RefObject, useEffect, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { SdTicketDTO } from '@/types/sd-ticket'
import { useSdNow } from '../ticket/sd-ticket-badges'
import { SD_TONE, SD_TONE_TEXT, sdTicketHref } from '../ticket/sd-ticket-meta'
import { SdTicketCard } from './sd-ticket-card'

export interface SdKanbanColumn {
  /** Id da fase (quadro de um tipo) ou categoria (quadro "Todos"). */
  id: string
  name: string
  color: string
  /** % de conclusão da fase (não existe no agrupamento por categoria). */
  percent: number | null
  /** Total na coluna com os filtros (pode ser maior que `items`). */
  count: number
  wipLimit: number
  items: SdTicketDTO[]
}

/** A coluna estourou o limite WIP? (0 = sem limite) */
export function sdWipExceeded(
  column: Pick<SdKanbanColumn, 'count' | 'wipLimit'>,
) {
  return column.wipLimit > 0 && column.count > column.wipLimit
}

function DraggableCard({
  ticket,
  slug,
  now,
  showType,
  columnId,
}: {
  ticket: SdTicketDTO
  slug: string
  now: Date
  showType: boolean
  columnId: string
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: ticket.id,
  })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-shortcut-row={ticket.id}
      data-shortcut-column={columnId}
      data-shortcut-href={sdTicketHref(slug, ticket)}
      className={cn(
        'cursor-grab touch-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:cursor-grabbing',
        isDragging && 'opacity-40',
      )}
    >
      <SdTicketCard ticket={ticket} slug={slug} now={now} showType={showType} />
    </div>
  )
}

function Column({
  column,
  slug,
  now,
  showType,
  onCreate,
  onShowMore,
}: {
  column: SdKanbanColumn
  slug: string
  now: Date
  showType: boolean
  onCreate?: (columnId: string) => void
  onShowMore?: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const exceeded = sdWipExceeded(column)
  const hidden = column.count - column.items.length
  return (
    <section
      aria-label={column.name}
      data-column-id={column.id}
      data-shortcut-column-id={column.id}
      className='flex w-72 shrink-0 flex-col rounded-xl border bg-muted/30'
    >
      <header className='flex flex-col gap-1.5 border-b px-3 pt-2.5 pb-2'>
        <div className='flex items-center gap-2'>
          <span
            className='size-2.5 shrink-0 rounded-full'
            style={{ backgroundColor: column.color }}
          />
          <h3 className='truncate font-semibold text-sm'>{column.name}</h3>
          <span
            className={cn(
              'rounded-md bg-background px-1.5 font-medium text-muted-foreground text-xs tabular-nums',
              exceeded && SD_TONE.red,
            )}
            title={
              column.wipLimit > 0
                ? `Limite WIP: ${column.wipLimit}`
                : 'Chamados na coluna'
            }
          >
            {column.count}
            {column.wipLimit > 0 ? `/${column.wipLimit}` : ''}
          </span>
          {column.percent !== null ? (
            <span className='ml-auto text-[11px] text-muted-foreground tabular-nums'>
              {column.percent}%
            </span>
          ) : null}
          {onCreate ? (
            <Button
              variant='ghost'
              size='icon-xs'
              className={cn(column.percent === null && 'ml-auto')}
              aria-label={`Novo chamado em ${column.name}`}
              onClick={() => onCreate(column.id)}
            >
              <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
            </Button>
          ) : null}
        </div>
        {column.percent !== null ? (
          <div className='h-1 overflow-hidden rounded-full bg-background'>
            <div
              className='h-full rounded-full'
              style={{
                width: `${column.percent}%`,
                backgroundColor: column.color,
              }}
            />
          </div>
        ) : null}
        {exceeded ? (
          <p
            className={cn(
              'flex items-center gap-1 text-[11px]',
              SD_TONE_TEXT.red,
            )}
          >
            <SteelIcon icon={Alert02Icon} strokeWidth={2} className='size-3' />
            Limite WIP excedido ({column.count}/{column.wipLimit})
          </p>
        ) : null}
      </header>
      <div
        ref={setNodeRef}
        className={cn(
          'no-scrollbar flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto p-2 transition-colors',
          isOver && 'bg-primary/5 ring-2 ring-primary/30 ring-inset',
        )}
      >
        {column.items.map((ticket) => (
          <DraggableCard
            key={ticket.id}
            ticket={ticket}
            slug={slug}
            now={now}
            showType={showType}
            columnId={column.id}
          />
        ))}
        {column.items.length === 0 ? (
          <p className='py-6 text-center text-muted-foreground text-xs'>
            Nenhum chamado
          </p>
        ) : null}
        {hidden > 0 ? (
          <button
            type='button'
            onClick={onShowMore}
            className='rounded-md py-1.5 text-muted-foreground text-xs hover:bg-muted hover:text-foreground'
          >
            + {hidden} chamado{hidden === 1 ? '' : 's'} — ver na lista
          </button>
        ) : null}
      </div>
    </section>
  )
}

/**
 * Kanban de chamados com arrastar e soltar (`@dnd-kit`). Quem usa decide o
 * que é uma coluna (fase ou categoria) e trata `onMove`.
 */
export function SdKanbanView({
  columns,
  slug,
  loading,
  showType = false,
  empty,
  onMove,
  onCreate,
  onShowMore,
  moveRef,
}: {
  columns: SdKanbanColumn[]
  slug: string
  loading?: boolean
  showType?: boolean
  /** The "no columns at all" screen — without it the board went blank. */
  empty?: React.ReactNode
  onMove: (ticket: SdTicketDTO, columnId: string) => void
  onCreate?: (columnId: string) => void
  onShowMore?: () => void
  /** Filled with the keyboard move (Shift+←/→) for the board shortcuts. */
  moveRef?: RefObject<((id: string, columnId: string) => boolean) | null>
}) {
  const now = useSdNow()
  const [active, setActive] = useState<SdTicketDTO | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )

  function findTicket(id: string) {
    for (const column of columns) {
      const ticket = column.items.find((t) => t.id === id)
      if (ticket) return { ticket, column }
    }
    return null
  }

  // Shift+←/→ on a focused card: same path as a drop on the next column.
  useEffect(() => {
    if (!moveRef) return
    moveRef.current = (id, columnId) => {
      const found = findTicket(id)
      if (!found) return false
      onMove(found.ticket, columnId)
      return true
    }
    return () => {
      moveRef.current = null
    }
  })

  function handleStart(event: DragStartEvent) {
    setActive(findTicket(String(event.active.id))?.ticket ?? null)
  }

  function handleEnd(event: DragEndEvent) {
    setActive(null)
    const found = findTicket(String(event.active.id))
    const target = event.over ? String(event.over.id) : null
    if (!found || !target || target === found.column.id) return
    onMove(found.ticket, target)
  }

  if (loading) {
    return (
      <div className='flex h-full gap-3 overflow-hidden p-4'>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={`sk-${i}`}
            className='flex w-72 shrink-0 flex-col gap-2 rounded-xl border p-3'
          >
            <Skeleton className='h-4 w-32' />
            <Skeleton className='h-24 w-full' />
            <Skeleton className='h-24 w-full' />
          </div>
        ))}
      </div>
    )
  }

  if (columns.length === 0 && empty) return <>{empty}</>

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleStart}
      onDragEnd={handleEnd}
      onDragCancel={() => setActive(null)}
    >
      <div className='flex h-full min-h-0 items-stretch gap-3 overflow-x-auto p-4'>
        {columns.map((column) => (
          <Column
            key={column.id}
            column={column}
            slug={slug}
            now={now}
            showType={showType}
            onCreate={onCreate}
            onShowMore={onShowMore}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {active ? (
          <SdTicketCard
            ticket={active}
            slug={slug}
            now={now}
            showType={showType}
            dragging
            className='w-68'
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
