import { describe, expect, it, vi } from 'vitest'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { WhatsAppSettingsRepository } from '../whatsapp-settings.repository'

describe('WhatsAppSettingsRepository', () => {
  describe('findByWorkspace()', () => {
    it('should return null when nothing was saved', async () => {
      const workspace = await seedWorkspace()
      expect(
        expectOk(
          await WhatsAppSettingsRepository.findByWorkspace(workspace.id),
        ),
      ).toBeNull()
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.whatsAppSettings, 'findUnique').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await WhatsAppSettingsRepository.findByWorkspace('w'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('upsert()', () => {
    it('should create with defaults and update the same row', async () => {
      const workspace = await seedWorkspace()

      const created = expectOk(
        await WhatsAppSettingsRepository.upsert(workspace.id, {
          autoCloseAfterHours: 12,
        }),
      )
      expect(created.autoCloseAfterHours).toBe(12)
      expect(created.sentimentAlertEnabled).toBe(true)
      expect(created.sentimentAlertCooldownHours).toBe(6)

      const updated = expectOk(
        await WhatsAppSettingsRepository.upsert(workspace.id, {
          autoCloseAfterHours: 0,
          sentimentAlertEnabled: false,
        }),
      )
      expect(updated.id).toBe(created.id)
      expect(updated.autoCloseAfterHours).toBe(0)
      expect(updated.sentimentAlertEnabled).toBe(false)

      const found = expectOk(
        await WhatsAppSettingsRepository.findByWorkspace(workspace.id),
      )
      expect(found?.autoCloseAfterHours).toBe(0)
    })

    it('should return DATABASE_ERROR when the workspace does not exist', async () => {
      expectErr(
        await WhatsAppSettingsRepository.upsert('missing-workspace', {}),
        'DATABASE_ERROR',
      )
    })
  })

  describe('listAll()', () => {
    it('should list the saved rows of every workspace', async () => {
      const [a, b, untouched] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedWorkspace(),
      ])
      expectOk(await WhatsAppSettingsRepository.upsert(a.id, {}))
      expectOk(await WhatsAppSettingsRepository.upsert(b.id, {}))

      const rows = expectOk(await WhatsAppSettingsRepository.listAll())
      const ids = rows.map((r) => r.workspaceId)
      expect(ids).toHaveLength(2)
      expect(ids).toEqual(expect.arrayContaining([a.id, b.id]))
      expect(ids).not.toContain(untouched.id)
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.whatsAppSettings, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(await WhatsAppSettingsRepository.listAll(), 'DATABASE_ERROR')
    })
  })
})
