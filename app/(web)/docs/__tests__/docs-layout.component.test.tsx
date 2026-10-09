import '@/src/__tests__/helpers/dom-matchers'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DocsSearchable } from '@/src/lib/docs/search'
import { DocsMobileNav } from '../_components/docs-mobile-nav'
import { DocsPager } from '../_components/docs-pager'
import { DocsSearch } from '../_components/docs-search'
import { DocsSidebar } from '../_components/docs-sidebar'
import { DocsToc } from '../_components/docs-toc'

const push = vi.fn()
const pathname = { value: '/docs/crm/leads' }

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => pathname.value,
}))

afterEach(() => {
  push.mockClear()
  pathname.value = '/docs/crm/leads'
})

const NAV = [
  {
    slug: 'crm',
    label: 'CRM',
    pages: [
      { href: '/docs/crm', title: 'Visão geral do CRM' },
      { href: '/docs/crm/leads', title: 'Leads' },
    ],
  },
  {
    slug: 'faq',
    label: 'Perguntas frequentes',
    pages: [{ href: '/docs/faq', title: 'Perguntas frequentes' }],
  },
]

const INDEX: DocsSearchable[] = [
  {
    href: '/docs/crm/leads',
    title: 'Leads',
    description: 'As etapas do funil de leads.',
    section: 'CRM',
    headings: [{ id: 'pontuacao', text: 'Pontuação e roteamento' }],
  },
  {
    href: '/docs/comunicacao/conexoes',
    title: 'Conexões',
    description: 'Meta e Z-API.',
    section: 'Comunicação',
    headings: [{ id: 'z-api', text: 'Z-API' }],
  },
]

describe('<DocsSidebar />', () => {
  it('lists every section and marks the current page', () => {
    render(<DocsSidebar nav={NAV} />)

    expect(screen.getByText('CRM')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Leads' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(
      screen.getByRole('link', { name: 'Visão geral do CRM' }),
    ).not.toHaveAttribute('aria-current')
    expect(
      screen.getByRole('link', { name: 'Visão geral do manual' }),
    ).toHaveAttribute('href', '/docs')
  })

  it('takes a custom home link (the developer site)', () => {
    pathname.value = '/dev'
    render(
      <DocsSidebar nav={NAV} home={{ href: '/dev', label: 'Visão geral' }} />,
    )
    expect(screen.getByRole('link', { name: 'Visão geral' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})

describe('<DocsSearch />', () => {
  it('filters titles and headings while typing, ignoring accents', () => {
    render(<DocsSearch index={INDEX} />)
    const input = screen.getByRole('combobox', {
      name: 'Buscar na documentação',
    })

    fireEvent.change(input, { target: { value: 'pontuacao' } })

    const results = screen.getByRole('list', { name: 'Resultados da busca' })
    const link = within(results).getByRole('link')
    expect(link).toHaveAttribute('href', '/docs/crm/leads#pontuacao')
    expect(link).toHaveTextContent('Pontuação e roteamento')
    expect(input).toHaveAttribute('aria-expanded', 'true')
  })

  it('says when nothing matches and clears on Escape', () => {
    render(<DocsSearch index={INDEX} />)
    const input = screen.getByRole('combobox')

    fireEvent.change(input, { target: { value: 'boleto' } })
    expect(screen.getByText(/Nada encontrado para/)).toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input).toHaveValue('')
    expect(screen.queryByText(/Nada encontrado/)).not.toBeInTheDocument()
  })

  it('moves with the arrows and opens the active result with Enter', () => {
    const onNavigate = vi.fn()
    render(<DocsSearch index={INDEX} onNavigate={onNavigate} />)
    const input = screen.getByRole('combobox')

    fireEvent.change(input, { target: { value: 'e' } })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(push).toHaveBeenCalledTimes(1)
    expect(onNavigate).toHaveBeenCalled()
    expect(input).toHaveValue('')
  })

  it('ignores navigation keys without results and closes after a click', () => {
    render(<DocsSearch index={INDEX} />)
    const input = screen.getByRole('combobox')

    fireEvent.change(input, { target: { value: 'xyz' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(push).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: 'conexoes' } })
    fireEvent.mouseEnter(screen.getByRole('link', { name: /Conexões/ }))
    fireEvent.click(screen.getByRole('link', { name: /Conexões/ }))
    expect(input).toHaveValue('')
  })
})

describe('<DocsToc />', () => {
  it('links to each heading, nesting level 3', () => {
    render(
      <DocsToc
        headings={[
          { level: 2, id: 'etapas', text: 'Etapas' },
          { level: 3, id: 'perder', text: 'Perder e reabrir' },
        ]}
      />,
    )
    const nav = screen.getByRole('navigation', { name: 'Nesta página' })
    expect(within(nav).getByRole('link', { name: 'Etapas' })).toHaveAttribute(
      'href',
      '#etapas',
    )
    expect(
      within(nav).getByRole('link', { name: 'Perder e reabrir' }).parentElement,
    ).toHaveClass('pl-3')
  })

  it('renders nothing without headings', () => {
    const { container } = render(<DocsToc headings={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('<DocsPager />', () => {
  it('links to the previous and next pages', () => {
    render(
      <DocsPager
        prev={{ href: '/docs/crm', title: 'Visão geral do CRM' }}
        next={{ href: '/docs/faq', title: 'Perguntas frequentes' }}
      />,
    )
    expect(screen.getByRole('link', { name: /Anterior/ })).toHaveAttribute(
      'href',
      '/docs/crm',
    )
    expect(screen.getByRole('link', { name: /Próxima/ })).toHaveAttribute(
      'href',
      '/docs/faq',
    )
  })

  it('keeps the grid with only a next page and hides when alone', () => {
    const { rerender, container } = render(
      <DocsPager prev={null} next={{ href: '/docs/faq', title: 'FAQ' }} />,
    )
    expect(screen.queryByRole('link', { name: /Anterior/ })).toBeNull()
    rerender(<DocsPager prev={null} next={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('<DocsMobileNav />', () => {
  it('opens a sheet with the search and the sections, and closes on navigation', async () => {
    render(<DocsMobileNav nav={NAV} index={INDEX} />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Abrir o menu: Documentação' }),
    )

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('combobox')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('link', { name: 'Leads' }))
    expect(screen.queryByRole('link', { name: 'Leads' })).toBeNull()
  })

  it('hides the search when there is nothing to search', async () => {
    render(
      <DocsMobileNav
        nav={NAV}
        index={[]}
        title='Desenvolvedores'
        description='Integração com a API'
      />,
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Abrir o menu: Desenvolvedores' }),
    )
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByRole('combobox')).toBeNull()
  })
})
