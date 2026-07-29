import { describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { createFakeWhatsAppBroadcastListWithRecipients } from '@/src/__tests__/factories/whatsapp-broadcast.factory'
import { createFakeWhatsAppConnection } from '@/src/__tests__/factories/whatsapp-connection.factory'
import { createFakeWhatsAppContact } from '@/src/__tests__/factories/whatsapp-contact.factory'
import { createFakeWhatsAppTemplate } from '@/src/__tests__/factories/whatsapp-template.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/whatsapp-connection.repository')
vi.mock('@/src/repositories/whatsapp-template.repository')
vi.mock('@/src/repositories/whatsapp-contact.repository')
vi.mock('@/src/repositories/whatsapp-broadcast.repository')

import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WhatsAppBroadcastRepository } from '@/src/repositories/whatsapp-broadcast.repository'
import { WhatsAppConnectionRepository } from '@/src/repositories/whatsapp-connection.repository'
import { WhatsAppContactRepository } from '@/src/repositories/whatsapp-contact.repository'
import { WhatsAppTemplateRepository } from '@/src/repositories/whatsapp-template.repository'
import { WhatsAppBroadcastImportService } from '../whatsapp-broadcast-import.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedConnectionRepo = vi.mocked(WhatsAppConnectionRepository)
const mockedTemplateRepo = vi.mocked(WhatsAppTemplateRepository)
const mockedContactRepo = vi.mocked(WhatsAppContactRepository)
const mockedBroadcastRepo = vi.mocked(WhatsAppBroadcastRepository)

const validCsv = [
  'telefone,nome,data_referencia,var_1',
  '11987654321,Maria,2026-08-15T09:00:00.000Z,Maria',
].join('\n')

function mockHappyPathDeps() {
  mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role: 'MEMBER' })),
  )
  mockedConnectionRepo.findById.mockResolvedValue(
    ok(createFakeWhatsAppConnection({ id: 'conn1' })),
  )
  mockedTemplateRepo.findById.mockResolvedValue(
    ok(
      createFakeWhatsAppTemplate({
        id: 'tmpl1',
        status: 'APPROVED',
        components: [{ type: 'BODY', text: 'Olá {{1}}' }],
      }),
    ),
  )
  mockedContactRepo.upsertByWaId.mockResolvedValue(
    ok(createFakeWhatsAppContact({ id: 'contact1' })),
  )
  mockedBroadcastRepo.createScheduled.mockResolvedValue(
    ok(createFakeWhatsAppBroadcastListWithRecipients({ id: 'list1' }, 1)),
  )
}

describe('WhatsAppBroadcastImportService.import()', () => {
  it('should create a scheduled broadcast from a valid csv', async () => {
    mockHappyPathDeps()

    const result = await WhatsAppBroadcastImportService.import('u1', 'ws1', {
      name: 'Lembretes',
      connectionId: 'conn1',
      templateId: 'tmpl1',
      sendOffsetHours: 24,
      csv: validCsv,
    })

    const dto = expectOk(result)
    expect(dto.createdCount).toBe(1)
    expect(dto.rejectedRows).toEqual([])
    expect(dto.broadcastList?.id).toBe('list1')
    expect(mockedBroadcastRepo.createScheduled).toHaveBeenCalledWith(
      expect.objectContaining({ connectionId: 'conn1', templateId: 'tmpl1' }),
      [
        expect.objectContaining({
          contactId: 'contact1',
          variableValues: { body: { '1': 'Maria' } },
        }),
      ],
    )
  })

  it('should return WHATSAPP_CONNECTION_NOT_FOUND when the connection does not exist', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'MEMBER' })),
    )
    mockedConnectionRepo.findById.mockResolvedValue(ok(null))

    const result = await WhatsAppBroadcastImportService.import('u1', 'ws1', {
      name: 'Lembretes',
      connectionId: 'conn1',
      templateId: 'tmpl1',
      sendOffsetHours: 24,
      csv: validCsv,
    })

    expectErr(result, 'WHATSAPP_CONNECTION_NOT_FOUND')
  })

  it('should return WHATSAPP_TEMPLATE_NOT_FOUND when the template does not exist', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'MEMBER' })),
    )
    mockedConnectionRepo.findById.mockResolvedValue(
      ok(createFakeWhatsAppConnection({ id: 'conn1' })),
    )
    mockedTemplateRepo.findById.mockResolvedValue(ok(null))

    const result = await WhatsAppBroadcastImportService.import('u1', 'ws1', {
      name: 'Lembretes',
      connectionId: 'conn1',
      templateId: 'tmpl1',
      sendOffsetHours: 24,
      csv: validCsv,
    })

    expectErr(result, 'WHATSAPP_TEMPLATE_NOT_FOUND')
  })

  it('should return WHATSAPP_TEMPLATE_NOT_APPROVED for a non-approved template', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'MEMBER' })),
    )
    mockedConnectionRepo.findById.mockResolvedValue(
      ok(createFakeWhatsAppConnection({ id: 'conn1' })),
    )
    mockedTemplateRepo.findById.mockResolvedValue(
      ok(createFakeWhatsAppTemplate({ id: 'tmpl1', status: 'PENDING' })),
    )

    const result = await WhatsAppBroadcastImportService.import('u1', 'ws1', {
      name: 'Lembretes',
      connectionId: 'conn1',
      templateId: 'tmpl1',
      sendOffsetHours: 24,
      csv: validCsv,
    })

    expectErr(result, 'WHATSAPP_TEMPLATE_NOT_APPROVED')
  })

  it('should return BAD_REQUEST when the csv is malformed', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'MEMBER' })),
    )
    mockedConnectionRepo.findById.mockResolvedValue(
      ok(createFakeWhatsAppConnection({ id: 'conn1' })),
    )
    mockedTemplateRepo.findById.mockResolvedValue(
      ok(createFakeWhatsAppTemplate({ id: 'tmpl1', status: 'APPROVED' })),
    )

    const result = await WhatsAppBroadcastImportService.import('u1', 'ws1', {
      name: 'Lembretes',
      connectionId: 'conn1',
      templateId: 'tmpl1',
      sendOffsetHours: 24,
      csv: 'nome,var_1\nMaria,x',
    })

    expectErr(result, 'BAD_REQUEST')
  })

  it('should return a partial result (no broadcast created) when every row is rejected', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'MEMBER' })),
    )
    mockedConnectionRepo.findById.mockResolvedValue(
      ok(createFakeWhatsAppConnection({ id: 'conn1' })),
    )
    mockedTemplateRepo.findById.mockResolvedValue(
      ok(
        createFakeWhatsAppTemplate({
          id: 'tmpl1',
          status: 'APPROVED',
          components: [{ type: 'BODY', text: 'Olá {{1}}' }],
        }),
      ),
    )

    const invalidCsv = [
      'telefone,data_referencia,var_1',
      'abc,2026-08-15,Maria',
    ].join('\n')

    const result = await WhatsAppBroadcastImportService.import('u1', 'ws1', {
      name: 'Lembretes',
      connectionId: 'conn1',
      templateId: 'tmpl1',
      sendOffsetHours: 24,
      csv: invalidCsv,
    })

    const dto = expectOk(result)
    expect(dto.broadcastList).toBeNull()
    expect(dto.createdCount).toBe(0)
    expect(dto.rejectedRows).toHaveLength(1)
    expect(mockedBroadcastRepo.createScheduled).not.toHaveBeenCalled()
  })
})
