import { describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { createFakeWhatsAppConnection } from '@/src/__tests__/factories/whatsapp-connection.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import type { AppError } from '@/src/errors/app-error'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/whatsapp-connection.repository')
vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/src/lib/crypto', () => ({
  encryptConnectionSecret: vi.fn(async (plain: string) => `enc:${plain}`),
  decryptConnectionSecret: vi.fn(async (envelope: string) =>
    envelope.replace(/^enc:/, ''),
  ),
}))
vi.mock('@/src/lib/whatsapp/zapi-client', () => ({
  createZapiClient: vi.fn(),
}))

import { auditMutation } from '@/lib/axiom/audit'
import { createZapiClient } from '@/src/lib/whatsapp/zapi-client'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WhatsAppConnectionRepository } from '@/src/repositories/whatsapp-connection.repository'
import { WhatsAppConnectionService } from '../whatsapp-connection.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedConnectionRepo = vi.mocked(WhatsAppConnectionRepository)
const mockedCreateZapiClient = vi.mocked(createZapiClient)

const DB_ERROR: AppError = { code: 'DATABASE_ERROR', message: 'db down' }

function asRole(role: 'ADMIN' | 'MEMBER') {
  mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role })),
  )
}

function zapiConnection(
  overrides: Parameters<typeof createFakeWhatsAppConnection>[0] = {},
) {
  return createFakeWhatsAppConnection({
    id: 'conn1',
    workspaceId: 'ws1',
    provider: 'ZAPI',
    status: 'DISCONNECTED',
    zapiInstanceId: 'instance-1',
    encryptedZapiToken: 'enc:token',
    encryptedZapiClientToken: null,
    ...overrides,
  })
}

function stubQr(qr: { status: string; qrCodeBase64?: string }) {
  const getQrCode = vi.fn(async () => qr)
  mockedCreateZapiClient.mockReturnValue({ getQrCode } as never)
  return getQrCode
}

describe('WhatsAppConnectionService.list()', () => {
  it('should propagate a repository failure', async () => {
    asRole('MEMBER')
    mockedConnectionRepo.listByWorkspace.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await WhatsAppConnectionService.list('u1', 'ws1'),
      'DATABASE_ERROR',
    )
  })
})

describe('WhatsAppConnectionService.create()', () => {
  it('should encrypt the optional Z-API client token', async () => {
    asRole('ADMIN')
    mockedConnectionRepo.create.mockResolvedValue(ok(zapiConnection()))

    expectOk(
      await WhatsAppConnectionService.create('u1', 'ws1', {
        provider: 'ZAPI',
        label: 'Suporte',
        phoneNumber: '5511999999999',
        zapiInstanceId: 'instance-1',
        zapiToken: 'raw-token',
        zapiClientToken: 'client-token',
      }),
    )

    expect(mockedConnectionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        encryptedZapiToken: 'enc:raw-token',
        encryptedZapiClientToken: 'enc:client-token',
      }),
    )
  })

  it('should encrypt the Meta access token for a Cloud API connection', async () => {
    asRole('ADMIN')
    mockedConnectionRepo.create.mockResolvedValue(
      ok(createFakeWhatsAppConnection({ id: 'meta1', provider: 'META' })),
    )

    const created = expectOk(
      await WhatsAppConnectionService.create('u1', 'ws1', {
        provider: 'META',
        label: 'Vendas',
        phoneNumber: '5511988887777',
        metaPhoneNumberId: 'pn-1',
        metaWabaId: 'waba-1',
        metaAccessToken: 'meta-token',
      }),
    )

    expect(created.id).toBe('meta1')
    expect(mockedConnectionRepo.create).toHaveBeenCalledWith({
      workspaceId: 'ws1',
      provider: 'META',
      label: 'Vendas',
      phoneNumber: '5511988887777',
      createdById: 'u1',
      metaPhoneNumberId: 'pn-1',
      metaWabaId: 'waba-1',
      encryptedMetaAccessToken: 'enc:meta-token',
    })
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create',
        targetId: 'meta1',
        meta: { provider: 'META' },
      }),
    )
  })
})

describe('WhatsAppConnectionService.update()', () => {
  it('should return FORBIDDEN for a plain member', async () => {
    asRole('MEMBER')

    expectErr(
      await WhatsAppConnectionService.update('u1', 'ws1', 'conn1', {
        label: 'Novo',
      }),
      'FORBIDDEN',
    )
    expect(mockedConnectionRepo.findById).not.toHaveBeenCalled()
  })

  it('should propagate a lookup failure', async () => {
    asRole('ADMIN')
    mockedConnectionRepo.findById.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await WhatsAppConnectionService.update('u1', 'ws1', 'conn1', {
        label: 'Novo',
      }),
      'DATABASE_ERROR',
    )
  })

  it('should return WHATSAPP_CONNECTION_NOT_FOUND when missing', async () => {
    asRole('ADMIN')
    mockedConnectionRepo.findById.mockResolvedValue(ok(null))

    expectErr(
      await WhatsAppConnectionService.update('u1', 'ws1', 'conn1', {
        label: 'Novo',
      }),
      'WHATSAPP_CONNECTION_NOT_FOUND',
    )
  })

  it('should encrypt every provided secret and audit the changed fields', async () => {
    asRole('ADMIN')
    mockedConnectionRepo.findById.mockResolvedValue(ok(zapiConnection()))
    mockedConnectionRepo.update.mockResolvedValue(
      ok(zapiConnection({ label: 'Novo' })),
    )

    const dto = expectOk(
      await WhatsAppConnectionService.update('u1', 'ws1', 'conn1', {
        label: 'Novo',
        zapiToken: 't2',
        zapiClientToken: 'c2',
        metaAccessToken: 'm2',
      }),
    )

    expect(dto.label).toBe('Novo')
    expect(mockedConnectionRepo.update).toHaveBeenCalledWith('conn1', {
      label: 'Novo',
      encryptedZapiToken: 'enc:t2',
      encryptedZapiClientToken: 'enc:c2',
      encryptedMetaAccessToken: 'enc:m2',
    })
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        targetId: 'conn1',
        meta: {
          fields: ['label', 'zapiToken', 'zapiClientToken', 'metaAccessToken'],
        },
      }),
    )
  })

  it('should send an empty patch when nothing changes', async () => {
    asRole('ADMIN')
    mockedConnectionRepo.findById.mockResolvedValue(ok(zapiConnection()))
    mockedConnectionRepo.update.mockResolvedValue(ok(zapiConnection()))

    expectOk(await WhatsAppConnectionService.update('u1', 'ws1', 'conn1', {}))

    expect(mockedConnectionRepo.update).toHaveBeenCalledWith('conn1', {})
  })

  it('should audit and propagate an update failure', async () => {
    asRole('ADMIN')
    mockedConnectionRepo.findById.mockResolvedValue(ok(zapiConnection()))
    mockedConnectionRepo.update.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await WhatsAppConnectionService.update('u1', 'ws1', 'conn1', {
        label: 'Novo',
      }),
      'DATABASE_ERROR',
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        outcome: 'failure',
        reason: 'DATABASE_ERROR',
      }),
    )
  })
})

describe('WhatsAppConnectionService.remove()', () => {
  it('should return FORBIDDEN for a plain member', async () => {
    asRole('MEMBER')

    expectErr(
      await WhatsAppConnectionService.remove('u1', 'ws1', 'conn1'),
      'FORBIDDEN',
    )
  })

  it('should propagate a lookup failure', async () => {
    asRole('ADMIN')
    mockedConnectionRepo.findById.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await WhatsAppConnectionService.remove('u1', 'ws1', 'conn1'),
      'DATABASE_ERROR',
    )
    expect(mockedConnectionRepo.delete).not.toHaveBeenCalled()
  })
})

describe('WhatsAppConnectionService.getQrCode()', () => {
  it('should return FORBIDDEN for a plain member', async () => {
    asRole('MEMBER')

    expectErr(
      await WhatsAppConnectionService.getQrCode('u1', 'ws1', 'conn1'),
      'FORBIDDEN',
    )
  })

  it('should propagate a lookup failure', async () => {
    asRole('ADMIN')
    mockedConnectionRepo.findById.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await WhatsAppConnectionService.getQrCode('u1', 'ws1', 'conn1'),
      'DATABASE_ERROR',
    )
  })

  it('should return WHATSAPP_CONNECTION_NOT_FOUND when missing', async () => {
    asRole('ADMIN')
    mockedConnectionRepo.findById.mockResolvedValue(ok(null))

    expectErr(
      await WhatsAppConnectionService.getQrCode('u1', 'ws1', 'conn1'),
      'WHATSAPP_CONNECTION_NOT_FOUND',
    )
  })

  it.each([
    ['instance id', { zapiInstanceId: null }],
    ['token', { encryptedZapiToken: null }],
  ])('should reject a Z-API connection without %s', async (_label, overrides) => {
    asRole('ADMIN')
    mockedConnectionRepo.findById.mockResolvedValue(
      ok(zapiConnection(overrides)),
    )

    const error = expectErr(
      await WhatsAppConnectionService.getQrCode('u1', 'ws1', 'conn1'),
      'BAD_REQUEST',
    )
    expect(error.message).toBe('Conexão Z-API sem credenciais configuradas')
    expect(mockedCreateZapiClient).not.toHaveBeenCalled()
  })

  it('should mark the connection CONNECTED once the instance reports it', async () => {
    asRole('ADMIN')
    mockedConnectionRepo.findById.mockResolvedValue(
      ok(zapiConnection({ encryptedZapiClientToken: 'enc:client' })),
    )
    stubQr({ status: 'connected' })

    expect(
      expectOk(await WhatsAppConnectionService.getQrCode('u1', 'ws1', 'conn1')),
    ).toEqual({ status: 'connected' })

    expect(mockedCreateZapiClient).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      token: 'token',
      clientToken: 'client',
    })
    expect(mockedConnectionRepo.update).toHaveBeenCalledWith('conn1', {
      status: 'CONNECTED',
    })
  })

  it('should not rewrite the status when it is unchanged', async () => {
    asRole('ADMIN')
    mockedConnectionRepo.findById.mockResolvedValue(
      ok(zapiConnection({ status: 'CONNECTING' })),
    )
    stubQr({ status: 'awaiting_scan', qrCodeBase64: 'data:image/png;base64,x' })

    expectOk(await WhatsAppConnectionService.getQrCode('u1', 'ws1', 'conn1'))

    expect(mockedConnectionRepo.update).not.toHaveBeenCalled()
  })
})
