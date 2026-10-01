import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  parseSdAiJson,
  SD_AI_CLOSE_OUTCOMES,
  SD_AI_TRIAGE_JSON_SCHEMA,
  SD_AI_TURN_ACTIONS,
  SD_AI_TURN_JSON_SCHEMA,
  SdAiChatMessageSchema,
  SdAiPreServiceCloseSchema,
  SdAiPreServiceMessageSchema,
  SdAiPreServiceOpenTicketSchema,
  SdAiReplyRequestSchema,
  SdAiTicketDraftSchema,
  SdAiTriageOutputSchema,
  SdAiTurnOutputSchema,
} from '../sd-ai.schema'

describe('entradas da API', () => {
  it('aceita a orientação opcional do agente e recusa texto longo demais', () => {
    expect(SdAiReplyRequestSchema.parse({})).toEqual({})
    expect(
      SdAiReplyRequestSchema.parse({ instructions: '  peça o print  ' }),
    ).toEqual({ instructions: 'peça o print' })
    expect(
      SdAiReplyRequestSchema.safeParse({ instructions: 'x'.repeat(1001) })
        .success,
    ).toBe(false)
  })

  it('exige uma mensagem não vazia e com no máximo 4000 caracteres', () => {
    expect(SdAiChatMessageSchema.parse({ message: ' oi ' })).toEqual({
      message: 'oi',
    })
    const empty = SdAiChatMessageSchema.safeParse({ message: '   ' })
    expect(empty.success).toBe(false)
    expect(empty.error?.issues[0]?.message).toBe('Escreva uma mensagem')

    const long = SdAiChatMessageSchema.safeParse({ message: 'x'.repeat(4001) })
    expect(long.success).toBe(false)
    expect(long.error?.issues[0]?.message).toBe(
      'Mensagem muito longa (máx. 4000 caracteres)',
    )
  })

  it('aceita o pré-atendimento com e sem conversa existente', () => {
    expect(SdAiPreServiceMessageSchema.parse({ message: 'olá' })).toEqual({
      message: 'olá',
    })
    const parsed = SdAiPreServiceMessageSchema.parse({
      conversationId: 'c'.repeat(24),
      message: 'olá',
    })
    expect(parsed.conversationId).toBe('c'.repeat(24))
    expect(
      SdAiPreServiceMessageSchema.safeParse({
        conversationId: '',
        message: 'x',
      }).success,
    ).toBe(false)
  })

  it('valida o "abrir chamado" do fim do pré-atendimento', () => {
    expect(SdAiPreServiceOpenTicketSchema.parse({})).toEqual({})
    expect(
      SdAiPreServiceOpenTicketSchema.parse({
        title: ' Sem acesso ',
        description: ' tentei reiniciar ',
        type: 'SERVICE_REQUEST',
      }),
    ).toEqual({
      title: 'Sem acesso',
      description: 'tentei reiniciar',
      type: 'SERVICE_REQUEST',
    })
    expect(
      SdAiPreServiceOpenTicketSchema.safeParse({ title: 'ab' }).success,
    ).toBe(false)
    expect(
      SdAiPreServiceOpenTicketSchema.safeParse({ type: 'OUTRO' }).success,
    ).toBe(false)
  })

  it('só encerra o pré-atendimento com um desfecho sem chamado', () => {
    expect(SD_AI_CLOSE_OUTCOMES).toEqual(['resolved_by_kb', 'abandoned'])
    expect(
      SdAiPreServiceCloseSchema.parse({ outcome: 'abandoned' }).outcome,
    ).toBe('abandoned')
    expect(
      SdAiPreServiceCloseSchema.safeParse({ outcome: 'ticket_opened' }).success,
    ).toBe(false)
  })
})

describe('saídas do modelo', () => {
  const triage = {
    categoryId: 'cat',
    subcategoryId: null,
    serviceId: null,
    impactId: null,
    urgencyId: null,
    priorityId: null,
    departmentId: null,
    tags: ['VPN', 'vpn', 'acesso'],
    confidence: 0.82,
    reasoning: 'Problema de acesso',
  }

  it('normaliza tags (únicas e em minúsculas) e mantém a confiança', () => {
    const parsed = SdAiTriageOutputSchema.parse(triage)
    expect(parsed.tags).toEqual(['vpn', 'acesso'])
    expect(parsed.confidence).toBe(0.82)
    expect(parsed.categoryId).toBe('cat')
  })

  it('cai no padrão quando o modelo devolve lixo em vez de respeitar o schema', () => {
    const parsed = SdAiTriageOutputSchema.parse({
      ...triage,
      categoryId: 42,
      tags: 'nada disso',
      confidence: 7,
      reasoning: { nope: true },
    })
    expect(parsed.categoryId).toBeNull()
    expect(parsed.tags).toEqual([])
    expect(parsed.confidence).toBe(0)
    expect(parsed.reasoning).toBe('')
  })

  it('valida o rascunho do chamado, com fallback por campo', () => {
    const parsed = SdAiTicketDraftSchema.parse({
      title: 12,
      description: null,
      type: 'NADA',
      categoryId: 'cat',
      subcategoryId: null,
      serviceId: null,
      urgencyId: null,
    })
    expect(parsed).toMatchObject({
      title: '',
      description: '',
      type: null,
      categoryId: 'cat',
    })

    const good = SdAiTicketDraftSchema.parse({
      title: '  Sem VPN  ',
      description: 'não conecta',
      type: 'INCIDENT',
      categoryId: null,
      subcategoryId: null,
      serviceId: null,
      urgencyId: 'urg',
    })
    expect(good).toMatchObject({ title: 'Sem VPN', type: 'INCIDENT' })
  })

  it('exige a resposta do turno e tolera o resto', () => {
    expect(SD_AI_TURN_ACTIONS).toContain('collect_info')
    const parsed = SdAiTurnOutputSchema.parse({
      reply: '  Tente reiniciar  ',
      action: 'inventada',
      articleIds: 'nada',
      confidence: -1,
      ticket: 'nada',
    })
    expect(parsed).toMatchObject({
      reply: 'Tente reiniciar',
      action: 'answer',
      articleIds: [],
      confidence: 0,
      ticket: null,
    })
    expect(SdAiTurnOutputSchema.safeParse({ reply: '  ' }).success).toBe(false)
  })

  it('descreve as saídas estruturadas pedidas ao provedor', () => {
    expect(SD_AI_TRIAGE_JSON_SCHEMA.additionalProperties).toBe(false)
    expect(SD_AI_TRIAGE_JSON_SCHEMA.required).toContain('confidence')
    const turn = SD_AI_TURN_JSON_SCHEMA.properties as Record<string, unknown>
    expect(Object.keys(turn)).toEqual([
      'reply',
      'action',
      'articleIds',
      'confidence',
      'ticket',
    ])
  })
})

describe('parseSdAiJson', () => {
  const schema = z.object({ a: z.number() })

  it('lê JSON puro e JSON em cerca de markdown', () => {
    expect(parseSdAiJson(schema, '{"a":1}')).toEqual({ a: 1 })
    expect(parseSdAiJson(schema, '```json\n{"a":2}\n```')).toEqual({ a: 2 })
    expect(parseSdAiJson(schema, '```\n{"a":3}\n```')).toEqual({ a: 3 })
  })

  it('devolve null para texto que não é JSON ou que não passa no schema', () => {
    expect(parseSdAiJson(schema, 'desculpe, não consegui')).toBeNull()
    expect(parseSdAiJson(schema, '{"a":"texto"}')).toBeNull()
  })
})
