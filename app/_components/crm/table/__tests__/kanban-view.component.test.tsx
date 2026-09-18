import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CrmKanbanView } from '../kanban-view'

// dnd-kit needs real layout to resolve a drop target, which jsdom does not
// provide. The UI primitives are replaced by plain containers and the
// `onValueCommit` callback is captured so a drop can be simulated directly —
// what we verify is how the CRM view translates a drop into `onMove`.
type CommitMeta = {
  kind: 'item' | 'column'
  activeContainer: string
  overContainer: string
  event: { active: { id: string } }
}
const kanban = vi.hoisted(() => ({
  commit: null as null | ((next: unknown, meta: CommitMeta) => void),
}))

vi.mock('@/components/ui/kanban', () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  return {
    Kanban: ({
      children,
      onValueCommit,
    }: {
      children?: ReactNode
      onValueCommit: (next: unknown, meta: CommitMeta) => void
    }) => {
      kanban.commit = onValueCommit
      return <div>{children}</div>
    },
    KanbanBoard: Box,
    KanbanColumn: ({
      children,
      value,
    }: {
      children?: ReactNode
      value: string
    }) => <section data-testid={`column-${value}`}>{children}</section>,
    KanbanColumnContent: Box,
    KanbanItem: Box,
    KanbanItemHandle: ({
      children,
      onClick,
    }: {
      children?: ReactNode
      onClick?: () => void
    }) => (
      <button type='button' onClick={onClick}>
        {children}
      </button>
    ),
    KanbanOverlay: () => null,
  }
})

type Task = { id: string; title: string; status: string | null }

const COLUMNS = [
  { value: 'TODO', label: 'A fazer' },
  { value: 'IN_PROGRESS', label: 'Em andamento' },
  { value: 'DONE', label: 'Concluído' },
]

const ITEMS: Task[] = [
  { id: 't1', title: 'Ligar para o cliente', status: 'TODO' },
  { id: 't2', title: 'Enviar proposta', status: 'TODO' },
  { id: 't3', title: 'Reunião de kickoff', status: 'DONE' },
  { id: 't4', title: 'Sem status', status: null },
]

function renderBoard(overrides: { onCardClick?: (id: string) => void } = {}) {
  const onMove = vi.fn()
  render(
    <CrmKanbanView
      items={ITEMS}
      groupByKey='status'
      columns={COLUMNS}
      onMove={onMove}
      renderCard={(t) => <span>{t.title}</span>}
      {...overrides}
    />,
  )
  return { onMove }
}

function column(value: string) {
  return within(screen.getByTestId(`column-${value}`))
}

describe('<CrmKanbanView />', () => {
  it('groups items into the declared columns with their counts', () => {
    renderBoard()

    expect(column('TODO').getByText('A fazer')).toBeTruthy()
    expect(column('TODO').getByText('Ligar para o cliente')).toBeTruthy()
    expect(column('TODO').getByText('Enviar proposta')).toBeTruthy()
    expect(column('TODO').getByText('2')).toBeTruthy()
    expect(column('DONE').getByText('Reunião de kickoff')).toBeTruthy()
    expect(column('DONE').getByText('1')).toBeTruthy()
  })

  it('shows an empty placeholder for columns without items', () => {
    renderBoard()
    expect(column('IN_PROGRESS').getByText('Vazio')).toBeTruthy()
    expect(column('IN_PROGRESS').getByText('0')).toBeTruthy()
    expect(column('TODO').queryByText('Vazio')).toBeNull()
  })

  it('does not render items whose group value has no declared column', () => {
    renderBoard()
    expect(screen.queryByText('Sem status')).toBeNull()
  })

  it('opens the record when a card is clicked', () => {
    const onCardClick = vi.fn()
    renderBoard({ onCardClick })
    fireEvent.click(screen.getByText('Enviar proposta'))
    expect(onCardClick).toHaveBeenCalledWith('t2')
  })

  it('calls onMove with the target column when a card changes column', () => {
    const { onMove } = renderBoard()
    kanban.commit?.(
      {},
      {
        kind: 'item',
        activeContainer: 'TODO',
        overContainer: 'IN_PROGRESS',
        event: { active: { id: 't1' } },
      },
    )
    expect(onMove).toHaveBeenCalledWith('t1', 'IN_PROGRESS')
  })

  it('ignores reorders within the same column and column drags', () => {
    const { onMove } = renderBoard()
    kanban.commit?.(
      {},
      {
        kind: 'item',
        activeContainer: 'TODO',
        overContainer: 'TODO',
        event: { active: { id: 't1' } },
      },
    )
    kanban.commit?.(
      {},
      {
        kind: 'column',
        activeContainer: 'TODO',
        overContainer: 'DONE',
        event: { active: { id: 'TODO' } },
      },
    )
    expect(onMove).not.toHaveBeenCalled()
  })
})
