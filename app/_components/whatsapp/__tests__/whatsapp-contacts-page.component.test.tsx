import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  type FetchRoute,
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import { WhatsappContactsPage } from '../whatsapp-contacts-page'

// Dialog/select flows render Base UI portals and wait on several fetches;
// the project default (5s) is too tight when the suite runs under load.
vi.setConfig({ testTimeout: 20_000 })

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/lib/notify', () => ({ notify }))

const BASE = '/api/workspaces/ws_1/whatsapp/contacts'

function contact(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    workspaceId: 'ws_1',
    waId: '5511911111111',
    name: 'Ana Souza',
    avatarUrl: null,
    description: 'Cliente VIP',
    conversationCount: 4,
    createdAt: '2026-03-15T12:00:00.000Z',
    updatedAt: '2026-03-15T12:00:00.000Z',
    ...overrides,
  }
}

const contacts = [
  contact(),
  contact({
    id: 'c2',
    name: null,
    waId: '5521988887777',
    description: null,
    conversationCount: 0,
  }),
]

function setup(extra: FetchRoute[] = [], list: unknown[] = contacts) {
  return mockFetch([
    ...extra,
    { match: `${BASE}?search=ana`, data: [contacts[0]] },
    { match: BASE, data: list },
  ])
}

describe('<WhatsappContactsPage />', () => {
  it('renders contacts with fallbacks and formatted date', async () => {
    setup()
    renderWithQuery(<WhatsappContactsPage workspaceId='ws_1' />)

    expect(await screen.findByText('Ana Souza')).toBeTruthy()
    expect(screen.getByText('Cliente VIP')).toBeTruthy()
    expect(screen.getByText('4')).toBeTruthy()
    expect(screen.getAllByText('15/03/2026')).toHaveLength(2)
    // Missing name/description render an em dash.
    expect(screen.getAllByText('—')).toHaveLength(2)
  })

  it('shows the empty state', async () => {
    setup([], [])
    renderWithQuery(<WhatsappContactsPage workspaceId='ws_1' />)
    expect(await screen.findByText('Nenhum contato cadastrado.')).toBeTruthy()
  })

  it('searches server-side as the user types', async () => {
    const fetchSpy = setup()
    renderWithQuery(<WhatsappContactsPage workspaceId='ws_1' />)
    await screen.findByText('5521988887777')

    fireEvent.change(screen.getByPlaceholderText('Buscar contato'), {
      target: { value: 'ana' },
    })
    await waitFor(() => expect(screen.queryByText('5521988887777')).toBeNull())
    expect(
      fetchSpy.mock.calls.some(([url]) => String(url).endsWith('?search=ana')),
    ).toBe(true)
  })

  it('creates a contact, dropping empty optional fields', async () => {
    const fetchSpy = setup([
      { method: 'POST', match: BASE, data: contact({ id: 'c3' }) },
    ])
    renderWithQuery(<WhatsappContactsPage workspaceId='ws_1' />)
    await screen.findByText('Ana Souza')

    fireEvent.click(screen.getByRole('button', { name: 'Novo contato' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(
      within(dialog).getByLabelText('Número (DDI + DDD + número)'),
      { target: { value: '5511977776666' } },
    )
    fireEvent.change(within(dialog).getByLabelText('Nome'), {
      target: { value: 'Bruno' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Contato cadastrado'),
    )
    expect(fetchBody(fetchSpy, BASE)).toEqual({
      waId: '5511977776666',
      name: 'Bruno',
    })
  })

  it('does not submit a contact without a number', async () => {
    const fetchSpy = setup()
    renderWithQuery(<WhatsappContactsPage workspaceId='ws_1' />)
    await screen.findByText('Ana Souza')

    fireEvent.click(screen.getByRole('button', { name: 'Novo contato' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Nome'), {
      target: { value: 'Sem número' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))

    await new Promise((r) => setTimeout(r, 50))
    expect(fetchBody(fetchSpy, BASE)).toBeUndefined()
  })

  it('edits a contact with the number locked', async () => {
    const fetchSpy = setup([
      { method: 'PATCH', match: `${BASE}/c1`, data: contact() },
    ])
    renderWithQuery(<WhatsappContactsPage workspaceId='ws_1' />)
    await screen.findByText('Ana Souza')

    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0])
    const dialog = await screen.findByRole('dialog')
    const number = within(dialog).getByLabelText(
      'Número (DDI + DDD + número)',
    ) as HTMLInputElement
    expect(number.value).toBe('5511911111111')
    expect(number.disabled).toBe(true)

    fireEvent.change(within(dialog).getByLabelText('Descrição / recado'), {
      target: { value: 'Prefere contato à tarde' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Contato atualizado'),
    )
    expect(fetchBody(fetchSpy, `${BASE}/c1`, 'PATCH')).toEqual({
      name: 'Ana Souza',
      description: 'Prefere contato à tarde',
    })
  })

  it('syncs the profile photo and reports provider limitations', async () => {
    setup([
      {
        method: 'POST',
        match: `${BASE}/c1/sync-avatar`,
        status: 400,
        error: 'Conexão Meta não suporta',
      },
    ])
    renderWithQuery(<WhatsappContactsPage workspaceId='ws_1' />)
    await screen.findByText('Ana Souza')

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Buscar foto de perfil' })[0],
    )
    await waitFor(() => expect(notify.error).toHaveBeenCalled())
    expect((notify.error.mock.calls[0][0] as Error).message).toBe(
      'Conexão Meta não suporta',
    )
  })

  it('confirms before removing, naming the contact (or number)', async () => {
    const fetchSpy = setup([
      { method: 'DELETE', match: `${BASE}/c2`, data: null },
    ])
    renderWithQuery(<WhatsappContactsPage workspaceId='ws_1' />)
    await screen.findByText('Ana Souza')

    fireEvent.click(screen.getAllByRole('button', { name: 'Remover' })[1])
    const alert = await screen.findByRole('alertdialog')
    expect(
      within(alert).getByText(/5521988887777 será removido da lista/),
    ).toBeTruthy()
    fireEvent.click(within(alert).getByRole('button', { name: 'Remover' }))

    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Contato removido'),
    )
    expect(
      fetchSpy.mock.calls.some(
        ([url, init]) =>
          init?.method === 'DELETE' && String(url).endsWith('/contacts/c2'),
      ),
    ).toBe(true)
  })
})
