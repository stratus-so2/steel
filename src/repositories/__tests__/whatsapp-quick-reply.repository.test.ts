import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { WhatsAppQuickReplyRepository } from '../whatsapp-quick-reply.repository'

afterEach(() => {
  vi.restoreAllMocks()
})

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

  describe('findById()', () => {
    it('should find a quick reply only within its workspace', async () => {
      const [workspace, other] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
      ])
      const created = expectOk(
        await WhatsAppQuickReplyRepository.create({
          workspaceId: workspace.id,
          shortcut: '/oi',
          title: 'Saudação',
          body: 'Olá!',
        }),
      )

      expect(
        expectOk(
          await WhatsAppQuickReplyRepository.findById(created.id, workspace.id),
        )?.shortcut,
      ).toBe('/oi')
      expect(
        expectOk(
          await WhatsAppQuickReplyRepository.findById(created.id, other.id),
        ),
      ).toBeNull()
    })
  })

  describe('update()', () => {
    it('should update the fields', async () => {
      const workspace = await seedWorkspace()
      const created = expectOk(
        await WhatsAppQuickReplyRepository.create({
          workspaceId: workspace.id,
          shortcut: '/oi',
          title: 'Saudação',
          body: 'Olá!',
        }),
      )

      const updated = expectOk(
        await WhatsAppQuickReplyRepository.update(created.id, {
          shortcut: '/ola',
          body: 'Olá, tudo bem?',
          mediaUrl: 'https://cdn.test/a.png',
        }),
      )
      expect(updated).toMatchObject({
        shortcut: '/ola',
        title: 'Saudação',
        body: 'Olá, tudo bem?',
        mediaUrl: 'https://cdn.test/a.png',
      })
    })

    it('should return WHATSAPP_QUICK_REPLY_CONFLICT when renaming onto a taken shortcut', async () => {
      const workspace = await seedWorkspace()
      expectOk(
        await WhatsAppQuickReplyRepository.create({
          workspaceId: workspace.id,
          shortcut: '/a',
          title: 'A',
          body: 'a',
        }),
      )
      const b = expectOk(
        await WhatsAppQuickReplyRepository.create({
          workspaceId: workspace.id,
          shortcut: '/b',
          title: 'B',
          body: 'b',
        }),
      )

      expectErr(
        await WhatsAppQuickReplyRepository.update(b.id, { shortcut: '/a' }),
        'WHATSAPP_QUICK_REPLY_CONFLICT',
      )
    })

    it('should return DATABASE_ERROR for a missing quick reply', async () => {
      expectErr(
        await WhatsAppQuickReplyRepository.update('missing', { title: 'x' }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('database failures', () => {
    it('should return DATABASE_ERROR when create hits a missing workspace', async () => {
      expectErr(
        await WhatsAppQuickReplyRepository.create({
          workspaceId: 'missing',
          shortcut: '/x',
          title: 'X',
          body: 'x',
        }),
        'DATABASE_ERROR',
      )
    })

    it('should return DATABASE_ERROR when deleting a missing quick reply', async () => {
      expectErr(
        await WhatsAppQuickReplyRepository.delete('missing'),
        'DATABASE_ERROR',
      )
    })

    it('should return DATABASE_ERROR when reads throw', async () => {
      vi.spyOn(prisma.whatsAppQuickReply, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      vi.spyOn(prisma.whatsAppQuickReply, 'findFirst').mockRejectedValueOnce(
        new Error('boom'),
      )

      expectErr(
        await WhatsAppQuickReplyRepository.listByWorkspace('w'),
        'DATABASE_ERROR',
      )
      expectErr(
        await WhatsAppQuickReplyRepository.findById('q', 'w'),
        'DATABASE_ERROR',
      )
    })
  })
})
