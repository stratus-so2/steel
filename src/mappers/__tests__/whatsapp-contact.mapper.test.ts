import { describe, expect, it } from 'vitest'
import { createFakeWhatsAppContact } from '@/src/__tests__/factories/whatsapp-contact.factory'
import { toWhatsAppContactDTO } from '../whatsapp-contact.mapper'

describe('toWhatsAppContactDTO()', () => {
  it('should map all fields correctly', () => {
    const contact = createFakeWhatsAppContact({
      id: 'ct1',
      waId: '5511988887777',
      name: 'Maria Silva',
      avatarUrl: 'https://minio.internal/avatars/ct1.jpg',
    })

    const dto = toWhatsAppContactDTO(contact)

    expect(dto).toEqual({
      id: 'ct1',
      workspaceId: contact.workspaceId,
      waId: '5511988887777',
      name: 'Maria Silva',
      avatarUrl: 'https://minio.internal/avatars/ct1.jpg',
      description: null,
      conversationCount: 0,
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
    })
  })

  it('should keep name and avatarUrl as null when unset', () => {
    const contact = createFakeWhatsAppContact({ name: null, avatarUrl: null })

    const dto = toWhatsAppContactDTO(contact)

    expect(dto.name).toBeNull()
    expect(dto.avatarUrl).toBeNull()
  })
})
