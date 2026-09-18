import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  type FetchRoute,
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import { CrmNotesTable } from '../crm-notes-table'

const notify = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}))
vi.mock('@/lib/notify', () => ({ notify }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/acme/crm/notes',
}))

function note(overrides: Record<string, unknown>) {
  return {
    id: 'n1',
    title: 'Reunião de kickoff',
    body: null,
    companyId: 'c1',
    personId: null,
    opportunityId: 'o1',
    createdById: 'u1',
    updatedById: 'u1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  }
}

function baseRoutes(notes: unknown[] = [note({})]): FetchRoute[] {
  return [
    { match: /\/crm\/notes$/, data: notes },
    { match: /\/crm\/companies$/, data: [{ id: 'c1', name: 'Acme Ltda' }] },
    { match: /\/crm\/people$/, data: [] },
    {
      match: /\/crm\/opportunities$/,
      data: [{ id: 'o1', name: 'Renovação Acme' }],
    },
    { match: /\/crm\/members$/, data: [{ id: 'u1', name: 'Ana Souza' }] },
  ]
}

function renderTable() {
  return renderWithQuery(<CrmNotesTable workspaceId='ws1' slug='acme' />)
}

describe('<CrmNotesTable />', { timeout: 15_000 }, () => {
  it('lists notes linked to their company and opportunity', async () => {
    mockFetch(baseRoutes())
    renderTable()

    const row = (await screen.findByText('Reunião de kickoff')).closest(
      'tr',
    ) as HTMLElement
    expect(await within(row).findByText('Acme Ltda')).toBeTruthy()
    expect(within(row).getByText('Renovação Acme')).toBeTruthy()
    expect(screen.getByPlaceholderText('Buscar notas…')).toBeTruthy()
  })

  it('creates an untitled note (title is optional)', async () => {
    const fetchSpy = mockFetch([
      ...baseRoutes([]),
      {
        method: 'POST',
        match: /\/crm\/notes$/,
        data: note({ id: 'n2', title: null }),
      },
    ])
    renderTable()
    await screen.findByText('Nada por aqui ainda')

    fireEvent.click(screen.getAllByText(/^Nov[oa] nota$/)[0])

    await waitFor(() =>
      expect(fetchBody(fetchSpy, /\/crm\/notes$/)).toEqual({}),
    )
    await waitFor(() =>
      expect(screen.queryByText('Nada por aqui ainda')).toBeNull(),
    )
  })

  it('removes a note that failed its first edit right after creation', async () => {
    const fetchSpy = mockFetch([
      ...baseRoutes([]),
      {
        method: 'POST',
        match: /\/crm\/notes$/,
        data: note({
          id: 'n2',
          title: null,
          companyId: null,
          opportunityId: null,
        }),
      },
      {
        method: 'PATCH',
        match: '/crm/notes/n2',
        status: 400,
        error: 'Título muito longo',
      },
      { method: 'DELETE', match: '/crm/notes/n2', data: null },
    ])
    renderTable()
    await screen.findByText('Nada por aqui ainda')

    fireEvent.click(screen.getAllByText(/^Nov[oa] nota$/)[0])
    const input = await screen.findByPlaceholderText('Reunião de kickoff')
    fireEvent.change(input, { target: { value: 'x'.repeat(10) } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith('Título muito longo'),
    )
    await waitFor(() =>
      expect(
        fetchSpy.mock.calls.some(
          ([u, init]) =>
            init?.method === 'DELETE' && String(u).endsWith('/crm/notes/n2'),
        ),
      ).toBe(true),
    )
    expect(await screen.findByText('Nada por aqui ainda')).toBeTruthy()
  })
})
