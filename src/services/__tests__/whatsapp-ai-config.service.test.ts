import { describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { createFakeWhatsAppAiConfig } from '@/src/__tests__/factories/whatsapp-ai-config.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/whatsapp-ai-config.repository')
vi.mock('@/src/lib/crypto', () => ({
  encryptConnectionSecret: vi.fn(async (plain: string) => `enc:${plain}`),
  decryptConnectionSecret: vi.fn(async (envelope: string) =>
    envelope.replace(/^enc:/, ''),
  ),
}))

import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WhatsAppAiConfigRepository } from '@/src/repositories/whatsapp-ai-config.repository'
import { WhatsAppAiConfigService } from '../whatsapp-ai-config.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedAiConfigRepo = vi.mocked(WhatsAppAiConfigRepository)

describe('WhatsAppAiConfigService', () => {
  describe('get()', () => {
    it('should return null when no config exists yet', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'OWNER' })),
      )
      mockedAiConfigRepo.findByWorkspace.mockResolvedValue(ok(null))

      const result = await WhatsAppAiConfigService.get('u1', 'ws1')

      expect(expectOk(result)).toBeNull()
    })

    it('should reject a plain MEMBER from reading the AI config', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )

      const result = await WhatsAppAiConfigService.get('u1', 'ws1')

      expectErr(result, 'FORBIDDEN')
    })
  })

  describe('save()', () => {
    it('should encrypt the OpenAI key on first save', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'OWNER' })),
      )
      mockedAiConfigRepo.findByWorkspace.mockResolvedValue(ok(null))
      const saved = createFakeWhatsAppAiConfig({ workspaceId: 'ws1' })
      mockedAiConfigRepo.upsert.mockResolvedValue(ok(saved))

      const result = await WhatsAppAiConfigService.save('u1', 'ws1', {
        openaiApiKey: 'sk-test',
        active: true,
      })

      expectOk(result)
      expect(mockedAiConfigRepo.upsert).toHaveBeenCalledWith(
        'ws1',
        expect.objectContaining({ encryptedOpenaiApiKey: 'enc:sk-test' }),
      )
    })

    it('should reuse the existing encrypted key when none is provided in the update', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'OWNER' })),
      )
      const existing = createFakeWhatsAppAiConfig({
        workspaceId: 'ws1',
        encryptedOpenaiApiKey: 'enc:existing-key',
        active: false,
      })
      mockedAiConfigRepo.findByWorkspace.mockResolvedValue(ok(existing))
      mockedAiConfigRepo.upsert.mockResolvedValue(
        ok({ ...existing, active: true }),
      )

      const result = await WhatsAppAiConfigService.save('u1', 'ws1', {
        active: true,
      })

      expectOk(result)
      expect(mockedAiConfigRepo.upsert).toHaveBeenCalledWith(
        'ws1',
        expect.objectContaining({ encryptedOpenaiApiKey: 'enc:existing-key' }),
      )
    })

    it('should reject activating the AI without ever having configured a key', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'OWNER' })),
      )
      mockedAiConfigRepo.findByWorkspace.mockResolvedValue(ok(null))

      const result = await WhatsAppAiConfigService.save('u1', 'ws1', {
        active: true,
      })

      expectErr(result, 'BAD_REQUEST')
      expect(mockedAiConfigRepo.upsert).not.toHaveBeenCalled()
    })
  })
})
