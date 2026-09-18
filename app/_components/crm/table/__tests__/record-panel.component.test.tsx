import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { GridColumn } from '@/app/_components/crm/table/grid'
import { fetchBody, mockFetch } from '@/src/__tests__/component-utils'
import type { Lookups } from '@/src/hooks/use-crm-workspace-lookups'
import { RecordPanel } from '../record-panel'

const notify = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}))
vi.mock('@/lib/notify', () => ({ notify }))

const LOOKUPS: Lookups = {
  maps: {
    users: {},
    companies: {},
    people: {},
    opportunities: {},
    pipelines: {},
    stages: {},
    products: {},
  },
  options: {
    users: [],
    companies: [],
    people: [],
    opportunities: [],
    pipelines: [],
    stages: [],
    products: [],
  },
}

const COLUMNS: GridColumn[] = [
  { key: 'name', header: 'Nome', kind: 'text', required: true, primary: true },
  { key: 'city', header: 'Cidade', kind: 'text' },
  { key: 'createdAt', header: 'Criado em', kind: 'readonly-date' },
]

const RECORD = {
  id: 'p1',
  name: 'Ada Lovelace',
  city: 'Londres',
  createdAt: '2026-01-01T00:00:00.000Z',
}

function renderPanel(
  overrides: Partial<Parameters<typeof RecordPanel>[0]> = {},
) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    record: RECORD,
    columns: COLUMNS,
    workspaceId: 'ws1',
    slug: 'acme',
    resource: 'people',
    title: 'pessoa',
    lookups: LOOKUPS,
    onSaved: vi.fn(),
    onDeleted: vi.fn(),
    ...overrides,
  }
  render(<RecordPanel {...props} />)
  return props
}

function editText(current: string, next: string) {
  fireEvent.click(screen.getByRole('button', { name: current }))
  const input = screen.getByDisplayValue(current)
  fireEvent.change(input, { target: { value: next } })
  fireEvent.blur(input)
}

describe('<RecordPanel />', () => {
  it('renders the entity title and each column label with its value', () => {
    renderPanel()
    expect(screen.getByText('pessoa')).toBeTruthy()
    expect(screen.getByText('Nome')).toBeTruthy()
    expect(screen.getByText('Cidade')).toBeTruthy()
    expect(screen.getByText('Ada Lovelace')).toBeTruthy()
    expect(screen.getByText('Londres')).toBeTruthy()
  })

  it('closes without a request when nothing changed', async () => {
    const fetchSpy = mockFetch([])
    const props = renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(props.onOpenChange).toHaveBeenCalledWith(false))
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('PATCHes only the changed fields and reports the saved record', async () => {
    const saved = { ...RECORD, city: 'Recife, PE' }
    const fetchSpy = mockFetch([
      { method: 'PATCH', match: '/crm/people/p1', data: saved },
    ])
    const props = renderPanel()

    editText('Londres', 'Recife, PE')
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(props.onSaved).toHaveBeenCalledWith(saved))
    expect(fetchBody(fetchSpy, '/crm/people/p1', 'PATCH')).toEqual({
      city: 'Recife, PE',
    })
    expect(props.onOpenChange).toHaveBeenCalledWith(false)
  })

  it('discards clearing a required field instead of saving it empty', async () => {
    const fetchSpy = mockFetch([])
    const props = renderPanel()

    editText('Ada Lovelace', '   ')
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(props.onOpenChange).toHaveBeenCalledWith(false))
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(screen.getByText('Ada Lovelace')).toBeTruthy()
  })

  it('surfaces field errors from the API and keeps the panel open', async () => {
    mockFetch([
      {
        method: 'PATCH',
        match: '/crm/people/p1',
        handler: () =>
          new Response(
            JSON.stringify({
              success: false,
              error: {
                details: { fieldErrors: { city: ['Cidade inválida'] } },
              },
            }),
            { status: 400 },
          ),
      },
    ])
    const props = renderPanel()

    editText('Londres', 'X')
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith('city: Cidade inválida'),
    )
    expect(props.onSaved).not.toHaveBeenCalled()
    expect(props.onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it('requires a second click to confirm deletion', async () => {
    const fetchSpy = mockFetch([
      { method: 'DELETE', match: '/crm/people/p1', data: null },
    ])
    const props = renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(fetchSpy).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }))

    await waitFor(() => expect(props.onDeleted).toHaveBeenCalledWith('p1'))
    expect(props.onOpenChange).toHaveBeenCalledWith(false)
  })

  it('notifies when deletion fails', async () => {
    mockFetch([
      {
        method: 'DELETE',
        match: '/crm/people/p1',
        status: 403,
        error: 'Sem permissão',
      },
    ])
    const props = renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }))

    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith('Sem permissão'),
    )
    expect(props.onDeleted).not.toHaveBeenCalled()
  })

  it('renders extra content for the open record', () => {
    renderPanel({ renderExtra: (r) => <p>Extra de {r.id}</p> })
    expect(screen.getByText('Extra de p1')).toBeTruthy()
  })
})
