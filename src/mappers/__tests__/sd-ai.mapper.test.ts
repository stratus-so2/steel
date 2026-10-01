import { describe, expect, it } from 'vitest'
import {
  createFakeSdAiCatalog,
  createFakeSdAiConversation,
} from '@/src/__tests__/factories/sd-ai.factory'
import type { SdAiTriageOutput } from '@/src/schemas/sd-ai.schema'
import {
  parseSdAiMessages,
  toSdAiClassification,
  toSdAiConversationDTO,
} from '../sd-ai.mapper'

const card = { id: 'a1', title: 'VPN', excerpt: 'Passo a passo' }

function triage(overrides: Partial<SdAiTriageOutput> = {}): SdAiTriageOutput {
  return {
    categoryId: null,
    subcategoryId: null,
    serviceId: null,
    impactId: null,
    urgencyId: null,
    priorityId: null,
    departmentId: null,
    tags: [],
    confidence: 0,
    reasoning: '',
    ...overrides,
  }
}

describe('parseSdAiMessages', () => {
  it('devolve lista vazia quando o JSON não é um array', () => {
    expect(parseSdAiMessages(null)).toEqual([])
    expect(parseSdAiMessages({ role: 'user' })).toEqual([])
    expect(parseSdAiMessages('[]')).toEqual([])
  })

  it('descarta entradas malformadas e mantém as válidas', () => {
    const messages = parseSdAiMessages([
      null,
      'texto',
      { role: 'sistema', content: 'x', at: 'y' },
      { role: 'user', content: 42, at: 'y' },
      { role: 'user', content: 'oi', at: 12 },
      { role: 'user', content: 'oi', at: '2026-09-21T12:00:00.000Z' },
    ])
    expect(messages).toEqual([
      { role: 'user', content: 'oi', at: '2026-09-21T12:00:00.000Z' },
    ])
  })

  it('mantém só os cartões de artigo bem formados', () => {
    const [withCards, withoutCards] = parseSdAiMessages([
      {
        role: 'assistant',
        content: 'veja',
        at: 'now',
        articles: [card, { id: 'a2' }, null, 'x'],
      },
      { role: 'assistant', content: 'nada', at: 'now', articles: ['x'] },
    ])
    expect(withCards?.articles).toEqual([card])
    expect(withoutCards).not.toHaveProperty('articles')
    expect(parseSdAiMessages([{ ...card, role: 'user' }])).toEqual([])
  })

  it('ignora `articles` que não é array', () => {
    const [message] = parseSdAiMessages([
      { role: 'assistant', content: 'oi', at: 'now', articles: 'nope' },
    ])
    expect(message).toEqual({ role: 'assistant', content: 'oi', at: 'now' })
  })
})

describe('toSdAiConversationDTO', () => {
  it('serializa a conversa do copiloto com as datas em ISO', () => {
    const row = createFakeSdAiConversation({
      id: 'c1',
      mode: 'COPILOT',
      ticketId: 't1',
      outcome: null,
      messages: [{ role: 'user', content: 'oi', at: 'now' }],
    })
    expect(toSdAiConversationDTO(row)).toEqual({
      id: 'c1',
      mode: 'COPILOT',
      ticketId: 't1',
      outcome: null,
      messages: [{ role: 'user', content: 'oi', at: 'now' }],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })
  })

  it('normaliza modo desconhecido para PRE_SERVICE e desfecho inválido para null', () => {
    const dto = toSdAiConversationDTO(
      createFakeSdAiConversation({ mode: 'OUTRO', outcome: 'inventado' }),
    )
    expect(dto.mode).toBe('PRE_SERVICE')
    expect(dto.outcome).toBeNull()

    expect(
      toSdAiConversationDTO(
        createFakeSdAiConversation({ outcome: 'resolved_by_kb' }),
      ).outcome,
    ).toBe('resolved_by_kb')
  })
})

describe('toSdAiClassification', () => {
  const catalog = createFakeSdAiCatalog()

  it('aceita o caminho categoria > subcategoria > serviço completo', () => {
    const result = toSdAiClassification(
      triage({
        categoryId: 'cat',
        subcategoryId: 'sub',
        serviceId: 'svc',
        impactId: 'imp',
        urgencyId: 'urg',
        priorityId: 'pri',
        departmentId: 'dep',
        tags: ['a', 'b', 'c', 'd', 'e', 'f'],
        confidence: 0.8166,
        reasoning: 'porque sim',
      }),
      catalog,
    )
    expect(result).toMatchObject({
      category: { id: 'cat', name: 'Acesso' },
      subcategory: { id: 'sub', name: 'VPN' },
      service: { id: 'svc', name: 'Reset de senha' },
      impact: { id: 'imp', name: 'Alto' },
      urgency: { id: 'urg', name: 'Alta' },
      priority: { id: 'pri', name: 'P1' },
      department: { id: 'dep', name: 'Suporte N1' },
      reasoning: 'porque sim',
    })
    expect(result.tags).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(result.confidence).toBe(0.82)
  })

  it('descarta os níveis abaixo quando o caminho quebra', () => {
    // Subcategoria de outra categoria → cai ela e o serviço.
    expect(
      toSdAiClassification(
        triage({ categoryId: 'cat', subcategoryId: 'orfa', serviceId: 'svc' }),
        catalog,
      ),
    ).toMatchObject({
      category: { id: 'cat' },
      subcategory: null,
      service: null,
    })

    // Categoria inexistente → nada do caminho sobrevive.
    expect(
      toSdAiClassification(
        triage({ categoryId: 'nope', subcategoryId: 'sub', serviceId: 'svc' }),
        catalog,
      ),
    ).toMatchObject({ category: null, subcategory: null, service: null })

    // Nível errado no lugar da categoria.
    expect(
      toSdAiClassification(triage({ categoryId: 'sub' }), catalog).category,
    ).toBeNull()
  })

  it('devolve null para ids que não existem no catálogo e para ausência de id', () => {
    const result = toSdAiClassification(
      triage({ impactId: 'nope', urgencyId: null, serviceId: 'svc' }),
      catalog,
    )
    expect(result.impact).toBeNull()
    expect(result.urgency).toBeNull()
    expect(result.service).toBeNull()
  })
})
