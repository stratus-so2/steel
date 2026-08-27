'use client'

import * as React from 'react'
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnContent,
  KanbanItem,
  KanbanOverlay,
} from '@/components/ui/kanban'
import { cn } from '@/lib/utils'

export type CrmKanbanColumnDef = {
  value: string
  label: string
  className?: string
}

/**
 * View de kanban genérica para o CRM: agrupa `items` por `groupByKey` nas
 * colunas declaradas em `columns` e chama `onMove` quando um card é
 * arrastado pra outra coluna (o caller decide o que fazer — normalmente
 * `patch(itemId, { [groupByKey]: toColumn })`). Reaproveitável por
 * qualquer tabela que tenha um campo categórico fixo (status, etc.).
 */
export function CrmKanbanView<TData extends { id: string }>({
  items,
  groupByKey,
  columns,
  onMove,
  renderCard,
}: {
  items: TData[]
  groupByKey: string
  columns: CrmKanbanColumnDef[]
  onMove: (itemId: string, toColumn: string) => void
  renderCard: (item: TData) => React.ReactNode
}) {
  const grouped = React.useMemo(() => {
    const map: Record<string, TData[]> = {}
    for (const col of columns) map[col.value] = []
    for (const item of items) {
      const raw = (item as Record<string, unknown>)[groupByKey]
      const key = raw == null ? '' : String(raw)
      if (!map[key]) map[key] = []
      map[key].push(item)
    }
    return map
  }, [items, columns, groupByKey])

  const [value, setValue] = React.useState(grouped)
  React.useEffect(() => setValue(grouped), [grouped])

  const itemsById = React.useMemo(() => {
    const map = new Map<string, TData>()
    for (const item of items) map.set(item.id, item)
    return map
  }, [items])

  return (
    <Kanban
      value={value}
      onValueChange={setValue}
      getItemValue={(item) => item.id}
      restoreOnCancel
      onValueCommit={(_next, meta) => {
        if (meta.kind !== 'item') return
        if (meta.activeContainer === meta.overContainer) return
        onMove(String(meta.event.active.id), meta.overContainer)
      }}
    >
      <KanbanBoard className='flex flex-1 items-start gap-3 overflow-x-auto pb-2 sm:grid-cols-none'>
        {columns.map((col) => {
          const colItems = value[col.value] ?? []
          return (
            <KanbanColumn
              key={col.value}
              value={col.value}
              className='flex h-full w-72 shrink-0 flex-col rounded-xl border bg-card/40'
            >
              <div className='flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5'>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 font-medium text-xs',
                    col.className,
                  )}
                >
                  {col.label}
                </span>
                <span className='text-muted-foreground text-xs'>
                  {colItems.length}
                </span>
              </div>
              <KanbanColumnContent
                value={col.value}
                className='min-h-16 flex-1 gap-2 overflow-y-auto p-2'
              >
                {colItems.map((item) => (
                  <KanbanItem
                    key={item.id}
                    value={item.id}
                    className='cursor-grab rounded-lg border bg-card p-3 text-sm shadow-xs active:cursor-grabbing'
                  >
                    {renderCard(item)}
                  </KanbanItem>
                ))}
                {colItems.length === 0 ? (
                  <div className='rounded-lg border border-dashed p-4 text-center text-muted-foreground text-xs'>
                    Vazio
                  </div>
                ) : null}
              </KanbanColumnContent>
            </KanbanColumn>
          )
        })}
      </KanbanBoard>
      <KanbanOverlay>
        {({ value: activeId, variant }) => {
          if (variant !== 'item') return null
          const item = itemsById.get(String(activeId))
          if (!item) return null
          return (
            <div className='w-72 rounded-lg border bg-card p-3 text-sm shadow-md'>
              {renderCard(item)}
            </div>
          )
        }}
      </KanbanOverlay>
    </Kanban>
  )
}
