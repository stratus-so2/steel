import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const usePathname = vi.fn(() => '/about')
vi.mock('next/navigation', () => ({ usePathname: () => usePathname() }))

import { WebHeaderBar } from '../header/web-header-bar'
import { webNav } from '../header/web-header-nav-data'

const LATEST = { title: 'Steel AI', slug: '2026-10-06-steel-ai', date: '6 out' }

function renderBar(pathname = '/about') {
  usePathname.mockReturnValue(pathname)
  return render(<WebHeaderBar latest={LATEST} />)
}

function desktopNav() {
  return screen.getByRole('navigation', { name: 'Principal' })
}

describe('<WebHeaderBar />', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn()
  })

  it('shows only the essential items: Produto, Preços, Docs, Changelog', () => {
    renderBar()
    const nav = desktopNav()

    expect(within(nav).getByRole('button', { name: /Produto/ })).toBeTruthy()
    const links = within(nav)
      .getAllByRole('link')
      .map((a) => [a.textContent, a.getAttribute('href')])
    expect(links).toEqual([
      ['Preços', '/pricing'],
      ['Docs', '/docs'],
      ['Changelog', '/changelog'],
    ])
  })

  it('has the sign-in link and a single primary call to action', () => {
    const { container } = renderBar()

    expect(
      screen.getByRole('link', { name: 'Entrar' }).getAttribute('href'),
    ).toBe('/sign-in')
    expect(
      screen
        .getByRole('link', { name: 'Fale com vendas' })
        .getAttribute('href'),
    ).toBe('/talk-to-sales')
    // Leftovers from the Nexo bootstrap are gone.
    expect(container.textContent).not.toMatch(/Soluções|Recursos|Comece grátis/)
  })

  it('never links to "#"', () => {
    const { container } = renderBar()

    expect(container.querySelector('a[href="#"]')).toBeNull()
    for (const item of [...webNav.product, ...webNav.features]) {
      expect(item.href.startsWith('/')).toBe(true)
    }
  })

  it('marks the current page as active', () => {
    renderBar('/changelog/2026-10-06-steel-ai')
    const nav = desktopNav()

    expect(
      within(nav)
        .getByRole('link', { name: 'Changelog' })
        .getAttribute('aria-current'),
    ).toBe('page')
    expect(
      within(nav)
        .getByRole('link', { name: 'Preços' })
        .hasAttribute('aria-current'),
    ).toBe(false)
  })

  it('marks Produto active on a module page', () => {
    renderBar('/product/crm')

    expect(
      within(desktopNav())
        .getByRole('button', { name: /Produto/ })
        .hasAttribute('data-active'),
    ).toBe(true)
  })

  it('narrows into the floating bar once the page scrolls', () => {
    const { container } = renderBar()
    const header = container.querySelector('header') as HTMLElement
    expect(header.dataset.scrolled).toBe('false')

    Object.defineProperty(window, 'scrollY', { value: 120, configurable: true })
    fireEvent.scroll(window)

    expect(header.dataset.scrolled).toBe('true')
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
  })
})

describe('mobile menu', () => {
  it('opens with the modules, the main links, sign-in and the CTA', async () => {
    renderBar('/pricing')

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu' }))
    const dialog = await screen.findByRole('dialog')

    for (const item of webNav.product) {
      expect(
        within(dialog).getByRole('link', { name: new RegExp(item.label) }),
      ).toBeTruthy()
    }
    for (const link of webNav.main) {
      expect(
        within(dialog)
          .getByRole('link', { name: link.label })
          .getAttribute('href'),
      ).toBe(link.href)
    }
    expect(within(dialog).getByRole('link', { name: 'Entrar' })).toBeTruthy()
    expect(
      within(dialog).getByRole('link', { name: 'Fale com vendas' }),
    ).toBeTruthy()
    expect(
      within(dialog)
        .getByRole('link', { name: 'Preços' })
        .getAttribute('aria-current'),
    ).toBe('page')
  })

  it('closes when a link is clicked', async () => {
    renderBar()

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('link', { name: 'Docs' }))

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('closes from its close button', async () => {
    renderBar()

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu' }))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Fechar menu' }))

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
