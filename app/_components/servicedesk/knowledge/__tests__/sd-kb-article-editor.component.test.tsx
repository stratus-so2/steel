import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import type { Value } from 'platejs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import { SdKbArticleEditor } from '../sd-kb-article-editor'
import { article, summary, WS } from './sd-kb-fixtures'

const EDITED: Value = [{ type: 'h1', children: [{ text: 'Novo título H1' }] }]

// O editor Plate é uma superfície própria: trocado por um stub que dispara
// `onChange` na mão, como o teste do WikiPageEditor no Nexo.
vi.mock('@/components/editor/kb-editor', () => ({
  KbRichEditor: ({
    articleId,
    onChange,
  }: {
    articleId: string
    onChange: (content: Value) => void
  }) => (
    <div>
      <p>Editor {articleId}</p>
      <button type='button' onClick={() => onChange(EDITED)}>
        Editar conteúdo
      </button>
    </div>
  ),
}))
vi.mock('@/components/editor/kb-viewer', () => ({
  KbRichViewer: () => <div>Leitura</div>,
}))

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/acme/servicedesk/knowledge/a1',
}))

const DRAFT = article({ status: 'DRAFT', visibility: 'INTERNAL' })

function setup(extra: Parameters<typeof mockFetch>[0] = []) {
  const spy = mockFetch([
    ...extra,
    {
      method: 'PATCH',
      match: '/knowledge/a1/status',
      data: { ...DRAFT, status: 'PUBLISHED' },
    },
    {
      method: 'PATCH',
      match: /\/knowledge\/a1$/,
      handler: (_url, init) => ({
        ...DRAFT,
        ...JSON.parse(String(init?.body)),
      }),
    },
    {
      match: '/knowledge/categories',
      data: [
        {
          id: 'c1',
          name: 'Rede',
          icon: null,
          description: null,
          parentId: null,
          articleCount: 1,
        },
      ],
    },
    {
      match: '/knowledge/a1/related',
      data: [summary({ id: 'a9', title: 'Relacionado' })],
    },
    {
      method: 'POST',
      match: '/knowledge/a1/view',
      data: { viewCount: 1, counted: true },
    },
    { match: /\/knowledge\/a1$/, data: DRAFT },
  ])
  renderWithQuery(
    <SdKbArticleEditor
      workspaceId={WS}
      workspaceSlug='acme'
      userId='u1'
      userName='Ana'
      article={DRAFT}
      canDelete
    />,
  )
  return spy
}

describe('<SdKbArticleEditor />', () => {
  beforeEach(() => {
    push.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('autosaves the content after the debounce and shows the indicator', async () => {
    const spy = setup()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    fireEvent.click(screen.getByRole('button', { name: 'Editar conteúdo' }))
    expect(screen.getByRole('status').textContent).toContain('Salvando')
    expect(fetchBody(spy, /\/knowledge\/a1$/, 'PATCH')).toBeUndefined()

    await act(async () => {
      vi.advanceTimersByTime(900)
    })
    await waitFor(() =>
      expect(fetchBody(spy, /\/knowledge\/a1$/, 'PATCH')).toEqual({
        content: EDITED,
      }),
    )
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('Salvo'),
    )
    // O sumário acompanha o conteúdo editado.
    expect(screen.getByRole('button', { name: 'Novo título H1' })).toBeTruthy()
  })

  it('saves the title on blur', async () => {
    const spy = setup()
    const input = screen.getByLabelText('Título do artigo')
    fireEvent.change(input, { target: { value: 'Título novo' } })
    fireEvent.blur(input)
    await waitFor(() =>
      expect(fetchBody(spy, /\/knowledge\/a1$/, 'PATCH')).toEqual({
        title: 'Título novo',
      }),
    )
  })

  it('publishes and switches the visibility', async () => {
    const spy = setup()
    fireEvent.click(screen.getByRole('button', { name: /Publicar/ }))
    await waitFor(() =>
      expect(fetchBody(spy, '/knowledge/a1/status', 'PATCH')).toEqual({
        status: 'PUBLISHED',
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: /Portal/ }))
    await waitFor(() =>
      expect(fetchBody(spy, /\/knowledge\/a1$/, 'PATCH')).toEqual({
        visibility: 'PORTAL',
      }),
    )
  })

  it('adds a tag and archives the article', async () => {
    const spy = setup([
      { method: 'PATCH', match: '/knowledge/a1/archive', data: DRAFT },
    ])
    const tags = screen.getByLabelText('Adicionar tag')
    fireEvent.change(tags, { target: { value: 'VPN' } })
    fireEvent.keyDown(tags, { key: 'Enter' })
    await waitFor(() =>
      expect(fetchBody(spy, /\/knowledge\/a1$/, 'PATCH')).toEqual({
        tags: ['vpn'],
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Mais ações' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Arquivar/ }))
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/acme/servicedesk/knowledge'),
    )
  })

  it('toggles the reader preview and shows related articles', async () => {
    setup()
    expect(await screen.findByText('Relacionado')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Visualizar/ }))
    expect(await screen.findByText('Leitura')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Editar/ }))
    expect(screen.getByText('Editor a1')).toBeTruthy()
  })
})
