import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('../notification-emitter', () => ({
  emitNotification: vi.fn(),
  workspaceAdminIds: vi.fn(),
}))

import { emitNotification, workspaceAdminIds } from '../notification-emitter'
import {
  notifyWhatsAppUsers,
  WHATSAPP_NOTIFY_ADMIN_CAP,
  whatsAppAdminIds,
  whatsAppConversationPath,
} from '../whatsapp-notify'

const emit = vi.mocked(emitNotification)
const admins = vi.mocked(workspaceAdminIds)

beforeEach(() => {
  vi.clearAllMocks()
  emit.mockResolvedValue(2)
})

describe('notifyWhatsAppUsers', () => {
  it('hands the notice to the shared emitter (actor, members and mute are handled there)', async () => {
    expect(
      await notifyWhatsAppUsers({
        workspaceId: 'ws1',
        kind: 'WHATSAPP_CONVERSATION_ASSIGNED',
        userIds: ['u1', null],
        actorId: 'actor',
        title: 'Conversa atribuída a você',
        body: 'Conversa com Ana.',
        path: whatsAppConversationPath('c1'),
        meta: { conversationId: 'c1' },
      }),
    ).toBe(2)
    expect(emit).toHaveBeenCalledWith({
      workspaceId: 'ws1',
      recipients: ['u1', null],
      actorId: 'actor',
      kind: 'WHATSAPP_CONVERSATION_ASSIGNED',
      title: 'Conversa atribuída a você',
      body: 'Conversa com Ana.',
      path: '/zap?conversa=c1',
    })
  })
})

describe('whatsAppAdminIds', () => {
  it('caps the workspace admins', async () => {
    admins.mockResolvedValue(
      Array.from({ length: 30 }, (_, index) => `admin-${index}`),
    )
    const ids = await whatsAppAdminIds('ws1')
    expect(ids).toHaveLength(WHATSAPP_NOTIFY_ADMIN_CAP)
    expect(admins).toHaveBeenCalledWith('ws1')
  })
})
