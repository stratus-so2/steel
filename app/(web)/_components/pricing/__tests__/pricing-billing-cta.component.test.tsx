import { render, screen } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { describe, expect, it } from 'vitest'
import { PLAN_ORDER, type PlanGrid } from '../plans'
import { PricingCardPlan } from '../pricing-card-plan'
import { PricingTableHeader } from '../table/pricing-table-header'

function hrefOf(label: string) {
  return screen.getByText(label).closest('a')?.getAttribute('href')
}

function renderCard(plan: PlanGrid, billingEnabled: boolean) {
  return render(
    <NuqsTestingAdapter searchParams='?billing=monthly'>
      <PricingCardPlan plan={plan} billingEnabled={billingEnabled} />
    </NuqsTestingAdapter>,
  )
}

describe('<PricingCardPlan /> and the billing flag', () => {
  it('starts a checkout for a paid plan while billing is on', () => {
    renderCard('PRO', true)

    expect(hrefOf('Obter Pro por este preço')).toBe(
      '/upgrade?plan=PRO&billing=monthly',
    )
  })

  it('sends a paid plan to sales while billing is off', () => {
    const { container } = renderCard('BUSINESS', false)

    expect(container.textContent).not.toMatch(/Obter Business/)
    expect(container.querySelector('a[href="/talk-to-sales"]')).not.toBeNull()
    expect(container.querySelector('a[href^="/upgrade"]')).toBeNull()
  })

  it('keeps the free sign-up CTA while billing is off', () => {
    const { container } = renderCard('FREE', false)

    expect(container.querySelector('a[href="/sign-up"]')).not.toBeNull()
  })
})

describe('<PricingTableHeader /> and the billing flag', () => {
  function renderHeader(billingEnabled: boolean) {
    return render(
      <NuqsTestingAdapter searchParams='?billing=yearly'>
        <PricingTableHeader billingEnabled={billingEnabled} />
      </NuqsTestingAdapter>,
    )
  }

  it('links paid plans to the checkout while billing is on', () => {
    renderHeader(true)

    expect(hrefOf('Obtenha o Pro')).toBe('/upgrade?plan=PRO&billing=yearly')
  })

  it('links every paid plan to sales while billing is off', () => {
    const { container } = renderHeader(false)

    expect(container.textContent).not.toMatch(/Obtenha o/)
    expect(container.querySelector('a[href^="/upgrade"]')).toBeNull()
    const sales = container.querySelectorAll('a[href="/talk-to-sales"]')
    // Every tier but FREE (which keeps its sign-up CTA).
    expect(sales).toHaveLength(PLAN_ORDER.length - 1)
    expect(container.querySelectorAll('a[href="/sign-up"]')).toHaveLength(1)
  })
})
