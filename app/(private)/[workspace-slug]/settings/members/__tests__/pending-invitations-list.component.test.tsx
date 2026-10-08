import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import type { InvitationDTO } from '@/types/invitation'
import { PendingInvitationsList } from '../pending-invitations-list'

const notify = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}))
vi.mock('@/lib/notify', () => ({ notify }))

const WS = 'ws_1'
const BASE = `/api/workspaces/${WS}/invitations`
const FUTURE = '2099-10-15T12:00:00.000Z'
const PAST = '2020-01-10T12:00:00.000Z'

function invitation(overrides: Partial<InvitationDTO>): InvitationDTO {
  return {
    id: 'inv_1',
    email: 'fernanda@cliente.com.br',
    role: 'MEMBER',
    status: 'PENDING',
    expiresAt: FUTURE,
    workspaceId: WS,
    projectId: null,
    invitedById: 'u_owner',
    createdAt: '2026-10-01T12:00:00.000Z',
    updatedAt: '2026-10-01T12:00:00.000Z',
    ...overrides,
  }
}

const LIST = [
  invitation({}),
  invitation({ id: 'inv_2', email: 'gustavo@cliente.com.br', role: 'ADMIN' }),
  invitation({
    id: 'inv_3',
    email: 'old@cliente.com.br',
    status: 'EXPIRED',
    expiresAt: PAST,
  }),
  invitation({
    id: 'inv_4',
    email: 'aceito@cliente.com.br',
    status: 'ACCEPTED',
  }),
  invitation({
    id: 'inv_5',
    email: 'revogado@cliente.com.br',
    status: 'REVOKED',
  }),
]

function rowOf(email: string) {
  return screen.getByText(email).closest('.divide-y > div') as HTMLElement
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('<PendingInvitationsList />', () => {
  it('shows a skeleton while loading, then nothing without open invitations', async () => {
    mockFetch([{ match: BASE, data: [invitation({ status: 'ACCEPTED' })] }])
    const { container } = renderWithQuery(
      <PendingInvitationsList workspaceId={WS} />,
    )

    expect(screen.getByTestId('invitations-loading')).toBeTruthy()
    await waitFor(() =>
      expect(screen.queryByTestId('invitations-loading')).toBeNull(),
    )
    expect(container.textContent).toBe('')
  })

  it('lists pending and expired invitations only, with the count', async () => {
    mockFetch([{ match: BASE, data: LIST }])
    renderWithQuery(<PendingInvitationsList workspaceId={WS} />)

    expect(await screen.findByText('Convites pendentes')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.queryByText('aceito@cliente.com.br')).toBeNull()
    expect(screen.queryByText('revogado@cliente.com.br')).toBeNull()

    const pending = rowOf('fernanda@cliente.com.br')
    expect(pending.textContent).toContain('Pendente')
    expect(pending.textContent).toContain('Membro')
    expect(pending.textContent).toContain('Expira em 15 de out.')
    expect(pending.textContent).toContain('Excluir')

    expect(rowOf('gustavo@cliente.com.br').textContent).toContain(
      'Administrador',
    )

    const expired = rowOf('old@cliente.com.br')
    expect(expired.textContent).toContain('Expirado')
    expect(expired.textContent).toContain('Expirou em 10 de jan.')
    expect(expired.textContent).toContain('Reenviar')
    expect(expired.textContent).not.toContain('Excluir')
  })

  it('treats a PENDING invitation past its date as expired', async () => {
    mockFetch([{ match: BASE, data: [invitation({ expiresAt: PAST })] }])
    renderWithQuery(<PendingInvitationsList workspaceId={WS} />)

    await screen.findByText('fernanda@cliente.com.br')
    const row = rowOf('fernanda@cliente.com.br')
    expect(row.textContent).toContain('Expirado')
    // Still PENDING in the database, so it can be revoked.
    expect(row.textContent).toContain('Excluir')
  })

  it('changes the role of a pending invitation', async () => {
    const spy = mockFetch([
      { match: BASE, data: LIST },
      {
        method: 'PATCH',
        match: `${BASE}/inv_1`,
        data: invitation({ role: 'VIEWER' }),
      },
    ])
    renderWithQuery(<PendingInvitationsList workspaceId={WS} />)
    await screen.findByText('fernanda@cliente.com.br')

    fireEvent.click(
      screen.getByLabelText('Cargo do convite de fernanda@cliente.com.br'),
    )
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Visualizador' }),
    )

    await waitFor(() =>
      expect(fetchBody(spy, `${BASE}/inv_1`, 'PATCH')).toEqual({
        role: 'VIEWER',
      }),
    )
    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith(
        'Cargo do convite atualizado',
      ),
    )
  })

  it('reports a failed role change', async () => {
    mockFetch([
      { match: BASE, data: LIST },
      { method: 'PATCH', match: `${BASE}/inv_1`, status: 409, error: 'x' },
    ])
    renderWithQuery(<PendingInvitationsList workspaceId={WS} />)
    await screen.findByText('fernanda@cliente.com.br')

    fireEvent.click(
      screen.getByLabelText('Cargo do convite de fernanda@cliente.com.br'),
    )
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Administrador' }),
    )

    await waitFor(() => expect(notify.error).toHaveBeenCalled())
    expect(notify.error.mock.calls[0][1]).toBe(
      'Não foi possível atualizar o cargo',
    )
  })

  it('resends an invitation (also an expired one)', async () => {
    const spy = mockFetch([
      { match: BASE, data: LIST },
      { method: 'POST', match: `${BASE}/inv_3/resend`, data: invitation({}) },
    ])
    renderWithQuery(<PendingInvitationsList workspaceId={WS} />)
    await screen.findByText('old@cliente.com.br')

    const row = rowOf('old@cliente.com.br')
    fireEvent.click(
      Array.from(row.querySelectorAll('button')).find(
        (b) => b.textContent === 'Reenviar',
      ) as HTMLElement,
    )

    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Convite reenviado'),
    )
    expect(
      spy.mock.calls.some(
        ([input, init]) =>
          String(input).endsWith('/inv_3/resend') && init?.method === 'POST',
      ),
    ).toBe(true)
  })

  it('reports a failed resend', async () => {
    mockFetch([
      { match: BASE, data: LIST },
      {
        method: 'POST',
        match: `${BASE}/inv_1/resend`,
        status: 500,
        error: 'x',
      },
    ])
    renderWithQuery(<PendingInvitationsList workspaceId={WS} />)
    await screen.findByText('fernanda@cliente.com.br')

    const row = rowOf('fernanda@cliente.com.br')
    fireEvent.click(
      Array.from(row.querySelectorAll('button')).find(
        (b) => b.textContent === 'Reenviar',
      ) as HTMLElement,
    )

    await waitFor(() => expect(notify.error).toHaveBeenCalled())
    expect(notify.error.mock.calls[0][1]).toBe(
      'Não foi possível reenviar o convite',
    )
  })

  it('revokes a pending invitation', async () => {
    const spy = mockFetch([
      { match: BASE, data: LIST },
      {
        method: 'DELETE',
        match: `${BASE}/inv_2`,
        data: invitation({ status: 'REVOKED' }),
      },
    ])
    renderWithQuery(<PendingInvitationsList workspaceId={WS} />)
    await screen.findByText('gustavo@cliente.com.br')

    const row = rowOf('gustavo@cliente.com.br')
    fireEvent.click(
      Array.from(row.querySelectorAll('button')).find(
        (b) => b.textContent === 'Excluir',
      ) as HTMLElement,
    )

    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Convite excluído'),
    )
    expect(
      spy.mock.calls.some(
        ([input, init]) =>
          String(input).endsWith('/inv_2') && init?.method === 'DELETE',
      ),
    ).toBe(true)
  })

  it('reports a failed revoke', async () => {
    mockFetch([
      { match: BASE, data: LIST },
      { method: 'DELETE', match: `${BASE}/inv_1`, status: 409, error: 'x' },
    ])
    renderWithQuery(<PendingInvitationsList workspaceId={WS} />)
    await screen.findByText('fernanda@cliente.com.br')

    const row = rowOf('fernanda@cliente.com.br')
    fireEvent.click(
      Array.from(row.querySelectorAll('button')).find(
        (b) => b.textContent === 'Excluir',
      ) as HTMLElement,
    )

    await waitFor(() => expect(notify.error).toHaveBeenCalled())
    expect(notify.error.mock.calls[0][1]).toBe(
      'Não foi possível excluir o convite',
    )
  })
})
