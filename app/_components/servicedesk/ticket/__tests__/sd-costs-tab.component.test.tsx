import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import type { SdTicketCostDTO } from '@/types/sd-ticket-cost'
import { formatBRL, parseSdDecimal } from '../shared/sd-tab-format'
import { SdTicketCostsTab } from '../tabs/costs-tab'
import {
  AGENTS,
  stubEventSource,
  TAB_URL,
  TICKET_ID,
  tabProps,
  user,
} from './sd-ticket-tab-fixtures'

const brl = (v: string) => formatBRL(v).replace(/\s/g, ' ')
const text = (el: Element | null) => el?.textContent?.replace(/\s/g, ' ')

function cost(overrides: Partial<SdTicketCostDTO> = {}): SdTicketCostDTO {
  return {
    id: 'c1',
    ticketId: TICKET_ID,
    category: 'LABOR',
    description: 'Visita técnica',
    quantity: '1.50',
    unitCost: '150.00',
    total: '225.00',
    billable: true,
    incurredAt: '2026-09-21T12:00:00.000Z',
    user: user('u-agent', 'Ana Agente'),
    createdBy: null,
    createdAt: '2026-09-21T12:00:00.000Z',
    updatedAt: '2026-09-21T12:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  stubEventSource()
})

describe('shared formatting', () => {
  it('parses pt-BR decimals', () => {
    expect(parseSdDecimal('1,5')).toBe(1.5)
    expect(parseSdDecimal('1.234,50')).toBe(1234.5)
    expect(parseSdDecimal('12.5')).toBe(12.5)
    expect(Number.isNaN(parseSdDecimal(''))).toBe(true)
  })
})

describe('SdTicketCostsTab', () => {
  function routes() {
    return mockFetch([
      {
        match: `${TAB_URL}/costs`,
        data: {
          items: [
            cost(),
            cost({
              id: 'c2',
              category: 'TRAVEL',
              description: 'Km rodado',
              billable: false,
              quantity: '10.00',
              unitCost: '2.00',
              total: '20.00',
              user: null,
            }),
          ],
          summary: {
            total: '245.00',
            billable: '225.00',
            nonBillable: '20.00',
            byCategory: [
              { category: 'LABOR', total: '225.00' },
              { category: 'TRAVEL', total: '20.00' },
            ],
          },
        },
      },
      { match: '/servicedesk/agents', data: AGENTS },
      { method: 'POST', match: `${TAB_URL}/costs`, data: cost({ id: 'n' }) },
    ])
  }

  it('renders totals by category and billable summary', async () => {
    routes()
    renderWithQuery(<SdTicketCostsTab {...tabProps('agent')} />)
    expect(await screen.findByText('Visita técnica')).toBeTruthy()
    const body = text(document.body) ?? ''
    expect(body).toContain(brl('245.00'))
    expect(body).toContain(brl('225.00'))
    expect(body).toContain(brl('20.00'))
    const byCategory = screen.getByLabelText('Totais por categoria')
    expect(text(byCategory)).toContain('Mão de obra')
    expect(text(byCategory)).toContain('Deslocamento')
    expect(screen.getByText('1,5')).toBeTruthy()
  })

  it('creates a cost from the dialog', async () => {
    const spy = routes()
    renderWithQuery(<SdTicketCostsTab {...tabProps('agent')} />)
    await screen.findByText('Visita técnica')
    fireEvent.click(screen.getByRole('button', { name: 'Lançar custo' }))
    fireEvent.change(await screen.findByLabelText('Descrição do custo'), {
      target: { value: 'Cabo' },
    })
    fireEvent.change(screen.getByLabelText('Quantidade'), {
      target: { value: '3' },
    })
    fireEvent.change(screen.getByLabelText('Custo unitário'), {
      target: { value: '12,50' },
    })
    fireEvent.change(screen.getByLabelText('Data do custo'), {
      target: { value: '2026-09-20' },
    })
    fireEvent.click(screen.getByRole('switch', { name: 'Faturável' }))
    expect(text(document.body)).toContain(brl('37.50'))
    fireEvent.click(screen.getByRole('button', { name: 'Lançar' }))
    await waitFor(() =>
      expect(fetchBody(spy, `${TAB_URL}/costs`)).toEqual({
        category: 'OTHER',
        description: 'Cabo',
        quantity: '3.00',
        unitCost: '12.50',
        billable: true,
        incurredAt: '2026-09-20T12:00:00.000Z',
        userId: null,
      }),
    )
  })

  it('is agent-only', () => {
    const spy = routes()
    renderWithQuery(<SdTicketCostsTab {...tabProps('requester')} />)
    expect(screen.getByText(/restrita aos agentes/)).toBeTruthy()
    expect(spy).not.toHaveBeenCalled()
  })
})
