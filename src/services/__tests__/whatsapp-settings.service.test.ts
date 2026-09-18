import { describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { createFakeWhatsAppSettings } from '@/src/__tests__/factories/whatsapp-settings.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/whatsapp-settings.repository')
vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))

import { auditMutation } from '@/lib/axiom/audit'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WhatsAppSettingsRepository } from '@/src/repositories/whatsapp-settings.repository'
import { WhatsAppSettingsService } from '../whatsapp-settings.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedSettingsRepo = vi.mocked(WhatsAppSettingsRepository)

function row(overrides: Parameters<typeof createFakeWhatsAppSettings>[0] = {}) {
  return createFakeWhatsAppSettings({
    id: 's1',
    workspaceId: 'ws1',
    ...overrides,
  })
}

function asRole(role: 'MEMBER' | 'ADMIN' | 'OWNER') {
  mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role })),
  )
}

describe('WhatsAppSettingsService', () => {
  describe('get()', () => {
    it('should return the defaults when nothing was saved', async () => {
      asRole('ADMIN')
      mockedSettingsRepo.findByWorkspace.mockResolvedValue(ok(null))

      expect(expectOk(await WhatsAppSettingsService.get('u1', 'ws1'))).toEqual(
        expect.objectContaining({
          workspaceId: 'ws1',
          autoCloseAfterHours: 24,
        }),
      )
    })

    it('should forbid a MEMBER (admin only)', async () => {
      asRole('MEMBER')
      expectErr(await WhatsAppSettingsService.get('u1', 'ws1'), 'FORBIDDEN')
    })
  })

  describe('update()', () => {
    it('should save the auto-close window and audit it', async () => {
      asRole('OWNER')
      mockedSettingsRepo.findByWorkspace.mockResolvedValue(ok(null))
      mockedSettingsRepo.upsert.mockResolvedValue(
        ok(row({ autoCloseAfterHours: 0 })),
      )

      const dto = expectOk(
        await WhatsAppSettingsService.update('u1', 'ws1', {
          autoCloseAfterHours: 0,
        }),
      )

      expect(dto.autoCloseAfterHours).toBe(0)
      expect(mockedSettingsRepo.upsert).toHaveBeenCalledWith(
        'ws1',
        expect.objectContaining({ autoCloseAfterHours: 0 }),
      )
      expect(auditMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'whatsapp_settings',
          action: 'create',
          actorId: 'u1',
        }),
      )
    })

    it('should reject alert recipients that are not workspace members', async () => {
      asRole('ADMIN')
      mockedSettingsRepo.findByWorkspace.mockResolvedValue(ok(null))
      mockedMembershipRepo.listWithUserByWorkspace.mockResolvedValue(
        ok([
          {
            ...createFakeMembership({ userId: 'u1', role: 'ADMIN' }),
            user: { id: 'u1', name: 'A', email: 'a@x.com', image: null },
          },
        ]),
      )

      expectErr(
        await WhatsAppSettingsService.update('u1', 'ws1', {
          sentimentAlertRecipientIds: ['u1', 'stranger'],
        }),
        'VALIDATION_ERROR',
      )
      expect(mockedSettingsRepo.upsert).not.toHaveBeenCalled()
    })

    it('should keep unspecified fields when saving the alert rule', async () => {
      asRole('ADMIN')
      mockedSettingsRepo.findByWorkspace.mockResolvedValue(
        ok(row({ autoCloseAfterHours: 8 })),
      )
      mockedSettingsRepo.upsert.mockResolvedValue(ok(row()))

      expectOk(
        await WhatsAppSettingsService.update('u1', 'ws1', {
          sentimentAlertNotifyEmail: true,
        }),
      )
      expect(mockedSettingsRepo.upsert).toHaveBeenCalledWith(
        'ws1',
        expect.objectContaining({
          autoCloseAfterHours: 8,
          sentimentAlertNotifyEmail: true,
          sentimentAlertThreshold: -0.3,
        }),
      )
    })

    it('should forbid a MEMBER', async () => {
      asRole('MEMBER')
      expectErr(
        await WhatsAppSettingsService.update('u1', 'ws1', {
          autoCloseAfterHours: 1,
        }),
        'FORBIDDEN',
      )
      expect(mockedSettingsRepo.upsert).not.toHaveBeenCalled()
    })
  })

  describe('listAutoCloseWindows()', () => {
    it('should skip disabled workspaces but still exclude them from the default', async () => {
      mockedSettingsRepo.listAll.mockResolvedValue(
        ok([
          row({ workspaceId: 'a', autoCloseAfterHours: 6 }),
          row({ workspaceId: 'b', autoCloseAfterHours: 0 }),
        ]),
      )

      expect(
        expectOk(await WhatsAppSettingsService.listAutoCloseWindows()),
      ).toEqual({
        configured: [{ workspaceId: 'a', hours: 6 }],
        configuredWorkspaceIds: ['a', 'b'],
        defaultHours: 24,
      })
    })
  })
})
