import fs from 'node:fs'
import path from 'node:path'
import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MARKETPLACE_GROUPS } from '../marketplace-data'
import MarketplacePage, { metadata } from '../page'

const APP_DIR = path.resolve(__dirname, '../../..')

/** True when `href` is served by a public app route (route groups dropped). */
function routeExists(href: string): boolean {
  const segments = href.split('/').filter(Boolean)
  const walk = (dir: string, rest: string[]): boolean => {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    if (rest.length === 0) {
      if (entries.some((e) => e.isFile() && e.name === 'page.tsx')) return true
    }
    return entries.some((entry) => {
      if (!entry.isDirectory()) return false
      const name = entry.name
      const next = path.join(dir, name)
      if (name.startsWith('(') && name.endsWith(')')) return walk(next, rest)
      if (rest.length === 0) return false
      // A dynamic segment only counts below the top level: at the top it is
      // the workspace slug, which would match any path.
      const dynamic = name.startsWith('[') && rest.length < segments.length
      if (name === rest[0] || dynamic) {
        return walk(next, rest.slice(1))
      }
      return false
    })
  }
  return walk(APP_DIR, segments)
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('/marketplace', () => {
  it('is indexable, with its canonical url and social cards', () => {
    expect(metadata.robots).toBeUndefined()
    expect(metadata).toMatchObject({
      alternates: { canonical: '/marketplace' },
      openGraph: { url: '/marketplace' },
    })
  })

  it('renders every group as a titled section of integration cards', () => {
    render(<MarketplacePage />)

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Conecte o Steel ao que você já usa',
      }),
    ).toBeTruthy()
    for (const group of MARKETPLACE_GROUPS) {
      const section = screen.getByRole('region', { name: group.title })
      for (const integration of group.integrations) {
        const title = within(section).getByRole('heading', {
          level: 3,
          name: integration.title,
        })
        const card = title.closest('div.rounded-xl') as HTMLElement
        expect(within(card).getByText(integration.description)).toBeTruthy()
        expect(
          within(card)
            .getByRole('link', { name: integration.cta })
            .getAttribute('href'),
        ).toBe(integration.href)
      }
    }
  })

  it('links every card to a page the app serves', () => {
    const hrefs = MARKETPLACE_GROUPS.flatMap((group) =>
      group.integrations.map((integration) => integration.href),
    )
    for (const href of hrefs) expect(routeExists(href), href).toBe(true)
    expect(routeExists('/nao-existe')).toBe(false)
  })

  it('has no empty copy and no duplicate integration', () => {
    const titles = MARKETPLACE_GROUPS.flatMap((group) =>
      group.integrations.map((integration) => integration.title),
    )
    expect(new Set(titles).size).toBe(titles.length)
    for (const group of MARKETPLACE_GROUPS) {
      expect(group.integrations.length).toBeGreaterThan(0)
      for (const integration of group.integrations) {
        for (const text of [
          integration.title,
          integration.description,
          integration.module,
          integration.cta,
        ]) {
          expect(text.trim()).not.toBe('')
        }
      }
    }
  })
})
