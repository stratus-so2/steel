import { describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { createFakeWhatsAppConnection } from '@/src/__tests__/factories/whatsapp-connection.factory'
import { createFakeWhatsAppTemplate } from '@/src/__tests__/factories/whatsapp-template.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/whatsapp-connection.repository')
vi.mock('@/src/repositories/whatsapp-template.repository')
vi.mock('@/src/lib/crypto', () => ({
  decryptConnectionSecret: vi.fn(async (envelope: string) =>
    envelope.replace(/^enc:/, ''),
  ),
}))
vi.mock('@/src/lib/whatsapp/meta-templates', () => ({
  fetchMetaTemplates: vi.fn(async () => [
    {
      name: 'boas_vindas',
      language: 'pt_BR',
      category: 'MARKETING',
      status: 'APPROVED',
      components: [],
    },
  ]),
}))

import { fetchMetaTemplates } from '@/src/lib/whatsapp/meta-templates'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WhatsAppConnectionRepository } from '@/src/repositories/whatsapp-connection.repository'
import { WhatsAppTemplateRepository } from '@/src/repositories/whatsapp-template.repository'
import { WhatsAppTemplateService } from '../whatsapp-template.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedConnectionRepo = vi.mocked(WhatsAppConnectionRepository)
const mockedTemplateRepo = vi.mocked(WhatsAppTemplateRepository)
const mockedFetchMetaTemplates = vi.mocked(fetchMetaTemplates)

describe('WhatsAppTemplateService', () => {
  describe('sync()', () => {
    it('should sync templates for a META connection', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      const connection = createFakeWhatsAppConnection({
        id: 'conn1',
        provider: 'META',
        metaWabaId: 'waba-1',
        encryptedMetaAccessToken: 'enc:access-token',
      })
      mockedConnectionRepo.findById.mockResolvedValue(ok(connection))
      const synced = createFakeWhatsAppTemplate({ name: 'boas_vindas' })
      mockedTemplateRepo.upsertSynced.mockResolvedValue(ok(synced))

      const result = await WhatsAppTemplateService.sync('u1', 'ws1', 'conn1')

      const dtos = expectOk(result)
      expect(dtos).toHaveLength(1)
      expect(mockedFetchMetaTemplates).toHaveBeenCalledWith({
        wabaId: 'waba-1',
        accessToken: 'access-token',
      })
    })

    it('should reject syncing a Z-API connection', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      const connection = createFakeWhatsAppConnection({
        id: 'conn1',
        provider: 'ZAPI',
      })
      mockedConnectionRepo.findById.mockResolvedValue(ok(connection))

      const result = await WhatsAppTemplateService.sync('u1', 'ws1', 'conn1')

      expectErr(result, 'BAD_REQUEST')
      expect(mockedFetchMetaTemplates).not.toHaveBeenCalled()
    })

    it('should return WHATSAPP_CONNECTION_NOT_FOUND for an unknown connection', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedConnectionRepo.findById.mockResolvedValue(ok(null))

      const result = await WhatsAppTemplateService.sync('u1', 'ws1', 'conn1')

      expectErr(result, 'WHATSAPP_CONNECTION_NOT_FOUND')
    })
  })
})
