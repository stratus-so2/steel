import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fetchBody, mockFetch } from '@/src/__tests__/component-utils'
import { ProposalAcceptPanel } from '../proposal-accept-panel'

const ACCEPT_URL = '/api/crm/proposals/tok/accept'

const OPEN = {
  validUntil: '2026-10-11T02:59:59.999Z',
  isExpired: false,
  canAccept: true,
  acceptedAt: null,
  acceptedByName: null,
}

describe('<ProposalAcceptPanel />', () => {
  it('shows the validity and records the acceptance', async () => {
    const spy = mockFetch([
      {
        method: 'POST',
        match: ACCEPT_URL,
        data: {
          ...OPEN,
          canAccept: false,
          acceptedAt: '2026-09-18T15:00:00.000Z',
          acceptedByName: 'Maria',
        },
      },
    ])
    render(<ProposalAcceptPanel token='tok' initial={OPEN} />)

    expect(screen.getByText('10/10/2026')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Aceitar proposta' }))
    expect(
      screen.getByText('Informe seu nome para aceitar a proposta.'),
    ).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Seu nome'), {
      target: { value: ' Maria ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar proposta' }))

    expect(await screen.findByText('Proposta aceita')).toBeTruthy()
    expect(screen.getByText(/Aceita por Maria em 18\/09\/2026/)).toBeTruthy()
    expect(fetchBody(spy, ACCEPT_URL)).toEqual({ name: 'Maria' })
  })

  it('blocks acceptance of an expired proposal with a pt-BR message', () => {
    render(
      <ProposalAcceptPanel
        token='tok'
        initial={{ ...OPEN, isExpired: true, canAccept: false }}
      />,
    )

    expect(screen.getByText('Proposta expirada')).toBeTruthy()
    expect(
      screen.getByText(
        /terminou em 10\/10\/2026 e ela não pode mais ser aceita/,
      ),
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Aceitar proposta' }),
    ).toBeNull()
  })

  it('switches to the expired notice when it expires while the page is open', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            success: false,
            statusCode: 409,
            error: { code: 'CRM_PROPOSAL_EXPIRED' },
            message: 'A validade desta proposta expirou em 10/10/2026.',
          },
          { status: 409 },
        ),
      ),
    )
    render(<ProposalAcceptPanel token='tok' initial={OPEN} />)

    fireEvent.change(screen.getByLabelText('Seu nome'), {
      target: { value: 'Maria' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar proposta' }))

    await waitFor(() =>
      expect(screen.getByText('Proposta expirada')).toBeTruthy(),
    )
  })

  it('shows who accepted an already accepted proposal', () => {
    render(
      <ProposalAcceptPanel
        token='tok'
        initial={{
          ...OPEN,
          canAccept: false,
          acceptedAt: '2026-09-18T15:00:00.000Z',
          acceptedByName: 'João',
        }}
      />,
    )
    expect(screen.getByText(/Aceita por João/)).toBeTruthy()
  })
})
