import { describe, expect, it } from 'vitest'
import {
  ListAiConversationsQuerySchema,
  ListAiPendingActionsQuerySchema,
} from '@/src/schemas/steel-ai.schema'

describe('steel-ai query schemas', () => {
  it('trims the conversation search and rejects an empty one', () => {
    expect(ListAiConversationsQuerySchema.parse({ q: ' chamados ' })).toEqual({
      q: 'chamados',
    })
    expect(ListAiConversationsQuerySchema.parse({})).toEqual({})
    expect(ListAiConversationsQuerySchema.safeParse({ q: '  ' }).success).toBe(
      false,
    )
  })

  it('accepts known action statuses only', () => {
    expect(
      ListAiPendingActionsQuerySchema.parse({
        status: 'PENDING',
        conversationId: 'c1',
      }),
    ).toEqual({ status: 'PENDING', conversationId: 'c1' })
    expect(
      ListAiPendingActionsQuerySchema.safeParse({ status: 'DONE' }).success,
    ).toBe(false)
  })
})
