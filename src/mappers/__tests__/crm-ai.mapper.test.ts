import { describe, expect, it } from 'vitest'
import {
  createFakeCrmAiConversation,
  createFakeCrmAiMessage,
} from '@/src/__tests__/factories/crm-ai.factory'
import { toCrmAiConversationDTO, toCrmAiMessageDTO } from '../crm-ai.mapper'

describe('toCrmAiConversationDTO()', () => {
  it('should map all fields correctly', () => {
    const conversation = createFakeCrmAiConversation({ id: 'c-1' })
    const dto = toCrmAiConversationDTO(conversation)
    expect(dto.id).toBe('c-1')
  })
})

describe('toCrmAiMessageDTO()', () => {
  it('should map all fields correctly', () => {
    const message = createFakeCrmAiMessage({ id: 'm-1', role: 'ASSISTANT' })
    const dto = toCrmAiMessageDTO(message)
    expect(dto.id).toBe('m-1')
    expect(dto.role).toBe('ASSISTANT')
  })
})
