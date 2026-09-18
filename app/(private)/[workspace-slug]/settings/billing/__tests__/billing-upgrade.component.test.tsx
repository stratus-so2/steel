import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { describe, expect, it } from 'vitest'
import {
  formatCurrency,
  getPrice,
  priceForBilling,
} from '@/app/(web)/_components/pricing/plans'
import { BillingUpgrade } from '../billing-upgrade'

function renderUpgrade(currentPlan: string, searchParams = '') {
  return render(
    <NuqsTestingAdapter searchParams={searchParams} hasMemory>
      <BillingUpgrade currentPlan={currentPlan} />
    </NuqsTestingAdapter>,
  )
}

// The CTA links are rendered through Base UI's `Button render`, which gives
// them `role=button`; resolve the anchor from its label instead.
function hrefOf(label: string) {
  return screen.getByText(label).closest('a')?.getAttribute('href')
}

// `Intl` currency output uses a non-breaking space; Testing Library
// normalizes the DOM text but not the matcher.
function money(cents: number) {
  return formatCurrency(cents).replace(/\s+/g, ' ')
}

describe('<BillingUpgrade />', () => {
  it('marks the current plan and offers upgrades for the others', () => {
    renderUpgrade('PRO')

    const current = screen.getByRole('button', { name: 'Plano atual' })
    expect((current as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByText('Atualizar para Pro')).toBeNull()
    expect(hrefOf('Atualizar para Business')).toBe(
      '/upgrade?plan=BUSINESS&billing=yearly',
    )
    expect(hrefOf('Falar com vendas')).toBe('/talk-to-sales')
  })

  it('offers every paid tier to a FREE workspace', () => {
    renderUpgrade('FREE')

    expect(screen.queryByRole('button', { name: 'Plano atual' })).toBeNull()
    expect(hrefOf('Atualizar para Pro')).toBe(
      '/upgrade?plan=PRO&billing=yearly',
    )
    expect(screen.getByText('Cotação a pedido')).toBeTruthy()
  })

  it('reads the billing cadence from the URL', () => {
    renderUpgrade('FREE', '?billing=monthly')

    expect(hrefOf('Atualizar para Pro')).toBe(
      '/upgrade?plan=PRO&billing=monthly',
    )
    const pro = getPrice('PRO')
    if (!pro) throw new Error('PRO must have a public price')
    expect(
      screen.getByText(money(priceForBilling(pro, 'monthly'))),
    ).toBeTruthy()
  })

  it('switches between yearly and monthly pricing via the toggle', async () => {
    renderUpgrade('FREE')
    const pro = getPrice('PRO')
    if (!pro) throw new Error('PRO must have a public price')

    expect(screen.getByText(money(priceForBilling(pro, 'yearly')))).toBeTruthy()

    fireEvent.click(screen.getByRole('switch'))

    await waitFor(() =>
      expect(hrefOf('Atualizar para Pro')).toBe(
        '/upgrade?plan=PRO&billing=monthly',
      ),
    )
    expect(
      screen.getByText(money(priceForBilling(pro, 'monthly'))),
    ).toBeTruthy()
  })
})
