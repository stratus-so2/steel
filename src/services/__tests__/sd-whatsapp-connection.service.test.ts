import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSdSettings } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { createFakeWhatsAppConnection } from '@/src/__tests__/factories/whatsapp-connection.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-access.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import type { CreateWhatsAppConnectionDTO } from '@/src/schemas/whatsapp-connection.schema'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-settings.repository')
vi.mock('@/src/repositories/whatsapp-connection.repository')
vi.mock('@/lib/axiom/audit')
vi.mock('../whatsapp-connection-health.service', () => ({
  WhatsAppConnectionHealthService: {
    markDown: vi.fn(async () => ({ ok: true, value: false })),
  },
}))
vi.mock('@/src/lib/crypto', () => ({
  encryptConnectionSecret: vi.fn(async (value: string) => `enc:${value}`),
  decryptConnectionSecret: vi.fn(async (value: string) =>
    value.replace(/^enc:/, ''),
  ),
}))
vi.mock('@/src/lib/whatsapp/zapi-client', () => ({
  createZapiClient: vi.fn(),
}))
vi.mock('@/src/lib/whatsapp/meta-client', () => ({
  createMetaClient: vi.fn(),
}))

import { auditMutation } from '@/lib/axiom/audit'
import { encryptConnectionSecret } from '@/src/lib/crypto'
import { createMetaClient } from '@/src/lib/whatsapp/meta-client'
import { createZapiClient } from '@/src/lib/whatsapp/zapi-client'
import { SdSettingsRepository } from '@/src/repositories/sd-settings.repository'
import { WhatsAppConnectionRepository } from '@/src/repositories/whatsapp-connection.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { SdWhatsappConnectionService } from '../sd-whatsapp-connection.service'
import { WhatsAppConnectionHealthService } from '../whatsapp-connection-health.service'

const connections = vi.mocked(WhatsAppConnectionRepository)
const settings = vi.mocked(SdSettingsRepository)
const moduleAccess = vi.mocked(WorkspaceModuleAccessRepository)
const zapi = vi.mocked(createZapiClient)
const meta = vi.mocked(createMetaClient)
const audit = vi.mocked(auditMutation)
const encrypt = vi.mocked(encryptConnectionSecret)

const WS = 'ws1'
const ADMIN = 'admin-1'

const zapiConnection = (overrides = {}) =>
  createFakeWhatsAppConnection({
    id: 'conn-zapi',
    workspaceId: WS,
    module: 'SERVICE_DESK',
    provider: 'ZAPI',
    zapiInstanceId: 'inst-1',
    encryptedZapiToken: 'enc:tok',
    ...overrides,
  })

const metaConnection = (overrides = {}) =>
  createFakeWhatsAppConnection({
    id: 'conn-meta',
    workspaceId: WS,
    module: 'SERVICE_DESK',
    provider: 'META',
    zapiInstanceId: null,
    encryptedZapiToken: null,
    metaPhoneNumberId: 'pn-1',
    metaWabaId: 'waba-1',
    encryptedMetaAccessToken: 'enc:meta-token',
    ...overrides,
  })

const createZapiDto: CreateWhatsAppConnectionDTO = {
  provider: 'ZAPI',
  label: 'Central',
  phoneNumber: '5511999999999',
  zapiInstanceId: 'inst-1',
  zapiToken: 'tok',
  zapiClientToken: 'client-tok',
}

const createMetaDto: CreateWhatsAppConnectionDTO = {
  provider: 'META',
  label: 'Central Meta',
  phoneNumber: '5511999999999',
  metaPhoneNumberId: 'pn-1',
  metaWabaId: 'waba-1',
  metaAccessToken: 'meta-token',
}

/** Configuração com (ou sem) a conexão ativa do módulo. */
function activeConnection(id: string | null) {
  settings.getOrCreate.mockResolvedValue(
    ok(createFakeSdSettings({ workspaceId: WS, whatsappConnectionId: id })),
  )
}

beforeEach(() => {
  moduleAccess.isEnabled.mockResolvedValue(ok(true))
  actAs('admin')
  activeConnection(null)
  settings.update.mockResolvedValue(ok(createFakeSdSettings()))
  connections.listByWorkspace.mockResolvedValue(ok([]))
  connections.update.mockResolvedValue(ok(zapiConnection()))
  connections.delete.mockResolvedValue(ok(undefined))
})

describe('list()', () => {
  it('lista só as conexões do ServiceDesk e marca a ativa', async () => {
    activeConnection('conn-zapi')
    connections.listByWorkspace.mockResolvedValue(
      ok([zapiConnection(), metaConnection()]),
    )
    const rows = expectOk(await SdWhatsappConnectionService.list(ADMIN, WS))
    expect(connections.listByWorkspace).toHaveBeenCalledWith(WS, 'SERVICE_DESK')
    expect(rows.map((c) => [c.id, c.active])).toEqual([
      ['conn-zapi', true],
      ['conn-meta', false],
    ])
  })

  it('recusa agentes sem permissão de configuração', async () => {
    actAs('agent')
    expectErr(
      await SdWhatsappConnectionService.list('agent-1', WS),
      'FORBIDDEN',
    )
    expect(connections.listByWorkspace).not.toHaveBeenCalled()
  })

  it('recusa quem não é membro e propaga falhas do banco', async () => {
    actAs('non-member')
    expectErr(await SdWhatsappConnectionService.list(ADMIN, WS), 'FORBIDDEN')

    actAs('admin')
    connections.listByWorkspace.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdWhatsappConnectionService.list(ADMIN, WS),
      'DATABASE_ERROR',
    )

    connections.listByWorkspace.mockResolvedValue(ok([]))
    settings.getOrCreate.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdWhatsappConnectionService.list(ADMIN, WS),
      'DATABASE_ERROR',
    )
  })

  it('recusa quando o módulo está desabilitado', async () => {
    moduleAccess.isEnabled.mockResolvedValue(ok(false))
    expectErr(
      await SdWhatsappConnectionService.list(ADMIN, WS),
      'MODULE_DISABLED',
    )
  })
})

describe('create()', () => {
  it('cifra o token da Z-API e promove a primeira conexão a ativa', async () => {
    connections.create.mockResolvedValue(ok(zapiConnection()))
    const dto = expectOk(
      await SdWhatsappConnectionService.create(ADMIN, WS, createZapiDto),
    )
    expect(connections.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WS,
        module: 'SERVICE_DESK',
        provider: 'ZAPI',
        zapiInstanceId: 'inst-1',
        encryptedZapiToken: 'enc:tok',
        encryptedZapiClientToken: 'enc:client-tok',
        createdById: ADMIN,
      }),
    )
    expect(settings.update).toHaveBeenCalledWith(WS, {
      whatsappConnectionId: 'conn-zapi',
      updatedById: ADMIN,
    })
    expect(dto.active).toBe(true)
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', targetId: 'conn-zapi' }),
    )
  })

  it('deixa o client-token nulo quando não informado', async () => {
    connections.create.mockResolvedValue(ok(zapiConnection()))
    const { zapiClientToken: _ignored, ...withoutClientToken } = createZapiDto
    expectOk(
      await SdWhatsappConnectionService.create(
        ADMIN,
        WS,
        withoutClientToken as CreateWhatsAppConnectionDTO,
      ),
    )
    expect(connections.create).toHaveBeenCalledWith(
      expect.objectContaining({ encryptedZapiClientToken: null }),
    )
  })

  it('cifra o access token da Meta e não mexe na conexão ativa existente', async () => {
    activeConnection('conn-zapi')
    connections.create.mockResolvedValue(ok(metaConnection()))
    const dto = expectOk(
      await SdWhatsappConnectionService.create(ADMIN, WS, createMetaDto),
    )
    expect(connections.create).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'META',
        metaPhoneNumberId: 'pn-1',
        metaWabaId: 'waba-1',
        encryptedMetaAccessToken: 'enc:meta-token',
      }),
    )
    expect(settings.update).not.toHaveBeenCalled()
    expect(dto.active).toBe(false)
  })

  it('audita a recusa de quem não é admin', async () => {
    actAs('agent')
    expectErr(
      await SdWhatsappConnectionService.create('agent-1', WS, createZapiDto),
      'FORBIDDEN',
    )
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure', reason: 'FORBIDDEN' }),
    )
    expect(connections.create).not.toHaveBeenCalled()
  })

  it('audita e propaga a falha ao gravar, e a falha ao ler a ativa', async () => {
    connections.create.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdWhatsappConnectionService.create(ADMIN, WS, createZapiDto),
      'DATABASE_ERROR',
    )
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'failure',
        reason: 'DATABASE_ERROR',
      }),
    )

    connections.create.mockResolvedValue(ok(zapiConnection()))
    settings.getOrCreate.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdWhatsappConnectionService.create(ADMIN, WS, createZapiDto),
      'DATABASE_ERROR',
    )
  })

  it('propaga a falha ao promover a primeira conexão', async () => {
    connections.create.mockResolvedValue(ok(zapiConnection()))
    settings.update.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdWhatsappConnectionService.create(ADMIN, WS, createZapiDto),
      'DATABASE_ERROR',
    )
  })
})

describe('update()', () => {
  it('renomeia e recifra cada credencial informada', async () => {
    activeConnection('conn-zapi')
    connections.findById.mockResolvedValue(ok(zapiConnection()))
    const dto = expectOk(
      await SdWhatsappConnectionService.update(ADMIN, WS, 'conn-zapi', {
        label: 'Novo nome',
        zapiToken: 'novo-tok',
        zapiClientToken: 'novo-client',
        metaAccessToken: 'novo-meta',
      }),
    )
    expect(connections.update).toHaveBeenCalledWith('conn-zapi', {
      label: 'Novo nome',
      encryptedZapiToken: 'enc:novo-tok',
      encryptedZapiClientToken: 'enc:novo-client',
      encryptedMetaAccessToken: 'enc:novo-meta',
    })
    expect(dto.active).toBe(true)
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'update', targetId: 'conn-zapi' }),
    )
  })

  it('não cifra nada quando nenhuma credencial muda', async () => {
    connections.findById.mockResolvedValue(ok(zapiConnection()))
    expectOk(
      await SdWhatsappConnectionService.update(ADMIN, WS, 'conn-zapi', {}),
    )
    expect(encrypt).not.toHaveBeenCalled()
    expect(connections.update).toHaveBeenCalledWith('conn-zapi', {})
  })

  it('recusa conexão de outro módulo/workspace e exige admin', async () => {
    connections.findById.mockResolvedValue(ok(null))
    expectErr(
      await SdWhatsappConnectionService.update(ADMIN, WS, 'outra', {}),
      'WHATSAPP_CONNECTION_NOT_FOUND',
    )

    actAs('agent')
    expectErr(
      await SdWhatsappConnectionService.update('agent-1', WS, 'conn-zapi', {}),
      'FORBIDDEN',
    )
  })

  it('propaga falhas de leitura, escrita e da configuração', async () => {
    connections.findById.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdWhatsappConnectionService.update(ADMIN, WS, 'conn-zapi', {}),
      'DATABASE_ERROR',
    )

    connections.findById.mockResolvedValue(ok(zapiConnection()))
    connections.update.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdWhatsappConnectionService.update(ADMIN, WS, 'conn-zapi', {}),
      'DATABASE_ERROR',
    )

    connections.update.mockResolvedValue(ok(zapiConnection()))
    settings.getOrCreate.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdWhatsappConnectionService.update(ADMIN, WS, 'conn-zapi', {}),
      'DATABASE_ERROR',
    )
  })
})

describe('remove()', () => {
  it('limpa a conexão ativa antes de excluir', async () => {
    activeConnection('conn-zapi')
    connections.findById.mockResolvedValue(ok(zapiConnection()))
    expectOk(await SdWhatsappConnectionService.remove(ADMIN, WS, 'conn-zapi'))
    expect(settings.update).toHaveBeenCalledWith(WS, {
      whatsappConnectionId: null,
      updatedById: ADMIN,
    })
    expect(connections.delete).toHaveBeenCalledWith('conn-zapi')
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delete', targetId: 'conn-zapi' }),
    )
  })

  it('não mexe na configuração quando a conexão não era a ativa', async () => {
    activeConnection('outra')
    connections.findById.mockResolvedValue(ok(zapiConnection()))
    expectOk(await SdWhatsappConnectionService.remove(ADMIN, WS, 'conn-zapi'))
    expect(settings.update).not.toHaveBeenCalled()
  })

  it('exige admin e conexão do módulo', async () => {
    actAs('agent')
    expectErr(
      await SdWhatsappConnectionService.remove('agent-1', WS, 'conn-zapi'),
      'FORBIDDEN',
    )

    actAs('admin')
    connections.findById.mockResolvedValue(ok(null))
    expectErr(
      await SdWhatsappConnectionService.remove(ADMIN, WS, 'conn-zapi'),
      'WHATSAPP_CONNECTION_NOT_FOUND',
    )
  })

  it('propaga falhas ao ler a ativa, ao limpá-la e ao excluir', async () => {
    connections.findById.mockResolvedValue(ok(zapiConnection()))
    settings.getOrCreate.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdWhatsappConnectionService.remove(ADMIN, WS, 'conn-zapi'),
      'DATABASE_ERROR',
    )

    activeConnection('conn-zapi')
    settings.update.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdWhatsappConnectionService.remove(ADMIN, WS, 'conn-zapi'),
      'DATABASE_ERROR',
    )

    settings.update.mockResolvedValue(ok(createFakeSdSettings()))
    connections.delete.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdWhatsappConnectionService.remove(ADMIN, WS, 'conn-zapi'),
      'DATABASE_ERROR',
    )
  })
})

describe('test()', () => {
  it('marca CONNECTED quando a Z-API confirma o número', async () => {
    connections.findById.mockResolvedValue(ok(zapiConnection()))
    zapi.mockReturnValue({
      getConnectionStatus: vi.fn(async () => ({ connected: true })),
    } as never)

    const result = expectOk(
      await SdWhatsappConnectionService.test(ADMIN, WS, 'conn-zapi'),
    )
    expect(result).toEqual({
      connected: true,
      status: 'CONNECTED',
      error: null,
    })
    expect(zapi).toHaveBeenCalledWith({
      instanceId: 'inst-1',
      token: 'tok',
      clientToken: undefined,
    })
    expect(connections.update).toHaveBeenCalledWith('conn-zapi', {
      status: 'CONNECTED',
      statusError: null,
    })
  })

  it('decifra também o client-token quando existe', async () => {
    connections.findById.mockResolvedValue(
      ok(zapiConnection({ encryptedZapiClientToken: 'enc:client' })),
    )
    zapi.mockReturnValue({
      getConnectionStatus: vi.fn(async () => ({ connected: true })),
    } as never)
    expectOk(await SdWhatsappConnectionService.test(ADMIN, WS, 'conn-zapi'))
    expect(zapi).toHaveBeenCalledWith(
      expect.objectContaining({ clientToken: 'client' }),
    )
  })

  it('marca DISCONNECTED quando o provedor nega a conexão', async () => {
    connections.findById.mockResolvedValue(ok(metaConnection()))
    meta.mockReturnValue({
      getConnectionStatus: vi.fn(async () => ({ connected: false })),
    } as never)

    const result = expectOk(
      await SdWhatsappConnectionService.test(ADMIN, WS, 'conn-meta'),
    )
    expect(result).toEqual({
      connected: false,
      status: 'DISCONNECTED',
      error: 'O provedor informou que o número não está conectado',
    })
    expect(meta).toHaveBeenCalledWith({
      phoneNumberId: 'pn-1',
      wabaId: 'waba-1',
      accessToken: 'meta-token',
    })
  })

  it('marca ERROR quando o provedor lança', async () => {
    connections.findById.mockResolvedValue(ok(metaConnection()))
    meta.mockReturnValue({
      getConnectionStatus: vi.fn(async () => {
        throw new Error('401 Unauthorized')
      }),
    } as never)

    const result = expectOk(
      await SdWhatsappConnectionService.test(ADMIN, WS, 'conn-meta'),
    )
    expect(result).toMatchObject({
      connected: false,
      status: 'ERROR',
      error: '401 Unauthorized',
    })
  })

  it('marca ERROR quando faltam credenciais em cada provedor', async () => {
    connections.findById.mockResolvedValue(
      ok(zapiConnection({ encryptedZapiToken: null })),
    )
    expect(
      expectOk(await SdWhatsappConnectionService.test(ADMIN, WS, 'conn-zapi'))
        .error,
    ).toBe('Conexão Z-API sem credenciais configuradas')

    connections.findById.mockResolvedValue(
      ok(metaConnection({ encryptedMetaAccessToken: null })),
    )
    expect(
      expectOk(await SdWhatsappConnectionService.test(ADMIN, WS, 'conn-meta'))
        .error,
    ).toBe('Conexão Meta sem credenciais configuradas')
  })

  it('descreve falhas que não são `Error`', async () => {
    connections.findById.mockResolvedValue(ok(metaConnection()))
    meta.mockReturnValue({
      getConnectionStatus: vi.fn(async () => {
        throw 'pane'
      }),
    } as never)
    expect(
      expectOk(await SdWhatsappConnectionService.test(ADMIN, WS, 'conn-meta'))
        .error,
    ).toBe('Falha ao testar a conexão')
  })

  it('exige admin, conexão existente e propaga a falha ao salvar o status', async () => {
    actAs('agent')
    expectErr(
      await SdWhatsappConnectionService.test('agent-1', WS, 'conn-zapi'),
      'FORBIDDEN',
    )

    actAs('admin')
    connections.findById.mockResolvedValue(ok(null))
    expectErr(
      await SdWhatsappConnectionService.test(ADMIN, WS, 'conn-zapi'),
      'WHATSAPP_CONNECTION_NOT_FOUND',
    )

    connections.findById.mockResolvedValue(ok(zapiConnection()))
    zapi.mockReturnValue({
      getConnectionStatus: vi.fn(async () => ({ connected: true })),
    } as never)
    connections.update.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdWhatsappConnectionService.test(ADMIN, WS, 'conn-zapi'),
      'DATABASE_ERROR',
    )
  })
})

describe('qrCode()', () => {
  it('devolve o QR e sincroniza o status da conexão', async () => {
    connections.findById.mockResolvedValue(
      ok(zapiConnection({ status: 'DISCONNECTED' })),
    )
    zapi.mockReturnValue({
      getQrCode: vi.fn(async () => ({
        status: 'awaiting_scan' as const,
        qrCodeBase64: 'data:image/png;base64,abc',
      })),
    } as never)

    const qr = expectOk(
      await SdWhatsappConnectionService.qrCode(ADMIN, WS, 'conn-zapi'),
    )
    expect(qr.qrCodeBase64).toBe('data:image/png;base64,abc')
    expect(connections.update).toHaveBeenCalledWith('conn-zapi', {
      status: 'CONNECTING',
    })
  })

  it('não regrava o status quando já bate com o do provedor', async () => {
    connections.findById.mockResolvedValue(
      ok(zapiConnection({ status: 'CONNECTED' })),
    )
    zapi.mockReturnValue({
      getQrCode: vi.fn(async () => ({ status: 'connected' as const })),
    } as never)

    expect(
      expectOk(await SdWhatsappConnectionService.qrCode(ADMIN, WS, 'conn-zapi'))
        .status,
    ).toBe('connected')
    expect(connections.update).not.toHaveBeenCalled()
  })

  it('recusa Meta, credenciais faltando e falha do provedor', async () => {
    connections.findById.mockResolvedValue(ok(metaConnection()))
    expect(
      expectErr(
        await SdWhatsappConnectionService.qrCode(ADMIN, WS, 'conn-meta'),
        'BAD_REQUEST',
      ).message,
    ).toBe('QR code está disponível apenas para conexões Z-API')

    connections.findById.mockResolvedValue(
      ok(zapiConnection({ zapiInstanceId: null })),
    )
    expect(
      expectErr(
        await SdWhatsappConnectionService.qrCode(ADMIN, WS, 'conn-zapi'),
        'BAD_REQUEST',
      ).message,
    ).toBe('Conexão Z-API sem credenciais configuradas')

    connections.findById.mockResolvedValue(ok(zapiConnection()))
    zapi.mockReturnValue({
      getQrCode: vi.fn(async () => {
        throw new Error('instância offline')
      }),
    } as never)
    expect(
      expectErr(
        await SdWhatsappConnectionService.qrCode(ADMIN, WS, 'conn-zapi'),
        'BAD_REQUEST',
      ).message,
    ).toBe('instância offline')

    zapi.mockReturnValue({
      getQrCode: vi.fn(async () => {
        throw 'pane'
      }),
    } as never)
    expect(
      expectErr(
        await SdWhatsappConnectionService.qrCode(ADMIN, WS, 'conn-zapi'),
        'BAD_REQUEST',
      ).message,
    ).toBe('Falha ao obter o QR code')
  })

  it('exige admin e conexão do módulo', async () => {
    actAs('agent')
    expectErr(
      await SdWhatsappConnectionService.qrCode('agent-1', WS, 'conn-zapi'),
      'FORBIDDEN',
    )

    actAs('admin')
    connections.findById.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdWhatsappConnectionService.qrCode(ADMIN, WS, 'conn-zapi'),
      'DATABASE_ERROR',
    )
  })
})

describe('test() · connection lost notice', () => {
  const markDown = vi.mocked(WhatsAppConnectionHealthService.markDown)

  beforeEach(() => markDown.mockClear())

  it('hands a failing test to the health service (notifies once per drop)', async () => {
    const connection = metaConnection()
    connections.findById.mockResolvedValue(ok(connection))
    meta.mockReturnValue({
      getConnectionStatus: vi.fn(async () => ({ connected: false })),
    } as never)
    expectOk(await SdWhatsappConnectionService.test(ADMIN, WS, 'conn-meta'))
    expect(markDown).toHaveBeenCalledWith(connection, {
      status: 'DISCONNECTED',
      error: 'O provedor informou que o número não está conectado',
      source: 'test',
      actorId: ADMIN,
    })
  })

  it('never calls it for a healthy connection', async () => {
    connections.findById.mockResolvedValue(ok(metaConnection()))
    meta.mockReturnValue({
      getConnectionStatus: vi.fn(async () => ({ connected: true })),
    } as never)
    expectOk(await SdWhatsappConnectionService.test(ADMIN, WS, 'conn-meta'))
    expect(markDown).not.toHaveBeenCalled()
  })

  it('propagates a failure to record the status', async () => {
    connections.findById.mockResolvedValue(ok(metaConnection()))
    meta.mockReturnValue({
      getConnectionStatus: vi.fn(async () => ({ connected: false })),
    } as never)
    markDown.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdWhatsappConnectionService.test(ADMIN, WS, 'conn-meta'),
      'DATABASE_ERROR',
    )
  })
})
