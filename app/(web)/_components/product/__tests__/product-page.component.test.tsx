import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PRODUCT_PAGES } from '@/src/config/web-product-pages'
import { slaPage } from '@/src/config/web-product-pages/sla'
import {
  type ProductVisual,
  ProductVisualSchema,
  productPagePath,
} from '@/src/schemas/web-product-page.schema'
import { webNav } from '../../header/web-header-nav-data'
import { CONNECTED_INTERVAL_MS, ConnectedTabs } from '../connected-tabs'
import {
  PRODUCT_TEMPLATE_SECTIONS,
  ProductPageView,
} from '../product-page-view'
import { Reveal } from '../reveal'
import { AppWindow } from '../visuals/app-window'
import { ProductVisualView } from '../visuals/product-visual'

/** Every visual in the content config, wherever it sits on a page. */
function allVisuals(): ProductVisual[] {
  const found: ProductVisual[] = []
  const walk = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(walk)
    else if (value && typeof value === 'object') {
      if (ProductVisualSchema.safeParse(value).success) {
        found.push(value as ProductVisual)
      }
      Object.values(value).forEach(walk)
    }
  }
  walk(PRODUCT_PAGES)
  return found
}

// jsdom's matchMedia and the setup's IntersectionObserver stub are writable
// but not configurable, so tests assign them and restore the originals.
const originalMatchMedia = window.matchMedia
const originalObserver = window.IntersectionObserver

function stubMotion(reduced: boolean) {
  window.matchMedia = vi.fn(
    () => ({ matches: reduced }) as MediaQueryList,
  ) as typeof window.matchMedia
}

function stubObserver(value: unknown) {
  window.IntersectionObserver = value as typeof IntersectionObserver
  globalThis.IntersectionObserver = value as typeof IntersectionObserver
}

beforeEach(() => {
  // The footer reads the live status; keep it pending.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  window.matchMedia = originalMatchMedia
  stubObserver(originalObserver)
})

describe('<ProductPageView />', () => {
  it.each(PRODUCT_PAGES.map((page) => [productPagePath(page), page] as const))(
    '%s renders its template sections, copy and calls to action',
    (_path, page) => {
      const { container } = render(<ProductPageView page={page} />)

      const sections = [
        ...container.querySelectorAll<HTMLElement>('[data-section]'),
      ].map((node) => node.dataset.section)
      expect(sections).toEqual([...PRODUCT_TEMPLATE_SECTIONS[page.template]])

      expect(
        screen.getByRole('heading', { level: 1, name: page.hero.title }),
      ).toBeTruthy()
      for (const item of [
        ...page.highlights.items,
        ...page.ai.items,
        ...page.details.items,
        ...(page.rows ?? []),
      ]) {
        expect(screen.getAllByText(item.title).length).toBeGreaterThan(0)
      }

      const hrefs = [...container.querySelectorAll('a')].map((a) =>
        a.getAttribute('href'),
      )
      for (const href of ['/talk-to-sales', '/sign-up', '/sign-in']) {
        expect(hrefs).toContain(href)
      }
      expect(container.querySelector('a[href="#"]')).toBeNull()

      const ld = container.querySelector('script[type="application/ld+json"]')
      expect(JSON.parse(ld?.textContent ?? '{}')['@graph'][0].name).toBe(
        page.meta.title,
      )
    },
  )

  it('has a page for every module and capability in the Produto menu, under the same name', () => {
    const byPath = new Map(
      PRODUCT_PAGES.map((page) => [productPagePath(page), page.label]),
    )
    for (const item of [...webNav.product, ...webNav.features]) {
      expect(byPath.get(item.href)).toBe(item.label)
    }
    expect(byPath.size).toBe(webNav.product.length + webNav.features.length)
  })
})

describe('<ProductVisualView />', () => {
  const visuals = allVisuals()

  it('the content config uses every kind of visual', () => {
    const kinds = new Set(visuals.map((visual) => visual.kind))
    expect([...kinds].sort()).toEqual(
      [
        'article',
        'chart',
        'chat',
        'fields',
        'flow',
        'form',
        'kanban',
        'list',
        'meters',
        'stats',
        'table',
        'timeline',
        'toggles',
      ].sort(),
    )
  })

  it.each(
    visuals.map(
      (visual, index) => [`${visual.kind} #${index}`, visual] as const,
    ),
  )('renders %s, hidden from assistive tech', (_name, visual) => {
    const { container } = render(<ProductVisualView visual={visual} />)
    const root = container.firstElementChild as HTMLElement
    expect(root.dataset.visual).toBe(visual.kind)
    expect(root.getAttribute('aria-hidden')).toBe('true')
    expect(root.textContent?.length).toBeGreaterThan(0)
  })

  it('draws an area chart as a line and bars as bars', () => {
    const area = render(
      <ProductVisualView
        visual={{
          kind: 'chart',
          title: 'Área',
          variant: 'area',
          points: [10, 20, 30, 40],
        }}
      />,
    )
    expect(area.container.querySelector('polyline')).not.toBeNull()
    const bars = render(
      <ProductVisualView
        visual={{
          kind: 'chart',
          title: 'Barras',
          variant: 'bars',
          points: [0, 50, 100, 2],
          caption: 'R$ mil',
        }}
      />,
    )
    expect(bars.container.querySelector('svg')).toBeNull()
    expect(screen.getByText('R$ mil')).toBeTruthy()
  })

  it('shows a toggle state and a done checklist item', () => {
    const { container } = render(
      <>
        <ProductVisualView
          visual={{
            kind: 'toggles',
            title: 'Ajustes',
            items: [
              { label: 'Ligado', on: true },
              { label: 'Desligado', on: false },
            ],
          }}
        />
        <ProductVisualView
          visual={{
            kind: 'article',
            title: 'Artigo',
            lines: ['Passo'],
            checklist: [
              { label: 'Feito', done: true },
              { label: 'A fazer', done: false },
            ],
          }}
        />
      </>,
    )
    expect(container.querySelectorAll('[data-on="true"]')).toHaveLength(1)
    expect(screen.getByText('Feito').className).toMatch(/line-through/)
    expect(screen.getByText('A fazer').className).not.toMatch(/line-through/)
  })
})

describe('<AppWindow />', () => {
  it('highlights the active screen and renders the side panel', () => {
    const { container } = render(<AppWindow frame={slaPage.hero.window} />)
    const active = slaPage.hero.window.nav[slaPage.hero.window.active]
    expect(screen.getAllByText(active).length).toBe(2)
    expect(container.querySelectorAll('[data-visual]')).toHaveLength(2)
  })

  it('works without a side panel', () => {
    const { container } = render(
      <AppWindow frame={{ ...slaPage.hero.window, aside: undefined }} />,
    )
    expect(container.querySelectorAll('[data-visual]')).toHaveLength(1)
  })
})

describe('<ConnectedTabs />', () => {
  const items = slaPage.connected.items

  function buttons() {
    return items.map((item) => screen.getByRole('button', { name: item.title }))
  }

  it('opens one item at a time and shows its link', () => {
    stubMotion(true)
    render(<ConnectedTabs items={items} />)

    expect(buttons().map((b) => b.getAttribute('aria-expanded'))).toEqual([
      'true',
      'false',
      'false',
    ])
    fireEvent.click(buttons()[2])
    expect(buttons()[2].getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText(items[2].description)).toBeTruthy()
    expect(
      screen
        .getByRole('link', { name: `Saiba mais: ${items[2].title}` })
        .getAttribute('href'),
    ).toBe(items[2].href)
    expect(screen.queryByText(items[0].description)).toBeNull()
  })

  it('walks through the items on its own and pauses under the pointer', () => {
    vi.useFakeTimers()
    stubMotion(false)
    const { container } = render(<ConnectedTabs items={items} />)

    act(() => {
      vi.advanceTimersByTime(CONNECTED_INTERVAL_MS)
    })
    expect(buttons()[1].getAttribute('aria-expanded')).toBe('true')

    const root = container.firstElementChild as HTMLElement
    fireEvent.pointerEnter(root)
    act(() => {
      vi.advanceTimersByTime(CONNECTED_INTERVAL_MS * 2)
    })
    expect(buttons()[1].getAttribute('aria-expanded')).toBe('true')
    expect(
      (screen.getByTestId('connected-progress') as HTMLElement).style.width,
    ).toBe('100%')

    fireEvent.pointerLeave(root)
    act(() => {
      vi.advanceTimersByTime(CONNECTED_INTERVAL_MS)
    })
    expect(buttons()[2].getAttribute('aria-expanded')).toBe('true')
    // Wraps around to the first item after the last.
    act(() => {
      vi.advanceTimersByTime(CONNECTED_INTERVAL_MS)
    })
    expect(buttons()[0].getAttribute('aria-expanded')).toBe('true')
  })

  it('stays put with reduced motion', () => {
    vi.useFakeTimers()
    stubMotion(true)
    render(<ConnectedTabs items={items} />)
    act(() => {
      vi.advanceTimersByTime(CONNECTED_INTERVAL_MS * 3)
    })
    expect(buttons()[0].getAttribute('aria-expanded')).toBe('true')
  })
})

describe('<Reveal />', () => {
  it('shows the content right away without IntersectionObserver', () => {
    stubObserver(undefined)
    const { container } = render(<Reveal>Oi</Reveal>)
    expect((container.firstElementChild as HTMLElement).dataset.shown).toBe(
      'true',
    )
  })

  it('waits until the block scrolls into view, then stops observing', () => {
    stubMotion(false)
    let trigger: (entries: { isIntersecting: boolean }[]) => void = () => {}
    const disconnect = vi.fn()
    stubObserver(
      vi.fn(function (this: unknown, callback: typeof trigger) {
        trigger = callback
        return { observe: vi.fn(), disconnect }
      }),
    )
    const { container } = render(<Reveal delay={200}>Oi</Reveal>)
    const node = container.firstElementChild as HTMLElement
    expect(node.dataset.shown).toBe('false')

    act(() => trigger([{ isIntersecting: false }]))
    expect(node.dataset.shown).toBe('false')

    act(() => trigger([{ isIntersecting: true }]))
    expect(node.dataset.shown).toBe('true')
    expect(node.style.transitionDelay).toBe('200ms')
    expect(disconnect).toHaveBeenCalled()
  })
})

describe('section headings', () => {
  it('render the eyebrow above the title', () => {
    render(<ProductPageView page={slaPage} />)
    const ai = document.querySelector('[data-section="ai"]') as HTMLElement
    expect(within(ai).getByText(slaPage.ai.eyebrow)).toBeTruthy()
    expect(
      within(ai).getByRole('heading', { level: 2, name: slaPage.ai.title }),
    ).toBeTruthy()
  })
})
