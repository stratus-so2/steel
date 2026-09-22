import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import { SdKbTree } from '../sd-kb-tree'
import { summary, WS } from './sd-kb-fixtures'

const push = vi.fn()
let pathname = '/acme/servicedesk/knowledge'
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => pathname,
}))

const TREE = [
  summary({ id: 'root', title: 'Rede', position: 0 }),
  summary({ id: 'child', title: 'VPN', parentId: 'root', status: 'DRAFT' }),
  summary({ id: 'second', title: '', position: 1 }),
]

function renderTree(
  props: Partial<Parameters<typeof SdKbTree>[0]> = {},
  extra: Parameters<typeof mockFetch>[0] = [],
) {
  const spy = mockFetch([
    ...extra,
    {
      match: /knowledge\?archived=true/,
      data: [
        summary({
          id: 'old',
          title: 'Antigo',
          archivedAt: '2026-09-01T00:00:00.000Z',
        }),
      ],
    },
    { match: /\/servicedesk\/knowledge$/, data: TREE },
  ])
  renderWithQuery(
    <SdKbTree
      workspaceId={WS}
      workspaceSlug='acme'
      canEdit
      canCreate
      canDelete
      {...props}
    />,
  )
  return spy
}

describe('<SdKbTree />', () => {
  it('renders roots, expands children and marks drafts', async () => {
    pathname = '/acme/servicedesk/knowledge'
    renderTree()
    expect(await screen.findByRole('link', { name: /Rede/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Sem título/ })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /VPN/ })).toBeNull()

    fireEvent.click(screen.getAllByRole('button', { name: 'Expandir' })[0])
    const child = await screen.findByRole('link', { name: /VPN/ })
    expect(child.getAttribute('href')).toBe('/acme/servicedesk/knowledge/child')
    expect(screen.getByTitle('Rascunho')).toBeTruthy()
  })

  it('opens the tree up to the current article', async () => {
    pathname = '/acme/servicedesk/knowledge/child'
    renderTree()
    const child = await screen.findByRole('link', { name: /VPN/ })
    expect(child.getAttribute('aria-current')).toBe('page')
  })

  it('archives an article from the item menu', async () => {
    pathname = '/acme/servicedesk/knowledge'
    const spy = renderTree({}, [
      {
        method: 'PATCH',
        match: '/knowledge/second/archive',
        data: summary({ id: 'second' }),
      },
    ])
    fireEvent.click(
      await screen.findByRole('button', { name: 'Ações de Sem título' }),
    )
    fireEvent.click(await screen.findByRole('menuitem', { name: /Arquivar/ }))
    await waitFor(() =>
      expect(
        spy.mock.calls.some(
          ([url, init]) =>
            String(url).includes('/second/archive') && init?.method === 'PATCH',
        ),
      ).toBe(true),
    )
  })

  it('moves an article down and creates a sub-article', async () => {
    pathname = '/acme/servicedesk/knowledge'
    const spy = renderTree({}, [
      {
        method: 'PATCH',
        match: '/knowledge/root/move',
        data: summary({ id: 'root' }),
      },
      {
        method: 'POST',
        match: /\/servicedesk\/knowledge$/,
        data: summary({ id: 'new' }),
      },
    ])
    fireEvent.click(
      await screen.findByRole('button', { name: 'Ações de Rede' }),
    )
    fireEvent.click(
      await screen.findByRole('menuitem', { name: /Mover para baixo/ }),
    )
    await waitFor(() =>
      expect(fetchBody(spy, '/root/move', 'PATCH')).toEqual({
        parentId: null,
        position: 1,
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ações de Rede' }))
    fireEvent.click(
      await screen.findByRole('menuitem', { name: /Novo subartigo/ }),
    )
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/acme/servicedesk/knowledge/new'),
    )
    expect(fetchBody(spy, /\/servicedesk\/knowledge$/)).toEqual({
      parentId: 'root',
    })
  })

  it('lists archived articles and restores one', async () => {
    pathname = '/acme/servicedesk/knowledge'
    const spy = renderTree({}, [
      {
        method: 'PATCH',
        match: '/knowledge/old/restore',
        data: summary({ id: 'old' }),
      },
    ])
    fireEvent.click(await screen.findByRole('button', { name: /Arquivados/ }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Restaurar Antigo' }),
    )
    await waitFor(() =>
      expect(
        spy.mock.calls.some(([url]) => String(url).includes('/old/restore')),
      ).toBe(true),
    )
    expect(
      screen.getByRole('button', { name: 'Excluir Antigo definitivamente' }),
    ).toBeTruthy()
  })

  it('hides editing controls from readers and shows the empty state', async () => {
    pathname = '/acme/servicedesk/knowledge'
    mockFetch([{ match: /\/servicedesk\/knowledge$/, data: [] }])
    renderWithQuery(
      <SdKbTree
        workspaceId={WS}
        workspaceSlug='acme'
        canEdit={false}
        canCreate={false}
        canDelete={false}
      />,
    )
    expect(await screen.findByText('Nenhum artigo ainda.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Arquivados/ })).toBeNull()
  })
})
