import { describe, expect, it } from 'vitest'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { WhatsAppQuickReplyRepository } from '../whatsapp-quick-reply.repository'

describe('WhatsAppQuickReplyRepository', () => {
  describe('create()', () => {
    it('should persist a quick reply', async () => {
      const workspace = await seedWorkspace()

      const result = await WhatsAppQuickReplyRepository.create({
        workspaceId: workspace.id,
        shortcut: 'saudacao',
        title: 'Saudação',
        body: 'Olá! Como posso ajudar?',
      })

      expect(expectOk(result).shortcut).toBe('saudacao')
    })

    it('should return WHATSAPP_QUICK_REPLY_CONFLICT for a duplicate shortcut in the same workspace', async () => {
      const workspace = await seedWorkspace()
      await WhatsAppQuickReplyRepository.create({
        workspaceId: workspace.id,
        shortcut: 'saudacao',
        title: 'Saudação',
        body: 'Olá!',
      })

      const result = await WhatsAppQuickReplyRepository.create({
        workspaceId: workspace.id,
        shortcut: 'saudacao',
        title: 'Outra',
        body: 'Oi!',
      })

      expectErr(result, 'WHATSAPP_QUICK_REPLY_CONFLICT')
    })
  })

  describe('listByWorkspace()', () => {
    it('should order results by shortcut', async () => {
      const workspace = await seedWorkspace()
      await WhatsAppQuickReplyRepository.create({
        workspaceId: workspace.id,
        shortcut: 'zzz',
        title: 'Z',
        body: 'Z',
      })
      await WhatsAppQuickReplyRepository.create({
        workspaceId: workspace.id,
        shortcut: 'aaa',
        title: 'A',
        body: 'A',
      })

      const result = expectOk(
        await WhatsAppQuickReplyRepository.listByWorkspace(workspace.id),
      )

      expect(result.map((q) => q.shortcut)).toEqual(['aaa', 'zzz'])
    })
  })

  describe('delete()', () => {
    it('should remove the quick reply', async () => {
      const workspace = await seedWorkspace()
      const created = expectOk(
        await WhatsAppQuickReplyRepository.create({
          workspaceId: workspace.id,
          shortcut: 'saudacao',
          title: 'Saudação',
          body: 'Olá!',
        }),
      )

      expectOk(await WhatsAppQuickReplyRepository.delete(created.id))

      const found = expectOk(
        await WhatsAppQuickReplyRepository.findById(created.id, workspace.id),
      )
      expect(found).toBeNull()
    })
  })
})
