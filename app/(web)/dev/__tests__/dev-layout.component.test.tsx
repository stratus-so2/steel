import '@/src/__tests__/helpers/dom-matchers'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ERROR_CODES } from '@/src/errors/codes'
import { getDevNav, getDevSearchIndex } from '@/src/lib/dev/pages'
import { DocsSearch } from '../../docs/_components/docs-search'
import { DocsSidebar } from '../../docs/_components/docs-sidebar'
import { BaseUrl, ErrorCodeTable } from '../_components/dev-mdx-components'
import { DEV_HOME } from '../dev-nav'
import DevLayout from '../layout'

const push = vi.fn()
const pathname = { value: '/dev/limites' }

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => pathname.value,
}))

beforeEach(() => {
  // The footer asks the status page for the current state.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  push.mockClear()
  pathname.value = '/dev/limites'
})

describe('developer site layout', () => {
  it('frames the page with the guides sidebar, its search and the footer', async () => {
    render(await DevLayout({ children: <p>Conteúdo do guia</p> }))

    expect(screen.getByText('Conteúdo do guia')).toBeInTheDocument()
    const sidebar = screen.getByRole('complementary', {
      name: 'Desenvolvedores',
    })
    expect(
      within(sidebar).getByRole('link', { name: 'Visão geral' }),
    ).toHaveAttribute('href', '/dev')
    expect(
      within(sidebar).getByRole('link', { name: 'Limites de requisição' }),
    ).toHaveAttribute('aria-current', 'page')
    expect(
      within(sidebar).getByRole('combobox', {
        name: 'Buscar na documentação',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Abrir o menu: Desenvolvedores' }),
    ).toBeInTheDocument()
  })

  it('lists the groups in order, ending with the API reference', async () => {
    render(<DocsSidebar nav={await getDevNav()} home={DEV_HOME} />)

    for (const label of [
      'Introdução',
      'Fundamentos',
      'Webhooks',
      'Guias por caso de uso',
      'Recursos',
      'Referência',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(
      screen.getByRole('link', { name: 'Referência da API' }),
    ).toHaveAttribute('href', '/dev/api')
    expect(
      screen.getByRole('link', {
        name: 'Receber eventos do GitHub e do GitLab',
      }),
    ).toHaveAttribute('href', '/dev/guias/eventos-github-gitlab')
  })

  it('searches the guides by heading', async () => {
    render(<DocsSearch index={await getDevSearchIndex()} />)

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'repetir com segurança' },
    })

    const results = screen.getByRole('list', { name: 'Resultados da busca' })
    expect(
      within(results).getByRole('link', { name: /Limites de requisição/ }),
    ).toHaveAttribute('href', '/dev/limites#como-repetir-com-segurança')
  })
})

describe('<ErrorCodeTable />', () => {
  it('shows every registry code under its HTTP status', () => {
    const { container } = render(<ErrorCodeTable />)

    const total = Object.keys(ERROR_CODES).length
    expect(screen.getByText(new RegExp(`^${total} códigos em`))).toBeTruthy()
    for (const [code, { status }] of Object.entries(ERROR_CODES)) {
      const cell = within(container).getByText(code)
      expect(cell.closest('details')).toHaveAttribute(
        'data-status',
        String(status),
      )
    }
    expect(
      container.querySelector('details[data-status="429"] summary')
        ?.textContent,
    ).toContain('Limite de requisições excedido')
  })

  it('renders a given catalog, with a dash for codes without a message', () => {
    render(
      <ErrorCodeTable
        groups={[
          {
            status: 409,
            title: 'Conflito com o estado atual',
            codes: [{ code: 'CONFLICT', message: null }],
          },
        ]}
      />,
    )
    expect(screen.getByText('1 códigos em 1 status HTTP.')).toBeTruthy()
    expect(screen.getByText('—')).toBeTruthy()
  })
})

describe('<BaseUrl />', () => {
  it('prints the API base url of this environment', () => {
    render(<BaseUrl />)
    expect(screen.getByText(/\/api$/).tagName).toBe('CODE')
  })
})
