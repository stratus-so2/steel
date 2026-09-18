import { describe, expect, it, vi } from 'vitest'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { WhatsAppAiConfigRepository } from '../whatsapp-ai-config.repository'

describe('WhatsAppAiConfigRepository', () => {
  describe('findByWorkspace()', () => {
    it('should return null when the workspace has no config yet', async () => {
      const workspace = await seedWorkspace()
      expect(
        expectOk(
          await WhatsAppAiConfigRepository.findByWorkspace(workspace.id),
        ),
      ).toBeNull()
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.whatsAppAiConfig, 'findUnique').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await WhatsAppAiConfigRepository.findByWorkspace('w'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('upsert()', () => {
    it('should create the config and then update it in place', async () => {
      const workspace = await seedWorkspace()

      const created = expectOk(
        await WhatsAppAiConfigRepository.upsert(workspace.id, {
          systemPrompt: 'Seja cordial',
        }),
      )
      expect(created.active).toBe(false)
      expect(created.readMedia).toBe(false)

      const updated = expectOk(
        await WhatsAppAiConfigRepository.upsert(workspace.id, {
          systemPrompt: 'Seja breve',
          active: true,
          readMedia: true,
        }),
      )
      expect(updated.id).toBe(created.id)
      expect(updated.systemPrompt).toBe('Seja breve')
      expect(updated.active).toBe(true)

      const found = expectOk(
        await WhatsAppAiConfigRepository.findByWorkspace(workspace.id),
      )
      expect(found?.id).toBe(created.id)
    })

    it('should return DATABASE_ERROR when the workspace does not exist', async () => {
      expectErr(
        await WhatsAppAiConfigRepository.upsert('missing-workspace', {
          systemPrompt: 'x',
        }),
        'DATABASE_ERROR',
      )
    })
  })
})
