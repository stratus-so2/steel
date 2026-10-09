import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GlobalSidebarNavigation } from '@/app/_components/navigation/sidebar-global'
import { globalNavItems } from '@/app/_components/navigation/sidebar-global/navigation-global-items'
import { availableCommands } from '@/app/_components/shortcuts/workspace-commands'

const nav = vi.hoisted(() => ({ pathname: '/acme/whiteboard/b1' }))

vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

function railLabels(container: HTMLElement) {
  return within(container)
    .getAllByRole('link')
    .map((link) => link.getAttribute('aria-label') ?? link.textContent)
}

describe('Quadro-branco rail entry', () => {
  it('sits right below the Wiki and is active on a board', () => {
    const { container } = render(
      <GlobalSidebarNavigation slug='acme' wikiEnabled whiteboardEnabled />,
    )

    const link = screen.getByRole('link', { name: 'Quadro-branco' })
    expect(link.getAttribute('href')).toBe('/acme/whiteboard')
    expect(link.getAttribute('aria-current')).toBe('page')

    const labels = railLabels(container)
    expect(labels.indexOf('Quadro-branco')).toBe(labels.indexOf('Wiki') + 1)
  })

  it('is hidden while the workspace switch is off', () => {
    render(<GlobalSidebarNavigation slug='acme' wikiEnabled />)
    expect(screen.queryByRole('link', { name: 'Quadro-branco' })).toBeNull()
  })

  it('opens the tools group (divider) when the Wiki is off', () => {
    const items = globalNavItems('acme', { whiteboardEnabled: true })
    const board = items.find((item) => item.label === 'Quadro-branco')
    const ai = items.find((item) => item.label === 'Steel AI')

    expect(board).toMatchObject({ separated: true, shortcut: 'nav.whiteboard' })
    expect(ai?.separated).toBe(false)
    expect(
      globalNavItems('acme', {
        wikiEnabled: true,
        whiteboardEnabled: true,
      }).find((item) => item.label === 'Quadro-branco')?.separated,
    ).toBe(false)
  })

  it('offers "Ir para o Quadro-branco" in Ctrl+K only while on', () => {
    const ids = (on: boolean) =>
      availableCommands('acme', [], false, on).map((command) => command.id)

    expect(ids(true)).toContain('nav.whiteboard')
    expect(ids(false)).not.toContain('nav.whiteboard')
  })
})
