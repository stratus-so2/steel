import { describe, expect, it } from 'vitest'
import {
  ConfirmAiPendingActionSchema,
  CreateAiConversationSchema,
  SendAiMessageSchema,
  UpdateAiConversationSchema,
} from '@/src/schemas/steel-ai.schema'

describe('steel-ai schemas', () => {
  it('defaults a new conversation to explore mode', () => {
    expect(CreateAiConversationSchema.parse({})).toEqual({ mode: 'EXPLORE' })
    expect(
      CreateAiConversationSchema.parse({ title: ' Plano ', mode: 'AGENT' }),
    ).toEqual({ title: 'Plano', mode: 'AGENT' })
  })

  it('rejects an unknown mode', () => {
    expect(CreateAiConversationSchema.safeParse({ mode: 'GOD' }).success).toBe(
      false,
    )
  })

  it('requires at least one field to update a conversation', () => {
    expect(UpdateAiConversationSchema.safeParse({}).success).toBe(false)
    expect(UpdateAiConversationSchema.parse({ pinned: true })).toEqual({
      pinned: true,
    })
    expect(UpdateAiConversationSchema.safeParse({ title: '  ' }).success).toBe(
      false,
    )
  })

  it('validates message content and optional mode switch', () => {
    expect(SendAiMessageSchema.safeParse({ content: '   ' }).success).toBe(
      false,
    )
    expect(
      SendAiMessageSchema.safeParse({ content: 'x'.repeat(8001) }).success,
    ).toBe(false)
    expect(SendAiMessageSchema.parse({ content: 'Oi', mode: 'AGENT' })).toEqual(
      { content: 'Oi', mode: 'AGENT', attachmentIds: [] },
    )
  })

  it('accepts attachments, a model and the Autopilot mode', () => {
    expect(
      SendAiMessageSchema.parse({
        attachmentIds: ['a1'],
        modelKey: 'openai:gpt-5',
        mode: 'AUTOPILOT',
      }),
    ).toEqual({
      content: '',
      attachmentIds: ['a1'],
      modelKey: 'openai:gpt-5',
      mode: 'AUTOPILOT',
    })
    expect(
      SendAiMessageSchema.safeParse({
        content: 'x',
        attachmentIds: ['1', '2', '3', '4', '5', '6'],
      }).success,
    ).toBe(false)
    expect(UpdateAiConversationSchema.parse({ modelKey: null })).toEqual({
      modelKey: null,
    })
  })

  it('accepts an optional double confirmation flag', () => {
    expect(ConfirmAiPendingActionSchema.parse({})).toEqual({})
    expect(
      ConfirmAiPendingActionSchema.parse({ doubleConfirmed: true }),
    ).toEqual({ doubleConfirmed: true })
    expect(
      ConfirmAiPendingActionSchema.safeParse({ doubleConfirmed: 'sim' })
        .success,
    ).toBe(false)
  })
})
