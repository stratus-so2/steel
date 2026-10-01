import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mockFetch, renderWithQuery } from '@/src/__tests__/component-utils'
import type { SdMonitorAlertDTO } from '@/types/sd-monitor'
import type { SdTicketChannelDTO, SdTicketDTO } from '@/types/sd-ticket'
import { SdTicketMonitorBlock } from '../sd-ticket-monitor-block'

const WS = 'ws-1'
const ALERTS = `/api/workspaces/${WS}/servicedesk/monitor-alerts`

function ticket(channel: SdTicketChannelDTO = 'API'): SdTicketDTO {
  return { id: 't1', channel } as unknown as SdTicketDTO
}

function alert(overrides: Partial<SdMonitorAlertDTO> = {}): SdMonitorAlertDTO {
  return {
    id: 'a1',
    sourceId: 'src-1',
    sourceName: 'Zabbix matriz',
    status: 'OPEN',
    externalId: '31415',
    severity: 'Disaster',
    host: 'SRV-01',
    subject: 'Sem resposta do agente no SRV-01',
    body: null,
    configItem: { id: 'ci-1', name: 'SRV-01' },
    ticket: { id: 't1', number: 42, title: 'Servidor fora', phase: 'Novo' },
    startedAt: '2026-10-01T12:00:00.000Z',
    resolvedAt: null,
    createdAt: '2026-10-01T12:00:00.000Z',
    ...overrides,
  }
}

describe('<SdTicketMonitorBlock />', () => {
  it('shows the originating alert of a ticket opened by monitoring', async () => {
    const spy = mockFetch([{ match: ALERTS, data: [alert()] }])
    renderWithQuery(<SdTicketMonitorBlock workspaceId={WS} ticket={ticket()} />)
    expect(await screen.findByText('Monitoramento')).toBeTruthy()
    expect(screen.getByText('Alerta aberto')).toBeTruthy()
    expect(screen.getByText('Sem resposta do agente no SRV-01')).toBeTruthy()
    expect(screen.getByText('Zabbix matriz')).toBeTruthy()
    expect(screen.getByText('31415')).toBeTruthy()
    expect(screen.getAllByText('SRV-01')).toHaveLength(2)
    expect(spy.mock.calls[0][0]).toContain('ticketId=t1')
  })

  it('shows the recovery time of a resolved alert', async () => {
    mockFetch([
      {
        match: ALERTS,
        data: [
          alert({
            status: 'RESOLVED',
            resolvedAt: '2026-10-01T13:30:00.000Z',
            severity: null,
            host: null,
            configItem: null,
          }),
        ],
      },
    ])
    renderWithQuery(<SdTicketMonitorBlock workspaceId={WS} ticket={ticket()} />)
    expect(await screen.findByText('Alerta normalizado')).toBeTruthy()
    expect(screen.getByText('Normalizou')).toBeTruthy()
    expect(screen.queryByText('Severidade')).toBeNull()
    expect(screen.queryByText('Host')).toBeNull()
  })

  it('renders nothing without an alert and never asks for other channels', async () => {
    const spy = mockFetch([{ match: ALERTS, data: [] }])
    const { container } = renderWithQuery(
      <SdTicketMonitorBlock workspaceId={WS} ticket={ticket()} />,
    )
    await waitFor(() => expect(spy).toHaveBeenCalled())
    expect(container.textContent).toBe('')

    spy.mockClear()
    renderWithQuery(
      <SdTicketMonitorBlock workspaceId={WS} ticket={ticket('PORTAL')} />,
    )
    expect(spy).not.toHaveBeenCalled()
  })
})
