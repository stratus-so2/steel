import { describe, expect, it } from 'vitest'
import { createFakeWhatsAppGroupMessage } from '@/src/__tests__/factories/whatsapp-group-message.factory'
import { toWhatsAppGroupMessageDTO } from '../whatsapp-group-message.mapper'

describe('toWhatsAppGroupMessageDTO()', () => {
  it('should map all fields, including the sender attribution', () => {
    const message = createFakeWhatsAppGroupMessage({
      id: 'gm1',
      direction: 'IN',
      text: 'Bom dia!',
      senderWaId: '5511988887777',
      senderName: 'Maria Silva',
    })

    const dto = toWhatsAppGroupMessageDTO(message)

    expect(dto).toEqual({
      id: 'gm1',
      workspaceId: message.workspaceId,
      groupId: message.groupId,
      direction: 'IN',
      type: 'TEXT',
      text: 'Bom dia!',
      mediaUrl: null,
      status: 'DELIVERED',
      senderUserId: null,
      senderWaId: '5511988887777',
      senderName: 'Maria Silva',
      createdAt: message.createdAt.toISOString(),
    })
  })

  it('should carry senderUserId for outbound messages sent from the platform', () => {
    const message = createFakeWhatsAppGroupMessage({
      direction: 'OUT',
      senderUserId: 'u1',
      senderWaId: null,
      senderName: null,
    })

    const dto = toWhatsAppGroupMessageDTO(message)

    expect(dto.senderUserId).toBe('u1')
    expect(dto.senderWaId).toBeNull()
  })
})
