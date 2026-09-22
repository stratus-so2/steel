import type { SdAutomationRule } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-config.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import type { SdAutomationAction } from '@/src/schemas/sd-rule.schema'

vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-config.repository')
vi.mock('@/src/repositories/sd-automation-rule.repository')

import { auditMutation } from '@/lib/axiom/audit'
import { SdAutomationRuleRepository } from '@/src/repositories/sd-automation-rule.repository'
import { SdConfigRepository } from '@/src/repositories/sd-config.repository'
import { SdAutomationRuleService } from '../sd-automation-rule.service'

const repo = vi.mocked(SdAutomationRuleRepository)
const refs = vi.mocked(SdConfigRepository.findExistingRefs)
const WS = 'ws1'

const actions: SdAutomationAction[] = [
  { type: 'assign_department', params: { departmentId: 'd1' } },
  { type: 'round_robin', params: { departmentId: 'd2' } },
  { type: 'round_robin', params: {} },
  { type: 'assign_user', params: { userId: 'u2' } },
  { type: 'add_participant', params: { userId: 'u3' } },
  {
    type: 'notify',
    params: {
      userIds: ['u4'],
      assignee: false,
      requester: false,
      departmentLeads: true,
      email: false,
      title: 'Oi',
      message: '',
    },
  },
  { type: 'create_task', params: { title: 't', assigneeId: 'u5' } },
  { type: 'create_task', params: { title: 't2' } },
  { type: 'apply_template', params: { templateId: 'tpl1' } },
  {
    type: 'escalate',
    params: {
      kind: 'FUNCTIONAL',
      toDepartmentId: 'd3',
      toUserId: 'u6',
      reason: 'r',
    },
  },
  { type: 'escalate', params: { kind: 'HIERARCHICAL', reason: 'r' } },
  { type: 'add_tag', params: { tag: 'vip' } },
]

function rule(overrides: Partial<SdAutomationRule> = {}): SdAutomationRule {
  const now = new Date()
  return {
    id: 'a1',
    workspaceId: WS,
    name: 'Regra',
    description: null,
    event: 'TICKET_CREATED',
    conditions: [],
    actions,
    stopProcessing: false,
    active: true,
    position: 0,
    runCount: 2,
    lastRunAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

beforeEach(() => {
  actAs('admin')
  refs.mockImplementation(async (_ws, wanted) => ok(wanted))
})

describe('SdAutomationRuleService.list', () => {
  it('lists for agents with the event filter', async () => {
    actAs('lead')
    repo.list.mockResolvedValue(ok([rule()]))
    const list = expectOk(
      await SdAutomationRuleService.list('u1', WS, { event: 'TICKET_CREATED' }),
    )
    expect(list[0].runCount).toBe(2)
    expect(repo.list).toHaveBeenCalledWith(WS, { event: 'TICKET_CREATED' })
    expectOk(await SdAutomationRuleService.list('u1', WS))
    expect(repo.list).toHaveBeenLastCalledWith(WS, {})
  })

  it('refuses requesters and propagates errors', async () => {
    actAs('requester')
    expectErr(await SdAutomationRuleService.list('u1', WS), 'SD_NOT_AGENT')
    actAs('owner')
    repo.list.mockResolvedValue(err(databaseError()))
    expectErr(await SdAutomationRuleService.list('u1', WS), 'DATABASE_ERROR')
  })
})

describe('SdAutomationRuleService.create', () => {
  const dto = {
    name: 'Regra',
    event: 'TICKET_CREATED' as const,
    conditions: [],
    actions,
    stopProcessing: false,
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
    expectErr(await SdAutomationRuleService.create('u1', WS, dto), code)
  })

  it('validates every referenced id and creates', async () => {
    repo.create.mockResolvedValue(ok(rule()))
    expectOk(await SdAutomationRuleService.create('u1', WS, dto))
    expect(refs).toHaveBeenCalledWith(WS, {
      departmentIds: ['d1', 'd2', 'd3'],
      userIds: ['u2', 'u3', 'u4', 'u5', 'u6'],
      templateIds: ['tpl1'],
    })
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'sd_automation_rule', targetId: 'a1' }),
    )
  })

  it('refuses a foreign template', async () => {
    refs.mockImplementation(async (_ws, wanted) =>
      ok({ ...wanted, templateIds: [] }),
    )
    const e = expectErr(
      await SdAutomationRuleService.create('u1', WS, dto),
      'SD_CONFIG_NOT_FOUND',
    )
    expect(e.details).toEqual({
      missing: [{ kind: 'templateIds', id: 'tpl1' }],
    })
  })

  it('propagates create errors', async () => {
    repo.create.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdAutomationRuleService.create('u1', WS, dto),
      'DATABASE_ERROR',
    )
  })
})

describe('SdAutomationRuleService.update/remove/reorder', () => {
  it('updates without actions (no refs to check)', async () => {
    repo.findById.mockResolvedValue(ok(rule()))
    repo.update.mockResolvedValue(ok(rule({ active: false })))
    const updated = expectOk(
      await SdAutomationRuleService.update('u1', WS, 'a1', { active: false }),
    )
    expect(updated.active).toBe(false)
    expect(refs).not.toHaveBeenCalled()
  })

  it('validates actions on update and propagates errors', async () => {
    repo.findById.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdAutomationRuleService.update('u1', WS, 'a1', { active: false }),
      'DATABASE_ERROR',
    )
    repo.findById.mockResolvedValue(ok(rule()))
    refs.mockResolvedValue(ok({}))
    expectErr(
      await SdAutomationRuleService.update('u1', WS, 'a1', { actions }),
      'SD_CONFIG_NOT_FOUND',
    )
    refs.mockImplementation(async (_ws, wanted) => ok(wanted))
    repo.update.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdAutomationRuleService.update('u1', WS, 'a1', { actions }),
      'DATABASE_ERROR',
    )
  })

  it('removes and reorders', async () => {
    repo.findById.mockResolvedValue(ok(rule()))
    repo.delete.mockResolvedValue(ok(undefined))
    expectOk(await SdAutomationRuleService.remove('u1', WS, 'a1'))
    repo.findById.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdAutomationRuleService.remove('u1', WS, 'a1'),
      'DATABASE_ERROR',
    )
    repo.reorder.mockResolvedValue(ok(undefined))
    expectOk(await SdAutomationRuleService.reorder('u1', WS, ['a1']))
    expect(repo.reorder).toHaveBeenCalledWith(WS, ['a1'])
  })

  it('denies non-admins', async () => {
    actAs('agent')
    expectErr(
      await SdAutomationRuleService.update('u1', WS, 'a1', { active: false }),
      'FORBIDDEN',
    )
    expectErr(await SdAutomationRuleService.remove('u1', WS, 'a1'), 'FORBIDDEN')
    expectErr(
      await SdAutomationRuleService.reorder('u1', WS, ['a1']),
      'FORBIDDEN',
    )
  })
})
