import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import type { Value } from 'platejs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShortcutsProvider } from '@/app/_components/shortcuts/shortcuts-provider'
import {
  apiSuccess,
  createTestQueryClient,
  getFetchCall,
  mockFetch,
  renderWithProviders,
} from '@/src/__tests__/helpers/component'
import type { WikiPageDTO } from '@/types/wiki-page'
import { WikiPageEditor } from '../wiki-page-editor'

const EDITED: Value = [{ type: 'p', children: [{ text: 'editado' }] }]
const EDITED_AGAIN: Value = [{ type: 'p', children: [{ text: 'de novo' }] }]

// The rich editor is a Plate/Yjs surface with its own collaboration
// transport; stub it at the module boundary and drive `onChange` by hand so
// these tests are only about the title field and the autosave around it.
// Labels fetch their own list; this suite is about title and content.
vi.mock('../wiki-page-labels', () => ({ WikiPageLabels: () => null }))
vi.mock('@/components/editor/wiki-editor', () => ({
  WikiPageRichEditor: ({
    documentName,
    userName,
    content,
    onChange,
    header,
    onStatusChange,
  }: {
    documentName: string
    userName: string
    content: Value
    onChange: (content: Value) => void
    header?: React.ReactNode
    onStatusChange?: (status: string) => void
  }) => (
    <div>
      {header}
      <button type='button' onClick={() => onStatusChange?.('synced')}>
        Sincronizar
      </button>
      <button type='button' onClick={() => onStatusChange?.('offline')}>
        Cair conexão
      </button>
      <p>
        Documento {documentName} por {userName}
      </p>
      <p data-testid='editor-content'>{JSON.stringify(content)}</p>
      <button type='button' onClick={() => onChange(EDITED)}>
        Editar conteúdo
      </button>
      <button type='button' onClick={() => onChange(EDITED_AGAIN)}>
        Editar de novo
      </button>
    </div>
  ),
}))

const WORKSPACE_ID = 'ws-1'
const AUTOSAVE_DELAY_MS = 1500

function buildPage(overrides: Partial<WikiPageDTO> = {}): WikiPageDTO {
  return {
    id: 'page-1',
    workspaceId: WORKSPACE_ID,
    parentId: null,
    title: 'Manual',
    icon: null,
    coverImage: null,
    content: [{ type: 'p', children: [{ text: 'original' }] }],
    position: 0,
    labelIds: [],
    createdById: 'user-1',
    updatedById: null,
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const ROOT = buildPage({ id: 'root', title: 'Processos' })
const MID = buildPage({ id: 'mid', parentId: 'root', title: '' })

function renderEditor(page = buildPage(), tree: WikiPageDTO[] = [page]) {
  const fetchSpy = mockFetch().mockImplementation(async () =>
    apiSuccess(buildPage()),
  )
  // The page tree comes from the sidebar's query; seeding it keeps the fetch
  // spy about the saves only.
  const queryClient = createTestQueryClient()
  queryClient.setQueryData(['wiki-pages', WORKSPACE_ID], tree)
  const utils = renderWithProviders(
    <ShortcutsProvider>
      <WikiPageEditor
        workspaceId={WORKSPACE_ID}
        workspaceSlug='acme'
        userId='user-1'
        userName='Ana'
        page={page}
      />
    </ShortcutsProvider>,
    { queryClient },
  )
  return { ...utils, fetchSpy }
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms)
  })
}

const titleInput = () => screen.getByPlaceholderText('Sem título')

beforeEach(() => {
  // `shouldAdvanceTime` keeps `user-event`'s own delays running on the real
  // clock while the autosave debounce stays under the test's control.
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('<WikiPageEditor /> rendering', () => {
  it('opens on the stored title and content', () => {
    renderEditor()

    expect(titleInput()).toHaveProperty('value', 'Manual')
    expect(screen.getByTestId('editor-content').textContent).toContain(
      'original',
    )
  })

  it('hands the page id and the signed-in author to the editor', () => {
    renderEditor()

    expect(screen.getByText('Documento page-1 por Ana')).toBeTruthy()
  })

  it('follows a switch to another page', () => {
    const { rerender } = renderEditor()

    rerender(
      <ShortcutsProvider>
        <WikiPageEditor
          workspaceId={WORKSPACE_ID}
          workspaceSlug='acme'
          userId='user-1'
          userName='Ana'
          page={buildPage({ id: 'page-2', title: 'Arquitetura' })}
        />
      </ShortcutsProvider>,
    )

    expect(titleInput()).toHaveProperty('value', 'Arquitetura')
  })
})

describe('<WikiPageEditor /> header', () => {
  it('shows the path from the wiki root to the page', () => {
    renderEditor(buildPage({ id: 'leaf', parentId: 'mid' }), [
      ROOT,
      MID,
      buildPage({ id: 'leaf', parentId: 'mid' }),
    ])

    const nav = screen.getByRole('navigation', { name: 'breadcrumb' })
    const links = Array.from(nav.querySelectorAll('a')).map((a) => [
      a.textContent,
      a.getAttribute('href'),
    ])
    expect(links).toEqual([
      ['Wiki', '/acme/wiki'],
      ['Processos', '/acme/wiki/root'],
      ['Sem título', '/acme/wiki/mid'],
    ])
    expect(nav.textContent).toContain('Manual')
  })

  it('reports the collaboration status as it changes', () => {
    renderEditor()
    const status = () => screen.getByRole('status')

    expect(status().getAttribute('data-status')).toBe('connecting')
    expect(status().textContent).toBe('Conectando…')

    fireEvent.click(screen.getByRole('button', { name: 'Sincronizar' }))
    expect(status().textContent).toBe('Sincronizado')

    fireEvent.click(screen.getByRole('button', { name: 'Cair conexão' }))
    expect(status().getAttribute('data-status')).toBe('offline')
    expect(status().textContent).toBe('Sem conexão')
  })

  it('names an untitled page in the breadcrumb while the title is empty', async () => {
    const { user } = renderEditor()
    await user.clear(titleInput())
    const nav = screen.getByRole('navigation', { name: 'breadcrumb' })
    expect(nav.textContent).toContain('Sem título')
  })

  it('toggles the page tree from the header button', () => {
    renderEditor()
    // No sidebar is mounted here; the button just must not throw.
    fireEvent.click(
      screen.getByRole('button', { name: 'Mostrar ou ocultar as páginas' }),
    )
    expect(titleInput()).toBeTruthy()
  })
})

describe('<WikiPageEditor /> title', () => {
  it('saves an edited title on blur', async () => {
    const { user, fetchSpy } = renderEditor()

    await user.clear(titleInput())
    await user.type(titleInput(), 'Manual v2')
    await user.tab()

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    expect(getFetchCall(fetchSpy)).toMatchObject({
      url: `/api/workspaces/${WORKSPACE_ID}/wiki/page-1`,
      method: 'PATCH',
      body: { title: 'Manual v2' },
    })
  })

  it('keeps the typed title while the field is still focused', async () => {
    const { user, fetchSpy } = renderEditor()

    await user.type(titleInput(), ' v2')

    expect(titleInput()).toHaveProperty('value', 'Manual v2')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('does not save a title that was not changed', async () => {
    const { user, fetchSpy } = renderEditor()

    await user.click(titleInput())
    await user.tab()

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('<WikiPageEditor /> content autosave', () => {
  it('waits out the debounce before saving an edit', async () => {
    const { user, fetchSpy } = renderEditor()

    await user.click(screen.getByRole('button', { name: 'Editar conteúdo' }))
    await advance(AUTOSAVE_DELAY_MS / 3)
    expect(fetchSpy).not.toHaveBeenCalled()

    await advance(AUTOSAVE_DELAY_MS)

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    expect(getFetchCall(fetchSpy)).toMatchObject({
      url: `/api/workspaces/${WORKSPACE_ID}/wiki/page-1`,
      method: 'PATCH',
      body: { content: EDITED },
    })
  })

  it('collapses a burst of edits into one save of the latest content', async () => {
    const { user, fetchSpy } = renderEditor()

    await user.click(screen.getByRole('button', { name: 'Editar conteúdo' }))
    await advance(AUTOSAVE_DELAY_MS / 3)
    await user.click(screen.getByRole('button', { name: 'Editar de novo' }))
    await advance(AUTOSAVE_DELAY_MS)

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    expect(getFetchCall(fetchSpy).body).toEqual({ content: EDITED_AGAIN })
  })

  it('drops a pending save when the editor unmounts', async () => {
    const { user, fetchSpy, unmount } = renderEditor()

    await user.click(screen.getByRole('button', { name: 'Editar conteúdo' }))
    unmount()
    await advance(AUTOSAVE_DELAY_MS * 2)

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
