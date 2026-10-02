import { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeSdContract,
  createFakeSdContractPeriod,
  createFakeSdContractRate,
} from '@/src/__tests__/factories/sd-contract.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-access.helpers'
import { databaseError, sdContractNotFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import {
  CreateSdContractSchema,
  UpdateSdContractSchema,
} from '@/src/schemas/sd-contract.schema'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-contract.repository')
vi.mock('@/src/repositories/sd-contract-period.repository')
vi.mock('@/lib/axiom/audit')
vi.mock('../sd-contract-billing.service', () => ({
  SdContractBillingService: {
    ensureOpenPeriod: vi.fn(),
    consolidate: vi.fn(),
    runTick: vi.fn(),
  },
}))

import { auditMutation } from '@/lib/axiom/audit'
import { SdContractRepository } from '@/src/repositories/sd-contract.repository'
import { SdContractPeriodRepository } from '@/src/repositories/sd-contract-period.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { SdContractService } from '../sd-contract.service'
import { SdContractBillingService } from '../sd-contract-billing.service'

const repo = vi.mocked(SdContractRepository)
const periods = vi.mocked(SdContractPeriodRepository)
const billing = vi.mocked(SdContractBillingService)
const moduleAccess = vi.mocked(WorkspaceModuleAccessRepository)
const audit = vi.mocked(auditMutation)

const WS = 'ws1'
const ADMIN = 'admin-1'
const AGENT = 'agent-1'

const createDto = CreateSdContractSchema.parse({
  customerId: 'cus1',
  name: 'Suporte 20 h',
  status: 'ACTIVE',
  startsAt: '2026-01-01T00:00:00.000Z',
  includedMinutes: 1200,
  hourlyRate: '150,00',
  overtimeRate: 200,
  roundingMinutes: 15,
  minimumMinutes: 30,
  rates: [{ hourlyRate: '300', window: 'AFTER_HOURS', multiplier: 1.5 }],
})

beforeEach(() => {
  moduleAccess.isEnabled.mockResolvedValue(ok(true))
  actAs('admin')
  repo.list.mockResolvedValue(ok([]))
  repo.findById.mockResolvedValue(ok(createFakeSdContract()))
  repo.validateRefs.mockResolvedValue(ok([]))
  repo.findOverlapping.mockResolvedValue(ok(null))
  repo.create.mockResolvedValue(ok(createFakeSdContract()))
  repo.update.mockResolvedValue(ok(createFakeSdContract()))
  repo.softDelete.mockResolvedValue(ok(undefined))
  periods.listByContract.mockResolvedValue(ok([]))
  periods.findById.mockResolvedValue(ok(createFakeSdContractPeriod()))
  periods.findByStart.mockResolvedValue(ok(createFakeSdContractPeriod()))
  billing.ensureOpenPeriod.mockResolvedValue(ok(createFakeSdContractPeriod()))
  billing.consolidate.mockResolvedValue(
    ok(
      createFakeSdContractPeriod({
        status: 'CLOSED',
        amount: new Prisma.Decimal('250'),
        overageMinutes: 60,
      }),
    ),
  )
})

describe('list / get', () => {
  it('lista os contratos do workspace para um agente', async () => {
    actAs('agent')
    repo.list.mockResolvedValue(
      ok([createFakeSdContract({ rates: [createFakeSdContractRate()] })]),
    )
    const rows = expectOk(
      await SdContractService.list(AGENT, WS, { status: 'ACTIVE' }),
    )
    expect(repo.list).toHaveBeenCalledWith(WS, { status: 'ACTIVE' })
    expect(rows[0].rates).toHaveLength(1)
    expect(rows[0].hourlyRate).toBe('150.00')
  })

  it('recusa solicitante e quem não é do workspace', async () => {
    actAs('requester')
    expectErr(await SdContractService.list(AGENT, WS), 'SD_NOT_AGENT')
    actAs('non-member')
    expectErr(await SdContractService.list(AGENT, WS), 'FORBIDDEN')
    expect(repo.list).not.toHaveBeenCalled()
  })

  it('recusa quando o módulo está desligado', async () => {
    moduleAccess.isEnabled.mockResolvedValue(ok(false))
    expectErr(await SdContractService.list(ADMIN, WS), 'MODULE_DISABLED')
  })

  it('propaga erro de banco na lista e no get', async () => {
    repo.list.mockResolvedValue(err(databaseError()))
    expectErr(await SdContractService.list(ADMIN, WS), 'DATABASE_ERROR')
    repo.findById.mockResolvedValue(err(sdContractNotFound()))
    expectErr(
      await SdContractService.get(ADMIN, WS, 'nope'),
      'SD_CONTRACT_NOT_FOUND',
    )
  })

  it('devolve o contrato pelo id', async () => {
    const dto = expectOk(await SdContractService.get(AGENT, WS, 'ct1'))
    expect(dto.id).toBe('ct1')
  })
})

describe('create', () => {
  it('cria com a tabela de valores, abre o período e audita', async () => {
    const dto = expectOk(await SdContractService.create(ADMIN, WS, createDto))
    expect(dto.id).toBe('ct1')
    const [, , fields, rates] = repo.create.mock.calls[0]
    expect(fields).toMatchObject({
      customerId: 'cus1',
      hourlyRate: '150.00',
      overtimeRate: '200.00',
      roundingMinutes: 15,
      minimumMinutes: 30,
      slaPolicyId: null,
      notes: null,
      code: null,
      endsAt: null,
    })
    expect(rates).toEqual([
      {
        ticketType: null,
        priorityId: null,
        window: 'AFTER_HOURS',
        hourlyRate: '300.00',
        multiplier: '1.50',
      },
    ])
    expect(billing.ensureOpenPeriod).toHaveBeenCalled()
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'sd_contract', action: 'create' }),
    )
  })

  it('não abre período para contrato em rascunho', async () => {
    repo.create.mockResolvedValue(ok(createFakeSdContract({ status: 'DRAFT' })))
    expectOk(
      await SdContractService.create(
        ADMIN,
        WS,
        CreateSdContractSchema.parse({
          customerId: 'cus1',
          name: 'Rascunho',
          startsAt: '2026-01-01T00:00:00.000Z',
        }),
      ),
    )
    expect(billing.ensureOpenPeriod).not.toHaveBeenCalled()
    expect(repo.findOverlapping).not.toHaveBeenCalled()
  })

  it('segue mesmo quando a abertura do período falha', async () => {
    billing.ensureOpenPeriod.mockResolvedValue(err(databaseError()))
    expectOk(await SdContractService.create(ADMIN, WS, createDto))
    expect(repo.create).toHaveBeenCalled()
  })

  it('recusa vigência sobreposta de outro contrato ativo', async () => {
    repo.findOverlapping.mockResolvedValue(
      ok({ id: 'ct-antigo', name: 'Contrato antigo' }),
    )
    const error = expectErr(
      await SdContractService.create(ADMIN, WS, createDto),
      'SD_CONTRACT_OVERLAP',
    )
    expect(error.message).toContain('Contrato antigo')
    expect(repo.create).not.toHaveBeenCalled()
  })

  it.each([
    ['customerId', 'Cliente não encontrado'],
    ['slaPolicyId', 'Política de SLA não encontrada'],
    ['priorityId', 'Prioridade não encontrada na tabela de valores'],
  ])('recusa referência inexistente (%s)', async (missing, message) => {
    repo.validateRefs.mockResolvedValue(ok([missing]))
    const error = expectErr(
      await SdContractService.create(ADMIN, WS, createDto),
      'VALIDATION_ERROR',
    )
    expect(error.message).toBe(message)
  })

  it('recusa referência desconhecida com mensagem genérica', async () => {
    repo.validateRefs.mockResolvedValue(ok(['outraCoisa']))
    const error = expectErr(
      await SdContractService.create(ADMIN, WS, createDto),
      'VALIDATION_ERROR',
    )
    expect(error.message).toBe('Dados inválidos')
  })

  it('recusa agente sem perfil de admin', async () => {
    actAs('agent')
    expectErr(await SdContractService.create(AGENT, WS, createDto), 'FORBIDDEN')
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('propaga erro de banco da validação, da criação e da releitura', async () => {
    repo.validateRefs.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdContractService.create(ADMIN, WS, createDto),
      'DATABASE_ERROR',
    )

    repo.validateRefs.mockResolvedValue(ok([]))
    repo.findOverlapping.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdContractService.create(ADMIN, WS, createDto),
      'DATABASE_ERROR',
    )

    repo.findOverlapping.mockResolvedValue(ok(null))
    repo.create.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdContractService.create(ADMIN, WS, createDto),
      'DATABASE_ERROR',
    )

    repo.create.mockResolvedValue(ok(createFakeSdContract()))
    repo.findById.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdContractService.create(ADMIN, WS, createDto),
      'DATABASE_ERROR',
    )
  })
})

describe('update', () => {
  it('atualiza os campos e substitui a tabela de valores', async () => {
    const dto = UpdateSdContractSchema.parse({
      name: 'Novo nome',
      code: null,
      endsAt: null,
      overtimeRate: null,
      slaPolicyId: null,
      notes: null,
      rates: [{ hourlyRate: '90' }],
    })
    expectOk(await SdContractService.update(ADMIN, WS, 'ct1', dto))
    const [id, fields, rates] = repo.update.mock.calls[0]
    expect(id).toBe('ct1')
    expect(fields).toMatchObject({
      name: 'Novo nome',
      code: null,
      endsAt: null,
      overtimeRate: null,
      slaPolicyId: null,
      notes: null,
    })
    expect(rates).toHaveLength(1)
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'sd_contract', action: 'update' }),
    )
  })

  it('mantém a tabela de valores quando `rates` não vem', async () => {
    expectOk(
      await SdContractService.update(
        ADMIN,
        WS,
        'ct1',
        UpdateSdContractSchema.parse({ includedMinutes: 600 }),
      ),
    )
    expect(repo.update.mock.calls[0][2]).toBeUndefined()
  })

  it('checa sobreposição com os valores já salvos quando o contrato é ativo', async () => {
    repo.findById.mockResolvedValue(
      ok(
        createFakeSdContract({
          status: 'ACTIVE',
          customerId: 'cus1',
          startsAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      ),
    )
    expectOk(
      await SdContractService.update(
        ADMIN,
        WS,
        'ct1',
        UpdateSdContractSchema.parse({ name: 'x' }),
      ),
    )
    expect(repo.findOverlapping).toHaveBeenCalledWith({
      workspaceId: WS,
      customerId: 'cus1',
      startsAt: new Date('2026-01-01T00:00:00.000Z'),
      endsAt: null,
      excludeId: 'ct1',
    })
  })

  it('não checa sobreposição ao suspender o contrato', async () => {
    expectOk(
      await SdContractService.update(
        ADMIN,
        WS,
        'ct1',
        UpdateSdContractSchema.parse({ status: 'SUSPENDED' }),
      ),
    )
    expect(repo.findOverlapping).not.toHaveBeenCalled()
  })

  it('recusa término anterior ao início já salvo', async () => {
    repo.findById.mockResolvedValue(
      ok(
        createFakeSdContract({
          startsAt: new Date('2026-06-01T00:00:00.000Z'),
        }),
      ),
    )
    expectErr(
      await SdContractService.update(
        ADMIN,
        WS,
        'ct1',
        UpdateSdContractSchema.parse({ endsAt: '2026-01-01T00:00:00.000Z' }),
      ),
      'VALIDATION_ERROR',
    )
    expect(repo.update).not.toHaveBeenCalled()
  })

  it('recusa agente e propaga erro de banco', async () => {
    actAs('agent')
    expectErr(
      await SdContractService.update(
        AGENT,
        WS,
        'ct1',
        UpdateSdContractSchema.parse({ name: 'x' }),
      ),
      'FORBIDDEN',
    )

    actAs('admin')
    repo.findById.mockResolvedValue(err(sdContractNotFound()))
    expectErr(
      await SdContractService.update(
        ADMIN,
        WS,
        'ct1',
        UpdateSdContractSchema.parse({ name: 'x' }),
      ),
      'SD_CONTRACT_NOT_FOUND',
    )

    repo.findById.mockResolvedValue(ok(createFakeSdContract()))
    repo.validateRefs.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdContractService.update(
        ADMIN,
        WS,
        'ct1',
        UpdateSdContractSchema.parse({ name: 'x' }),
      ),
      'DATABASE_ERROR',
    )

    repo.validateRefs.mockResolvedValue(ok([]))
    repo.update.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdContractService.update(
        ADMIN,
        WS,
        'ct1',
        UpdateSdContractSchema.parse({ name: 'x' }),
      ),
      'DATABASE_ERROR',
    )
  })
})

describe('remove', () => {
  it('exclui logicamente e audita', async () => {
    expectOk(await SdContractService.remove(ADMIN, WS, 'ct1'))
    expect(repo.softDelete).toHaveBeenCalledWith('ct1')
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'sd_contract', action: 'delete' }),
    )
  })

  it('recusa agente, contrato inexistente e erro de banco', async () => {
    actAs('agent')
    expectErr(await SdContractService.remove(AGENT, WS, 'ct1'), 'FORBIDDEN')

    actAs('admin')
    repo.findById.mockResolvedValue(err(sdContractNotFound()))
    expectErr(
      await SdContractService.remove(ADMIN, WS, 'ct1'),
      'SD_CONTRACT_NOT_FOUND',
    )

    repo.findById.mockResolvedValue(ok(createFakeSdContract()))
    repo.softDelete.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdContractService.remove(ADMIN, WS, 'ct1'),
      'DATABASE_ERROR',
    )
  })
})

describe('listPeriods', () => {
  it('devolve o histórico de períodos do contrato', async () => {
    periods.listByContract.mockResolvedValue(
      ok([createFakeSdContractPeriod({ usedMinutes: 90 })]),
    )
    const rows = expectOk(await SdContractService.listPeriods(AGENT, WS, 'ct1'))
    expect(rows[0].usedMinutes).toBe(90)
  })

  it('recusa solicitante e propaga erros', async () => {
    actAs('requester')
    expectErr(
      await SdContractService.listPeriods(AGENT, WS, 'ct1'),
      'SD_NOT_AGENT',
    )

    actAs('agent')
    repo.findById.mockResolvedValue(err(sdContractNotFound()))
    expectErr(
      await SdContractService.listPeriods(AGENT, WS, 'ct1'),
      'SD_CONTRACT_NOT_FOUND',
    )

    repo.findById.mockResolvedValue(ok(createFakeSdContract()))
    periods.listByContract.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdContractService.listPeriods(AGENT, WS, 'ct1'),
      'DATABASE_ERROR',
    )
  })
})

describe('closePeriod', () => {
  it('fecha o período corrente, consolidando e auditando', async () => {
    const dto = expectOk(
      await SdContractService.closePeriod(ADMIN, WS, 'ct1', {}),
    )
    expect(dto.status).toBe('CLOSED')
    expect(dto.amount).toBe('250.00')
    expect(billing.ensureOpenPeriod).toHaveBeenCalled()
    expect(billing.consolidate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ct1' }),
      expect.objectContaining({ id: 'per1' }),
      { close: true, closedById: ADMIN },
    )
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'sd_contract_period' }),
    )
  })

  it('fecha um período informado pelo id', async () => {
    expectOk(
      await SdContractService.closePeriod(ADMIN, WS, 'ct1', {
        periodId: 'per9',
      }),
    )
    expect(periods.findById).toHaveBeenCalledWith('per9', 'ct1')
    expect(billing.ensureOpenPeriod).not.toHaveBeenCalled()
  })

  it('recusa período já fechado', async () => {
    periods.findById.mockResolvedValue(
      ok(createFakeSdContractPeriod({ status: 'CLOSED' })),
    )
    expectErr(
      await SdContractService.closePeriod(ADMIN, WS, 'ct1', {
        periodId: 'per9',
      }),
      'SD_CONTRACT_PERIOD_CLOSED',
    )
    expect(billing.consolidate).not.toHaveBeenCalled()
  })

  it('usa o período corrente quando o dto vem vazio', async () => {
    expectOk(await SdContractService.closePeriod(ADMIN, WS, 'ct1'))
    expect(billing.ensureOpenPeriod).toHaveBeenCalled()
  })

  it('recusa agente e propaga erros', async () => {
    actAs('agent')
    expectErr(
      await SdContractService.closePeriod(AGENT, WS, 'ct1', {}),
      'FORBIDDEN',
    )

    actAs('admin')
    repo.findById.mockResolvedValue(err(sdContractNotFound()))
    expectErr(
      await SdContractService.closePeriod(ADMIN, WS, 'ct1', {}),
      'SD_CONTRACT_NOT_FOUND',
    )

    repo.findById.mockResolvedValue(ok(createFakeSdContract()))
    billing.ensureOpenPeriod.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdContractService.closePeriod(ADMIN, WS, 'ct1', {}),
      'DATABASE_ERROR',
    )

    billing.ensureOpenPeriod.mockResolvedValue(ok(createFakeSdContractPeriod()))
    billing.consolidate.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdContractService.closePeriod(ADMIN, WS, 'ct1', {}),
      'DATABASE_ERROR',
    )
  })
})

describe('summaryForCustomer', () => {
  it('devolve o contrato vigente e o consumo do período', async () => {
    repo.list.mockResolvedValue(
      ok([
        createFakeSdContract({
          startsAt: new Date('2026-01-01T00:00:00.000Z'),
          endsAt: null,
        }),
      ]),
    )
    periods.findByStart.mockResolvedValue(
      ok(
        createFakeSdContractPeriod({
          includedMinutes: 1200,
          billableMinutes: 300,
        }),
      ),
    )
    const dto = expectOk(
      await SdContractService.summaryForCustomer(AGENT, WS, 'cus1'),
    )
    expect(repo.list).toHaveBeenCalledWith(WS, {
      customerId: 'cus1',
      status: 'ACTIVE',
    })
    expect(dto.contract?.id).toBe('ct1')
    expect(dto.percentUsed).toBe(25)
  })

  it('cliente sem contrato vigente devolve tudo nulo', async () => {
    repo.list.mockResolvedValue(ok([]))
    const dto = expectOk(
      await SdContractService.summaryForCustomer(AGENT, WS, 'cus1'),
    )
    expect(dto).toEqual({ contract: null, period: null, percentUsed: null })
    expect(periods.findByStart).not.toHaveBeenCalled()
  })

  it('ignora contrato que ainda não começou ou já terminou', async () => {
    repo.list.mockResolvedValue(
      ok([
        createFakeSdContract({
          startsAt: new Date('2099-01-01T00:00:00.000Z'),
        }),
      ]),
    )
    expect(
      expectOk(await SdContractService.summaryForCustomer(AGENT, WS, 'cus1'))
        .contract,
    ).toBeNull()

    repo.list.mockResolvedValue(
      ok([
        createFakeSdContract({ endsAt: new Date('2020-01-01T00:00:00.000Z') }),
      ]),
    )
    expect(
      expectOk(await SdContractService.summaryForCustomer(AGENT, WS, 'cus1'))
        .contract,
    ).toBeNull()
  })

  it('período ainda não aberto não impede o resumo', async () => {
    repo.list.mockResolvedValue(ok([createFakeSdContract()]))
    periods.findByStart.mockResolvedValue(ok(null))
    const dto = expectOk(
      await SdContractService.summaryForCustomer(AGENT, WS, 'cus1'),
    )
    expect(dto.period).toBeNull()
    expect(dto.percentUsed).toBeNull()
  })

  it('recusa solicitante e propaga erros', async () => {
    actAs('requester')
    expectErr(
      await SdContractService.summaryForCustomer(AGENT, WS, 'cus1'),
      'SD_NOT_AGENT',
    )

    actAs('agent')
    repo.list.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdContractService.summaryForCustomer(AGENT, WS, 'cus1'),
      'DATABASE_ERROR',
    )

    repo.list.mockResolvedValue(ok([createFakeSdContract()]))
    periods.findByStart.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdContractService.summaryForCustomer(AGENT, WS, 'cus1'),
      'DATABASE_ERROR',
    )
  })
})
