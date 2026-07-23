import { describe, expect, it } from 'vitest'
import {
  seedCrmAiConversation,
  seedCrmAiMessage,
} from '@/src/__tests__/factories/crm-ai.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import {
  CrmAiConversationRepository,
  CrmAiMessageRepository,
} from '../crm-ai.repository'

describe('CrmAiConversationRepository', () => {
  describe('findById()', () => {
    it('should scope by workspace and user', async () => {
      const [workspace, user, other] = await Promise.all([
        seedWorkspace(),
        seedUser(),
        seedUser(),
      ])
      const conversation = await seedCrmAiConversation(workspace.id, user.id)

      expectErr(
        await CrmAiConversationRepository.findById(
          conversation.id,
          workspace.id,
          other.id,
        ),
        'RESOURCE_NOT_FOUND',
      )

      const found = expectOk(
        await CrmAiConversationRepository.findById(
          conversation.id,
          workspace.id,
          user.id,
        ),
      )
      expect(found.id).toBe(conversation.id)
    })
  })
})

describe('CrmAiMessageRepository', () => {
  describe('listByConversation()', () => {
    it('should list messages ordered by createdAt asc', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const conversation = await seedCrmAiConversation(workspace.id, user.id)
      const a = await seedCrmAiMessage(conversation.id, { content: 'A' })
      const b = await seedCrmAiMessage(conversation.id, { content: 'B' })

      const list = expectOk(
        await CrmAiMessageRepository.listByConversation(conversation.id),
      )
      expect(list.map((m) => m.id)).toEqual([a.id, b.id])
    })
  })
})
