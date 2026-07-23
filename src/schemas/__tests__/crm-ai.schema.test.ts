import { describe, expect, it } from 'vitest'
import {
  CreateCrmAiConversationSchema,
  SendCrmAiMessageSchema,
} from '../crm-ai.schema'

describe('CreateCrmAiConversationSchema', () => {
  it('should accept an empty payload', () => {
    expect(CreateCrmAiConversationSchema.safeParse({}).success).toBe(true)
  })
})

describe('SendCrmAiMessageSchema', () => {
  it('should reject an empty message', () => {
    expect(SendCrmAiMessageSchema.safeParse({ content: '' }).success).toBe(
      false,
    )
  })

  it('should accept a valid message', () => {
    expect(SendCrmAiMessageSchema.safeParse({ content: 'Olá' }).success).toBe(
      true,
    )
  })
})
