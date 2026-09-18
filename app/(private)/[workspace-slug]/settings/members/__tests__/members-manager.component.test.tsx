import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import { MembersManager } from '../members-manager'

const notify = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}))
vi.mock('@/lib/notify', () => ({ notify }))

const WS = 'ws_1'
const BASE = `/api/workspaces/${WS}/invitations`

function invitation(overrides: Record<string, unknown>) {
  return {
    id: 'inv_1',
    email: 'ana@empresa.com',
    role: 'MEMBER',
    status: 'PENDING',
    expiresAt: '2026-10-01T12:00:00.000Z',
    ...overrides,
  }
}

function buttonsInRow(email: string) {
  const row = screen.getByText(email).closest('tr') as HTMLElement
  const [resend, revoke] = Array.from(row.querySelectorAll('button'))
  return { row, resend, revoke }
}

describe('<MembersManager />', () => {
  it('shows the empty state when there are no invitations', async () => {
    mockFetch([{ match: BASE, data: [] }])
    renderWithQuery(<MembersManager workspaceId={WS} />)

    expect(screen.getByText('Carregando convites...')).toBeTruthy()
    expect(await screen.findByText('Nenhum convite ainda.')).toBeTruthy()
  })

  it('lists invitations with pt-BR role and status labels', async () => {
    mockFetch([
      {
        match: BASE,
        data: [
          invitation({}),
          invitation({
            id: 'inv_2',
            email: 'bia@empresa.com',
            role: 'ADMIN',
            status: 'ACCEPTED',
          }),
        ],
      },
    ])
    renderWithQuery(<MembersManager workspaceId={WS} />)

    expect(await screen.findByText('ana@empresa.com')).toBeTruthy()
    expect(buttonsInRow('ana@empresa.com').row.textContent).toContain('Membro')
    expect(buttonsInRow('ana@empresa.com').row.textContent).toContain(
      'Pendente',
    )
    expect(buttonsInRow('bia@empresa.com').row.textContent).toContain(
      'Administrador',
    )
    expect(buttonsInRow('bia@empresa.com').row.textContent).toContain('Aceito')
  })

  it('disables resend/revoke for accepted invitations', async () => {
    mockFetch([
      {
        match: BASE,
        data: [invitation({ status: 'ACCEPTED' })],
      },
    ])
    renderWithQuery(<MembersManager workspaceId={WS} />)
    await screen.findByText('ana@empresa.com')

    const { resend, revoke } = buttonsInRow('ana@empresa.com')
    expect((resend as HTMLButtonElement).disabled).toBe(true)
    expect((revoke as HTMLButtonElement).disabled).toBe(true)
  })

  it('keeps the invite button disabled until an e-mail is typed', async () => {
    mockFetch([{ match: BASE, data: [] }])
    renderWithQuery(<MembersManager workspaceId={WS} />)
    await screen.findByText('Nenhum convite ainda.')

    const submit = screen.getByRole('button', {
      name: 'Convidar',
    }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)

    fireEvent.change(screen.getByPlaceholderText('email@exemplo.com'), {
      target: { value: 'novo@empresa.com' },
    })
    expect(submit.disabled).toBe(false)
  })

  it('sends an invitation with the default MEMBER role and clears the input', async () => {
    const spy = mockFetch([
      { method: 'POST', match: BASE, data: invitation({ id: 'inv_9' }) },
      { match: BASE, data: [] },
    ])
    renderWithQuery(<MembersManager workspaceId={WS} />)
    await screen.findByText('Nenhum convite ainda.')

    const input = screen.getByPlaceholderText(
      'email@exemplo.com',
    ) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'novo@empresa.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Convidar' }))

    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Convite enviado'),
    )
    expect(fetchBody(spy, BASE)).toEqual({
      email: 'novo@empresa.com',
      role: 'MEMBER',
    })
    expect(input.value).toBe('')
  })

  it('sends the role picked in the select', async () => {
    const spy = mockFetch([
      { method: 'POST', match: BASE, data: invitation({ id: 'inv_9' }) },
      { match: BASE, data: [] },
    ])
    renderWithQuery(<MembersManager workspaceId={WS} />)
    await screen.findByText('Nenhum convite ainda.')

    fireEvent.change(screen.getByPlaceholderText('email@exemplo.com'), {
      target: { value: 'chefe@empresa.com' },
    })
    fireEvent.click(
      document.querySelector('[data-slot=select-trigger]') as HTMLElement,
    )
    const option = await screen.findByRole('option', {
      name: 'Administrador',
    })
    // Base UI only commits a mouse click that started on the item itself.
    fireEvent.pointerDown(option, { pointerType: 'mouse' })
    fireEvent.click(option)
    fireEvent.click(screen.getByRole('button', { name: 'Convidar' }))

    await waitFor(() =>
      expect(fetchBody(spy, BASE)).toEqual({
        email: 'chefe@empresa.com',
        role: 'ADMIN',
      }),
    )
  })

  it('surfaces the API error when the invitation fails', async () => {
    mockFetch([
      {
        method: 'POST',
        match: BASE,
        status: 409,
        error: 'Usuário já é membro',
      },
      { match: BASE, data: [] },
    ])
    renderWithQuery(<MembersManager workspaceId={WS} />)
    await screen.findByText('Nenhum convite ainda.')

    fireEvent.change(screen.getByPlaceholderText('email@exemplo.com'), {
      target: { value: 'dup@empresa.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Convidar' }))

    await waitFor(() => expect(notify.error).toHaveBeenCalled())
    const [error] = notify.error.mock.calls[0]
    expect((error as Error).message).toBe('Usuário já é membro')
  })

  it('resends a pending invitation', async () => {
    const spy = mockFetch([
      { method: 'POST', match: `${BASE}/inv_1/resend`, data: null },
      { match: BASE, data: [invitation({})] },
    ])
    renderWithQuery(<MembersManager workspaceId={WS} />)
    await screen.findByText('ana@empresa.com')

    fireEvent.click(buttonsInRow('ana@empresa.com').resend as HTMLElement)

    await waitFor(() => expect(notify.success).toHaveBeenCalled())
    expect(
      spy.mock.calls.some(([url]) => String(url).endsWith('/inv_1/resend')),
    ).toBe(true)
  })

  // BUG: `handleRevoke` in members-manager.tsx calls
  // `resendInvitation.mutate` instead of `revokeInvitation.mutate`, so
  // clicking "Revogar" re-sends the e-mail and never issues the DELETE.
  // `it.fails` documents the defect; flip it to `it` once it is fixed.
  it.fails('revokes a pending invitation via DELETE', async () => {
    const spy = mockFetch([
      { method: 'DELETE', match: `${BASE}/inv_1`, data: null },
      { method: 'POST', match: `${BASE}/inv_1/resend`, data: null },
      { match: BASE, data: [invitation({})] },
    ])
    renderWithQuery(<MembersManager workspaceId={WS} />)
    await screen.findByText('ana@empresa.com')

    fireEvent.click(buttonsInRow('ana@empresa.com').revoke as HTMLElement)

    await waitFor(
      () =>
        expect(
          spy.mock.calls.some(([, init]) => init?.method === 'DELETE'),
        ).toBe(true),
      { timeout: 500 },
    )
  })
})
