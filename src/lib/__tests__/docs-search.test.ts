import { describe, expect, it } from 'vitest'
import {
  type DocsSearchable,
  normalizeSearchText,
  searchDocs,
} from '@/src/lib/docs/search'
import { DOCS_SECTIONS, docsSectionLabel } from '@/src/lib/docs/sections'
import { DOCS_SECTION_SLUGS } from '@/src/schemas/docs-page.schema'

const PAGES: DocsSearchable[] = [
  {
    href: '/docs/comunicacao/conexoes',
    title: 'Conexões (Meta e Z-API)',
    description: 'Conecte um número de WhatsApp.',
    section: 'Comunicação',
    headings: [
      { id: 'z-api', text: 'Z-API' },
      { id: 'client-token', text: 'Client-Token da Z-API' },
    ],
  },
  {
    href: '/docs/servicedesk/prioridade-e-sla',
    title: 'Prioridade e SLA',
    description: 'Matriz impacto × urgência e políticas de SLA.',
    section: 'ServiceDesk',
    headings: [{ id: 'escalonamento', text: 'Escalonamento' }],
  },
  {
    href: '/docs/faq',
    title: 'Perguntas frequentes',
    description: 'Inclui uma pergunta sobre SLA.',
    section: 'Perguntas frequentes',
    headings: [],
  },
]

describe('searchDocs', () => {
  it('ignores accents and case', () => {
    expect(normalizeSearchText('  Conexões ÁGEIS ')).toBe('conexoes ageis')
    expect(searchDocs(PAGES, 'CONEXOES')[0].href).toBe(
      '/docs/comunicacao/conexoes',
    )
  })

  it('returns nothing for a blank query', () => {
    expect(searchDocs(PAGES, '   ')).toEqual([])
  })

  it('requires every word of the query', () => {
    expect(searchDocs(PAGES, 'sla whatsapp')).toEqual([])
  })

  it('ranks title matches above description matches', () => {
    const results = searchDocs(PAGES, 'sla')
    expect(results.map((r) => r.href)).toEqual([
      '/docs/servicedesk/prioridade-e-sla',
      '/docs/faq',
    ])
    expect(results[1].excerpt).toBe('Inclui uma pergunta sobre SLA.')
  })

  it('points to the heading that carries the query', () => {
    expect(searchDocs(PAGES, 'client token')[0]).toEqual({
      href: '/docs/comunicacao/conexoes#client-token',
      title: 'Conexões (Meta e Z-API)',
      section: 'Comunicação',
      excerpt: 'Client-Token da Z-API',
    })
    expect(searchDocs(PAGES, 'escalonamento')[0].href).toBe(
      '/docs/servicedesk/prioridade-e-sla#escalonamento',
    )
  })

  it('respects the limit', () => {
    expect(searchDocs(PAGES, 'a', 1)).toHaveLength(1)
  })
})

describe('docs sections', () => {
  it('lists every section slug once, in the schema order', () => {
    expect(DOCS_SECTIONS.map((s) => s.slug)).toEqual([...DOCS_SECTION_SLUGS])
    expect(docsSectionLabel('steel-ai')).toBe('Steel AI')
  })
})
