import { screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, renderWithQuery } from '@/src/__tests__/component-utils'
import type { SdApprovalRoundDTO } from '@/types/sd-cab'
import type { SdChangeCalendarDTO } from '@/types/sd-change'
import { SD_SETTINGS_TABS } from '../../settings/settings-tabs'
import {
  SD_TICKET_TABS,
  sdResolveTab,
  sdTicketTabsFor,
} from '../../ticket/ticket-tabs'
import { SdChangeCalendar } from '../sd-change-calendar'
import {
  SD_APPROVAL_ROUND_STATUS_LABEL,
  sdTallySummary,
  sdWarningKindLabel,
  sdWindowKindLabel,
} from '../sd-change-labels'
import { SdChangeViewSwitch } from '../sd-change-view-switch'

afterEach(() => {
  vi.useRealTimers()
})

const WS = 'ws-1'
const SLUG = 'acme'

/** 2026-10-10 é um sábado; o calendário abre no mês de "hoje". */
const TODAY = new Date('2026-10-10T12:00:00.000Z')

function calendar(
  overrides: Partial<SdChangeCalendarDTO> = {},
): SdChangeCalendarDTO {
  return {
    from: '2026-09-27T00:00:00.000Z',
    to: '2026-11-01T00:00:00.000Z',
    windows: [
      {
        windowId: 'w1',
        name: 'Congelamento de outubro',
        kind: 'FREEZE',
        startsAt: '2026-10-10T00:00:00.000Z',
        endsAt: '2026-10-11T00:00:00.000Z',
        timezone: 'America/Sao_Paulo',
        configItemIds: [],
        departmentIds: [],
        description: 'Fechamento contábil',
        recurring: false,
      },
    ],
    changes: [
      {
        ticketId: 't1',
        number: 42,
        code: 'CHG-000042',
        title: 'Troca de disco',
        type: 'CHANGE',
        plannedStartAt: '2026-10-10T12:00:00.000Z',
        plannedEndAt: '2026-10-10T16:00:00.000Z',
        phaseName: 'Planejada',
        phaseCategory: 'IN_PROGRESS',
        changeType: 'NORMAL',
        changeRisk: 'HIGH',
        configItemId: 'ci1',
        configItemName: 'Servidor de e-mail',
        departmentId: null,
        assignee: null,
        conflictTicketIds: ['t2'],
        frozenWindowIds: ['w1'],
      },
      {
        ticketId: 't2',
        number: 43,
        code: 'CHG-000043',
        title: 'Atualização de firmware',
        type: 'CHANGE',
        plannedStartAt: '2026-10-10T14:00:00.000Z',
        plannedEndAt: '2026-10-10T18:00:00.000Z',
        phaseName: 'Planejada',
        phaseCategory: 'IN_PROGRESS',
        changeType: null,
        changeRisk: null,
        configItemId: 'ci1',
        configItemName: 'Servidor de e-mail',
        departmentId: null,
        assignee: null,
        conflictTicketIds: ['t1'],
        frozenWindowIds: ['w1'],
      },
    ],
    ...overrides,
  }
}

describe('sdWindowKindLabel / sdWarningKindLabel', () => {
  it('names the window and warning kinds in pt-BR', () => {
    expect(sdWindowKindLabel('FREEZE')).toBe('Congelamento')
    expect(sdWindowKindLabel('MAINTENANCE')).toBe('Manutenção')
    expect(sdWarningKindLabel('FREEZE')).toBe('Congelamento')
    expect(sdWarningKindLabel('CONFLICT')).toBe('Conflito de janela')
  })

  it('names every round status', () => {
    expect(Object.keys(SD_APPROVAL_ROUND_STATUS_LABEL)).toEqual([
      'PENDING',
      'APPROVED',
      'REJECTED',
      'CANCELED',
      'EXPIRED',
    ])
  })
})

describe('sdTallySummary', () => {
  const tally = (
    overrides: Partial<SdApprovalRoundDTO['tally']> = {},
  ): SdApprovalRoundDTO['tally'] => ({
    total: 3,
    approved: 1,
    rejected: 0,
    pending: 2,
    requiredPending: 0,
    remaining: 1,
    ...overrides,
  })

  it('says how many approvals are still missing', () => {
    expect(sdTallySummary(tally(), 2)).toBe('1 de 2 aprovação(ões) · faltam 1')
  })

  it('mentions the pending mandatory votes', () => {
    expect(
      sdTallySummary(
        tally({ approved: 2, remaining: 0, requiredPending: 1 }),
        2,
      ),
    ).toContain('obrigatório(s) pendente(s)')
  })

  it('announces the quorum once it is reached', () => {
    expect(
      sdTallySummary(tally({ approved: 2, pending: 0, remaining: 0 }), 2),
    ).toContain('quórum atingido')
  })
})

describe('SdChangeViewSwitch', () => {
  it('links both views and marks the active one', () => {
    renderWithQuery(<SdChangeViewSwitch slug={SLUG} active='calendar' />)
    const board = screen.getByRole('link', { name: 'Quadro' })
    const cal = screen.getByRole('link', { name: 'Calendário' })
    expect(board.getAttribute('href')).toBe(`/${SLUG}/servicedesk/changes`)
    expect(cal.getAttribute('href')).toBe(
      `/${SLUG}/servicedesk/changes/calendar`,
    )
    expect(cal.getAttribute('aria-current')).toBe('page')
    expect(board.getAttribute('aria-current')).toBeNull()
  })
})

describe('SdChangeCalendar', () => {
  it('paints the freeze band, the conflicts and the day panel', async () => {
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
    vi.setSystemTime(TODAY)
    mockFetch([{ match: '/servicedesk/change-calendar', data: calendar() }])
    renderWithQuery(<SdChangeCalendar workspaceId={WS} slug={SLUG} />)

    // O dia 10 é o selecionado (hoje) e tem congelamento.
    await waitFor(() => {
      expect(
        screen.getAllByText(/Congelamento de outubro/).length,
      ).toBeGreaterThan(0)
    })
    const day = screen.getByRole('button', {
      name: /sábado, 10 de outubro · congelamento · 2 mudança\(s\)/i,
    })
    expect(day.getAttribute('aria-pressed')).toBe('true')

    // Painel do dia: as duas mudanças, com o motivo do conflito.
    const links = screen.getAllByRole('link')
    const first = links.find((link) => link.textContent?.includes('CHG-000042'))
    expect(first?.getAttribute('href')).toBe(`/${SLUG}/servicedesk/tickets/42`)
    expect(
      screen.getAllByText(/Dentro de uma janela de congelamento/),
    ).toHaveLength(2)
    expect(
      screen.getByText(/Conflito com CHG-000043 no mesmo item/),
    ).toBeTruthy()
    expect(screen.getAllByText('Servidor de e-mail').length).toBeGreaterThan(0)
  })

  it('switches to the week view and shows the error from the api', async () => {
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
    vi.setSystemTime(TODAY)
    mockFetch([
      { match: '/servicedesk/change-calendar', status: 500, error: 'Caiu' },
    ])
    renderWithQuery(<SdChangeCalendar workspaceId={WS} slug={SLUG} />)
    await waitFor(() => {
      expect(screen.getByText('Caiu')).toBeTruthy()
    })
    expect(screen.getByRole('button', { name: 'Semana' })).toBeTruthy()
  })

  it('shows an empty day panel when nothing is scheduled', async () => {
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
    vi.setSystemTime(TODAY)
    mockFetch([
      {
        match: '/servicedesk/change-calendar',
        data: calendar({ windows: [], changes: [] }),
      },
    ])
    renderWithQuery(<SdChangeCalendar workspaceId={WS} slug={SLUG} />)
    await waitFor(() => {
      expect(
        screen.getByText('Nenhuma mudança agendada neste dia.'),
      ).toBeTruthy()
    })
    expect(screen.getByText('0 mudança(s) · 0 janela(s)')).toBeTruthy()
  })
})

describe('tab registries', () => {
  it('registers the "Mudanças" settings tab', () => {
    const tab = SD_SETTINGS_TABS.find((item) => item.id === 'changes')
    expect(tab?.label).toBe('Mudanças')
    expect(tab?.personal).toBeUndefined()
  })

  it('shows the ticket "Mudança" tab only on CHANGE tickets, for agents', () => {
    expect(SD_TICKET_TABS.some((t) => t.id === 'change')).toBe(true)
    expect(sdTicketTabsFor('agent', 'CHANGE').map((t) => t.id)).toContain(
      'change',
    )
    expect(sdTicketTabsFor('agent', 'INCIDENT').map((t) => t.id)).not.toContain(
      'change',
    )
    expect(
      sdTicketTabsFor('requester', 'CHANGE').map((t) => t.id),
    ).not.toContain('change')
    // Sem tipo informado o registro inteiro continua valendo (compatível).
    expect(sdTicketTabsFor('agent').map((t) => t.id)).toContain('change')
  })

  it('resolves ?tab=change only where the tab exists', () => {
    expect(sdResolveTab('change', 'agent', 'CHANGE')).toBe('change')
    expect(sdResolveTab('change', 'agent', 'INCIDENT')).toBe('history')
    expect(sdResolveTab(null, 'agent', 'CHANGE')).toBe('history')
  })
})
