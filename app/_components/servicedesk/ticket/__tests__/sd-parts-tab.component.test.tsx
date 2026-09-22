import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import type { SdTicketPartDTO } from '@/types/sd-ticket-part'
import { SdTicketPartsTab } from '../tabs/parts-tab'
import {
  stubEventSource,
  TAB_URL,
  TICKET_ID,
  tabProps,
} from './sd-ticket-tab-fixtures'

function part(overrides: Partial<SdTicketPartDTO> = {}): SdTicketPartDTO {
  return {
    id: 'p1',
    ticketId: TICKET_ID,
    partId: 'cat1',
    name: 'Fonte 12V',
    sku: 'FT-12',
    quantity: 2,
    unitCost: '50.00',
    total: '100.00',
    serialNumber: 'SN123',
    status: 'REQUESTED',
    notes: null,
    catalogStock: 7,
    nextStatuses: ['RESERVED', 'INSTALLED', 'CANCELED'],
    createdBy: null,
    createdAt: '2026-09-21T12:00:00.000Z',
    updatedAt: '2026-09-21T12:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  stubEventSource()
})

describe('SdTicketPartsTab', () => {
  function routes() {
    return mockFetch([
      {
        match: `${TAB_URL}/parts`,
        data: {
          items: [
            part(),
            part({
              id: 'p2',
              partId: null,
              name: 'Parafuso avulso',
              sku: null,
              status: 'CANCELED',
              nextStatuses: [],
              catalogStock: null,
              serialNumber: null,
              notes: 'Não precisou',
            }),
          ],
          summary: { total: '100.00', installed: '0.00', count: 1 },
        },
      },
      { match: '/servicedesk/parts', data: [] },
      { method: 'PATCH', match: `${TAB_URL}/parts/`, data: part() },
      { method: 'POST', match: `${TAB_URL}/parts`, data: part({ id: 'n' }) },
    ])
  }

  it('renders parts, stock and final statuses', async () => {
    routes()
    renderWithQuery(<SdTicketPartsTab {...tabProps('agent')} />)
    expect(await screen.findByText('Fonte 12V')).toBeTruthy()
    expect(screen.getByText(/estoque 7/)).toBeTruthy()
    expect(screen.getByText('Texto livre')).toBeTruthy()
    expect(
      screen.getAllByText('Cancelada').some((el) => el.tagName !== 'OPTION'),
    ).toBe(true)
    expect(screen.getByText('Não precisou')).toBeTruthy()
  })

  it('changes the status within the allowed flow', async () => {
    const spy = routes()
    renderWithQuery(<SdTicketPartsTab {...tabProps('agent')} />)
    await screen.findByText('Fonte 12V')
    const select = screen.getByLabelText(
      'Status de Fonte 12V',
    ) as HTMLSelectElement
    expect(Array.from(select.options).map((o) => o.value)).toEqual([
      'REQUESTED',
      'RESERVED',
      'INSTALLED',
      'CANCELED',
    ])
    fireEvent.change(select, { target: { value: 'INSTALLED' } })
    await waitFor(() =>
      expect(fetchBody(spy, `${TAB_URL}/parts/p1`, 'PATCH')).toEqual({
        status: 'INSTALLED',
      }),
    )
  })

  it('adds a free-text part', async () => {
    const spy = routes()
    renderWithQuery(<SdTicketPartsTab {...tabProps('agent')} />)
    await screen.findByText('Fonte 12V')
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar peça' }))
    fireEvent.change(await screen.findByLabelText('Nome da peça'), {
      target: { value: 'Conector RJ45' },
    })
    fireEvent.change(screen.getByLabelText('Quantidade'), {
      target: { value: '4' },
    })
    fireEvent.change(screen.getByLabelText('Custo unitário'), {
      target: { value: '1,20' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    await waitFor(() =>
      expect(fetchBody(spy, `${TAB_URL}/parts`)).toEqual({
        quantity: 4,
        serialNumber: null,
        notes: null,
        unitCost: '1.20',
        name: 'Conector RJ45',
        sku: null,
        status: 'REQUESTED',
      }),
    )
  })

  it('is agent-only', () => {
    routes()
    renderWithQuery(<SdTicketPartsTab {...tabProps('requester')} />)
    expect(screen.getByText(/restrita aos agentes/)).toBeTruthy()
  })
})
