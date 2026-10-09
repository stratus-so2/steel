import '@/src/__tests__/helpers/dom-matchers'
import { render, screen, within } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { describe, expect, it } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { COMPETITOR_COMPARISON } from '@/src/config/competitor-comparison'
import { PAID_PLAN_PRICES } from '@/src/config/plan-prices'
import { formatMoney } from '@/src/lib/pricing/comparison'
import { PricingBillingNote } from '../pricing-billing-note'
import { PricingCardPlan } from '../pricing-card-plan'
import { formatCheckedAt, PricingComparison } from '../pricing-comparison'
import { PRICING_FAQ, PricingFaq } from '../pricing-faq'
import { PRICING_GROUPS } from '../table/pricing-table-data'
import { PricingTableGroup } from '../table/pricing-table-group'

describe('<PricingComparison />', () => {
  it('renders the three approved blocks', () => {
    render(<PricingComparison />)
    for (const title of [
      'Steel vs ServiceDesk',
      'Steel vs CRM',
      'Steel vs Comunicação',
    ]) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }
    expect(
      screen.getByRole('heading', {
        name: 'Um workspace no lugar de três assinaturas',
      }),
    ).toBeInTheDocument()
  })

  it('prices Steel from plan-prices and computes the team of 10', () => {
    render(<PricingComparison />)
    const crm = screen
      .getByRole('heading', { name: 'Steel vs CRM' })
      .closest('section') as HTMLElement
    const proMonthly = Math.round(PAID_PLAN_PRICES.PRO.yearly / 12)
    const proRow = within(crm)
      .getAllByRole('row')
      .find((row) => /Steel\s*Pro/.test(row.textContent ?? '')) as HTMLElement
    expect(proRow).toHaveTextContent(
      `${formatMoney(proMonthly, 'BRL')} por usuário/mês`,
    )
    expect(proRow).toHaveTextContent(formatMoney(proMonthly * 10, 'BRL'))
    // Pipedrive Growth, verified on the official page.
    const growth = within(crm)
      .getAllByRole('row')
      .find((row) => /Pipedrive\s*Growth/.test(row.textContent ?? ''))
    expect(growth).toHaveTextContent('US$ 24 por usuário/mês')
    expect(growth).toHaveTextContent('US$ 240')
  })

  it('dates and sources every block, without rating competitors "no"', () => {
    render(<PricingComparison />)
    const consulted = `consultadas em ${formatCheckedAt(COMPETITOR_COMPARISON.checkedAt)}`
    expect(screen.getAllByText(new RegExp(consulted))).toHaveLength(3)
    const zendesk = screen.getByRole('link', { name: 'Zendesk Suite' })
    expect(zendesk).toHaveAttribute('href', 'https://www.zendesk.com/pricing/')
    expect(zendesk).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.queryByText('Não')).toBeNull()
    expect(screen.getAllByText('Não informado').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Em alguns planos').length).toBeGreaterThan(0)
    expect(screen.getAllByText('À parte').length).toBeGreaterThan(0)
  })

  it('shows a dash for flat prices that cannot be split per user', () => {
    render(<PricingComparison />)
    const zap = screen
      .getByRole('heading', { name: 'Steel vs Comunicação' })
      .closest('section') as HTMLElement
    const zenvia = within(zap)
      .getAllByRole('row')
      .find((row) => /Zenvia\s*Specialist/.test(row.textContent ?? ''))
    expect(zenvia).toHaveTextContent('R$ 600 por mês')
    expect(zenvia).toHaveTextContent('—')
  })

  it('formats the check month in Portuguese', () => {
    expect(formatCheckedAt('2026-10')).toBe('outubro de 2026')
    expect(formatCheckedAt('2027-01')).toBe('janeiro de 2027')
  })
})

describe('<PricingTableGroup />', () => {
  it('shows the seat limit per plan and checks everything else', () => {
    render(
      <TooltipProvider>
        <PricingTableGroup />
      </TooltipProvider>,
    )
    const seats = screen
      .getByText('Membros (assentos)')
      .closest('tr') as HTMLElement
    expect(within(seats).getAllByText('Até 12')).toHaveLength(2)
    expect(within(seats).getAllByText('Ilimitados')).toHaveLength(2)

    const wiki = screen
      .getByText('Wiki colaborativa')
      .closest('tr') as HTMLElement
    expect(within(wiki).getAllByText('Incluído')).toHaveLength(4)
    expect(
      within(
        screen.getByText('Cota de IA').closest('tr') as HTMLElement,
      ).getAllByText('Mensal, por workspace'),
    ).toHaveLength(4)
  })

  it('has no leftover rows from the project-management catalog', () => {
    const labels = PRICING_GROUPS.flatMap((g) => g.rows.map((r) => r.label))
    for (const word of ['Ciclos', 'Iniciativas', 'LDAP', 'Jira', 'Créditos']) {
      expect(labels.join(' ')).not.toContain(word)
    }
  })
})

describe('<PricingCardPlan /> copy', () => {
  it('lists what every plan includes', () => {
    render(
      <NuqsTestingAdapter searchParams='?billing=yearly'>
        <TooltipProvider>
          <PricingCardPlan plan='PRO' billingEnabled={false} />
        </TooltipProvider>
      </NuqsTestingAdapter>,
    )
    expect(screen.getByText('Inclui')).toBeInTheDocument()
    expect(screen.getByText('Membros ilimitados')).toBeInTheDocument()
    expect(
      screen.getByText('ServiceDesk, CRM e Comunicação'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/teste gratuito de duas semanas/)).toBeNull()
  })

  it('shows Enterprise on request', () => {
    render(
      <NuqsTestingAdapter>
        <TooltipProvider>
          <PricingCardPlan plan='ENTERPRISE' billingEnabled={true} />
        </TooltipProvider>
      </NuqsTestingAdapter>,
    )
    expect(screen.getByText('Sob consulta')).toBeInTheDocument()
    expect(screen.getByText('Falar com vendas').closest('a')).toHaveAttribute(
      'href',
      '/talk-to-sales',
    )
  })
})

describe('<PricingFaq /> and <PricingBillingNote />', () => {
  it('renders every question', () => {
    render(<PricingFaq />)
    for (const item of PRICING_FAQ) {
      expect(screen.getByText(item.question)).toBeInTheDocument()
    }
  })

  it('explains how paid plans are bought with billing on and off', () => {
    const { rerender } = render(<PricingBillingNote billingEnabled={false} />)
    expect(screen.getByText(/equipe comercial/)).toBeInTheDocument()
    rerender(<PricingBillingNote billingEnabled={true} />)
    expect(screen.getByText(/contratação online/)).toBeInTheDocument()
  })
})
