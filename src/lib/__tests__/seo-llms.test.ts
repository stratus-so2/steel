import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env/env', () => ({ NEXT_PUBLIC_URL: 'https://steel.test' }))

import { formatChangelogDate } from '@/src/lib/changelog/labels'
import { buildLlmsFullTxt, buildLlmsTxt } from '@/src/lib/seo/llms'
import { publicPageMetadata } from '@/src/lib/seo/metadata'
import { siteJsonLd } from '@/src/lib/seo/site'
import { escapeXml } from '@/src/lib/seo/xml'
import type { ChangelogEntryDTO } from '@/types/changelog-entry'

const ENTRY: ChangelogEntryDTO = {
  slug: 'busca-global',
  title: 'Busca global',
  date: '2026-10-08T00:00:00.000Z',
  summary: 'Uma busca que atravessa os três módulos.',
  tags: ['PLATAFORMA', 'IA'],
  version: null,
  cover: null,
  source: '## Como usar\n\nCtrl+K.\n\n### Atalho',
  headings: [],
}

describe('buildLlmsTxt', () => {
  it('links the public pages and the recent changelog on the configured domain', () => {
    const txt = buildLlmsTxt([ENTRY])
    expect(txt.startsWith('# Steel\n\n> ')).toBe(true)
    expect(txt).toContain('[Manifesto](https://steel.test/manifesto)')
    expect(txt).toContain(
      '- [Busca global](https://steel.test/changelog/busca-global) (2026-10-08): Uma busca',
    )
    expect(txt).toContain('https://steel.test/llms-full.txt')
  })

  it('lists every module and capability page with its description', () => {
    const txt = buildLlmsTxt([])
    expect(txt).toContain(
      '- [ServiceDesk](https://steel.test/product/servicedesk): Incidentes',
    )
    expect(txt).toContain('[SLA e OLA](https://steel.test/features/sla)')
    expect(txt).toContain('[Marketplace](https://steel.test/marketplace)')
    expect(txt.indexOf('## Módulos')).toBeGreaterThan(0)
    expect(txt.indexOf('## Módulos')).toBeLessThan(txt.indexOf('## Recursos'))
  })
})

describe('buildLlmsFullTxt', () => {
  it('inlines each entry with its headings nested under the title', () => {
    const txt = buildLlmsFullTxt([ENTRY, { ...ENTRY, slug: 'outra' }])
    expect(txt).toContain('## Busca global')
    expect(txt).toContain('Publicado em 2026-10-08 · Plataforma, Steel AI')
    expect(txt).toContain('### Como usar')
    expect(txt).toContain('#### Atalho')
    expect(txt).toContain('\n\n---\n\n')
  })
})

const DOC = {
  section: 'crm' as const,
  slug: 'leads',
  href: '/docs/crm/leads',
  title: 'Leads',
  description: 'As etapas do funil de leads.',
  order: 1,
  source: '## Etapas\n\nTexto.',
  headings: [],
}

describe('llms files with the manual', () => {
  it('lists the manual pages in llms.txt', () => {
    const txt = buildLlmsTxt([ENTRY], [DOC])
    expect(txt).toContain('## Documentação (manual do usuário)')
    expect(txt).toContain(
      '- [CRM: Leads](https://steel.test/docs/crm/leads): As etapas do funil de leads.',
    )
    expect(txt).toContain('[Para desenvolvedores](https://steel.test/dev)')
  })

  it('leaves the manual block out when there are no pages', () => {
    expect(buildLlmsTxt([ENTRY])).not.toContain('manual do usuário')
    expect(buildLlmsFullTxt([ENTRY])).not.toContain('# Documentação')
  })

  it('inlines every manual page in llms-full.txt before the changelog', () => {
    const txt = buildLlmsFullTxt([ENTRY], [DOC, { ...DOC, href: '/docs/crm' }])
    expect(txt).toContain('# Documentação\n\n## CRM: Leads')
    expect(txt).toContain('https://steel.test/docs/crm/leads')
    expect(txt).toContain('### Etapas')
    expect(txt.indexOf('# Documentação')).toBeLessThan(
      txt.indexOf('# Changelog'),
    )
  })
})

describe('seo helpers', () => {
  it('builds canonical and social metadata for a public page', () => {
    expect(
      publicPageMetadata({ title: 'T', description: 'D', path: '/about' }),
    ).toMatchObject({
      alternates: { canonical: '/about' },
      openGraph: { url: '/about', images: ['/opengraph-image'] },
      twitter: { card: 'summary_large_image', images: ['/twitter-image'] },
    })
  })

  it('describes the organization, site and product as one graph', () => {
    const graph = siteJsonLd()['@graph']
    expect(graph.map((node) => node['@type'])).toEqual([
      'Organization',
      'WebSite',
      'SoftwareApplication',
    ])
    expect(graph[0]['@id']).toBe('https://steel.test/#organization')
  })

  it('escapes the five xml entities', () => {
    expect(escapeXml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&apos;s&lt;/a&gt;',
    )
  })

  it('formats a changelog date as a UTC calendar day', () => {
    expect(formatChangelogDate('2026-10-08T00:00:00.000Z')).toBe('8 out 2026')
  })
})
