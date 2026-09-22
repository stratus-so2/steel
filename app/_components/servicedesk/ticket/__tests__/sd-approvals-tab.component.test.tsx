import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import type {
  SdPublicApprovalDTO,
  SdTicketApprovalDTO,
} from '@/types/sd-ticket-approval'
import { isSdEmail } from '../approvals/sd-approval-labels'
import { SdPublicApprovalForm } from '../approvals/sd-public-approval-form'
import { SdTicketApprovalsTab } from '../tabs/approvals-tab'
import {
  AGENTS,
  stubEventSource,
  TAB_URL,
  TICKET_ID,
  tabProps,
  user,
} from './sd-ticket-tab-fixtures'

function approval(
  overrides: Partial<SdTicketApprovalDTO> = {},
): SdTicketApprovalDTO {
  return {
    id: 'ap1',
    ticketId: TICKET_ID,
    approverName: 'Diretor',
    approverEmail: 'diretor@cliente.com',
    approver: null,
    status: 'PENDING',
    message: 'Aprovar a troca do switch',
    comment: null,
    requestedBy: user('u-agent', 'Ana Agente'),
    sentAt: '2026-09-21T12:00:00.000Z',
    respondedAt: null,
    expiresAt: '2026-09-28T12:00:00.000Z',
    createdAt: '2026-09-21T12:00:00.000Z',
    updatedAt: '2026-09-21T12:00:00.000Z',
    ...overrides,
  }
}

const LIST = [
  approval(),
  approval({
    id: 'ap2',
    approver: user('u-req', 'Rui Solicitante'),
    approverEmail: 'u-req@example.com',
    status: 'REJECTED',
    comment: 'Sem orçamento',
    respondedAt: '2026-09-22T12:00:00.000Z',
  }),
  approval({
    id: 'ap3',
    status: 'EXPIRED',
    approverName: null,
    approverEmail: 'x@y.com',
  }),
]

beforeEach(() => {
  stubEventSource()
})

describe('SdTicketApprovalsTab', () => {
  function routes() {
    return mockFetch([
      { match: `${TAB_URL}/approvals`, data: LIST },
      { match: '/servicedesk/agents', data: AGENTS },
      {
        method: 'POST',
        match: `${TAB_URL}/approvals/ap1/cancel`,
        data: approval({ status: 'CANCELED' }),
      },
      {
        method: 'POST',
        match: `${TAB_URL}/approvals/ap3/resend`,
        data: approval({ id: 'ap3' }),
      },
      {
        method: 'POST',
        match: `${TAB_URL}/approvals`,
        data: [approval({ id: 'n1' }), approval({ id: 'n2' })],
      },
    ])
  }

  it('lists approvals with status, comment and actions', async () => {
    routes()
    renderWithQuery(<SdTicketApprovalsTab {...tabProps('agent')} />)
    expect(await screen.findByText('Diretor')).toBeTruthy()
    expect(screen.getByText('Pendente')).toBeTruthy()
    expect(screen.getAllByText('Reprovada').length).toBeGreaterThan(0)
    expect(screen.getByText('Expirada')).toBeTruthy()
    expect(screen.getByText(/Sem orçamento/)).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Cancelar pedido de x@y.com' }),
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Reenviar para x@y.com' }),
    ).toBeTruthy()
  })

  it('cancels and resends', async () => {
    const spy = routes()
    renderWithQuery(<SdTicketApprovalsTab {...tabProps('agent')} />)
    await screen.findByText('Diretor')
    fireEvent.click(
      screen.getByRole('button', { name: 'Cancelar pedido de Diretor' }),
    )
    await waitFor(() =>
      expect(fetchBody(spy, '/approvals/ap1/cancel')).toEqual({}),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Reenviar para x@y.com' }),
    )
    await waitFor(() =>
      expect(fetchBody(spy, '/approvals/ap3/resend')).toEqual({}),
    )
  })

  it('requests approval from a user and an external e-mail', async () => {
    const spy = routes()
    renderWithQuery(<SdTicketApprovalsTab {...tabProps('agent')} />)
    await screen.findByText('Diretor')
    fireEvent.click(screen.getByRole('button', { name: 'Pedir aprovação' }))
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Ana Agente' }))
    const email = screen.getByLabelText('E-mail do aprovador')
    fireEvent.change(email, { target: { value: 'invalido' } })
    fireEvent.keyDown(email, { key: 'Enter' })
    expect(screen.queryByText('invalido')).toBeNull()
    fireEvent.change(email, { target: { value: 'CFO@Cliente.com' } })
    fireEvent.keyDown(email, { key: 'Enter' })
    expect(await screen.findByText('cfo@cliente.com')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Mensagem ao aprovador'), {
      target: { value: 'Urgente' },
    })
    fireEvent.change(screen.getByLabelText('Validade em dias'), {
      target: { value: '3' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }))
    await waitFor(() =>
      expect(fetchBody(spy, `${TAB_URL}/approvals`)).toEqual({
        approvers: [{ userId: 'u-agent' }, { email: 'cfo@cliente.com' }],
        message: 'Urgente',
        expiresInDays: 3,
      }),
    )
  })

  it('is agent-only', () => {
    routes()
    renderWithQuery(<SdTicketApprovalsTab {...tabProps('requester')} />)
    expect(screen.getByText(/restrita aos agentes/)).toBeTruthy()
  })

  it('validates e-mails', () => {
    expect(isSdEmail('a@b.co')).toBe(true)
    expect(isSdEmail('a@b')).toBe(false)
  })
})

describe('SdPublicApprovalForm', () => {
  const TOKEN = 'a'.repeat(43)
  const preview = (
    overrides: Partial<SdPublicApprovalDTO> = {},
  ): SdPublicApprovalDTO => ({
    status: 'PENDING',
    workspaceName: 'Acme',
    approverName: 'Diretor',
    requestedByName: 'Ana Agente',
    message: 'Aprovar a troca do switch',
    comment: null,
    expiresAt: '2026-09-28T12:00:00.000Z',
    respondedAt: null,
    ticket: {
      code: 'CHG-000004',
      title: 'Troca do switch core',
      type: 'CHANGE',
      phaseName: 'Aguardando aprovação',
      summary: 'Switch com falhas intermitentes',
    },
    ...overrides,
  })

  it('approves with a comment and shows the answered state', async () => {
    const spy = mockFetch([
      {
        method: 'POST',
        match: `/api/servicedesk/approvals/${TOKEN}`,
        data: preview({
          status: 'APPROVED',
          comment: 'Pode seguir',
          respondedAt: '2026-09-22T12:00:00.000Z',
        }),
      },
    ])
    renderWithQuery(
      <SdPublicApprovalForm
        token={TOKEN}
        approval={preview()}
        initialDecision='APPROVED'
      />,
    )
    expect(screen.getByText('CHG-000004 — Troca do switch core')).toBeTruthy()
    expect(screen.getByText('Mudança')).toBeTruthy()
    expect(screen.getByText('Switch com falhas intermitentes')).toBeTruthy()
    expect(screen.getByText('Mensagem de Ana Agente')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Comentário'), {
      target: { value: 'Pode seguir' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }))
    await waitFor(() =>
      expect(fetchBody(spy, '/api/servicedesk/approvals/')).toEqual({
        decision: 'APPROVED',
        comment: 'Pode seguir',
      }),
    )
    expect(
      await screen.findByText('Esta solicitação foi aprovada.'),
    ).toBeTruthy()
    expect(screen.getByText(/Pode seguir/)).toBeTruthy()
  })

  it('shows the API error and closed states', async () => {
    mockFetch([
      {
        method: 'POST',
        match: '/api/servicedesk/approvals/',
        status: 410,
        error: 'O link de aprovação expirou',
      },
    ])
    const { unmount } = renderWithQuery(
      <SdPublicApprovalForm token={TOKEN} approval={preview()} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Reprovar' }))
    expect(await screen.findByText('O link de aprovação expirou')).toBeTruthy()
    unmount()

    renderWithQuery(
      <SdPublicApprovalForm
        token={TOKEN}
        approval={preview({
          status: 'EXPIRED',
          message: null,
          ticket: { ...preview().ticket, summary: null },
        })}
      />,
    )
    expect(screen.getByText(/link de aprovação expirou/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Aprovar' })).toBeNull()
  })
})
