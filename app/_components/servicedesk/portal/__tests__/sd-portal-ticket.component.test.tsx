import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import type { SdTicketDTO } from '@/types/sd-ticket'
import { SdPortalTicket } from '../sd-portal-ticket'
import {
  API,
  portalTicket,
  REQUESTER_ME,
  RESOLVED_PHASE,
  SLUG,
  stubPortalEventSource,
  WS,
} from './sd-portal-fixtures'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => `/${SLUG}/servicedesk/portal/tickets/1`,
}))

beforeEach(() => {
  stubPortalEventSource()
})

const TICKET_URL = `${API}/tickets/t1`

function renderTicket(
  ticket: SdTicketDTO,
  routes: Parameters<typeof mockFetch>[0] = [],
) {
  const spy = mockFetch([
    ...routes,
    { match: `${TICKET_URL}/messages`, data: { items: [], nextBefore: null } },
    { match: `${TICKET_URL}/signatures`, data: [] },
    { match: `${API}/me`, data: REQUESTER_ME },
    { match: `${API}/tickets/t1`, data: ticket },
  ])
  renderWithQuery(
    <SdPortalTicket workspaceId={WS} slug={SLUG} ticketRef='t1' />,
  )
  return spy
}

describe('<SdPortalTicket />', () => {
  it('shows the code, the title, the progress and the key information', async () => {
    renderTicket(
      portalTicket({
        assignee: {
          id: 'u-agent',
          name: 'Ana Agente',
          email: 'ana@example.com',
          image: null,
        },
        urgency: { id: 'u1', name: 'Preciso agora', level: 3, color: null },
      }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Servidor fora do ar' }),
    ).toBeTruthy()
    expect(screen.getByText('INC-000001')).toBeTruthy()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      '50',
    )
    expect(screen.getByText(/Situação: Em andamento/)).toBeTruthy()
    expect(screen.getByText('Ana Agente')).toBeTruthy()
    expect(screen.getByText('Preciso agora')).toBeTruthy()
  })

  it('falls back to friendly text when nobody picked the ticket yet', async () => {
    renderTicket(portalTicket())
    expect(await screen.findByText('Aguardando a equipe')).toBeTruthy()
    expect(screen.getByText('Não informada')).toBeTruthy()
    expect(screen.getByText('Não informado')).toBeTruthy()
  })

  it('opens the conversation first and switches to the signature tab', async () => {
    renderTicket(portalTicket())

    expect(await screen.findByText(/Nenhuma mensagem ainda/)).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Assinatura' }))
    expect(await screen.findByText('Colher assinatura')).toBeTruthy()
  })

  it('does not offer CSAT or reopening while the ticket is open', async () => {
    renderTicket(portalTicket())
    await screen.findByRole('heading', { name: 'Servidor fora do ar' })
    expect(screen.queryByText('Como foi o atendimento?')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reabrir' })).toBeNull()
  })

  it('submits the CSAT once the ticket is resolved', async () => {
    const spy = renderTicket(
      portalTicket({ phase: RESOLVED_PHASE, completionPercent: 100 }),
      [
        {
          method: 'POST',
          match: `${TICKET_URL}/csat`,
          status: 201,
          data: {
            ticketId: 't1',
            number: 1,
            csatScore: 5,
            csatComment: 'Rápido!',
          },
        },
      ],
    )

    expect(await screen.findByText('Como foi o atendimento?')).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: '5 estrelas — Excelente' }),
    )
    fireEvent.change(screen.getByLabelText('Comentário sobre o atendimento'), {
      target: { value: 'Rápido!' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar avaliação' }))

    await waitFor(() =>
      expect(fetchBody(spy, `${TICKET_URL}/csat`, 'POST')).toEqual({
        score: 5,
        comment: 'Rápido!',
      }),
    )
  })

  it('shows the rating already given instead of the form', async () => {
    renderTicket(
      portalTicket({
        phase: RESOLVED_PHASE,
        csatScore: 4,
        csatComment: 'Resolveu',
      }),
    )

    expect(await screen.findByText('Obrigado pela sua avaliação!')).toBeTruthy()
    expect(screen.getByText(/avaliou este atendimento como "Bom"/)).toBeTruthy()
    expect(screen.getByText('“Resolveu”')).toBeTruthy()
    expect(screen.queryByText('Como foi o atendimento?')).toBeNull()
  })

  it('reopens the ticket by posting a message', async () => {
    const spy = renderTicket(portalTicket({ phase: RESOLVED_PHASE }), [
      {
        method: 'POST',
        match: `${TICKET_URL}/messages`,
        status: 201,
        data: { id: 'm1' },
      },
    ])

    fireEvent.click(await screen.findByRole('button', { name: 'Reabrir' }))
    fireEvent.change(await screen.findByLabelText('Motivo da reabertura'), {
      target: { value: 'O problema voltou hoje' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reabrir chamado' }))

    await waitFor(() =>
      expect(fetchBody(spy, `${TICKET_URL}/messages`, 'POST')).toEqual({
        body: 'O problema voltou hoje',
      }),
    )
  })

  it('explains when the ticket cannot be loaded', async () => {
    mockFetch([
      { match: `${API}/me`, data: REQUESTER_ME },
      {
        match: `${API}/tickets/t1`,
        status: 404,
        error: 'Chamado não encontrado',
      },
    ])
    renderWithQuery(
      <SdPortalTicket workspaceId={WS} slug={SLUG} ticketRef='t1' />,
    )

    expect(await screen.findByText('Não encontramos este chamado')).toBeTruthy()
    expect(screen.getByText('Chamado não encontrado')).toBeTruthy()
  })
})
