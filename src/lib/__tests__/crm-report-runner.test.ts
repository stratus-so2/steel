import { describe, expect, it } from 'vitest'
import type {
  CrmJoinQuery,
  CrmUnionQuery,
} from '@/src/schemas/crm-report.schema'
import {
  type CrmReportRowsByAlias,
  isCrmReportSource,
  runCrmReportQuery,
} from '../crm-report-runner'

describe('isCrmReportSource()', () => {
  it('should accept known sources', () => {
    expect(isCrmReportSource('company')).toBe(true)
    expect(isCrmReportSource('person')).toBe(true)
    expect(isCrmReportSource('opportunity')).toBe(true)
    expect(isCrmReportSource('lead')).toBe(true)
    expect(isCrmReportSource('task')).toBe(true)
    expect(isCrmReportSource('note')).toBe(true)
    expect(isCrmReportSource('product')).toBe(true)
  })

  it('should reject unknown sources', () => {
    expect(isCrmReportSource('invalid')).toBe(false)
  })
})

const opps = [
  {
    id: 'o1',
    name: 'Acme deal',
    source: 'WhatsApp',
    amount: 100,
    companyId: 'c1',
  },
  { id: 'o2', name: 'Beta deal', source: 'Site', amount: 50, companyId: 'c2' },
  {
    id: 'o3',
    name: 'Gama deal',
    source: 'WhatsApp',
    amount: 200,
    companyId: 'c1',
  },
  { id: 'o4', name: 'Orphan', source: 'Site', amount: 10, companyId: 'cX' },
]
const companies = [
  { id: 'c1', name: 'Acme' },
  { id: 'c2', name: 'Beta' },
]

function joinQuery(over: Partial<CrmJoinQuery>): CrmJoinQuery {
  return {
    mode: 'join',
    datasets: [{ alias: 'opportunity', source: 'opportunity', filters: [] }],
    joins: [],
    columns: ['opportunity.name', 'opportunity.amount'],
    ...over,
  }
}

describe('runCrmReportQuery — fonte única (join, 1 dataset)', () => {
  const rows: CrmReportRowsByAlias = { opportunity: opps }

  it('projeta colunas e aplica filtros do dataset', () => {
    const out = runCrmReportQuery(
      joinQuery({
        datasets: [
          {
            alias: 'opportunity',
            source: 'opportunity',
            filters: [
              { field: 'source', operator: 'equals', value: 'WhatsApp' },
            ],
          },
        ],
      }),
      rows,
    )
    expect(out.grouped).toBe(false)
    expect(out.total).toBe(2)
    expect(out.rows).toEqual([
      { 'opportunity.name': 'Acme deal', 'opportunity.amount': 100 },
      { 'opportunity.name': 'Gama deal', 'opportunity.amount': 200 },
    ])
    // dataset único ⇒ rótulo sem prefixo de fonte
    expect(out.columns.map((c) => c.label)).toEqual(['Nome', 'Valor'])
  })

  it('ordena numericamente quando possível', () => {
    const out = runCrmReportQuery(
      joinQuery({ sort: { field: 'opportunity.amount', direction: 'desc' } }),
      rows,
    )
    expect(out.rows.map((r) => r['opportunity.amount'])).toEqual([
      200, 100, 50, 10,
    ])
  })
})

describe('runCrmReportQuery — agrupamento e agregações', () => {
  it('agrupa por origem com count + sum + avg + min + max', () => {
    const out = runCrmReportQuery(
      joinQuery({
        group: {
          by: ['opportunity.source'],
          aggregations: [
            { fn: 'count', alias: 'Qtd' },
            { fn: 'sum', field: 'opportunity.amount', alias: 'Total' },
            { fn: 'avg', field: 'opportunity.amount', alias: 'Media' },
            { fn: 'min', field: 'opportunity.amount', alias: 'Min' },
            { fn: 'max', field: 'opportunity.amount', alias: 'Max' },
          ],
        },
        sort: { field: 'Total', direction: 'desc' },
      }),
      { opportunity: opps },
    )
    expect(out.grouped).toBe(true)
    expect(out.total).toBe(4)
    expect(out.columns.map((c) => c.key)).toEqual([
      'opportunity.source',
      'Qtd',
      'Total',
      'Media',
      'Min',
      'Max',
    ])
    const wpp = out.rows.find((r) => r['opportunity.source'] === 'WhatsApp')
    expect(wpp).toMatchObject({
      Qtd: 2,
      Total: 300,
      Media: 150,
      Min: 100,
      Max: 200,
    })
    // ordenado por Total desc ⇒ WhatsApp (300) antes de Site (60)
    expect(out.rows[0]['opportunity.source']).toBe('WhatsApp')
  })
})

describe('runCrmReportQuery — JOIN entre fontes', () => {
  const rows: CrmReportRowsByAlias = { opportunity: opps, company: companies }

  function withJoin(type: 'inner' | 'left'): CrmJoinQuery {
    return joinQuery({
      datasets: [
        { alias: 'opportunity', source: 'opportunity', filters: [] },
        { alias: 'company', source: 'company', filters: [] },
      ],
      joins: [
        {
          leftAlias: 'opportunity',
          rightAlias: 'company',
          leftField: 'companyId',
          rightField: 'id',
          type,
        },
      ],
      columns: ['opportunity.name', 'company.name'],
    })
  }

  it('inner join descarta linhas sem correspondência (fan-out 1:N)', () => {
    const out = runCrmReportQuery(withJoin('inner'), rows)
    // o4 (cX) é descartado; o1,o3 → Acme, o2 → Beta
    expect(out.total).toBe(3)
    expect(out.rows).toContainEqual({
      'opportunity.name': 'Acme deal',
      'company.name': 'Acme',
    })
    expect(out.rows.some((r) => r['opportunity.name'] === 'Orphan')).toBe(false)
    // múltiplos datasets ⇒ rótulo com prefixo de fonte
    expect(out.columns.map((c) => c.label)).toEqual([
      'Oportunidades · Nome',
      'Empresas · Nome',
    ])
  })

  it('left join mantém base sem correspondência (campos do direito nulos)', () => {
    const out = runCrmReportQuery(withJoin('left'), rows)
    expect(out.total).toBe(4)
    const orphan = out.rows.find((r) => r['opportunity.name'] === 'Orphan')
    expect(orphan?.['company.name']).toBeUndefined()
  })
})

describe('runCrmReportQuery — UNION entre fontes', () => {
  const leads = [{ id: 'l1', name: 'Maria', emails: 'm@x.com' }]
  const people = [{ id: 'p1', name: 'João', emails: 'j@y.com' }]
  const rows: CrmReportRowsByAlias = { lead: leads, person: people }

  function unionQuery(includeSource: boolean): CrmUnionQuery {
    return {
      mode: 'union',
      datasets: [
        { alias: 'lead', source: 'lead', filters: [] },
        { alias: 'person', source: 'person', filters: [] },
      ],
      columns: [
        {
          key: 'nome',
          label: 'Nome',
          fields: { lead: 'name', person: 'name' },
        },
        {
          key: 'email',
          label: 'E-mail',
          fields: { lead: 'emails', person: 'emails' },
        },
      ],
      includeSource,
    }
  }

  it('empilha registros mapeando colunas por dataset', () => {
    const out = runCrmReportQuery(unionQuery(false), rows)
    expect(out.total).toBe(2)
    expect(out.columns.map((c) => c.key)).toEqual(['nome', 'email'])
    expect(out.rows).toEqual([
      { nome: 'Maria', email: 'm@x.com' },
      { nome: 'João', email: 'j@y.com' },
    ])
  })

  it('inclui coluna de origem quando includeSource', () => {
    const out = runCrmReportQuery(unionQuery(true), rows)
    expect(out.columns.map((c) => c.label)).toContain('Origem')
    expect(out.rows[0].__source).toBe('Leads')
    expect(out.rows[1].__source).toBe('Pessoas')
  })
})
