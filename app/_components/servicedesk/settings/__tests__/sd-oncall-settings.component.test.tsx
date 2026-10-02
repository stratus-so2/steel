import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import type { SdConfigBootstrapDTO } from '@/types/sd-config'
import type {
  SdOnCallNowDTO,
  SdOnCallOverrideDTO,
  SdOnCallScheduleDTO,
  SdOnCallTimelineDTO,
} from '@/types/sd-oncall'
import {
  formatSdOnCallRange,
  SD_ONCALL_ROTATION_OPTIONS,
  SD_TIMEZONE_OPTIONS,
  SdOnCallTab,
  sdOnCallSegmentColor,
  toLocalInputValue,
} from '../oncall-tab'
import { SdSettingsProvider } from '../sd-settings-kit'
import { SD_SETTINGS_TABS } from '../settings-tabs'

const WS = 'ws-1'
const SD_URL = `/api/workspaces/${WS}/servicedesk`
const ONCALL = `${SD_URL}/oncall`

const config = {
  departments: [
    { id: 'dep-1', name: 'Suporte N1', children: [] },
    { id: 'dep-2', name: 'Infra', children: [{ id: 'dep-3', name: 'Redes' }] },
  ],
} as unknown as SdConfigBootstrapDTO

const user = (id: string, name: string) => ({
  id,
  name,
  email: `${id}@steel.test`,
  image: null,
})

function schedule(
  overrides: Partial<SdOnCallScheduleDTO> = {},
): SdOnCallScheduleDTO {
  return {
    id: 'sch-1',
    name: 'Plantão de redes',
    department: { id: 'dep-1', name: 'Suporte N1' },
    timezone: 'America/Sao_Paulo',
    rotation: 'WEEKLY',
    rotationStart: '2026-10-05T12:00:00.000Z',
    handoffTime: '09:00',
    calendar: null,
    active: true,
    layers: [
      {
        id: 'layer-1',
        name: 'Primeira chamada',
        level: 1,
        participants: [
          { id: 'part-1', position: 0, user: user('u1', 'Ana Primeira') },
          { id: 'part-2', position: 1, user: user('u2', 'Bruno Segundo') },
        ],
      },
    ],
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  }
}

function override(
  overrides: Partial<SdOnCallOverrideDTO> = {},
): SdOnCallOverrideDTO {
  return {
    id: 'ov-1',
    scheduleId: 'sch-1',
    scheduleName: 'Plantão de redes',
    layerId: 'layer-1',
    user: user('u3', 'Carla Cobertura'),
    startsAt: '2026-10-07T00:00:00.000Z',
    endsAt: '2026-10-08T00:00:00.000Z',
    reason: 'Consulta médica',
    createdAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  }
}

const timeline: SdOnCallTimelineDTO = {
  scheduleId: 'sch-1',
  scheduleName: 'Plantão de redes',
  timezone: 'America/Sao_Paulo',
  from: '2026-10-06T00:00:00.000Z',
  to: '2026-10-20T00:00:00.000Z',
  layers: [
    {
      layerId: 'layer-1',
      layerName: 'Primeira chamada',
      level: 1,
      segments: [
        {
          start: '2026-10-06T00:00:00.000Z',
          end: '2026-10-12T12:00:00.000Z',
          userId: 'u1',
          user: user('u1', 'Ana Primeira'),
          source: 'rotation',
          overrideId: null,
        },
        {
          start: '2026-10-12T12:00:00.000Z',
          end: '2026-10-20T00:00:00.000Z',
          userId: 'u3',
          user: user('u3', 'Carla Cobertura'),
          source: 'override',
          overrideId: 'ov-1',
        },
      ],
    },
  ],
}

const now: SdOnCallNowDTO = {
  scheduleId: 'sch-1',
  scheduleName: 'Plantão de redes',
  department: { id: 'dep-1', name: 'Suporte N1' },
  timezone: 'America/Sao_Paulo',
  at: '2026-10-06T00:00:00.000Z',
  offHours: true,
  applies: true,
  layers: [
    {
      layerId: 'layer-1',
      layerName: 'Primeira chamada',
      level: 1,
      userId: 'u1',
      user: user('u1', 'Ana Primeira'),
      source: 'rotation',
      overrideId: null,
      periodStart: '2026-10-05T12:00:00.000Z',
      periodEnd: '2026-10-12T12:00:00.000Z',
    },
  ],
}

/** Rotas de leitura que a aba sempre pede. */
function reads(schedules: SdOnCallScheduleDTO[]) {
  return [
    { match: `${ONCALL}/sch-1/timeline`, data: timeline },
    { match: `${ONCALL}/overrides`, data: [override()] },
    { match: `${ONCALL}/now`, data: [now] },
    {
      match: `${SD_URL}/agents`,
      data: [
        user('u1', 'Ana Primeira'),
        user('u2', 'Bruno Segundo'),
        user('u3', 'Carla Cobertura'),
      ],
    },
    {
      match: `${SD_URL}/calendars`,
      data: [{ id: 'cal-1', name: 'Comercial' }],
    },
    { match: ONCALL, data: schedules },
  ]
}

function renderTab(canEdit = true, schedules = [schedule()]) {
  const spy = mockFetch(reads(schedules))
  return {
    spy,
    ...renderWithQuery(
      <SdSettingsProvider value={{ workspaceId: WS, canEdit, config }}>
        <SdOnCallTab />
      </SdSettingsProvider>,
    ),
  }
}

describe('SD_SETTINGS_TABS', () => {
  it('registers the on-call tab after the escalation one', () => {
    const ids = SD_SETTINGS_TABS.map((tab) => tab.id)
    expect(ids).toContain('oncall')
    expect(ids.indexOf('oncall')).toBeGreaterThan(ids.indexOf('escalation'))
    const tab = SD_SETTINGS_TABS.find((item) => item.id === 'oncall')
    expect(tab?.label).toBe('Plantão')
    expect(tab?.component).toBe(SdOnCallTab)
    expect(tab?.personal).toBeUndefined()
  })

  it('labels the rotations and the timezones in pt-BR', () => {
    expect(SD_ONCALL_ROTATION_OPTIONS.map((o) => o.value)).toEqual([
      'DAILY',
      'WEEKLY',
      'BIWEEKLY',
    ])
    expect(SD_ONCALL_ROTATION_OPTIONS[1].label).toMatch(/Semanal/)
    expect(SD_TIMEZONE_OPTIONS[0].value).toBe('America/Sao_Paulo')
  })
})

describe('helpers da aba', () => {
  it('formats a period in pt-BR', () => {
    expect(
      formatSdOnCallRange(
        '2026-10-06T12:00:00.000Z',
        '2026-10-07T12:00:00.000Z',
      ),
    ).toMatch(/→/)
  })

  it('builds the value of a datetime-local input', () => {
    expect(toLocalInputValue(new Date(2026, 9, 5, 9, 30))).toBe(
      '2026-10-05T09:30',
    )
    expect(toLocalInputValue('2026-10-05T12:00:00.000Z')).toMatch(
      /^2026-10-05T\d{2}:\d{2}$/,
    )
  })

  it('keeps one stable colour per person and greys out the gaps', () => {
    expect(sdOnCallSegmentColor('u1')).toBe(sdOnCallSegmentColor('u1'))
    expect(sdOnCallSegmentColor(null)).toMatch(/bg-muted/)
  })
})

describe('<SdOnCallTab />', () => {
  it('invites the admin to create the first schedule', async () => {
    renderTab(true, [])
    expect(await screen.findByText(/Nenhuma escala de plantão/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Nova escala/ })).toBeTruthy()
  })

  it('shows the schedule, the rotation order and who is on call now', async () => {
    renderTab()
    expect(await screen.findByText('Plantão de redes')).toBeTruthy()
    expect(screen.getByText(/Semanal · 09:00/)).toBeTruthy()
    expect(screen.getByText('Suporte N1')).toBeTruthy()
    expect(screen.getByText(/vale 24 h/)).toBeTruthy()
    expect(await screen.findByText(/De plantão: Ana Primeira/)).toBeTruthy()

    expect(
      (await screen.findAllByText('Primeira chamada')).length,
    ).toBeGreaterThan(0)
    expect(screen.getByText('1º')).toBeTruthy()
    expect(screen.getAllByText('Ana Primeira').length).toBeGreaterThan(0)
    expect(screen.getByText('2º')).toBeTruthy()
    expect(screen.getByText('Bruno Segundo')).toBeTruthy()
  })

  it('hides every write for a non-admin', async () => {
    renderTab(false)
    expect(await screen.findByText('Plantão de redes')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Nova escala/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Nova camada/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Registrar troca/ })).toBeNull()
    expect(screen.queryByText('Adicionar ao rodízio')).toBeNull()
  })

  it('creates a schedule with the rotation defaults', async () => {
    const { spy } = renderTab(true, [])
    fireEvent.click(await screen.findByRole('button', { name: /Nova escala/ }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(dialog.querySelector('input') as HTMLInputElement, {
      target: { value: 'Plantão NOC' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(fetchBody(spy, ONCALL)).toBeTruthy())
    const body = fetchBody(spy, ONCALL)
    expect(body.name).toBe('Plantão NOC')
    expect(body.rotation).toBe('WEEKLY')
    expect(body.handoffTime).toBe('09:00')
    expect(body.timezone).toBe('America/Sao_Paulo')
    expect(body.active).toBe(true)
  })

  it('refuses to save a schedule without a name', async () => {
    const { spy } = renderTab(true, [])
    fireEvent.click(await screen.findByRole('button', { name: /Nova escala/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(fetchBody(spy, ONCALL)).toBeUndefined()
  })

  it('adds a participant to the end of the rotation', async () => {
    const { spy } = renderTab()
    expect(
      (await screen.findAllByText('Primeira chamada')).length,
    ).toBeGreaterThan(0)
    fireEvent.click(await screen.findByText('Escolha um agente'))
    fireEvent.click(
      await screen.findByRole('option', { name: 'Carla Cobertura' }),
    )

    await waitFor(() =>
      expect(
        fetchBody(spy, `${ONCALL}/sch-1/layers/layer-1/participants`, 'PUT'),
      ).toBeTruthy(),
    )
    expect(
      fetchBody(spy, `${ONCALL}/sch-1/layers/layer-1/participants`, 'PUT'),
    ).toEqual({ userIds: ['u1', 'u2', 'u3'] })
  })

  it('removes a participant from the rotation', async () => {
    const { spy } = renderTab()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Remover Ana Primeira' }),
    )
    await waitFor(() =>
      expect(
        fetchBody(spy, `${ONCALL}/sch-1/layers/layer-1/participants`, 'PUT'),
      ).toEqual({ userIds: ['u2'] }),
    )
  })

  it('creates the next layer with the following level', async () => {
    const { spy } = renderTab()
    fireEvent.click(await screen.findByRole('button', { name: /Nova camada/ }))
    expect(await screen.findByText('Nova camada (nível 2)')).toBeTruthy()
    const dialog = screen.getByRole('dialog')
    fireEvent.change(dialog.querySelector('input') as HTMLInputElement, {
      target: { value: 'Retaguarda' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Criar camada' }))
    await waitFor(() =>
      expect(fetchBody(spy, `${ONCALL}/sch-1/layers`)).toEqual({
        name: 'Retaguarda',
        level: 2,
      }),
    )
  })

  it('warns that a layer without anybody falls back to the rule', async () => {
    renderTab(true, [
      schedule({
        layers: [
          {
            id: 'layer-1',
            name: 'Primeira chamada',
            level: 1,
            participants: [],
          },
        ],
      }),
    ])
    expect(
      await screen.findByText(/o escalonamento cai no destino normal/),
    ).toBeTruthy()
  })

  it('tells the admin that a schedule without layers calls nobody', async () => {
    renderTab(true, [schedule({ layers: [] })])
    expect(await screen.findByText(/a escala não chama ninguém/)).toBeTruthy()
  })

  it('lists the swaps and registers a new one', async () => {
    const { spy } = renderTab()
    expect(
      (await screen.findAllByText('Carla Cobertura')).length,
    ).toBeGreaterThan(0)
    expect(screen.getByText(/Consulta médica/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Registrar troca/ }))
    fireEvent.click(await screen.findByText('Selecione'))
    const option = await screen.findByRole('option', { name: 'Bruno Segundo' })
    fireEvent.pointerDown(option)
    fireEvent.pointerUp(option)
    fireEvent.click(option)
    await waitFor(() =>
      expect(
        screen.queryByRole('option', { name: 'Bruno Segundo' }),
      ).toBeNull(),
    )
    fireEvent.click(screen.getByRole('button', { name: /Registrar$/ }))

    await waitFor(() =>
      expect(fetchBody(spy, `${ONCALL}/overrides`)).toBeTruthy(),
    )
    const body = fetchBody(spy, `${ONCALL}/overrides`)
    expect(body.userId).toBe('u2')
    expect(body.scheduleId).toBe('sch-1')
    expect(body.layerId).toBe('layer-1')
    expect(new Date(body.endsAt).getTime()).toBeGreaterThan(
      new Date(body.startsAt).getTime(),
    )
  })

  it('refuses a swap without anybody covering', async () => {
    const { spy } = renderTab()
    fireEvent.click(
      await screen.findByRole('button', { name: /Registrar troca/ }),
    )
    fireEvent.click(screen.getByRole('button', { name: /Registrar$/ }))
    expect(fetchBody(spy, `${ONCALL}/overrides`)).toBeUndefined()
  })

  it('draws the next two weeks with the swap marked', async () => {
    renderTab()
    expect(await screen.findByText(/Camada 1 · Primeira chamada/)).toBeTruthy()
    expect((await screen.findAllByText(/\(troca\)/)).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Ana').length).toBeGreaterThan(0)
  })

  it('says the schedule only applies outside the business calendar', async () => {
    renderTab(true, [
      schedule({ calendar: { id: 'cal-1', name: 'Comercial' } }),
    ])
    expect(
      await screen.findByText(/fora do expediente de Comercial/),
    ).toBeTruthy()
  })

  it('surfaces the error of the schedules query', async () => {
    mockFetch([
      { match: `${ONCALL}/now`, data: [] },
      { match: ONCALL, status: 403, error: 'Só agentes' },
    ])
    renderWithQuery(
      <SdSettingsProvider value={{ workspaceId: WS, canEdit: true, config }}>
        <SdOnCallTab />
      </SdSettingsProvider>,
    )
    expect(await screen.findByText(/Nenhuma escala de plantão/)).toBeTruthy()
  })
})
