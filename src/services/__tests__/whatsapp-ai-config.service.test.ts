import { describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { createFakeWhatsAppAiConfig } from '@/src/__tests__/factories/whatsapp-ai-config.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { err, ok } from '@/src/lib/result'

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

    it('should activate the AI without a workspace key (platform keys are used)', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'OWNER' })),
      )
      mockedAiConfigRepo.findByWorkspace.mockResolvedValue(ok(null))
      mockedAiConfigRepo.upsert.mockResolvedValue(
        ok(
          createFakeWhatsAppAiConfig({
            workspaceId: 'ws1',
            encryptedOpenaiApiKey: null,
            active: true,
          }),
        ),
      )

      const result = await WhatsAppAiConfigService.save('u1', 'ws1', {
        active: true,
      })

      expect(expectOk(result).active).toBe(true)
      expect(mockedAiConfigRepo.upsert).toHaveBeenCalledWith(
        'ws1',
        expect.objectContaining({ encryptedOpenaiApiKey: null, active: true }),
      )
    })
  })
})

describe('WhatsAppAiConfigService failure paths and fallbacks', () => {
  const DB_ERROR = { code: 'DATABASE_ERROR' as const, message: 'db down' }

  function asOwner() {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'OWNER' })),
    )
  }

  it('get() should return the saved config as a DTO', async () => {
    asOwner()
    mockedAiConfigRepo.findByWorkspace.mockResolvedValue(
      ok(createFakeWhatsAppAiConfig({ workspaceId: 'ws1', active: true })),
    )

    const dto = expectOk(await WhatsAppAiConfigService.get('u1', 'ws1'))

    expect(dto).toEqual(expect.objectContaining({ active: true }))
  })

  it('get() should propagate a lookup failure', async () => {
    asOwner()
    mockedAiConfigRepo.findByWorkspace.mockResolvedValue(err(DB_ERROR))

    expectErr(await WhatsAppAiConfigService.get('u1', 'ws1'), 'DATABASE_ERROR')
  })

  it('save() should reject a plain MEMBER', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'MEMBER' })),
    )

    expectErr(
      await WhatsAppAiConfigService.save('u1', 'ws1', { active: true }),
      'FORBIDDEN',
    )
    expect(mockedAiConfigRepo.upsert).not.toHaveBeenCalled()
  })

  it('save() should propagate a lookup failure', async () => {
    asOwner()
    mockedAiConfigRepo.findByWorkspace.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await WhatsAppAiConfigService.save('u1', 'ws1', { active: true }),
      'DATABASE_ERROR',
    )
  })

  it('save() should keep the stored flags when the update omits them', async () => {
    asOwner()
    const existing = createFakeWhatsAppAiConfig({
      workspaceId: 'ws1',
      active: true,
      readMedia: true,
    })
    mockedAiConfigRepo.findByWorkspace.mockResolvedValue(ok(existing))
    mockedAiConfigRepo.upsert.mockResolvedValue(ok(existing))

    expectOk(
      await WhatsAppAiConfigService.save('u1', 'ws1', {
        systemPrompt: 'Novo prompt',
      }),
    )

    expect(mockedAiConfigRepo.upsert).toHaveBeenCalledWith(
      'ws1',
      expect.objectContaining({
        systemPrompt: 'Novo prompt',
        active: true,
        readMedia: true,
      }),
    )
  })

  it('save() should default to inactive for a brand-new config', async () => {
    asOwner()
    mockedAiConfigRepo.findByWorkspace.mockResolvedValue(ok(null))
    mockedAiConfigRepo.upsert.mockResolvedValue(
      ok(createFakeWhatsAppAiConfig({ workspaceId: 'ws1' })),
    )

    expectOk(await WhatsAppAiConfigService.save('u1', 'ws1', {}))

    expect(mockedAiConfigRepo.upsert).toHaveBeenCalledWith(
      'ws1',
      expect.objectContaining({
        encryptedOpenaiApiKey: null,
        model: 'gpt-4o-mini',
        active: false,
        readMedia: false,
      }),
    )
  })

  it('save() should propagate an upsert failure', async () => {
    asOwner()
    mockedAiConfigRepo.findByWorkspace.mockResolvedValue(ok(null))
    mockedAiConfigRepo.upsert.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await WhatsAppAiConfigService.save('u1', 'ws1', { active: true }),
      'DATABASE_ERROR',
    )
  })
})
