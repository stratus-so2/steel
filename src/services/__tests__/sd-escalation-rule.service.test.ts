import type { SdEscalationRule } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-config.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { SdEscalationActionsSchema } from '@/src/schemas/sd-rule.schema'

vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-config.repository')
vi.mock('@/src/repositories/sd-escalation-rule.repository')

import { auditMutation } from '@/lib/axiom/audit'
import { SdConfigRepository } from '@/src/repositories/sd-config.repository'
import { SdEscalationRuleRepository } from '@/src/repositories/sd-escalation-rule.repository'
import { SdEscalationRuleService } from '../sd-escalation-rule.service'

const repo = vi.mocked(SdEscalationRuleRepository)
const refs = vi.mocked(SdConfigRepository.findExistingRefs)
const WS = 'ws1'
const actions = SdEscalationActionsSchema.parse({ notifyUserIds: ['u9'] })

function rule(overrides: Partial<SdEscalationRule> = {}): SdEscalationRule {
  const now = new Date()
  return {
    id: 'r1',
    workspaceId: WS,
    name: 'Risco',
    trigger: 'RESOLUTION_AT_RISK',
    thresholdMinutes: null,
    conditions: [],
    actions,
    active: true,
    position: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

beforeEach(() => {
  actAs('owner')
  refs.mockImplementation(async (_ws, wanted) => ok(wanted))
})

describe('SdEscalationRuleService.list', () => {
  it('lists for agents', async () => {
    actAs('agent')
    repo.list.mockResolvedValue(ok([rule()]))
    const list = expectOk(await SdEscalationRuleService.list('u1', WS))
    expect(list[0]).toMatchObject({ id: 'r1', trigger: 'RESOLUTION_AT_RISK' })
  })

  it('refuses requesters', async () => {
    actAs('requester')
    expectErr(await SdEscalationRuleService.list('u1', WS), 'SD_NOT_AGENT')
  })

  it('propagates db errors', async () => {
    repo.list.mockResolvedValue(err(databaseError()))
    expectErr(await SdEscalationRuleService.list('u1', WS), 'DATABASE_ERROR')
  })
})

describe('SdEscalationRuleService.create', () => {
  const dto = {
    name: 'Sem atualização',
    trigger: 'NO_UPDATE' as const,
    thresholdMinutes: 60,
    conditions: [],
    actions,
    active: true,
  }

  it.each([
    ['requester', 'FORBIDDEN'],
    ['agent', 'FORBIDDEN'],
    ['viewer', 'FORBIDDEN'],
    ['stranger', 'FORBIDDEN'],
    ['disabled', 'MODULE_DISABLED'],
  ] as const)('denies %s', async (actor, code) => {
    actAs(actor)
    expectErr(await SdEscalationRuleService.create('u1', WS, dto), code)
  })

  it('creates a NO_UPDATE rule keeping the threshold', async () => {
    repo.create.mockResolvedValue(
      ok(rule({ trigger: 'NO_UPDATE', thresholdMinutes: 60 })),
    )
    expectOk(await SdEscalationRuleService.create('u1', WS, dto))
    expect(repo.create).toHaveBeenCalledWith(
      WS,
      expect.objectContaining({ thresholdMinutes: 60 }),
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_escalation_rule',
        action: 'create',
        targetId: 'r1',
      }),
    )
  })

  it('drops the threshold on other triggers and defaults null', async () => {
    repo.create.mockResolvedValue(ok(rule()))
    expectOk(
      await SdEscalationRuleService.create('u1', WS, {
        ...dto,
        trigger: 'RESOLUTION_BREACHED',
      }),
    )
    expect(repo.create).toHaveBeenLastCalledWith(
      WS,
      expect.objectContaining({ thresholdMinutes: null }),
    )
    expectOk(
      await SdEscalationRuleService.create('u1', WS, {
        ...dto,
        thresholdMinutes: undefined,
      }),
    )
    expect(repo.create).toHaveBeenLastCalledWith(
      WS,
      expect.objectContaining({ thresholdMinutes: null }),
    )
  })

  it('refuses users outside the workspace', async () => {
    refs.mockResolvedValue(ok({ userIds: [], departmentIds: [] }))
    expectErr(
      await SdEscalationRuleService.create('u1', WS, dto),
      'SD_CONFIG_NOT_FOUND',
    )
  })

  it('propagates create errors', async () => {
    repo.create.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdEscalationRuleService.create('u1', WS, dto),
      'DATABASE_ERROR',
    )
  })
})

describe('SdEscalationRuleService.update', () => {
  it('updates using the stored trigger/threshold', async () => {
    repo.findById.mockResolvedValue(
      ok(rule({ trigger: 'NO_UPDATE', thresholdMinutes: 30 })),
    )
    repo.update.mockResolvedValue(ok(rule({ name: 'Novo' })))
    expectOk(
      await SdEscalationRuleService.update('u1', WS, 'r1', { name: 'Novo' }),
    )
    expect(repo.update).toHaveBeenCalledWith(
      'r1',
      WS,
      expect.objectContaining({ thresholdMinutes: 30 }),
    )
  })

  it('clears the threshold when switching away from NO_UPDATE', async () => {
    repo.findById.mockResolvedValue(
      ok(rule({ trigger: 'NO_UPDATE', thresholdMinutes: 30 })),
    )
    repo.update.mockResolvedValue(ok(rule()))
    expectOk(
      await SdEscalationRuleService.update('u1', WS, 'r1', {
        trigger: 'RESOLUTION_AT_RISK',
        actions,
      }),
    )
    expect(repo.update).toHaveBeenCalledWith(
      'r1',
      WS,
      expect.objectContaining({ thresholdMinutes: null }),
    )
  })

  it('requires a threshold for NO_UPDATE', async () => {
    repo.findById.mockResolvedValue(ok(rule()))
    expectErr(
      await SdEscalationRuleService.update('u1', WS, 'r1', {
        trigger: 'NO_UPDATE',
      }),
      'VALIDATION_ERROR',
    )
    repo.findById.mockResolvedValue(
      ok(rule({ trigger: 'NO_UPDATE', thresholdMinutes: 30 })),
    )
    expectErr(
      await SdEscalationRuleService.update('u1', WS, 'r1', {
        thresholdMinutes: null,
      }),
      'VALIDATION_ERROR',
    )
  })

  it('validates referenced ids and propagates errors', async () => {
    repo.findById.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdEscalationRuleService.update('u1', WS, 'r1', { name: 'x' }),
      'DATABASE_ERROR',
    )
    repo.findById.mockResolvedValue(ok(rule()))
    refs.mockResolvedValue(ok({ userIds: [] }))
    expectErr(
      await SdEscalationRuleService.update('u1', WS, 'r1', { actions }),
      'SD_CONFIG_NOT_FOUND',
    )
    refs.mockImplementation(async (_ws, wanted) => ok(wanted))
    repo.update.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdEscalationRuleService.update('u1', WS, 'r1', { name: 'x' }),
      'DATABASE_ERROR',
    )
  })

  it('denies non-admins', async () => {
    actAs('agent')
    expectErr(
      await SdEscalationRuleService.update('u1', WS, 'r1', { name: 'x' }),
      'FORBIDDEN',
    )
  })
})

describe('SdEscalationRuleService.remove/reorder', () => {
  it('removes an existing rule', async () => {
    repo.findById.mockResolvedValue(ok(rule()))
    repo.delete.mockResolvedValue(ok(undefined))
    expectOk(await SdEscalationRuleService.remove('u1', WS, 'r1'))
    expect(repo.delete).toHaveBeenCalledWith('r1', WS)
  })

  it('propagates not found on remove', async () => {
    repo.findById.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdEscalationRuleService.remove('u1', WS, 'r1'),
      'DATABASE_ERROR',
    )
  })

  it('reorders and denies non-admins', async () => {
    repo.reorder.mockResolvedValue(ok(undefined))
    expectOk(await SdEscalationRuleService.reorder('u1', WS, ['r1']))
    expect(repo.reorder).toHaveBeenCalledWith(WS, ['r1'])
    actAs('requester')
    expectErr(
      await SdEscalationRuleService.reorder('u1', WS, ['r1']),
      'FORBIDDEN',
    )
    expectErr(await SdEscalationRuleService.remove('u1', WS, 'r1'), 'FORBIDDEN')
  })
})
