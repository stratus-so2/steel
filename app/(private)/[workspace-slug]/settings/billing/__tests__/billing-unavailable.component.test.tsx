import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BillingUnavailable } from '../billing-unavailable'

describe('<BillingUnavailable />', () => {
  it('explains that plans and billing are unavailable', () => {
    render(<BillingUnavailable />)

    const notice = screen.getByRole('status')
    expect(notice.textContent).toContain(
      'Planos e cobrança indisponíveis no momento',
    )
    expect(notice.textContent).toContain('fale com a Stratus Telecom')
  })

  it('points to sales instead of a checkout', () => {
    render(<BillingUnavailable />)

    const link = screen.getByText('Falar com a Stratus Telecom').closest('a')
    expect(link?.getAttribute('href')).toBe('/talk-to-sales')
    expect(document.querySelector('a[href^="/upgrade"]')).toBeNull()
  })
})
