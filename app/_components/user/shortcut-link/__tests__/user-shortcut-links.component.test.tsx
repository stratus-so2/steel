import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import { UserShortcutLinkList } from '../user-shortcut-link-list'
import { UserShortcutLinkModal } from '../user-shortcut-link-modal'

const notify = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}))
vi.mock('@/lib/notify', () => ({ notify }))

const API = '/api/short-links'

describe('<UserShortcutLinkList />', () => {
  it('shows the empty state', async () => {
    mockFetch([{ match: API, data: [] }])
    renderWithQuery(<UserShortcutLinkList />)
    expect(await screen.findByText('Nenhum link rápido ainda.')).toBeTruthy()
  })

  it('shows an error state when loading fails', async () => {
    mockFetch([{ match: API, status: 500, error: 'boom' }])
    renderWithQuery(<UserShortcutLinkList />)
    expect(
      await screen.findByText('Não foi possível carregar os links rápidos.'),
    ).toBeTruthy()
  })

  it('renders each link pointing at its URL with a relative date', async () => {
    mockFetch([
      {
        match: API,
        data: [
          {
            id: 'l1',
            title: 'Painel de vendas',
            url: 'https://example.com/vendas',
            createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
          },
        ],
      },
    ])
    renderWithQuery(<UserShortcutLinkList />)

    const title = await screen.findByText('Painel de vendas')
    expect(title.closest('a')?.getAttribute('href')).toBe(
      'https://example.com/vendas',
    )
    expect(screen.getByText('anteontem')).toBeTruthy()
  })
})

describe('<UserShortcutLinkModal />', () => {
  function openModal() {
    fireEvent.click(
      screen.getByRole('button', { name: /adicionar link rápido/i }),
    )
  }

  function submit() {
    fireEvent.click(
      screen.getByRole('button', { name: 'Adicionar Link rápido' }),
    )
  }

  it('validates title length and URL format in pt-BR', async () => {
    const spy = mockFetch([])
    renderWithQuery(<UserShortcutLinkModal />)
    openModal()

    fireEvent.change(
      await screen.findByPlaceholderText('Digite ou cole uma URL'),
      { target: { value: 'nao-e-url' } },
    )
    fireEvent.change(
      screen.getByPlaceholderText('Como você gostaria de ver este link'),
      { target: { value: ' a ' } },
    )
    submit()

    expect(await screen.findByText('URL inválida')).toBeTruthy()
    expect(
      screen.getByText('O título deve ter pelo menos 2 caracteres'),
    ).toBeTruthy()
    expect(spy).not.toHaveBeenCalled()
  })

  it('creates the link with a trimmed title and closes', async () => {
    const spy = mockFetch([
      { method: 'POST', match: API, data: { id: 'l9' } },
      { match: API, data: [] },
    ])
    renderWithQuery(<UserShortcutLinkModal />)
    openModal()

    fireEvent.change(
      await screen.findByPlaceholderText('Digite ou cole uma URL'),
      { target: { value: 'https://steel.app/docs' } },
    )
    fireEvent.change(
      screen.getByPlaceholderText('Como você gostaria de ver este link'),
      { target: { value: '  Docs  ' } },
    )
    submit()

    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Link rápido criado'),
    )
    expect(fetchBody(spy, API)).toEqual({
      title: 'Docs',
      url: 'https://steel.app/docs',
    })
    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText('Digite ou cole uma URL'),
      ).toBeNull(),
    )
  })

  it('keeps the dialog open and shows the API error', async () => {
    mockFetch([
      {
        method: 'POST',
        match: API,
        status: 409,
        error: 'Limite de links atingido',
      },
    ])
    renderWithQuery(<UserShortcutLinkModal />)
    openModal()

    fireEvent.change(
      await screen.findByPlaceholderText('Digite ou cole uma URL'),
      { target: { value: 'https://steel.app' } },
    )
    fireEvent.change(
      screen.getByPlaceholderText('Como você gostaria de ver este link'),
      { target: { value: 'Steel' } },
    )
    submit()

    expect(await screen.findByText('Limite de links atingido')).toBeTruthy()
    expect(screen.getByPlaceholderText('Digite ou cole uma URL')).toBeTruthy()
  })
})
