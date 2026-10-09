import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import { CrmCampaignsList } from '../crm-campaigns-list'
import { campaign, SLUG, WS } from './fixtures'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/lib/notify', () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}))

const kpis = {
  recipients: 10,
  emailSent: 10,
  emailOpened: 4,
  emailClicked: 1,
  whatsappSent: 2,
  whatsappRead: 1,
  whatsappReplied: 1,
  conversions: 3,
}

describe('CrmCampaignsList', () => {
  it('should show cards with status, channels and KPIs', async () => {
    mockFetch([
      {
        match: `/api/workspaces/${WS}/crm/campaigns`,
        data: [
          {
            ...campaign({
              status: 'COMPLETED',
              whatsappEnabled: true,
              startAt: '2026-10-09T13:00:00.000Z',
            }),
            kpis,
          },
          { ...campaign({ id: 'c2', name: 'Natal' }), kpis },
          {
            ...campaign({
              id: 'c3',
              name: 'Agendada',
              status: 'SCHEDULED',
              startAt: '2026-10-10T13:00:00.000Z',
            }),
            kpis,
          },
        ],
      },
    ])
    renderWithQuery(<CrmCampaignsList workspaceId={WS} slug={SLUG} />)
    const card = await screen.findByRole('link', { name: /Black Friday/ })
    expect(card.getAttribute('href')).toBe(`/${SLUG}/crm/campaigns/c1`)
    expect(card.textContent).toContain('Concluída')
    expect(card.textContent).toContain('WhatsApp')
    expect(card.textContent).toContain('Enviados12')
    expect(card.textContent).toContain('Abertura40%')
    expect(card.textContent).toContain('Conversões3')
    expect(screen.getByText('Rascunho')).toBeTruthy()
    expect(screen.getByText(/Agendada para 10\/10\/2026/)).toBeTruthy()
  })

  it('should create a draft and open the wizard', async () => {
    const spy = mockFetch([
      { match: `/api/workspaces/${WS}/crm/campaigns`, data: [] },
      {
        method: 'POST',
        match: `/api/workspaces/${WS}/crm/campaigns`,
        data: campaign({ id: 'new1' }),
      },
    ])
    renderWithQuery(<CrmCampaignsList workspaceId={WS} slug={SLUG} />)
    expect(await screen.findByText('Nenhuma campanha ainda')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Nova campanha' }))
    fireEvent.change(await screen.findByLabelText('Nome'), {
      target: { value: 'Black Friday' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Criar e continuar' }))
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(`/${SLUG}/crm/campaigns/new1`),
    )
    expect(fetchBody(spy, '/crm/campaigns')).toEqual({ name: 'Black Friday' })
  })
})
