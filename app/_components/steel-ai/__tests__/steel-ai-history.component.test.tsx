import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fetchBody, mockFetch } from '@/src/__tests__/component-utils'
import { SteelAiHistory } from '../steel-ai-history'
import { conversation, renderSteelAi } from './steel-ai-test-utils'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/acme/ai/c1',
}))
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/lib/notify', () => ({ notify }))

const LIST = [
  conversation({
    id: 'c2',
    title: 'Chamados críticos',
    pinnedAt: '2026-10-06T12:00:00.000Z',
  }),
  conversation({ id: 'c1', title: 'Pipeline do trimestre' }),
  conversation({ id: 'c3', title: null }),
]

function setup() {
  return mockFetch([
    { method: 'PATCH', match: '/ai/conversations/', data: LIST[1] },
    { method: 'DELETE', match: '/ai/conversations/c1', data: null },
    { match: /\/ai\/conversations(\?|$)/, data: LIST },
  ])
}

async function openMenu(label: string) {
  fireEvent.click(
    await screen.findByRole('button', { name: `Ações de ${label}` }),
  )
}

describe('<SteelAiHistory />', () => {
  it('lists pinned conversations first and marks the open one', async () => {
    setup()
    renderSteelAi(<SteelAiHistory />)
    const pinned = (await screen.findByText('Fixadas')).closest('section')
    const recent = screen.getByText('Recentes').closest('section')
    expect(
      within(pinned as HTMLElement).getByText('Chamados críticos'),
    ).toBeTruthy()
    expect(
      within(recent as HTMLElement).getByText('Pipeline do trimestre'),
    ).toBeTruthy()
    expect(
      within(recent as HTMLElement).getByText('Nova conversa'),
    ).toBeTruthy()
    expect(
      screen
        .getByText('Pipeline do trimestre')
        .closest('a')
        ?.getAttribute('aria-current'),
    ).toBe('page')
  })

  it('searches on the server with the typed query', async () => {
    const spy = setup()
    renderSteelAi(<SteelAiHistory />)
    fireEvent.change(screen.getByLabelText('Buscar conversas'), {
      target: { value: 'pipeline' },
    })
    await waitFor(() =>
      expect(
        spy.mock.calls.some(([url]) =>
          String(url).endsWith('/ai/conversations?q=pipeline'),
        ),
      ).toBe(true),
    )
  })

  it('pins and renames from the row menu', async () => {
    const spy = setup()
    renderSteelAi(<SteelAiHistory />)
    await openMenu('Pipeline do trimestre')
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Fixar' }))
    await waitFor(() =>
      expect(fetchBody(spy, '/ai/conversations/c1', 'PATCH')).toEqual({
        pinned: true,
      }),
    )

    spy.mockClear()
    await openMenu('Pipeline do trimestre')
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Renomear' }))
    const input = await screen.findByLabelText('Novo título da conversa')
    fireEvent.change(input, { target: { value: 'Pipeline Q4' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() =>
      expect(fetchBody(spy, '/ai/conversations/c1', 'PATCH')).toEqual({
        title: 'Pipeline Q4',
      }),
    )
  })

  it('deletes after confirmation and leaves the open conversation', async () => {
    const spy = setup()
    renderSteelAi(<SteelAiHistory />)
    await openMenu('Pipeline do trimestre')
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Excluir' }))
    expect(await screen.findByText('Excluir conversa?')).toBeTruthy()
    expect(spy.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(
      false,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/acme/ai'))
    expect(notify.success).toHaveBeenCalledWith('Conversa excluída.')
  })
})
