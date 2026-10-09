import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { DailyPoint } from '@/types/status'
import { HistoryBars } from '../history-bars'
import { STATUS_REPORT_HREF, StatusPageHeader } from '../status-page-header'

function days(n: number, overrides: Partial<DailyPoint> = {}): DailyPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    day: `2026-07-${String((i % 28) + 1).padStart(2, '0')}-${i}`,
    status: 'OPERATIONAL',
    uptimePct: 100,
    ...overrides,
  }))
}

describe('<HistoryBars />', () => {
  it('says so when nothing was collected yet', () => {
    render(<HistoryBars history={[]} />)

    expect(screen.getByText('Sem dados coletados ainda.')).toBeTruthy()
    expect(screen.queryByTestId('history-bars')).toBeNull()
  })

  it("spreads one bar per day across the row, like Nexo's", () => {
    render(<HistoryBars history={days(90)} />)
    const row = screen.getByTestId('history-bars')

    expect(row.children).toHaveLength(90)
    expect(row.className).toMatch(/w-full/)
    expect(row.className).toMatch(/justify-between/)
  })

  it('lets bars shrink on narrow screens instead of overflowing', () => {
    render(<HistoryBars history={days(3)} />)
    const bar = screen.getByTestId('history-bars').children[0]

    expect(bar.className).toMatch(/flex-1/)
    expect(bar.className).toMatch(/max-w-1/)
    expect(bar.className).toMatch(/min-w-0/)
  })

  it('colours each bar by the day status', () => {
    const history: DailyPoint[] = [
      { day: '2026-07-01', status: 'OPERATIONAL', uptimePct: 100 },
      { day: '2026-07-02', status: 'MAJOR_OUTAGE', uptimePct: 80 },
      {
        day: '2026-07-03',
        status: 'DEGRADED',
        uptimePct: 99,
        incidentId: 'inc_1',
      },
    ]
    render(<HistoryBars history={history} />)
    const [ok, down, degraded] = Array.from(
      screen.getByTestId('history-bars').children,
    )

    expect(ok.className).toMatch(/bg-emerald-500/)
    expect(down.className).toMatch(/bg-red-500/)
    expect(degraded.className).toMatch(/bg-amber-500/)
    expect(degraded.className).toMatch(/cursor-pointer/)
    expect(ok.className).not.toMatch(/cursor-pointer/)
  })
})

describe('<StatusPageHeader />', () => {
  it('names the page and links "Relate um problema" to a real page', () => {
    const { container } = render(<StatusPageHeader />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Status do Steel' }),
    ).toBeTruthy()
    expect(
      screen
        .getByRole('link', { name: 'Relate um problema' })
        .getAttribute('href'),
    ).toBe(STATUS_REPORT_HREF)
    expect(container.querySelector('a[href="#"]')).toBeNull()
    // The site header carries the logo; this row must not repeat it.
    expect(container.querySelector('img')).toBeNull()
  })
})
