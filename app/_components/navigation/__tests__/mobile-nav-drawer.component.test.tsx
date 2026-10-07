import { Home01Icon, Ticket01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MobileNavProvider } from '../mobile-nav/mobile-nav-context'
import { MobileNavDrawer } from '../mobile-nav/mobile-nav-drawer'
import {
  ContextHeader,
  ContextSidebar,
  NavGroup,
  NavItem,
} from '../sidebar-context'
import { GlobalSidebarNavigation } from '../sidebar-global'

const nav = vi.hoisted(() => ({ pathname: '/acme/servicedesk/tickets' }))

vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

function Shell({ withContext = true }: { withContext?: boolean }) {
  return (
    <MobileNavProvider>
      <MobileNavDrawer slug='acme' />
      {withContext && (
        <ContextSidebar>
          <ContextHeader title='ServiceDesk' />
          <NavGroup>
            <NavItem href='/acme/servicedesk' icon={Home01Icon}>
              Início
            </NavItem>
            <NavItem href='/acme/servicedesk/tickets' icon={Ticket01Icon}>
              Todos os chamados
            </NavItem>
          </NavGroup>
        </ContextSidebar>
      )}
    </MobileNavProvider>
  )
}

function openDrawer() {
  fireEvent.click(
    screen.getByRole('button', { name: 'Abrir menu de navegação' }),
  )
  return screen.findByRole('dialog')
}

describe('MobileNavDrawer', () => {
  beforeEach(() => {
    nav.pathname = '/acme/servicedesk/tickets'
  })

  it('stays closed until the menu button is pressed', () => {
    render(<Shell />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens with the global modules and the module context navigation', async () => {
    render(<Shell />)
    const dialog = await openDrawer()

    for (const label of [
      'ServiceDesk',
      'CRM',
      'Comunicação',
      'Steel AI',
      'Ajustes',
    ]) {
      expect(
        dialog.querySelector(`a[href="/acme/${hrefOf(label)}"]`)?.textContent,
      ).toContain(label)
    }
    // Active module is marked for assistive tech.
    expect(
      dialog.querySelector('a[href="/acme/servicedesk"][aria-current="page"]')
        ?.textContent,
    ).toContain('ServiceDesk')
    // Context items from the module's ContextSidebar are portaled in.
    expect(
      dialog.querySelector('a[href="/acme/servicedesk/tickets"]')?.textContent,
    ).toContain('Todos os chamados')
    expect(dialog.textContent).toContain('Início')
  })

  it('works without a module context sidebar', async () => {
    nav.pathname = '/acme/inbox'
    render(<Shell withContext={false} />)
    const dialog = await openDrawer()
    expect(dialog.querySelector('a[href="/acme/crm"]')).toBeTruthy()
    expect(dialog.querySelector('[aria-current="page"]')).toBeNull()
  })

  it('closes when a link inside it is clicked', async () => {
    render(<Shell />)
    const dialog = await openDrawer()
    const link = dialog.querySelector('a[href="/acme/servicedesk/tickets"]')
    if (!link) throw new Error('context link missing')
    // jsdom cannot navigate; the app router would handle the real one.
    link.addEventListener('click', (e) => e.preventDefault())
    // Same-route click: pathname does not change, the click itself closes it.
    fireEvent.click(link)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('closes when the route changes', async () => {
    const { rerender } = render(<Shell />)
    await openDrawer()
    nav.pathname = '/acme/crm/leads'
    rerender(<Shell />)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('closes from its own close button', async () => {
    render(<Shell />)
    await openDrawer()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar menu' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})

describe('GlobalSidebarNavigation', () => {
  it('names every icon link and marks the active module', () => {
    nav.pathname = '/acme/crm/leads'
    render(<GlobalSidebarNavigation slug='acme' />)
    const crm = screen.getByRole('link', { name: 'CRM' })
    expect(crm.getAttribute('aria-current')).toBe('page')
    expect(
      screen
        .getByRole('link', { name: 'ServiceDesk' })
        .getAttribute('aria-current'),
    ).toBeNull()
  })
})

describe('ContextSidebar', () => {
  it('renders the rail without the mobile provider and never shrinks', () => {
    render(
      <ContextSidebar>
        <span>Item</span>
      </ContextSidebar>,
    )
    const aside = screen.getByText('Item').closest('aside')
    expect(aside?.className).toContain('shrink-0')
    expect(aside?.getAttribute('data-slot')).toBe('context-sidebar')
  })
})

function hrefOf(label: string) {
  return (
    {
      ServiceDesk: 'servicedesk',
      CRM: 'crm',
      Comunicação: 'zap',
      'Steel AI': 'ai',
      Ajustes: 'settings',
    } as Record<string, string>
  )[label]
}
