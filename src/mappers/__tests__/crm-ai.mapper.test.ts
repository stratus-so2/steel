import { describe, expect, it } from 'vitest'
import {
  createFakeCrmAiAttachment,
  createFakeCrmAiConversation,
  createFakeCrmAiMessage,
} from '@/src/__tests__/factories/crm-ai.factory'
import {
  toCrmAiAttachmentDTO,
  toCrmAiConversationDTO,
  toCrmAiMessageDTO,
} from '../crm-ai.mapper'

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

  it('should include attachments when provided', () => {
    const message = createFakeCrmAiMessage({ id: 'm-1' })
    const attachment = createFakeCrmAiAttachment({ id: 'a-1' })
    const dto = toCrmAiMessageDTO(message, [toCrmAiAttachmentDTO(attachment)])
    expect(dto.attachments).toHaveLength(1)
    expect(dto.attachments?.[0].id).toBe('a-1')
  })
})

describe('toCrmAiAttachmentDTO()', () => {
  it('should map all fields and include the optional url', () => {
    const attachment = createFakeCrmAiAttachment({ id: 'a-1' })
    const dto = toCrmAiAttachmentDTO(attachment, 'https://example.com/x')
    expect(dto.id).toBe('a-1')
    expect(dto.url).toBe('https://example.com/x')
  })
})
