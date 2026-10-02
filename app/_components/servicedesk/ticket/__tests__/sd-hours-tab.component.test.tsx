import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import type { SdTimeEntryDTO } from '@/types/sd-time-entry'
import {
  formatSdAllowance,
  formatSdMinutes,
} from '../../contracts/sd-contract-labels'
import { SdTicketHoursTab } from '../tabs/hours-tab'
import {
  AGENTS,
  stubEventSource,
  TAB_URL,
  TICKET_ID,
  tabProps,
  user,
} from './sd-ticket-tab-fixtures'

const HOURS = `${TAB_URL}/time-entries`
const text = (el: Element | null) => el?.textContent?.replace(/\s/g, ' ')

function entry(overrides: Partial<SdTimeEntryDTO> = {}): SdTimeEntryDTO {
  return {
    id: 'te1',
    ticketId: TICKET_ID,
    contractId: 'ct1',
    periodId: 'per1',
    source: 'TIMER',
    user: user('u-agent', 'Ana Agente'),
    startedAt: '2026-10-07T13:00:00.000Z',
    endedAt: '2026-10-07T14:00:00.000Z',
    minutes: 60,
    billable: true,
    window: 'BUSINESS_HOURS',
    amount: '150.00',
    description: 'Troca do switch',
    editable: true,
    createdAt: '2026-10-07T14:00:00.000Z',
    updatedAt: '2026-10-07T14:00:00.000Z',
    ...overrides,
  }
}

const CONTRACT = {
  id: 'ct1',
  name: 'Suporte mensal 20 h',
  code: 'CT-001',
  includedMinutes: 1200,
  roundingMinutes: 15,
  minimumMinutes: 30,
  period: {
    id: 'per1',
    contractId: 'ct1',
    periodStart: '2026-10-01T00:00:00.000Z',
    periodEnd: '2026-11-01T00:00:00.000Z',
    status: 'OPEN' as const,
    includedMinutes: 1200,
    usedMinutes: 90,
    billableMinutes: 60,
    overageMinutes: 0,
    carriedMinutes: 0,
    amount: '150.00',
    closedAt: null,
    closedBy: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-07T14:00:00.000Z',
  },
}

function list(overrides: Record<string, unknown> = {}) {
  return {
    items: [
      entry(),
      entry({
        id: 'te2',
        user: user('u-other', 'Bruno Agente'),
        minutes: 30,
        billable: false,
        amount: '0.00',
        window: 'AFTER_HOURS',
        source: 'MANUAL',
        description: null,
        editable: false,
      }),
    ],
    summary: {
      totalMinutes: 90,
      billableMinutes: 60,
      nonBillableMinutes: 30,
      amount: '150.00',
      byWindow: [
        { window: 'BUSINESS_HOURS', minutes: 60 },
        { window: 'AFTER_HOURS', minutes: 30 },
      ],
    },
    running: null,
    contract: CONTRACT,
    ...overrides,
  }
}

function routes(data: Record<string, unknown> = list()) {
  return mockFetch([
    { match: HOURS, data },
    { match: '/servicedesk/agents', data: AGENTS },
    { method: 'POST', match: `${HOURS}/timer`, data: entry({ id: 'novo' }) },
    { method: 'POST', match: HOURS, data: entry({ id: 'novo' }) },
  ])
}

beforeEach(() => {
  stubEventSource()
})

describe('formatação das horas', () => {
  it('mostra os minutos em horas', () => {
    expect(formatSdMinutes(0)).toBe('0h')
    expect(formatSdMinutes(60)).toBe('1h')
    expect(formatSdMinutes(135)).toBe('2h15')
    expect(formatSdMinutes(-90)).toBe('-1h30')
  })

  it('mostra a franquia consumida', () => {
    expect(formatSdAllowance(60, 1200)).toBe('1h de 20h')
    expect(formatSdAllowance(60, 0)).toBe('1h (sem franquia)')
  })
})

describe('SdTicketHoursTab', () => {
  it('lista os apontamentos, o total e o contrato do chamado', async () => {
    routes()
    renderWithQuery(<SdTicketHoursTab {...tabProps('agent')} />)

    expect(await screen.findByText('Troca do switch')).toBeTruthy()
    const body = text(document.body) ?? ''
    expect(body).toContain('1h30')
    expect(body).toContain('Suporte mensal 20 h')
    expect(body).toContain('CT-001')
    expect(body).toContain('arredonda 15 min')
    expect(body).toContain('1h de 20h')
    expect(body).toContain('Expediente')
    expect(body).toContain('Fora de hora')
  })

  it('só o próprio apontamento tem ação de editar', async () => {
    routes()
    renderWithQuery(<SdTicketHoursTab {...tabProps('agent')} />)
    await screen.findByText('Troca do switch')
    expect(
      screen.getByRole('button', {
        name: 'Editar o apontamento de Ana Agente',
      }),
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', {
        name: 'Editar o apontamento de Bruno Agente',
      }),
    ).toBeNull()
  })

  it('inicia o cronômetro e, com um aberto, oferece pausar e parar', async () => {
    const spy = routes()
    renderWithQuery(<SdTicketHoursTab {...tabProps('agent')} />)
    await screen.findByText('Troca do switch')

    fireEvent.click(screen.getByRole('button', { name: /Retomar/ }))
    await waitFor(() =>
      expect(fetchBody(spy, `${HOURS}/timer`)).toEqual({ action: 'resume' }),
    )
  })

  it('mostra o relógio quando há cronômetro neste chamado', async () => {
    routes(
      list({
        running: entry({
          id: 'run',
          endedAt: null,
          minutes: 0,
          amount: null,
          startedAt: new Date(Date.now() - 65_000).toISOString(),
        }),
      }),
    )
    renderWithQuery(<SdTicketHoursTab {...tabProps('agent')} />)

    const clock = await screen.findByRole('timer', {
      name: 'Tempo do cronômetro',
    })
    expect(clock.textContent).toMatch(/^00:01:0\d$/)
    expect(screen.getByRole('button', { name: /Pausar/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Parar/ })).toBeTruthy()
  })

  it('avisa quando o cronômetro está em outro chamado', async () => {
    routes(
      list({
        running: entry({ id: 'run', ticketId: 'outro', endedAt: null }),
      }),
    )
    renderWithQuery(<SdTicketHoursTab {...tabProps('agent')} />)
    expect(
      await screen.findByText(/cronômetro em andamento em outro chamado/),
    ).toBeTruthy()
  })

  it('lança horas manualmente pelo diálogo', async () => {
    const spy = routes()
    renderWithQuery(<SdTicketHoursTab {...tabProps('agent')} />)
    await screen.findByText('Troca do switch')

    fireEvent.click(screen.getByRole('button', { name: 'Lançar horas' }))
    fireEvent.change(await screen.findByLabelText('Início'), {
      target: { value: '2026-10-07T10:00' },
    })
    fireEvent.change(screen.getByLabelText('Fim'), {
      target: { value: '2026-10-07T11:30' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => {
      const body = fetchBody(spy, HOURS) as { startedAt: string }
      expect(new Date(body.startedAt).getTime()).toBe(
        new Date('2026-10-07T10:00').getTime(),
      )
    })
  })

  it('avisa quando o cliente não tem contrato', async () => {
    routes(list({ contract: null }))
    renderWithQuery(<SdTicketHoursTab {...tabProps('agent')} />)
    expect(await screen.findByText(/não tem contrato vigente/)).toBeTruthy()
  })

  it('é restrita a agentes', () => {
    const spy = routes()
    renderWithQuery(<SdTicketHoursTab {...tabProps('requester')} />)
    expect(screen.getByText(/restrita aos agentes/)).toBeTruthy()
    expect(spy).not.toHaveBeenCalled()
  })
})
