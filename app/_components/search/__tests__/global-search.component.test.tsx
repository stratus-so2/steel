import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ShortcutsProvider } from '@/app/_components/shortcuts/shortcuts-provider'
import { mockFetch, renderWithQuery } from '@/src/__tests__/component-utils'
import type { SearchResultDTO } from '@/types/search'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/agro',
}))
const stash = vi.fn()
vi.mock('@/app/_components/steel-ai/steel-ai-handoff', () => ({
  stashSteelAiPrompt: (...args: unknown[]) => stash(...args),
}))

import {
  GlobalSearch,
  groupSearchResults,
  pushRecentSearch,
  readRecentSearches,
} from '../global-search'

function result(overrides: Partial<SearchResultDTO>): SearchResultDTO {
  return {
    type: 'crm-lead',
    id: 'l1',
    title: 'Agro Telecom',
    subtitle: 'Agro · Qualificado',
    snippet: null,
    href: '/agro/crm/leads?record=l1',
    module: 'CRM',
    group: 'Leads',
    score: 100,
    isMine: false,
    updatedAt: '2026-10-07T00:00:00.000Z',
    ...overrides,
  }
}

const RESULTS = [
  result({
    type: 'sd-ticket',
    id: 't1',
    title: 'Link da Agro caiu',
    subtitle: 'INC-000123 · Incidente',
    href: '/agro/servicedesk/tickets/123',
    group: 'Chamados',
    module: 'SERVICE_DESK',
  }),
  result({}),
  result({
    type: 'sd-ticket',
    id: 't2',
    title: 'Agro sem internet',
    subtitle: null,
    snippet: 'Cliente reclama',
    href: '/agro/servicedesk/tickets/124',
    group: 'Chamados',
  }),
]

function routes(results: SearchResultDTO[] = RESULTS) {
  return mockFetch([
    {
      match: '/ai/capabilities',
      data: { aiEnabled: true, modules: ['SERVICE_DESK', 'CRM'] },
    },
    {
      match: '/search?q=',
      handler: (url) => ({
        query: new URL(url, 'http://x').searchParams.get('q'),
        results,
        tookMs: 3,
      }),
    },
    {
      method: 'POST',
      match: '/ai/conversations',
      data: { id: 'conv1' },
    },
  ])
}

function renderPalette() {
  return renderWithQuery(
    <ShortcutsProvider>
      <GlobalSearch slug='agro' workspaceId='ws1' />
    </ShortcutsProvider>,
  )
}

async function openWithShortcut() {
  await act(async () => {
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
  })
  return screen.findByPlaceholderText(/Buscar chamados/)
}

// In-memory storage: this Node/jsdom combo may expose no localStorage.
function installStorage() {
  const data = new Map<string, string>()
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  }
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: storage,
  })
}

beforeEach(() => {
  installStorage()
  push.mockClear()
})

describe('GlobalSearch', () => {
  it('should open with Ctrl+K and toggle closed again', async () => {
    routes()
    renderPalette()
    expect(screen.queryByPlaceholderText(/Buscar chamados/)).toBeNull()

    await openWithShortcut()
    // Also while typing in the palette input (allowInInput + allowInDialog).
    await act(async () => {
      fireEvent.keyDown(screen.getByPlaceholderText(/Buscar chamados/), {
        key: 'K',
        ctrlKey: true,
      })
    })
    await waitFor(() =>
      expect(screen.queryByPlaceholderText(/Buscar chamados/)).toBeNull(),
    )
  })

  it('should open from the header button and show quick actions', async () => {
    routes()
    renderPalette()
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Buscar no workspace' })[0],
    )

    expect(await screen.findByText('Novo chamado')).toBeTruthy()
    expect(screen.getByText('Novo lead')).toBeTruthy()
    expect(screen.getByText(/Digite um nome, código/)).toBeTruthy()
  })

  it('should group results by type in global order and highlight matches', async () => {
    const spy = routes()
    renderPalette()
    const input = await openWithShortcut()
    fireEvent.change(input, { target: { value: 'agro' } })

    expect(await screen.findByText('Chamados')).toBeTruthy()
    const headings = screen
      .getAllByText(/^(Chamados|Leads|Ações rápidas)$/)
      .map((h) => h.textContent)
    expect(headings).toEqual(['Chamados', 'Leads', 'Ações rápidas'])
    const marks = document.querySelectorAll('mark')
    expect([...marks].map((m) => m.textContent)).toContain('Agro')
    expect(screen.getByText('Cliente reclama')).toBeTruthy()
    // Debounced: one request for the whole word.
    const searchCalls = spy.mock.calls.filter(([u]) =>
      String(u).includes('/search?q='),
    )
    expect(searchCalls.map(([u]) => String(u))).toEqual([
      '/api/workspaces/ws1/search?q=agro&limit=30',
    ])
  })

  it('should navigate with the keyboard and open the selected result', async () => {
    routes()
    renderPalette()
    const input = await openWithShortcut()
    fireEvent.change(input, { target: { value: 'agro' } })
    await screen.findByText('Leads')

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    // First item is pre-selected; ArrowDown moves to the second ticket.
    expect(push).toHaveBeenCalledWith('/agro/servicedesk/tickets/124')
    expect(readRecentSearches('ws1')).toEqual(['agro'])
  })

  it('should list recent searches and reuse one', async () => {
    pushRecentSearch('ws1', 'INC-000123')
    routes()
    renderPalette()
    await openWithShortcut()
    fireEvent.click(await screen.findByText('INC-000123'))
    expect(
      (screen.getByPlaceholderText(/Buscar chamados/) as HTMLInputElement)
        .value,
    ).toBe('INC-000123')
  })

  it('should show suggestions when nothing matches and hand the query to Steel AI', async () => {
    const spy = routes([])
    renderPalette()
    const input = await openWithShortcut()
    fireEvent.change(input, { target: { value: 'zzz' } })

    expect(await screen.findByText(/Nada encontrado para/)).toBeTruthy()
    fireEvent.click(screen.getByText(/Perguntar ao Steel AI/))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/agro/ai/conv1'))
    expect(stash).toHaveBeenCalledWith('conv1', {
      content: 'zzz',
      mode: 'EXPLORE',
    })
    expect(
      spy.mock.calls.some(
        ([u, init]) =>
          String(u).includes('/ai/conversations') && init?.method === 'POST',
      ),
    ).toBe(true)
  })

  it('should show an error when the search fails', async () => {
    mockFetch([
      { match: '/ai/capabilities', data: { aiEnabled: false, modules: [] } },
      { match: '/search?q=', status: 500, error: 'boom' },
    ])
    renderPalette()
    const input = await openWithShortcut()
    fireEvent.change(input, { target: { value: 'agro' } })
    expect(await screen.findByText(/Não foi possível buscar/)).toBeTruthy()
    expect(screen.queryByText('Novo chamado')).toBeNull()
  })
})

describe('global search helpers', () => {
  it('should keep groups in order of their best result', () => {
    expect(
      groupSearchResults(RESULTS).map((g) => [g.group, g.items.length]),
    ).toEqual([
      ['Chamados', 2],
      ['Leads', 1],
    ])
  })

  it('should dedupe recents case-insensitively and survive bad storage', () => {
    pushRecentSearch('ws1', 'Agro')
    pushRecentSearch('ws1', '  ')
    expect(pushRecentSearch('ws1', 'agro')).toEqual(['agro'])
    window.localStorage.setItem('steel:search-recent:ws1', '{bad json')
    expect(readRecentSearches('ws1')).toEqual([])
    window.localStorage.setItem('steel:search-recent:ws1', '"x"')
    expect(readRecentSearches('ws1')).toEqual([])
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked')
      },
    })
    expect(readRecentSearches('ws1')).toEqual([])
    expect(pushRecentSearch('ws1', 'x')).toEqual(['x'])
  })
})
