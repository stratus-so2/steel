import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import { SdKbArticleView } from '../sd-kb-article-view'
import { SdKbHome } from '../sd-kb-home'
import { SdKbPortalBrowser } from '../sd-kb-portal-browser'
import {
  buildSdKbTree,
  sdKbAncestorIds,
  sdKbHeadings,
  sdKbHelpfulRatio,
  sdKbRelativeTime,
  sdKbTop,
} from '../sd-kb-utils'
import { article, summary, WS } from './sd-kb-fixtures'

vi.mock('@/components/editor/kb-viewer', () => ({
  KbRichViewer: () => <div>Conteúdo do artigo</div>,
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/acme/servicedesk/knowledge',
}))

const CATEGORIES = [
  {
    id: 'c1',
    name: 'Rede',
    icon: null,
    description: 'VPN e Wi-Fi',
    parentId: null,
    articleCount: 2,
  },
  {
    id: 'c2',
    name: 'Vazia',
    icon: null,
    description: null,
    parentId: null,
    articleCount: 0,
  },
]
const LIST = [
  summary({
    id: 'a1',
    title: 'VPN corporativa',
    viewCount: 9,
    helpfulCount: 4,
  }),
  summary({
    id: 'a2',
    title: 'Rascunho interno',
    status: 'DRAFT',
    visibility: 'INTERNAL',
  }),
]

describe('sd-kb-utils', () => {
  it('builds the tree sorted by position and finds ancestors', () => {
    const rows = [
      summary({ id: 'b', position: 1 }),
      summary({ id: 'a', position: 0 }),
      summary({ id: 'c', parentId: 'a' }),
      summary({ id: 'orphan', parentId: 'missing' }),
    ]
    const tree = buildSdKbTree(rows)
    expect(tree.map((n) => n.id)).toEqual(['a', 'orphan', 'b'])
    expect(tree[0]?.children.map((n) => n.id)).toEqual(['c'])
    expect(sdKbAncestorIds(rows, 'c')).toEqual(['a'])
    expect(sdKbAncestorIds(rows, 'unknown')).toEqual([])
  })

  it('extracts headings, ratios, top lists and relative times', () => {
    expect(
      sdKbHeadings([
        { type: 'h1', children: [{ text: 'A' }] },
        { type: 'p', children: [{ text: 'x' }] },
        { type: 'h3', children: [{ text: ' ' }] },
        { type: 'h2', children: [{ type: 'a', children: [{ text: 'B' }] }] },
      ]),
    ).toEqual([
      { level: 1, text: 'A', index: 0 },
      { level: 2, text: 'B', index: 2 },
    ])
    expect(sdKbHelpfulRatio({ helpfulCount: 0, notHelpfulCount: 0 })).toBeNull()
    expect(sdKbHelpfulRatio({ helpfulCount: 3, notHelpfulCount: 1 })).toBe(75)
    expect(sdKbTop(LIST, 'viewCount').map((a) => a.id)).toEqual(['a1'])
    expect(sdKbTop(LIST, 'updatedAt')).toHaveLength(2)
    const now = new Date('2026-09-21T12:00:00Z').getTime()
    expect(sdKbRelativeTime('2026-09-21T11:59:40Z', now)).toBe('agora')
    expect(sdKbRelativeTime('2026-09-21T11:30:00Z', now)).toBe('há 30 min')
    expect(sdKbRelativeTime('2026-09-21T02:00:00Z', now)).toBe('há 10 h')
    expect(sdKbRelativeTime('2026-09-20T12:00:00Z', now)).toBe('há 1 dia')
    expect(sdKbRelativeTime('2026-06-21T12:00:00Z', now)).toBe('há 3 meses')
    expect(sdKbRelativeTime('2024-09-21T12:00:00Z', now)).toBe('há 2 anos')
  })
})

describe('<SdKbArticleView />', () => {
  it('renders the article, records the view and votes', async () => {
    const spy = mockFetch([
      {
        method: 'POST',
        match: '/knowledge/a1/view',
        data: { viewCount: 1, counted: true },
      },
      {
        method: 'PUT',
        match: '/knowledge/a1/vote',
        data: { helpfulCount: 1, notHelpfulCount: 0, myVote: 'up' },
      },
      {
        match: '/knowledge/a1/related',
        data: [summary({ id: 'a3', title: 'Wi-Fi' })],
      },
      { match: /\/knowledge\/a1$/, data: article() },
    ])
    renderWithQuery(
      <SdKbArticleView
        workspaceId={WS}
        article={article({
          tags: ['vpn'],
          category: { id: 'c1', name: 'Rede', icon: null },
        })}
        showStatus
        hrefForRelated={(a) => `/kb/${a.id}`}
      />,
    )
    expect(
      screen.getByRole('heading', { name: 'VPN corporativa' }),
    ).toBeTruthy()
    expect(screen.getByText('Conteúdo do artigo')).toBeTruthy()
    expect(screen.getByText('Publicado')).toBeTruthy()
    expect(screen.getByText('Portal')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Passo 1' })).toBeTruthy()
    await waitFor(() =>
      expect(spy.mock.calls.some(([u]) => String(u).includes('/a1/view'))).toBe(
        true,
      ),
    )
    expect(
      (await screen.findByRole('link', { name: /Wi-Fi/ })).getAttribute('href'),
    ).toBe('/kb/a3')

    fireEvent.click(screen.getByRole('button', { name: /Sim/ }))
    await waitFor(() =>
      expect(fetchBody(spy, '/knowledge/a1/vote', 'PUT')).toEqual({
        helpful: true,
      }),
    )
  })

  it('removes the vote when clicking the same option again', async () => {
    const spy = mockFetch([
      {
        method: 'PUT',
        match: '/knowledge/a1/vote',
        data: { helpfulCount: 0, notHelpfulCount: 0, myVote: null },
      },
      { match: '/knowledge/a1/related', data: [] },
      {
        match: /\/knowledge\/a1$/,
        data: article({ myVote: 'down', notHelpfulCount: 1 }),
      },
    ])
    renderWithQuery(
      <SdKbArticleView
        workspaceId={WS}
        article={article({ myVote: 'down', notHelpfulCount: 1 })}
        recordView={false}
      />,
    )
    expect(screen.getByText(/0% acharam útil/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Não/ }))
    await waitFor(() =>
      expect(fetchBody(spy, '/knowledge/a1/vote', 'PUT')).toEqual({
        helpful: null,
      }),
    )
  })
})

describe('<SdKbHome />', () => {
  it('shows categories and the home lists, then searches', async () => {
    const spy = mockFetch([
      { match: '/knowledge/categories', data: CATEGORIES },
      {
        match: '/knowledge/search',
        data: [{ ...LIST[0], excerpt: '…reinicie a VPN…', rank: 1 }],
      },
      { match: /\/servicedesk\/knowledge$/, data: LIST },
    ])
    renderWithQuery(
      <SdKbHome workspaceId={WS} workspaceSlug='acme' isAgent canCreate />,
    )
    expect(await screen.findByRole('button', { name: /Rede/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Vazia/ })).toBeNull()
    expect(
      await screen.findByText(/2 artigos · 1 publicados · 1 rascunhos/),
    ).toBeTruthy()
    expect(screen.getByText('Mais vistos')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Novo artigo/ })).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Buscar artigos'), {
      target: { value: 'vpn' },
    })
    fireEvent.keyDown(screen.getByLabelText('Buscar artigos'), { key: 'Enter' })
    expect(await screen.findByText('…reinicie a VPN…')).toBeTruthy()
    expect(
      spy.mock.calls.some(([u]) =>
        String(u).includes('/knowledge/search?q=vpn'),
      ),
    ).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Limpar busca' }))
    fireEvent.click(screen.getByRole('button', { name: /Rede/ }))
    await waitFor(() =>
      expect(
        spy.mock.calls.some(([u]) => String(u).includes('categoryId=c1')),
      ).toBe(true),
    )
  })
})

describe('<SdKbPortalBrowser />', () => {
  it('lists portal articles, opens one and goes back', async () => {
    const onChange = vi.fn()
    mockFetch([
      { match: '/knowledge/categories', data: [] },
      {
        method: 'POST',
        match: '/knowledge/a1/view',
        data: { viewCount: 1, counted: true },
      },
      { match: '/knowledge/a1/related', data: [] },
      { match: /\/knowledge\/a1$/, data: article() },
      { match: /\/servicedesk\/knowledge$/, data: LIST },
    ])
    renderWithQuery(
      <SdKbPortalBrowser workspaceId={WS} onArticleChange={onChange} />,
    )
    expect(await screen.findByText('Como podemos ajudar?')).toBeTruthy()
    fireEvent.click(
      await screen.findByRole('button', { name: /VPN corporativa/ }),
    )
    expect(screen.queryByText('Rascunho interno')).toBeNull()
    expect(onChange).toHaveBeenCalledWith('a1')
    expect(await screen.findByText('Conteúdo do artigo')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Voltar/ }))
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('searches only published portal articles', async () => {
    const spy = mockFetch([
      { match: '/knowledge/categories', data: [] },
      { match: '/knowledge/search', data: [] },
      { match: /\/servicedesk\/knowledge$/, data: [] },
    ])
    renderWithQuery(<SdKbPortalBrowser workspaceId={WS} />)
    expect(
      await screen.findByText('Ainda não há artigos publicados no portal.'),
    ).toBeTruthy()
    const box = screen.getByLabelText('Buscar artigos')
    fireEvent.change(box, { target: { value: 'senha' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(
      await screen.findByText(
        'Nenhum artigo encontrado. Se precisar, abra um chamado.',
      ),
    ).toBeTruthy()
    const url = String(
      spy.mock.calls.find(([u]) => String(u).includes('/search'))?.[0],
    )
    expect(url).toContain('status=PUBLISHED')
    expect(url).toContain('visibility=PORTAL')
  })
})
