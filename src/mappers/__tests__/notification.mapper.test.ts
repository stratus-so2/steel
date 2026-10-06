import type { Notification } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { toNotificationDTO } from '../notification.mapper'

function row(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n1',
    workspaceId: 'ws1',
    userId: 'u1',
    kind: 'SD_SLA_AT_RISK',
    title: 'SLA em risco: INC-000123',
    body: 'Faltam 15 minutos para o prazo de resolução.',
    href: '/acme/servicedesk/tickets/123',
    readAt: null,
    dedupeKey: null,
    archivedAt: null,
    deletedAt: null,
    createdAt: new Date('2026-09-18T12:00:00.000Z'),
    ...overrides,
  }
}

describe('toNotificationDTO', () => {
  it('should expose an unread, unarchived notification with its module metadata', () => {
    expect(toNotificationDTO(row())).toEqual({
      id: 'n1',
      workspaceId: 'ws1',
      kind: 'SD_SLA_AT_RISK',
      title: 'SLA em risco: INC-000123',
      body: 'Faltam 15 minutos para o prazo de resolução.',
      href: '/acme/servicedesk/tickets/123',
      read: false,
      readAt: null,
      archived: false,
      archivedAt: null,
      module: 'SERVICE_DESK',
      moduleLabel: 'ServiceDesk',
      kindLabel: 'SLA em risco',
      icon: 'alarm',
      color: 'amber',
      createdAt: '2026-09-18T12:00:00.000Z',
    })
  })

  it('should expose the read and archived stamps as ISO strings', () => {
    const dto = toNotificationDTO(
      row({
        readAt: new Date('2026-09-18T13:00:00.000Z'),
        archivedAt: new Date('2026-09-18T14:00:00.000Z'),
        href: null,
      }),
    )

    expect(dto.read).toBe(true)
    expect(dto.readAt).toBe('2026-09-18T13:00:00.000Z')
    expect(dto.archived).toBe(true)
    expect(dto.archivedAt).toBe('2026-09-18T14:00:00.000Z')
    expect(dto.href).toBeNull()
  })

  it('should keep the Comunicação metadata for a WhatsApp alert', () => {
    const dto = toNotificationDTO(row({ kind: 'WHATSAPP_NEGATIVE_SENTIMENT' }))

    expect(dto.module).toBe('COMMUNICATION')
    expect(dto.moduleLabel).toBe('Comunicação')
    expect(dto.kindLabel).toBe('Sentimento negativo')
  })
})
