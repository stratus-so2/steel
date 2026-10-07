import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { mockFetch } from '@/src/__tests__/component-utils'
import { SteelAiTopBar } from '../steel-ai-top-bar'
import { conversation, renderSteelAi } from './steel-ai-test-utils'

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

  it('opens the mobile sheet with new chat, agents and the history', async () => {
    mockFetch([
      {
        match: /\/ai\/conversations(\?|$)/,
        data: [conversation({ id: 'c1', title: 'Pipeline do trimestre' })],
      },
    ])
    renderSteelAi(<SteelAiTopBar />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Histórico de conversas' }),
    )
    const sheet = await screen.findByRole('dialog')
    expect(
      within(sheet)
        .getByRole('button', { name: /Novo chat/ })
        .getAttribute('href'),
    ).toBe('/acme/ai')
    expect(
      within(sheet)
        .getByRole('link', { name: /Agentes/ })
        .getAttribute('href'),
    ).toBe('/acme/ai/agents')
    expect(await within(sheet).findByText('Pipeline do trimestre')).toBeTruthy()

    fireEvent.click(within(sheet).getByRole('link', { name: /Agentes/ }))
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
