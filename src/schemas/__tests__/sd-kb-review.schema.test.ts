import { describe, expect, it } from 'vitest'
import {
  DecideSdKbReviewSchema,
  DraftSdKbArticleFromTicketSchema,
  ListSdKbReviewsSchema,
  MarkSdKbResolvedSchema,
  RequestSdKbReviewSchema,
  SD_KCS_DRAFT_JSON_SCHEMA,
  SdKbStatsSchema,
  SdKcsDraftOutputSchema,
  SetSdKbReviewIntervalSchema,
  SuggestSdKbForDraftSchema,
  UpdateSdKbReviewSettingsSchema,
} from '../sd-kb-review.schema'

describe('RequestSdKbReviewSchema', () => {
  it('exige o revisor e apara o comentário', () => {
    const parsed = RequestSdKbReviewSchema.parse({
      reviewerId: ' u2 ',
      comment: '  confere o passo 3  ',
    })
    expect(parsed).toEqual({ reviewerId: 'u2', comment: 'confere o passo 3' })
    expect(RequestSdKbReviewSchema.safeParse({}).success).toBe(false)
  })

  it('recusa comentário acima de 2000 caracteres', () => {
    const result = RequestSdKbReviewSchema.safeParse({
      reviewerId: 'u2',
      comment: 'x'.repeat(2001),
    })
    expect(result.success).toBe(false)
  })
})

describe('DecideSdKbReviewSchema', () => {
  it('aceita aprovação sem comentário', () => {
    expect(DecideSdKbReviewSchema.parse({ decision: 'APPROVE' })).toEqual({
      decision: 'APPROVE',
    })
  })

  it('aceita validade nula (artigo sem revisão periódica)', () => {
    const parsed = DecideSdKbReviewSchema.parse({
      decision: 'APPROVE',
      reviewIntervalDays: null,
    })
    expect(parsed.reviewIntervalDays).toBeNull()
  })

  it('exige comentário quando pede mudanças', () => {
    const result = DecideSdKbReviewSchema.safeParse({
      decision: 'REQUEST_CHANGES',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['comment'])
    }
    expect(
      DecideSdKbReviewSchema.safeParse({
        decision: 'REQUEST_CHANGES',
        comment: 'falta a validação',
      }).success,
    ).toBe(true)
  })

  it('recusa validade fora da faixa', () => {
    for (const days of [0, 3651, 1.5]) {
      expect(
        DecideSdKbReviewSchema.safeParse({
          decision: 'APPROVE',
          reviewIntervalDays: days,
        }).success,
      ).toBe(false)
    }
  })
})

describe('SetSdKbReviewIntervalSchema', () => {
  it('aceita número na faixa e null', () => {
    expect(
      SetSdKbReviewIntervalSchema.parse({ reviewIntervalDays: 90 }),
    ).toEqual({ reviewIntervalDays: 90 })
    expect(
      SetSdKbReviewIntervalSchema.parse({ reviewIntervalDays: null }),
    ).toEqual({ reviewIntervalDays: null })
    expect(SetSdKbReviewIntervalSchema.safeParse({}).success).toBe(false)
  })
})

describe('UpdateSdKbReviewSettingsSchema', () => {
  it('exige a validade padrão do workspace', () => {
    expect(
      UpdateSdKbReviewSettingsSchema.parse({ defaultIntervalDays: 365 }),
    ).toEqual({ defaultIntervalDays: 365 })
    expect(
      UpdateSdKbReviewSettingsSchema.safeParse({ defaultIntervalDays: null })
        .success,
    ).toBe(false)
  })
})

describe('ListSdKbReviewsSchema', () => {
  it('converte `mine` e aplica o limite padrão', () => {
    expect(ListSdKbReviewsSchema.parse({})).toEqual({
      mine: false,
      limit: 20,
    })
    expect(
      ListSdKbReviewsSchema.parse({
        mine: 'true',
        status: 'PENDING',
        limit: '5',
      }),
    ).toEqual({ mine: true, status: 'PENDING', limit: 5 })
    expect(ListSdKbReviewsSchema.safeParse({ limit: '99' }).success).toBe(false)
  })
})

describe('MarkSdKbResolvedSchema', () => {
  it('exige chamado e o booleano', () => {
    expect(
      MarkSdKbResolvedSchema.parse({ ticketId: 't1', resolved: true }),
    ).toEqual({ ticketId: 't1', resolved: true })
    expect(MarkSdKbResolvedSchema.safeParse({ ticketId: 't1' }).success).toBe(
      false,
    )
  })
})

describe('SdKbStatsSchema', () => {
  it('tem limite padrão de 5 e teto de 20', () => {
    expect(SdKbStatsSchema.parse({})).toEqual({ limit: 5 })
    expect(SdKbStatsSchema.parse({ limit: '20' })).toEqual({ limit: 20 })
    expect(SdKbStatsSchema.safeParse({ limit: '21' }).success).toBe(false)
  })
})

describe('DraftSdKbArticleFromTicketSchema', () => {
  it('usa IA por padrão', () => {
    expect(DraftSdKbArticleFromTicketSchema.parse({ ticketId: 't1' })).toEqual({
      ticketId: 't1',
      useAi: true,
    })
    expect(
      DraftSdKbArticleFromTicketSchema.parse({
        ticketId: 't1',
        useAi: false,
        categoryId: 'c1',
      }),
    ).toMatchObject({ useAi: false, categoryId: 'c1' })
    expect(DraftSdKbArticleFromTicketSchema.safeParse({}).success).toBe(false)
  })
})

describe('SuggestSdKbForDraftSchema', () => {
  it('tem padrões vazios e no máximo 3 categorias', () => {
    expect(SuggestSdKbForDraftSchema.parse({})).toEqual({
      title: '',
      description: '',
      categoryIds: [],
      limit: 5,
    })
    expect(
      SuggestSdKbForDraftSchema.safeParse({
        categoryIds: ['a', 'b', 'c', 'd'],
      }).success,
    ).toBe(false)
  })
})

describe('SdKcsDraftOutputSchema', () => {
  it('tolera seções ausentes e campos malformados', () => {
    const parsed = SdKcsDraftOutputSchema.parse({
      title: '  VPN não conecta  ',
      problem: ['O cliente VPN cai no login.'],
      cause: 'texto solto em vez de lista',
      tags: ['VPN', 'Acesso'],
    })
    expect(parsed.title).toBe('VPN não conecta')
    expect(parsed.problem).toEqual(['O cliente VPN cai no login.'])
    expect(parsed.cause).toEqual([])
    expect(parsed.environment).toEqual([])
    expect(parsed.tags).toEqual(['vpn', 'acesso'])
  })

  it('declara o JSON Schema equivalente para o provedor', () => {
    expect(SD_KCS_DRAFT_JSON_SCHEMA).toMatchObject({
      type: 'object',
      additionalProperties: false,
    })
    expect(SD_KCS_DRAFT_JSON_SCHEMA.required).toEqual([
      'title',
      'problem',
      'environment',
      'cause',
      'solution',
      'validation',
      'tags',
    ])
  })
})
