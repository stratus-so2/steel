import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fetchBody, mockFetch } from '@/src/__tests__/component-utils'
import type { ForecastRow } from '@/src/schemas/crm-forecast.schema'
import { CrmForecastBoard } from '../crm-forecast-board'

const notify = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}))
vi.mock('@/lib/notify', () => ({ notify }))

function row(overrides: Partial<ForecastRow>): ForecastRow {
  return {
    ownerId: 'u1',
    ownerName: 'Ana Souza',
    periodKey: '2026-09',
    wonAmount: 10000,
    weightedOpenAmount: 5000,
    forecastAmount: 15000,
    openCount: 2,
    wonCount: 1,
    quotaAmount: 20000,
    attainmentPct: 75,
    ...overrides,
  }
}

function forecastRoute(rows: ForecastRow[], period = 'MONTH') {
  return { match: `/crm/forecast?period=${period}`, data: { period, rows } }
}

describe('<CrmForecastBoard />', () => {
  it('shows the empty state guidance when there is no forecast data', async () => {
    mockFetch([forecastRoute([])])
    render(<CrmForecastBoard workspaceId='ws1' />)

    expect(await screen.findByText(/Sem dados de previsão/)).toBeTruthy()
  })

  it('renders won, weighted, forecast, quota and attainment per owner', async () => {
    mockFetch([
      forecastRoute([
        row({}),
        row({
          ownerId: null,
          ownerName: 'Sem responsável',
          quotaAmount: 0,
          attainmentPct: null,
        }),
      ]),
    ])
    render(<CrmForecastBoard workspaceId='ws1' />)

    const owned = within(
      (await screen.findByText('Ana Souza')).closest('tr') as HTMLElement,
    )
    expect(owned.getByText(/R\$\s?10\.000/)).toBeTruthy()
    expect(owned.getByText(/R\$\s?5\.000/)).toBeTruthy()
    expect(owned.getByText(/R\$\s?15\.000/)).toBeTruthy()
    expect(owned.getByText(/R\$\s?20\.000/)).toBeTruthy()
    expect(owned.getByText('75%')).toBeTruthy()
    // Row without quota: prompt to define it and no attainment.
    const orphan = within(
      screen.getByText('Sem responsável').closest('tr') as HTMLElement,
    )
    expect(orphan.getByText('definir')).toBeTruthy()
    expect(orphan.getByText('—')).toBeTruthy()
  })

  it('refetches with the quarter period when the tab changes', async () => {
    const fetchSpy = mockFetch([
      forecastRoute([row({})]),
      forecastRoute([row({ periodKey: '2026-Q3' })], 'QUARTER'),
    ])
    render(<CrmForecastBoard workspaceId='ws1' />)
    await screen.findByText('2026-09')

    fireEvent.click(screen.getByText('Trimestre'))

    expect(await screen.findByText('2026-Q3')).toBeTruthy()
    expect(
      fetchSpy.mock.calls.some(([u]) => String(u).includes('period=QUARTER')),
    ).toBe(true)
  })

  it('creates a quota for the owner and refreshes', async () => {
    const fetchSpy = mockFetch([
      forecastRoute([row({ quotaAmount: 0, attainmentPct: null })]),
      { method: 'POST', match: '/crm/quotas', data: { id: 'q1' } },
    ])
    render(<CrmForecastBoard workspaceId='ws1' />)

    fireEvent.click(await screen.findByText('definir'))
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '30000' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Meta atualizada.'),
    )
    expect(fetchBody(fetchSpy, '/crm/quotas')).toEqual({
      ownerId: 'u1',
      period: 'MONTH',
      periodKey: '2026-09',
      targetAmount: 30000,
    })
  })

  it('updates the existing quota when creation conflicts', async () => {
    const fetchSpy = mockFetch([
      forecastRoute([row({})]),
      { method: 'POST', match: '/crm/quotas', status: 409, error: 'Conflito' },
      {
        match: '/crm/quotas?ownerId=u1&period=MONTH',
        data: [
          { id: 'q-old', periodKey: '2026-08' },
          { id: 'q1', periodKey: '2026-09' },
        ],
      },
      { method: 'PATCH', match: '/crm/quotas/q1', data: { id: 'q1' } },
    ])
    render(<CrmForecastBoard workspaceId='ws1' />)

    fireEvent.click(await screen.findByText(/R\$\s?20\.000/))
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '25000' } })
    fireEvent.blur(input)

    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Meta atualizada.'),
    )
    expect(fetchBody(fetchSpy, '/crm/quotas/q1', 'PATCH')).toEqual({
      targetAmount: 25000,
    })
  })

  it('refuses to set a quota for a row without an owner', async () => {
    const fetchSpy = mockFetch([
      forecastRoute([
        row({ ownerId: null, ownerName: 'Sem responsável', quotaAmount: 0 }),
      ]),
    ])
    render(<CrmForecastBoard workspaceId='ws1' />)

    fireEvent.click(await screen.findByText('definir'))
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '1000' } })
    fireEvent.blur(input)

    expect(notify.error).toHaveBeenCalledWith(
      'Defina um responsável na oportunidade para criar a meta.',
    )
    expect(
      fetchSpy.mock.calls.some(([, init]) => init?.method === 'POST'),
    ).toBe(false)
  })

  it('skips saving when the quota is unchanged', async () => {
    const fetchSpy = mockFetch([forecastRoute([row({})])])
    render(<CrmForecastBoard workspaceId='ws1' />)

    fireEvent.click(await screen.findByText(/R\$\s?20\.000/))
    fireEvent.blur(screen.getByRole('spinbutton'))

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(notify.success).not.toHaveBeenCalled()
  })
})
