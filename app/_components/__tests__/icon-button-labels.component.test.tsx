import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { mockFetch } from '@/src/__tests__/component-utils'
import { ProposalMetricsDrawer } from '../crm/proposal/proposal-metrics-drawer'
import { OnboardingBackButton } from '../header/onboarding/header-onboarding-back-button'
import { UserDropdownHelper } from '../user/user-dropdown-helper'

vi.mock('next/navigation', () => ({
  usePathname: () => '/onboarding/role-setup',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('@/app/onboarding/actions', () => ({ goBackOnboarding: vi.fn() }))

// Botões só com ícone precisam de nome acessível (pt-BR) para leitores de tela.
describe('icon-only buttons have accessible labels', () => {
  it('onboarding back button', () => {
    render(<OnboardingBackButton />)
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeTruthy()
  })

  it('help dropdown trigger', () => {
    render(<UserDropdownHelper />)
    expect(screen.getByRole('button', { name: 'Ajuda' })).toBeTruthy()
  })

  it('proposal metrics drawer close button', async () => {
    mockFetch([{ match: '/metrics', data: null }])
    render(
      <ProposalMetricsDrawer
        workspaceId='ws1'
        proposalId='pr1'
        open
        onOpenChange={vi.fn()}
      />,
    )
    expect(await screen.findByRole('button', { name: 'Fechar' })).toBeTruthy()
  })
})
