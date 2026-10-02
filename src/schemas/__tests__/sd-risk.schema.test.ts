import { describe, expect, it } from 'vitest'
import {
  ListSdIncidentClustersSchema,
  ListSdRiskTicketsSchema,
  OpenSdClusterProblemSchema,
} from '../sd-risk.schema'

describe('ListSdRiskTicketsSchema', () => {
  it('cai na faixa alta e no limite padrão', () => {
    const parsed = ListSdRiskTicketsSchema.parse({})

    expect(parsed.level).toBe('HIGH')
    expect(parsed.limit).toBe(50)
    expect(parsed.minScore).toBeUndefined()
  })

  it('aceita faixa, nota mínima e recortes como texto da query', () => {
    const parsed = ListSdRiskTicketsSchema.parse({
      level: 'MEDIUM',
      minScore: '55',
      limit: '10',
      departmentId: 'd1',
      assigneeId: 'u1',
    })

    expect(parsed).toMatchObject({
      level: 'MEDIUM',
      minScore: 55,
      limit: 10,
      departmentId: 'd1',
      assigneeId: 'u1',
    })
  })

  it('trata vazio na query como ausente', () => {
    const parsed = ListSdRiskTicketsSchema.parse({
      level: '',
      minScore: '',
      departmentId: '',
      limit: '',
    })

    expect(parsed.level).toBe('HIGH')
    expect(parsed.minScore).toBeUndefined()
    expect(parsed.departmentId).toBeUndefined()
    expect(parsed.limit).toBe(50)
  })

  it('recusa faixa fora da escala e nota fora de 0–100', () => {
    expect(
      ListSdRiskTicketsSchema.safeParse({ level: 'URGENTE' }).success,
    ).toBe(false)
    expect(ListSdRiskTicketsSchema.safeParse({ minScore: '101' }).success).toBe(
      false,
    )
    expect(ListSdRiskTicketsSchema.safeParse({ limit: '500' }).success).toBe(
      false,
    )
  })
})

describe('ListSdIncidentClustersSchema', () => {
  it('lista as sugestões vivas por padrão', () => {
    const parsed = ListSdIncidentClustersSchema.parse({})

    expect(parsed.status).toBe('open')
    expect(parsed.limit).toBe(30)
  })

  it('aceita os já tratados e todos', () => {
    expect(
      ListSdIncidentClustersSchema.parse({ status: 'handled' }).status,
    ).toBe('handled')
    expect(ListSdIncidentClustersSchema.parse({ status: 'all' }).status).toBe(
      'all',
    )
  })

  it('recusa um status desconhecido', () => {
    expect(
      ListSdIncidentClustersSchema.safeParse({ status: 'arquivado' }).success,
    ).toBe(false)
  })
})

describe('OpenSdClusterProblemSchema', () => {
  it('vincula os incidentes por padrão e aceita corpo vazio', () => {
    const parsed = OpenSdClusterProblemSchema.parse({})

    expect(parsed.linkIncidents).toBe(true)
    expect(parsed.title).toBeUndefined()
  })

  it('aceita título e destino informados', () => {
    const parsed = OpenSdClusterProblemSchema.parse({
      title: '  Problema no servidor de e-mail  ',
      departmentId: 'd1',
      assigneeId: 'u1',
      priorityId: 'p1',
      categoryId: 'c1',
      linkIncidents: false,
    })

    expect(parsed.title).toBe('Problema no servidor de e-mail')
    expect(parsed.linkIncidents).toBe(false)
  })

  it('recusa título vazio ou gigante', () => {
    expect(OpenSdClusterProblemSchema.safeParse({ title: '   ' }).success).toBe(
      false,
    )
    expect(
      OpenSdClusterProblemSchema.safeParse({ title: 'x'.repeat(201) }).success,
    ).toBe(false)
  })
})
