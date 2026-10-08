'use client'

import type { RefObject } from 'react'
import { useShortcut, useShortcuts } from './shortcuts-provider'

/**
 * Rows are any focusable element inside the list container carrying
 * `data-shortcut-row="<id>"`; kanban cards also carry
 * `data-shortcut-column="<column id>"`. Focus is the real DOM focus, so
 * screen readers follow J/K and Tab keeps working. A row with
 * `data-shortcut-href` opens that page on Enter/O.
 *
 * Callbacks may return `false` when the action does not apply (the key
 * then goes on to the browser).
 */
export const ROW_SELECTOR = '[data-shortcut-row]'

export type ListShortcutOptions = {
  containerRef: RefObject<HTMLElement | null>
  enabled?: boolean
  /** Enter/O on the row in focus; default follows its href or clicks it. */
  onOpen?: (id: string, row: HTMLElement) => unknown
  isSelected?: (id: string) => boolean
  onToggleSelect?: (id: string) => unknown
  onSelectAll?: () => unknown
  /** Esc: return `false` when there was nothing to clear. */
  onClearSelection?: () => unknown
  /** `/`: focus the list search; without it the global search opens. */
  onSearch?: () => unknown
  onFilters?: () => unknown
  onNew?: () => unknown
  onEdit?: (id: string) => unknown
  /** `#`: delete the selection (or the row in focus); ask before. */
  onDelete?: (id: string | null) => unknown
  onToggleView?: () => unknown
  /** Kanban: Shift+←/→ moves the card to the previous/next column. */
  onMove?: (id: string, columnId: string, direction: -1 | 1) => unknown
}

function rowsOf(container: HTMLElement | null): HTMLElement[] {
  return container
    ? [...container.querySelectorAll<HTMLElement>(ROW_SELECTOR)]
    : []
}

/** The row holding the focus (or `null` when focus is elsewhere). */
export function focusedRow(container: HTMLElement | null): HTMLElement | null {
  const active = document.activeElement
  if (!container || !(active instanceof HTMLElement)) return null
  const row = active.closest<HTMLElement>(ROW_SELECTOR)
  return row && container.contains(row) ? row : null
}

function rowId(row: HTMLElement): string {
  return row.dataset.shortcutRow ?? ''
}

function focus(row: HTMLElement | undefined) {
  if (!row) return
  row.focus()
  row.scrollIntoView?.({ block: 'nearest' })
}

/**
 * Ordered column ids of a kanban: the `data-shortcut-column-id` containers
 * (empty columns included), else the columns of the cards.
 */
function columnsOf(container: HTMLElement | null, rows: HTMLElement[]) {
  const ids: string[] = []
  const columns = container?.querySelectorAll<HTMLElement>(
    '[data-shortcut-column-id]',
  )
  for (const column of columns ?? []) {
    const id = column.dataset.shortcutColumnId
    if (id && !ids.includes(id)) ids.push(id)
  }
  for (const row of rows) {
    const id = row.dataset.shortcutColumn
    if (id && !ids.includes(id)) ids.push(id)
  }
  return ids
}

/**
 * Common list/table/kanban shortcuts (`list.*`, `kanban.*`). Each one is
 * only bound when its callback is given; J/K/X/Shift+J/K work on the DOM
 * rows. Arrow keys and Ctrl+A act only with the focus inside the list, so
 * the page keeps scrolling and selecting text normally elsewhere.
 */
export function useListShortcuts(options: ListShortcutOptions) {
  const ctx = useShortcuts()
  const {
    containerRef,
    enabled = true,
    onOpen,
    isSelected,
    onToggleSelect,
    onSelectAll,
    onClearSelection,
    onSearch,
    onFilters,
    onNew,
    onEdit,
    onDelete,
    onToggleView,
    onMove,
  } = options
  const container = () => containerRef.current

  function step(delta: 1 | -1, keys: string) {
    const rows = rowsOf(container())
    if (rows.length === 0) return false
    const current = focusedRow(container())
    // Arrows only move once the list has the focus.
    if (!current && keys.startsWith('arrow')) return false
    const index = current ? rows.indexOf(current) : -1
    const next =
      index < 0
        ? delta > 0
          ? rows[0]
          : rows[rows.length - 1]
        : rows[Math.min(Math.max(index + delta, 0), rows.length - 1)]
    focus(next)
  }

  useShortcut('list.next', (_e, keys) => step(1, keys), { enabled })
  useShortcut('list.prev', (_e, keys) => step(-1, keys), { enabled })

  useShortcut(
    'list.open',
    (_e, keys) => {
      const row = focusedRow(container())
      if (!row) return false
      // Links and buttons open with their own Enter.
      if (keys === 'enter' && (row.tagName === 'A' || row.tagName === 'BUTTON'))
        return false
      if (onOpen) return onOpen(rowId(row), row)
      const href = row.dataset.shortcutHref
      if (href) ctx?.navigate(href)
      else row.click()
    },
    { enabled },
  )

  useShortcut(
    'list.toggle-select',
    () => {
      const row = focusedRow(container())
      if (!row || !onToggleSelect) return false
      return onToggleSelect(rowId(row))
    },
    { enabled: enabled && Boolean(onToggleSelect) },
  )

  function extend(delta: 1 | -1) {
    if (!onToggleSelect) return false
    const rows = rowsOf(container())
    const current = focusedRow(container())
    if (!current) return false
    const id = rowId(current)
    if (!isSelected?.(id)) onToggleSelect(id)
    const next = rows[rows.indexOf(current) + delta]
    if (!next) return
    if (!isSelected?.(rowId(next))) onToggleSelect(rowId(next))
    focus(next)
  }
  useShortcut('list.extend-down', () => extend(1), {
    enabled: enabled && Boolean(onToggleSelect),
  })
  useShortcut('list.extend-up', () => extend(-1), {
    enabled: enabled && Boolean(onToggleSelect),
  })

  useShortcut(
    'list.select-all',
    () => {
      if (!onSelectAll || !focusedRow(container())) return false
      return onSelectAll()
    },
    { enabled: enabled && Boolean(onSelectAll) },
  )

  useShortcut(
    'list.clear',
    () => (onClearSelection ? onClearSelection() : false),
    {
      enabled: enabled && Boolean(onClearSelection),
    },
  )

  useShortcut(
    'list.search',
    () => {
      if (onSearch) return onSearch()
      return ctx?.trigger('global.search')
    },
    { enabled: enabled && Boolean(onSearch || ctx) },
  )
  useShortcut('list.filters', () => (onFilters ? onFilters() : false), {
    enabled: enabled && Boolean(onFilters),
  })
  useShortcut('list.new', () => (onNew ? onNew() : false), {
    enabled: enabled && Boolean(onNew),
  })
  useShortcut(
    'list.edit',
    () => {
      const row = focusedRow(container())
      if (!row || !onEdit) return false
      return onEdit(rowId(row))
    },
    { enabled: enabled && Boolean(onEdit) },
  )
  useShortcut(
    'list.delete',
    () => {
      const row = focusedRow(container())
      return onDelete?.(row ? rowId(row) : null)
    },
    { enabled: enabled && Boolean(onDelete) },
  )
  useShortcut(
    'list.toggle-view',
    () => (onToggleView ? onToggleView() : false),
    {
      enabled: enabled && Boolean(onToggleView),
    },
  )

  function column(delta: -1 | 1) {
    const rows = rowsOf(container())
    const current = focusedRow(container())
    if (!current) return false
    const columns = columnsOf(container(), rows)
    const inColumn = (id: string) =>
      rows.filter((row) => row.dataset.shortcutColumn === id)
    const index = columns.indexOf(current.dataset.shortcutColumn ?? '')
    const position = inColumn(columns[index]).indexOf(current)
    // Skips empty columns on the way.
    for (let i = index + delta; i >= 0 && i < columns.length; i += delta) {
      const targetRows = inColumn(columns[i])
      if (targetRows.length > 0) {
        focus(targetRows[Math.min(position, targetRows.length - 1)])
        return
      }
    }
  }
  const isKanban = () => columnsOf(container(), rowsOf(container())).length > 0
  useShortcut('kanban.prev-column', () => (isKanban() ? column(-1) : false), {
    enabled,
  })
  useShortcut('kanban.next-column', () => (isKanban() ? column(1) : false), {
    enabled,
  })

  function move(direction: -1 | 1) {
    const current = focusedRow(container())
    if (!current || !onMove) return false
    const columns = columnsOf(container(), rowsOf(container()))
    const index = columns.indexOf(current.dataset.shortcutColumn ?? '')
    const target = columns[index + direction]
    if (!target) return
    return onMove(rowId(current), target, direction)
  }
  useShortcut('kanban.move-left', () => move(-1), {
    enabled: enabled && Boolean(onMove),
  })
  useShortcut('kanban.move-right', () => move(1), {
    enabled: enabled && Boolean(onMove),
  })
}
