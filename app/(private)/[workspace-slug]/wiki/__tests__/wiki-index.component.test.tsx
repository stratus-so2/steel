import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  apiError,
  apiSuccess,
  mockFetch,
  renderWithProviders,
} from '@/src/__tests__/helpers/component'
import type { WikiPageDTO } from '@/types/wiki-page'

const nav = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  push: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  redirect: nav.redirect,
  notFound: nav.notFound,
  useRouter: () => ({ push: nav.push }),
}))
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/lib/notify', () => ({ notify }))

const wiki = vi.hoisted(() => ({
  getWikiContext: vi.fn(),
  getWikiPages: vi.fn(),
}))
vi.mock('@/src/lib/wiki-context', () => wiki)

import WikiPage from '../page'

const CONTEXT = {
  userId: 'u1',
  userName: 'Ana',
  workspaceId: 'ws-1',
  workspaceSlug: 'acme',
}

function page(id: string, parentId: string | null, position: number) {
  return { id, parentId, position, title: id } as WikiPageDTO
}

const params = Promise.resolve({ 'workspace-slug': 'acme' })

beforeEach(() => {
  vi.clearAllMocks()
  wiki.getWikiContext.mockResolvedValue(CONTEXT)
})

describe('/wiki (the rail link)', () => {
  it('lands straight on the first root page, so one click opens the editor', async () => {
    wiki.getWikiPages.mockResolvedValue([
      page('child', 'b', 0),
      page('b', null, 1),
      page('a', null, 0),
    ])

    await expect(WikiPage({ params })).rejects.toThrow(
      'NEXT_REDIRECT /acme/wiki/a',
    )
    expect(nav.redirect).toHaveBeenCalledTimes(1)
  })

  it('answers 404 when the wiki is off or the user is not a member', async () => {
    wiki.getWikiContext.mockResolvedValue(null)
    await expect(WikiPage({ params })).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('offers to create the first page when the wiki is empty', async () => {
    wiki.getWikiPages.mockResolvedValue([])
    const fetchSpy = mockFetch().mockResolvedValue(
      apiSuccess({ id: 'new-page' }, 201),
    )

    renderWithProviders(await WikiPage({ params }))
    expect(nav.redirect).not.toHaveBeenCalled()
    expect(screen.getByText('A wiki ainda está vazia')).toBeTruthy()

    fireEvent.click(
      screen.getByRole('button', { name: 'Criar primeira página' }),
    )
    await waitFor(() =>
      expect(nav.push).toHaveBeenCalledWith('/acme/wiki/new-page'),
    )
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual({
      title: 'Primeira página',
    })
  })

  it('shows the empty state when the page list could not be read', async () => {
    wiki.getWikiPages.mockResolvedValue(null)
    renderWithProviders(await WikiPage({ params }))
    expect(screen.getByText('A wiki ainda está vazia')).toBeTruthy()
  })

  it('warns when creating the first page fails', async () => {
    wiki.getWikiPages.mockResolvedValue([])
    mockFetch().mockResolvedValue(apiError(500, 'falhou'))

    renderWithProviders(await WikiPage({ params }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Criar primeira página' }),
    )
    await waitFor(() => expect(notify.error).toHaveBeenCalled())
    expect(nav.push).not.toHaveBeenCalled()
  })
})
