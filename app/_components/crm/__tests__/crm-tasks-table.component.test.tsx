import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  type FetchRoute,
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import { CrmTasksTable } from '../crm-tasks-table'

const notify = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}))
vi.mock('@/lib/notify', () => ({ notify }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/acme/crm/tasks',
}))

function task(overrides: Record<string, unknown>) {
  return {
    id: 't1',
    title: 'Ligar para o cliente',
    status: 'TODO',
    dueDate: null,
    assigneeId: null,
    companyId: null,
    personId: null,
    opportunityId: null,
    body: null,
    createdById: 'u1',
    updatedById: 'u1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  }
}

const TASKS = [
  task({ id: 't1', title: 'Ligar para o cliente', status: 'TODO' }),
  task({
    id: 't2',
    title: 'Enviar contrato',
    status: 'IN_PROGRESS',
    dueDate: '2026-03-10T12:00:00.000Z',
  }),
  task({ id: 't3', title: 'Reunião de kickoff', status: 'DONE' }),
]

function baseRoutes(tasks: unknown[] = TASKS): FetchRoute[] {
  return [
    { match: /\/crm\/tasks$/, data: tasks },
    { match: /\/crm\/companies$/, data: [] },
    { match: /\/crm\/people$/, data: [] },
    { match: /\/crm\/opportunities$/, data: [] },
    { match: /\/crm\/members$/, data: [{ id: 'u1', name: 'Ana Souza' }] },
  ]
}

function renderTable() {
  return renderWithQuery(<CrmTasksTable workspaceId='ws1' slug='acme' />)
}

function storage(): Storage | undefined {
  try {
    return window.localStorage ?? undefined
  } catch {
    return undefined
  }
}

describe('<CrmTasksTable />', { timeout: 15_000 }, () => {
  beforeEach(() => {
    storage()?.clear?.()
  })

  it('renders tasks with their status labels in the table view', async () => {
    mockFetch(baseRoutes())
    renderTable()

    const row = (await screen.findByText('Enviar contrato')).closest(
      'tr',
    ) as HTMLElement
    expect(within(row).getByText('Em andamento')).toBeTruthy()
    expect(screen.getByText('A fazer')).toBeTruthy()
    expect(screen.getByText('Concluído')).toBeTruthy()
  })

  it('creates a task defaulting its status to "A fazer"', async () => {
    const fetchSpy = mockFetch([
      ...baseRoutes([]),
      {
        method: 'POST',
        match: /\/crm\/tasks$/,
        data: task({ id: 't9', title: 'Sem título' }),
      },
    ])
    renderTable()
    await screen.findByText('Nada por aqui ainda')

    fireEvent.click(screen.getAllByText(/^Nov[oa] tarefa$/)[0])

    await waitFor(() =>
      expect(fetchBody(fetchSpy, /\/crm\/tasks$/)).toEqual({
        title: 'Sem título',
        status: 'TODO',
      }),
    )
  })

  it('switches to the kanban view grouping tasks by status', async () => {
    mockFetch(baseRoutes())
    renderTable()
    await screen.findByText('Ligar para o cliente')

    fireEvent.click(screen.getByLabelText('Visualizar em kanban'))

    // Kanban cards: one per task, each column with its count; the due date
    // is rendered in pt-BR on the card.
    await waitFor(() => expect(screen.queryByRole('table')).toBeNull())
    expect(screen.getByText('Enviar contrato')).toBeTruthy()
    expect(screen.getByText('10/03/2026')).toBeTruthy()
    expect(screen.getByText('A fazer')).toBeTruthy()
    expect(screen.getByText('Em andamento')).toBeTruthy()
    expect(screen.getByText('Concluído')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Visualizar em tabela'))
    expect(await screen.findByRole('table')).toBeTruthy()
  })

  it('opens the details panel when a kanban card is clicked', async () => {
    mockFetch(baseRoutes())
    renderTable()
    await screen.findByText('Ligar para o cliente')
    fireEvent.click(screen.getByLabelText('Visualizar em kanban'))

    fireEvent.click(await screen.findByText('Reunião de kickoff'))

    expect(await screen.findByText('Salvar')).toBeTruthy()
    expect(screen.getByText('Excluir')).toBeTruthy()
    expect(screen.getByText('tarefa')).toBeTruthy()
  })
})
