import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { mockFetch } from '@/src/__tests__/component-utils'
import { SteelAiTopBar } from '../steel-ai-top-bar'
import { renderSteelAi } from './steel-ai-test-utils'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/acme/ai/c1',
}))

describe('<SteelAiTopBar />', () => {
  it('shows the title and renders the actions', () => {
    mockFetch([])
    renderSteelAi(
      <SteelAiTopBar
        title='Pipeline do trimestre'
        actions={<button type='button'>Executar agora</button>}
      />,
    )
    expect(screen.getByText('Pipeline do trimestre')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Executar agora' })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Novo chat' }).getAttribute('href'),
    ).toBe('/acme/ai')
  })

  it('leaves the history to the app drawer (no own menu button)', () => {
    mockFetch([])
    renderSteelAi(<SteelAiTopBar />)
    expect(
      screen.queryByRole('button', { name: 'Histórico de conversas' }),
    ).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
