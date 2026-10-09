import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeWhiteboardSummaryDTO } from '@/src/__tests__/factories/whiteboard.factory'
import {
  apiSuccess,
  mockFetch,
  renderWithProviders,
} from '@/src/__tests__/helpers/component'
import type { WhiteboardSummaryDTO } from '@/types/whiteboard'
import { WhiteboardHome } from '../whiteboard-home'
import { lastBoardKey, WhiteboardSessionProvider } from '../whiteboard-session'
import { WhiteboardSidebar } from '../whiteboard-sidebar'

const nav = vi.hoisted(() => ({
  pathname: '/acme/whiteboard/b1',
  push: vi.fn(),
  replace: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push, replace: nav.replace, refresh: vi.fn() }),
}))

// jsdom here has no Web Storage; an in-memory one stands in for it.
const memory = new Map<string, string>()
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
    clear: () => memory.clear(),
  },
})

function fetched(spy: ReturnType<typeof mockFetch>, url: string) {
  return spy.mock.calls.some(([input]) => String(input) === url)
}

const WS = 'ws-1'
const LIST_URL = `/api/workspaces/${WS}/whiteboards`

const boards: WhiteboardSummaryDTO[] = [
  createFakeWhiteboardSummaryDTO({
    id: 'b1',
    workspaceId: WS,
    title: 'Retro',
    thumbnailUrl: `/api/workspaces/${WS}/whiteboards/b1/thumbnail?v=1`,
    createdBy: { id: 'me', name: 'Eu' },
  }),
  createFakeWhiteboardSummaryDTO({
    id: 'b2',
    workspaceId: WS,
    title: '',
    updatedBy: { id: 'u2', name: 'Bruno' },
    createdBy: { id: 'u2', name: 'Bruno' },
  }),
]

function session(
  overrides: { canEdit?: boolean; isPrivileged?: boolean } = {},
) {
  return {
    workspaceId: WS,
    workspaceSlug: 'acme',
    userId: 'me',
    canEdit: true,
    isPrivileged: false,
    ...overrides,
  }
}

function renderSidebar(overrides?: Parameters<typeof session>[0]) {
  const fetchSpy = mockFetch().mockImplementation(async () =>
    apiSuccess(boards),
  )
  renderWithProviders(
    <WhiteboardSessionProvider value={session(overrides)}>
      <WhiteboardSidebar initialBoards={boards} />
    </WhiteboardSessionProvider>,
  )
  return fetchSpy
}

beforeEach(() => {
  nav.pathname = '/acme/whiteboard/b1'
  nav.push.mockReset()
  nav.replace.mockReset()
  window.localStorage.clear()
})

describe('<WhiteboardSidebar />', () => {
  it('lists the boards with links, previews and who edited them', () => {
    renderSidebar()

    const retro = screen.getByRole('link', { name: /Retro/ })
    expect(retro.getAttribute('href')).toBe('/acme/whiteboard/b1')
    expect(retro.getAttribute('aria-current')).toBe('page')
    expect(retro.querySelector('img')?.getAttribute('src')).toContain(
      '/thumbnail?v=1',
    )

    const untitled = screen.getByRole('link', { name: /Quadro sem título/ })
    expect(untitled.getAttribute('href')).toBe('/acme/whiteboard/b2')
    expect(untitled.getAttribute('aria-current')).toBeNull()
    expect(untitled.textContent).toContain('por Bruno')
  })

  it('switches the list to the archived boards and searches by title', async () => {
    const fetchSpy = renderSidebar()

    fireEvent.click(screen.getByRole('tab', { name: 'Arquivados' }))
    await waitFor(() =>
      expect(fetched(fetchSpy, `${LIST_URL}?archived=true`)).toBe(true),
    )

    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Buscar quadros' }),
      {
        target: { value: 'retro' },
      },
    )
    await waitFor(() =>
      expect(fetched(fetchSpy, `${LIST_URL}?q=retro&archived=true`)).toBe(true),
    )
  })

  it('shows archive only on the boards the member created', async () => {
    renderSidebar()

    fireEvent.click(screen.getByRole('button', { name: 'Ações de Retro' }))
    expect(
      await screen.findByRole('menuitem', { name: 'Arquivar' }),
    ).toBeTruthy()
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'Ações de Quadro sem título' }),
    )
    expect(
      await screen.findByRole('menuitem', { name: 'Duplicar' }),
    ).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: 'Arquivar' })).toBeNull()
  })

  it('duplicates a board and opens the copy', async () => {
    const fetchSpy = mockFetch().mockImplementation(async (input) =>
      String(input).endsWith('/duplicate')
        ? apiSuccess({ ...boards[0], id: 'b3' }, 201)
        : apiSuccess(boards),
    )
    renderWithProviders(
      <WhiteboardSessionProvider value={session()}>
        <WhiteboardSidebar initialBoards={boards} />
      </WhiteboardSessionProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ações de Retro' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Duplicar' }))

    await waitFor(() =>
      expect(nav.push).toHaveBeenCalledWith('/acme/whiteboard/b3'),
    )
    expect(fetched(fetchSpy, `${LIST_URL}/b1/duplicate`)).toBe(true)
  })

  it('hides the actions from a VIEWER', () => {
    renderSidebar({ canEdit: false })
    expect(screen.queryByRole('button', { name: /Ações de/ })).toBeNull()
  })
})

describe('<WhiteboardHome />', () => {
  function renderHome(list: WhiteboardSummaryDTO[], showAll = false) {
    mockFetch().mockImplementation(async () => apiSuccess(list))
    renderWithProviders(
      <WhiteboardSessionProvider value={session()}>
        <WhiteboardHome initialBoards={list} showAll={showAll} />
      </WhiteboardSessionProvider>,
    )
  }

  it('reopens the last board this browser had open', async () => {
    window.localStorage.setItem(lastBoardKey(WS), 'b2')
    renderHome(boards)

    await waitFor(() =>
      expect(nav.replace).toHaveBeenCalledWith('/acme/whiteboard/b2'),
    )
  })

  it('shows the gallery when the last board is gone or on "Todos"', async () => {
    window.localStorage.setItem(lastBoardKey(WS), 'deleted')
    renderHome(boards)

    expect(await screen.findByText('2 quadros no workspace')).toBeTruthy()
    expect(nav.replace).not.toHaveBeenCalled()
  })

  it('invites to create the first board when there is none', async () => {
    renderHome([], true)

    expect(await screen.findByText('Nenhum quadro ainda')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Criar primeiro quadro' }),
    ).toBeTruthy()
  })
})
