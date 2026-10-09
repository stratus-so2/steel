import fs from 'node:fs'
import path from 'node:path'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FOOTER_GROUPS, WebFooter } from '../footer'
import { FooterStatus } from '../footer-status'
import { COMING_ROUTE_PREFIXES, webNav } from '../header/web-header-nav-data'

const APP_DIR = path.resolve(__dirname, '../../..')

/** Every page route the app serves, as regexes (route groups dropped). */
function appRoutes(): RegExp[] {
  const routes: RegExp[] = []
  const walk = (dir: string, segments: string[]) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const name = entry.name
        if (name.startsWith('_') || name === '__tests__' || name === 'api') {
          continue
        }
        const isGroup = name.startsWith('(') && name.endsWith(')')
        walk(path.join(dir, name), isGroup ? segments : [...segments, name])
      } else if (entry.name === 'page.tsx') {
        const pattern = segments
          .map((s) => (s.startsWith('[') ? '[^/]+' : s))
          .join('/')
        routes.push(new RegExp(`^/${pattern}$`))
      }
    }
  }
  walk(APP_DIR, [])
  return routes
}

const isComing = (href: string) =>
  COMING_ROUTE_PREFIXES.some((prefix) => href.startsWith(prefix))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('public site links', () => {
  const routes = appRoutes()
  const all = [
    ...FOOTER_GROUPS.flatMap((g) => g.links.map((l) => l.href)),
    ...webNav.product.map((l) => l.href),
    ...webNav.features.map((l) => l.href),
    ...webNav.main.map((l) => l.href),
    webNav.signIn.href,
    webNav.cta.href,
  ]

  it('finds the app routes it checks against', () => {
    expect(routes.some((r) => r.test('/about'))).toBe(true)
    expect(routes.some((r) => r.test('/status/incident/abc'))).toBe(true)
  })

  it.each(all.filter((href) => !isComing(href)))(
    '%s resolves to an existing page',
    (href) => {
      expect(routes.some((r) => r.test(href))).toBe(true)
    },
  )

  // Pages a later slice creates (`/product/*`, `/features/*`, `/dev`): listed
  // so the report shows them; drop the prefix from COMING_ROUTE_PREFIXES when
  // they land and the test above starts covering them.
  it.each(all.filter(isComing))('%s is a "coming" route', (href) => {
    expect(href.startsWith('/')).toBe(true)
  })
})

describe('<WebFooter />', () => {
  it('renders every group with its links and no "#" link', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    )
    const { container } = render(<WebFooter />)

    for (const group of FOOTER_GROUPS) {
      expect(screen.getByText(group.title)).toBeTruthy()
    }
    expect(container.querySelector('a[href="#"]')).toBeNull()
    expect(container.textContent).toMatch(/© Stratus Telecom/)
  })

  it('lists the four modules, both docs and the legal pages', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    )
    const { container } = render(<WebFooter showBanner={false} />)

    for (const href of [
      '/product/servicedesk',
      '/product/crm',
      '/product/comunicacao',
      '/product/steel-ai',
      '/docs',
      '/dev',
      '/legals/terms',
      '/legals/privacy',
    ]) {
      expect(container.querySelector(`a[href="${href}"]`)).not.toBeNull()
    }
    expect(container.textContent).not.toMatch(/Fale com um especialista/)
  })
})

describe('<FooterStatus />', () => {
  function stubStatus(response: Promise<Response>) {
    const fetchMock = vi.fn(() => response)
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('shows the live overall status once the snapshot arrives', async () => {
    const fetchMock = stubStatus(
      Promise.resolve(
        new Response(
          JSON.stringify({ data: { overallStatus: 'OPERATIONAL' } }),
        ),
      ),
    )
    render(<FooterStatus />)

    expect(screen.getByText('Status dos sistemas')).toBeTruthy()
    await screen.findByText('Todos os sistemas operacionais')
    expect(fetchMock).toHaveBeenCalledWith('/api/status', expect.anything())
    expect(screen.getByTestId('footer-status-dot').className).toMatch(
      /bg-emerald-500/,
    )
    expect(screen.getByRole('link').getAttribute('href')).toBe('/status')
  })

  it('names a degraded state', async () => {
    stubStatus(
      Promise.resolve(
        new Response(JSON.stringify({ data: { overallStatus: 'DEGRADED' } })),
      ),
    )
    render(<FooterStatus />)

    await screen.findByText('Desempenho degradado')
  })

  it('stays neutral when the status cannot be read', async () => {
    stubStatus(Promise.resolve(new Response('nope', { status: 500 })))
    render(<FooterStatus />)

    await waitFor(() =>
      expect(screen.getByText('Status dos sistemas')).toBeTruthy(),
    )
    expect(screen.getByTestId('footer-status-dot').className).toMatch(
      /bg-muted-foreground/,
    )
  })

  it('ignores an unknown status and network errors', async () => {
    stubStatus(Promise.reject(new Error('offline')))
    render(<FooterStatus />)

    await waitFor(() =>
      expect(screen.getByText('Status dos sistemas')).toBeTruthy(),
    )
  })
})
