import { describe, expect, it } from 'vitest'
import {
  createFakeWhatsAppGroupParticipant,
  createFakeWhatsAppGroupWithParticipants,
} from '@/src/__tests__/factories/whatsapp-group.factory'
import { createFakeWhatsAppGroupMessage } from '@/src/__tests__/factories/whatsapp-group-message.factory'
import { toWhatsAppGroupDTO } from '../whatsapp-group.mapper'

describe('toWhatsAppGroupDTO()', () => {
  it('should map all fields correctly', () => {
    const group = createFakeWhatsAppGroupWithParticipants({
      id: 'g1',
      name: 'Time de Suporte',
      participants: [
        createFakeWhatsAppGroupParticipant({
          waId: '5511988887777',
          name: 'Maria',
          role: 'ADMIN',
        }),
      ],
    })

    const dto = toWhatsAppGroupDTO(group)

    expect(dto.id).toBe('g1')
    expect(dto.name).toBe('Time de Suporte')
    expect(dto.archived).toBe(false)
    expect(dto.participants).toEqual([
      { waId: '5511988887777', name: 'Maria', role: 'ADMIN' },
    ])
  })

  it('should mark archived true when archivedAt is set', () => {
    const group = createFakeWhatsAppGroupWithParticipants({
      archivedAt: new Date(),
    })

    const dto = toWhatsAppGroupDTO(group)

    expect(dto.archived).toBe(true)
  })

  it('should fall back to an emoji preview for non-text last messages', () => {
    const group = createFakeWhatsAppGroupWithParticipants({
      messages: [createFakeWhatsAppGroupMessage({ type: 'IMAGE', text: null })],
    })

    const dto = toWhatsAppGroupDTO(group)

    expect(dto.lastMessagePreview).toBe('📷 Imagem')
  })

  it('should return null lastMessagePreview when there are no messages', () => {
    const group = createFakeWhatsAppGroupWithParticipants({ messages: [] })

    const dto = toWhatsAppGroupDTO(group)

    expect(dto.lastMessagePreview).toBeNull()
  })

  it.each([
    ['IMAGE', '📷 Imagem'],
    ['AUDIO', '🎤 Áudio'],
    ['VIDEO', '🎥 Vídeo'],
    ['DOCUMENT', '📄 Documento'],
    ['STICKER', 'Figurinha'],
    ['CONTACT', 'Contato'],
    ['LOCATION', ''],
  ] as const)('should label a text-less %s message as "%s"', (type, label) => {
    const group = createFakeWhatsAppGroupWithParticipants({
      messages: [createFakeWhatsAppGroupMessage({ type, text: null })],
    })

    expect(toWhatsAppGroupDTO(group).lastMessagePreview).toBe(label)
  })

  it('should prefer the message text and serialize lastMessageAt', () => {
    const lastMessageAt = new Date('2026-09-01T09:00:00.000Z')
    const group = createFakeWhatsAppGroupWithParticipants({
      lastMessageAt,
      messages: [createFakeWhatsAppGroupMessage({ type: 'TEXT', text: 'Oi' })],
    })

    const dto = toWhatsAppGroupDTO(group)

    expect(dto.lastMessagePreview).toBe('Oi')
    expect(dto.lastMessageAt).toBe(lastMessageAt.toISOString())
  })
})
