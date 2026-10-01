import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import type { SdConfigBootstrapDTO } from '@/types/sd-config'
import type { SdRecurringTicketDTO } from '@/types/sd-recurring-ticket'

vi.mock('next/navigation', () => ({
  useParams: () => ({ 'workspace-slug': 'acme' }),
}))

import { SdConfigItemRoutines } from '../../recurring/sd-recurring-bits'
import { SdRecurringTab } from '../recurring-tab'
import { SdSettingsProvider } from '../sd-settings-kit'
import { SD_SETTINGS_TABS } from '../settings-tabs'

const WS = 'ws-1'
const SD_URL = `/api/workspaces/${WS}/servicedesk`
const RULES = `${SD_URL}/recurring-tickets`

const config = {
  departments: [{ id: 'dep-1', name: 'Infra', children: [] }],
  templates: [
    { id: 'tpl-1', name: 'Backup mensal', ticketType: 'SERVICE_REQUEST' },
    { id: 'tpl-2', name: 'Mudança padrão', ticketType: 'CHANGE' },
  ],
} as unknown as SdConfigBootstrapDTO

function rule(
  overrides: Partial<SdRecurringTicketDTO> = {},
): SdRecurringTicketDTO {
  return {
    id: 'rec-1',
    workspaceId: WS,
    name: 'Vistoria mensal do nobreak',
    description: 'Checar baterias',
    active: true,
    ticketType: 'SERVICE_REQUEST',
    templateId: null,
    template: null,
    defaults: {},
    customerId: null,
    customer: null,
    configItemId: 'ci-1',
    configItem: { id: 'ci-1', name: 'Nobreak da sala', code: 'NB-01' },
    departmentId: 'dep-1',
    assigneeId: null,
    frequency: 'MONTHLY',
    interval: 1,
    byWeekday: [],
    byMonthday: 10,
    atTime: '08:00',
    timezone: 'America/Sao_Paulo',
    startsAt: '2026-10-01T03:00:00.000Z',
    endsAt: null,
    leadTimeMinutes: 0,
    skipIfOpen: true,
    lastRunAt: null,
    nextRunAt: '2026-10-10T11:00:00.000Z',
    upcoming: ['2026-10-10T11:00:00.000Z', '2026-11-10T11:00:00.000Z'],
    runCount: 2,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  }
}

/** Os campos de data do editor não têm label associada: pega pelo tipo. */
function dateInputs(): HTMLInputElement[] {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]'),
  )
}

function renderTab(canEdit = true) {
  return renderWithQuery(
    <SdSettingsProvider value={{ workspaceId: WS, canEdit, config }}>
      <SdRecurringTab />
    </SdSettingsProvider>,
  )
}

describe('SD_SETTINGS_TABS', () => {
  it('registers the recurring tab', () => {
    const tab = SD_SETTINGS_TABS.find((item) => item.id === 'recurring')
    expect(tab?.label).toBe('Recorrentes')
    expect(tab?.component).toBe(SdRecurringTab)
  })
})

describe('<SdRecurringTab />', () => {
  it('invites the admin to create the first routine', async () => {
    mockFetch([{ match: RULES, data: [] }])
    renderTab()
    expect(await screen.findByText(/Nenhuma rotina cadastrada/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Nova rotina/ })).toBeTruthy()
  })

  it('surfaces the error of the list query', async () => {
    mockFetch([{ match: RULES, status: 403, error: 'Só agentes' }])
    renderTab()
    expect(await screen.findByText('Só agentes')).toBeTruthy()
  })

  it('shows the schedule, the next run and hides the writes in read only', async () => {
    mockFetch([{ match: RULES, data: [rule()] }])
    renderTab(false)
    expect(await screen.findByText('Vistoria mensal do nobreak')).toBeTruthy()
    expect(screen.getByText('A cada mês, no dia 10, às 08:00')).toBeTruthy()
    expect(screen.getByText('10/10/2026, 08:00')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Nova rotina/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Editar Vistoria/ })).toBeNull()
  })

  it('explains a paused routine and one whose window is over', async () => {
    mockFetch([
      {
        match: RULES,
        data: [
          rule({ active: false, nextRunAt: null }),
          rule({ id: 'rec-2', name: 'Antiga', nextRunAt: null }),
        ],
      },
    ])
    renderTab()
    expect(await screen.findByText('Pausada')).toBeTruthy()
    expect(screen.getByText('Vigência encerrada')).toBeTruthy()
  })

  it('pauses a routine from the switch', async () => {
    const spy = mockFetch([
      { match: RULES, data: [rule()] },
      { method: 'PATCH', match: `${RULES}/rec-1`, data: rule() },
    ])
    renderTab()
    fireEvent.click(await screen.findByRole('switch', { name: 'Pausar' }))
    await waitFor(() =>
      expect(fetchBody(spy, `${RULES}/rec-1`, 'PATCH')).toEqual({
        active: false,
      }),
    )
  })

  it('creates a routine and previews the next occurrences', async () => {
    const spy = mockFetch([
      { match: RULES, data: [] },
      { method: 'POST', match: RULES, status: 201, data: rule() },
    ])
    renderTab()
    fireEvent.click(await screen.findByRole('button', { name: /Nova rotina/ }))

    fireEvent.change(
      screen.getByPlaceholderText('Vistoria mensal do nobreak'),
      { target: { value: 'Backup semanal' } },
    )
    fireEvent.change(dateInputs()[0], {
      target: { value: '2026-10-01T00:00' },
    })

    expect(screen.getByText(/próximas ocorrências serão/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(fetchBody(spy, RULES)).toBeTruthy())
    expect(fetchBody(spy, RULES)).toMatchObject({
      name: 'Backup semanal',
      ticketType: 'SERVICE_REQUEST',
      frequency: 'MONTHLY',
      interval: 1,
      atTime: '08:00',
      timezone: 'America/Sao_Paulo',
      skipIfOpen: true,
      active: true,
    })
  })

  it('refuses to save a schedule the lib rejects', async () => {
    mockFetch([{ match: RULES, data: [] }])
    renderTab()
    fireEvent.click(await screen.findByRole('button', { name: /Nova rotina/ }))
    fireEvent.change(
      screen.getByPlaceholderText('Vistoria mensal do nobreak'),
      { target: { value: 'Rotina impossível' } },
    )
    fireEvent.change(dateInputs()[0], {
      target: { value: '2026-10-01T00:00' },
    })
    fireEvent.change(dateInputs()[1], {
      target: { value: '2026-09-01T00:00' },
    })

    expect(
      await screen.findByText('O fim da vigência deve ser depois do início'),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('generates the ticket now', async () => {
    const spy = mockFetch([
      { match: `${RULES}?`, data: [rule()] },
      {
        method: 'POST',
        match: `${RULES}/rec-1/run-now`,
        status: 201,
        data: {
          id: 'run-1',
          recurringId: 'rec-1',
          scheduledFor: '2026-10-02T12:00:00.000Z',
          status: 'CREATED',
          ticketId: 't1',
          ticket: {
            id: 't1',
            number: 42,
            type: 'SERVICE_REQUEST',
            title: 'Vistoria',
          },
          reason: null,
          createdAt: '2026-10-02T12:00:00.000Z',
        },
      },
    ])
    renderTab()
    fireEvent.click(await screen.findByRole('button', { name: /Gerar agora/ }))
    await waitFor(() =>
      expect(
        spy.mock.calls.some(([url]) => String(url).includes('/rec-1/run-now')),
      ).toBe(true),
    )
  })

  it('shows the occurrence history with a link to the generated ticket', async () => {
    mockFetch([
      { match: `${RULES}?`, data: [rule()] },
      {
        match: `${RULES}/rec-1/runs`,
        data: [
          {
            id: 'run-1',
            recurringId: 'rec-1',
            scheduledFor: '2026-10-10T11:00:00.000Z',
            status: 'CREATED',
            ticketId: 't1',
            ticket: {
              id: 't1',
              number: 42,
              type: 'SERVICE_REQUEST',
              title: 'Vistoria',
            },
            reason: null,
            createdAt: '2026-10-10T11:00:00.000Z',
          },
          {
            id: 'run-2',
            recurringId: 'rec-1',
            scheduledFor: '2026-11-10T11:00:00.000Z',
            status: 'SKIPPED',
            ticketId: null,
            ticket: null,
            reason:
              'O chamado REQ-000042 da ocorrência anterior ainda está aberto',
            createdAt: '2026-11-10T11:00:00.000Z',
          },
        ],
      },
    ])
    renderTab()
    fireEvent.click(await screen.findByRole('button', { name: /Histórico/ }))

    expect(await screen.findByText('Abriu')).toBeTruthy()
    expect(screen.getByText('Pulou')).toBeTruthy()
    expect(screen.getByText(/REQ-000042/)).toBeTruthy()
    expect(screen.getByRole('link', { name: '#42' })).toHaveProperty(
      'href',
      expect.stringContaining('/acme/servicedesk/tickets/42'),
    )
  })

  it('tells the agent when a routine never ran', async () => {
    mockFetch([
      { match: `${RULES}?`, data: [rule()] },
      { match: `${RULES}/rec-1/runs`, data: [] },
    ])
    renderTab()
    fireEvent.click(await screen.findByRole('button', { name: /Histórico/ }))
    expect(await screen.findByText(/ainda não rodou/)).toBeTruthy()
  })
})

describe('<SdConfigItemRoutines />', () => {
  it('lists the routines that cover the config item', async () => {
    const spy = mockFetch([{ match: RULES, data: [rule()] }])
    renderWithQuery(
      <SdConfigItemRoutines workspaceId={WS} configItemId='ci-1' slug='acme' />,
    )
    expect(await screen.findByText('Vistoria mensal do nobreak')).toBeTruthy()
    expect(screen.getByText(/Próxima: 10\/10\/2026/)).toBeTruthy()
    expect(spy.mock.calls[0]?.[0]).toContain('configItemId=ci-1')
    expect(screen.getByRole('link', { name: 'Configurar' })).toBeTruthy()
  })

  it('explains that no routine covers the item', async () => {
    mockFetch([{ match: RULES, data: [] }])
    renderWithQuery(
      <SdConfigItemRoutines workspaceId={WS} configItemId='ci-1' slug='acme' />,
    )
    expect(
      await screen.findByText(/Nenhuma rotina preventiva incide/),
    ).toBeTruthy()
  })

  it('surfaces the error', async () => {
    mockFetch([{ match: RULES, status: 500, error: 'Falhou' }])
    renderWithQuery(
      <SdConfigItemRoutines workspaceId={WS} configItemId='ci-1' slug='acme' />,
    )
    expect(await screen.findByText('Falhou')).toBeTruthy()
  })
})
