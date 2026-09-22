import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeSdEscalation,
  createFakeSdTicket,
} from '@/src/__tests__/factories/sd-ticket.factory'
import {
  createFakeSdEscalationRule,
  createFakeSdSettings,
} from '@/src/__tests__/factories/sd-ticket-context.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { DEFAULT_SD_TICKET_PREFIXES } from '@/src/lib/servicedesk/ticket-code'
import type { SdTicketWithRelations } from '@/src/repositories/sd-ticket.repository'

vi.mock('@/src/repositories/sd-ticket-context.repository')
vi.mock('@/src/repositories/sd-ticket-escalation.repository')
vi.mock('@/src/services/sd-ticket-notifier')
vi.mock('@/src/services/sd-ticket-event-recorder', async (orig) => ({
  ...(await orig<typeof import('../sd-ticket-event-recorder')>()),
  recordSdTicketEvent: vi.fn(async () => ({ ok: true, value: 1 })),
}))
vi.mock('@/src/services/sd-ticket-engine', async (orig) => ({
  ...(await orig<typeof import('../sd-ticket-engine')>()),
  SdTicketEngine: { update: vi.fn() },
}))

import type { SdEscalationRule } from '@prisma/client'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import { SdTicketEscalationRepository } from '@/src/repositories/sd-ticket-escalation.repository'
import {
  type SdActor,
  SdTicketEngine,
  sdSystemActor,
} from '../sd-ticket-engine'
import { escalateSdTicket, runSdEscalationRule } from '../sd-ticket-escalator'
import { recordSdTicketEvent } from '../sd-ticket-event-recorder'
import { SdTicketNotifier } from '../sd-ticket-notifier'

const ctxRepo = vi.mocked(SdTicketContextRepository)
const escRepo = vi.mocked(SdTicketEscalationRepository)
const update = vi.mocked(SdTicketEngine.update)
const notify = vi.mocked(SdTicketNotifier.notify)
const record = vi.mocked(recordSdTicketEvent)

const config = {
  settings: createFakeSdSettings(),
  prefixes: DEFAULT_SD_TICKET_PREFIXES,
}
const agent: SdActor = {
  kind: 'user',
  userId: 'u1',
  isAgent: true,
  isAdmin: false,
  departmentIds: [],
}

const dept = (id: string, parentId: string | null = null) => ({
  id,
  name: id,
  parentId,
})

beforeEach(() => {
  ctxRepo.findDepartment.mockImplementation(async (_ws, id) =>
    ok(id === 'missing' ? null : dept(id, id === 'd1' ? 'dp' : null)),
  )
  ctxRepo.listDepartmentLeadIds.mockImplementation(async (id) =>
    ok(id === 'd1' ? ['lead1', 'lead2'] : id === 'dp' ? ['boss'] : []),
  )
  ctxRepo.findNextPriorityId.mockResolvedValue(ok('p2'))
  update.mockImplementation(async (t, changes) =>
    ok(
      createFakeSdTicket({
        ...t,
        ...(changes as Partial<SdTicketWithRelations>),
      }),
    ),
  )
  escRepo.create.mockImplementation(async (data) =>
    ok(createFakeSdEscalation({ ...(data as object) })),
  )
  notify.mockResolvedValue(ok(1))
  record.mockResolvedValue(ok(1))
})

describe('escalateSdTicket — functional', () => {
  it('moves to another department clearing or setting the assignee', async () => {
    const t = createFakeSdTicket({ departmentId: 'd0', assigneeId: 'a0' })
    const out = expectOk(
      await escalateSdTicket(
        t,
        {
          kind: 'FUNCTIONAL',
          toDepartmentId: 'd2',
          reason: 'Rede',
          notifyDepartmentLeads: true,
        },
        agent,
        config,
      ),
    )
    expect(update).toHaveBeenCalledWith(
      t,
      { departmentId: 'd2', assigneeId: null },
      agent,
      config,
      { touchActivity: true, eventMeta: { via: 'escalation' } },
    )
    expect(out.escalation).toMatchObject({
      kind: 'FUNCTIONAL',
      fromLevel: 0,
      toLevel: 0,
      fromDepartmentId: 'd0',
      toDepartmentId: 'd2',
      fromAssigneeId: 'a0',
      automatic: false,
      ruleId: null,
      createdById: 'u1',
    })
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'escalated',
        actorKind: 'AGENT',
        meta: { kind: 'FUNCTIONAL', reason: 'Rede', automatic: false },
      }),
    )
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'SD_TICKET_ESCALATED',
        userIds: [null],
        excludeUserIds: ['u1'],
        title: 'INC-000001 escalonado',
      }),
    )
  })

  it('assigns a user in the same department and notifies its leads', async () => {
    const t = createFakeSdTicket({ departmentId: 'd1' })
    expectOk(
      await escalateSdTicket(
        t,
        {
          kind: 'FUNCTIONAL',
          toDepartmentId: 'd1',
          toUserId: 'u9',
          reason: 'x',
          notifyDepartmentLeads: true,
          notifyUserIds: ['n1'],
          notifyAssignee: false,
          email: true,
        },
        agent,
        config,
      ),
    )
    expect(update.mock.calls[0][1]).toEqual({ assigneeId: 'u9' })
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: ['n1', 'lead1', 'lead2'],
        email: true,
      }),
    )
  })

  it('assigns a user keeping the department, with nothing when no target changes', async () => {
    const t = createFakeSdTicket({ departmentId: null })
    expectOk(
      await escalateSdTicket(
        t,
        {
          kind: 'FUNCTIONAL',
          toUserId: 'u9',
          reason: 'x',
          notifyDepartmentLeads: true,
        },
        agent,
        config,
      ),
    )
    expect(update.mock.calls[0][1]).toEqual({ assigneeId: 'u9' })
    expect(ctxRepo.listDepartmentLeadIds).not.toHaveBeenCalled()
    const same = createFakeSdTicket({ departmentId: 'd3' })
    expectOk(
      await escalateSdTicket(
        same,
        { kind: 'FUNCTIONAL', toDepartmentId: 'd3', reason: 'x' },
        agent,
        config,
      ),
    )
    expect(update.mock.calls[1][1]).toEqual({})
  })

  it('requires a destination and an existing department', async () => {
    const t = createFakeSdTicket()
    expectErr(
      await escalateSdTicket(
        t,
        { kind: 'FUNCTIONAL', reason: 'x' },
        agent,
        config,
      ),
      'VALIDATION_ERROR',
    )
    expectErr(
      await escalateSdTicket(
        t,
        { kind: 'FUNCTIONAL', toDepartmentId: 'missing', reason: 'x' },
        agent,
        config,
      ),
      'SD_DEPARTMENT_NOT_FOUND',
    )
    ctxRepo.findDepartment.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await escalateSdTicket(
        t,
        { kind: 'FUNCTIONAL', toDepartmentId: 'd2', reason: 'x' },
        agent,
        config,
      ),
      'DATABASE_ERROR',
    )
    ctxRepo.listDepartmentLeadIds.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await escalateSdTicket(
        t,
        {
          kind: 'FUNCTIONAL',
          toDepartmentId: 'd2',
          reason: 'x',
          notifyDepartmentLeads: true,
        },
        agent,
        config,
      ),
      'DATABASE_ERROR',
    )
  })
})

describe('escalateSdTicket — hierarchical', () => {
  it('raises the level and assigns the first department lead', async () => {
    const t = createFakeSdTicket({
      departmentId: 'd1',
      assigneeId: 'a0',
      escalationLevel: 1,
    })
    const out = expectOk(
      await escalateSdTicket(
        t,
        { kind: 'HIERARCHICAL', reason: 'Sem resposta' },
        agent,
        config,
      ),
    )
    expect(update.mock.calls[0][1]).toEqual({
      escalationLevel: 2,
      assigneeId: 'lead1',
    })
    expect(out.escalation.toLevel).toBe(2)
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: ['lead1', 'lead1', 'lead2'],
        title: 'INC-000001 escalonado (nível 2)',
      }),
    )
  })

  it('climbs to the parent department when the assignee is already a lead', async () => {
    const t = createFakeSdTicket({ departmentId: 'd1', assigneeId: 'lead1' })
    expectOk(
      await escalateSdTicket(
        t,
        { kind: 'HIERARCHICAL', reason: 'x' },
        agent,
        config,
      ),
    )
    expect(update.mock.calls[0][1]).toEqual({
      escalationLevel: 1,
      departmentId: 'dp',
      assigneeId: 'boss',
    })
  })

  it('stays with the remaining leads when there is no parent', async () => {
    ctxRepo.listDepartmentLeadIds.mockResolvedValue(ok(['lead1', 'lead2']))
    const t = createFakeSdTicket({ departmentId: 'd5', assigneeId: 'lead1' })
    expectOk(
      await escalateSdTicket(
        t,
        { kind: 'HIERARCHICAL', reason: 'x', notifyDepartmentLeads: false },
        agent,
        config,
      ),
    )
    expect(update.mock.calls[0][1]).toEqual({
      escalationLevel: 1,
      assigneeId: 'lead2',
    })
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ userIds: ['lead2'] }),
    )
  })

  it('handles no department, no leads and an explicit target user', async () => {
    const t = createFakeSdTicket({ departmentId: null, assigneeId: 'a0' })
    expectOk(
      await escalateSdTicket(
        t,
        { kind: 'HIERARCHICAL', reason: 'x' },
        agent,
        config,
      ),
    )
    expect(update.mock.calls[0][1]).toEqual({ escalationLevel: 1 })
    expectOk(
      await escalateSdTicket(
        t,
        { kind: 'HIERARCHICAL', reason: 'x', toUserId: 'a0' },
        agent,
        config,
      ),
    )
    expect(update.mock.calls[1][1]).toEqual({ escalationLevel: 1 })
    const orphan = createFakeSdTicket({ departmentId: 'd9' })
    ctxRepo.findDepartment.mockResolvedValueOnce(ok(null))
    expectOk(
      await escalateSdTicket(
        orphan,
        { kind: 'HIERARCHICAL', reason: 'x' },
        agent,
        config,
      ),
    )
    expect(update.mock.calls[2][1]).toEqual({ escalationLevel: 1 })
  })

  it('escalates to an explicit department', async () => {
    const t = createFakeSdTicket({ departmentId: 'd0' })
    expectOk(
      await escalateSdTicket(
        t,
        { kind: 'HIERARCHICAL', toDepartmentId: 'dp', reason: 'x' },
        agent,
        config,
      ),
    )
    expect(update.mock.calls[0][1]).toEqual({
      escalationLevel: 1,
      departmentId: 'dp',
      assigneeId: 'boss',
    })
  })

  it('propagates lead and department lookup errors', async () => {
    const t = createFakeSdTicket({ departmentId: 'd1', assigneeId: 'lead1' })
    ctxRepo.listDepartmentLeadIds.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await escalateSdTicket(
        t,
        { kind: 'HIERARCHICAL', reason: 'x' },
        agent,
        config,
      ),
      'DATABASE_ERROR',
    )
    ctxRepo.findDepartment.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await escalateSdTicket(
        t,
        { kind: 'HIERARCHICAL', reason: 'x' },
        agent,
        config,
      ),
      'DATABASE_ERROR',
    )
    ctxRepo.listDepartmentLeadIds
      .mockResolvedValueOnce(ok(['lead1']))
      .mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await escalateSdTicket(
        t,
        { kind: 'HIERARCHICAL', reason: 'x' },
        agent,
        config,
      ),
      'DATABASE_ERROR',
    )
  })
})

describe('escalateSdTicket — priority and persistence', () => {
  it('raises the priority to the next level', async () => {
    const t = createFakeSdTicket({
      priorityId: 'p1',
      priority: { id: 'p1', name: 'P1', level: 1, color: null },
    })
    expectOk(
      await escalateSdTicket(
        t,
        { kind: 'HIERARCHICAL', reason: 'x', raisePriority: true },
        agent,
        config,
      ),
    )
    expect(ctxRepo.findNextPriorityId).toHaveBeenCalledWith('ws1', 1)
    expect(update.mock.calls[0][1]).toMatchObject({ priorityId: 'p2' })
  })

  it('keeps the priority when there is no higher one', async () => {
    ctxRepo.findNextPriorityId.mockResolvedValueOnce(ok(null))
    expectOk(
      await escalateSdTicket(
        createFakeSdTicket(),
        { kind: 'HIERARCHICAL', reason: 'x', raisePriority: true },
        agent,
        config,
      ),
    )
    expect(ctxRepo.findNextPriorityId).toHaveBeenCalledWith('ws1', null)
    expect(update.mock.calls[0][1].priorityId).toBeUndefined()
    ctxRepo.findNextPriorityId.mockResolvedValueOnce(ok('p1'))
    expectOk(
      await escalateSdTicket(
        createFakeSdTicket({ priorityId: 'p1' }),
        { kind: 'HIERARCHICAL', reason: 'x', raisePriority: true },
        agent,
        config,
      ),
    )
    expect(update.mock.calls[1][1].priorityId).toBeUndefined()
    ctxRepo.findNextPriorityId.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await escalateSdTicket(
        createFakeSdTicket(),
        { kind: 'HIERARCHICAL', reason: 'x', raisePriority: true },
        agent,
        config,
      ),
      'DATABASE_ERROR',
    )
  })

  it('propagates update and persistence errors', async () => {
    update.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await escalateSdTicket(
        createFakeSdTicket(),
        { kind: 'HIERARCHICAL', reason: 'x' },
        agent,
        config,
      ),
      'DATABASE_ERROR',
    )
    escRepo.create.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await escalateSdTicket(
        createFakeSdTicket(),
        { kind: 'HIERARCHICAL', reason: 'x' },
        agent,
        config,
      ),
      'DATABASE_ERROR',
    )
  })
})

describe('runSdEscalationRule', () => {
  it('maps the rule actions to an automatic escalation', async () => {
    const rule = createFakeSdEscalationRule({
      id: 'r1',
      name: 'Violou',
      trigger: 'RESOLUTION_BREACHED',
      actions: {
        kind: 'FUNCTIONAL',
        reassignDepartmentId: 'd2',
        notifyUserIds: ['n1'],
        raisePriority: false,
        email: true,
      },
    })
    const t = createFakeSdTicket({ departmentId: 'd0' })
    const out = expectOk(
      await runSdEscalationRule(t, rule, sdSystemActor('sla'), config),
    )
    expect(update).toHaveBeenCalledWith(
      t,
      { departmentId: 'd2', assigneeId: null },
      expect.objectContaining({ kind: 'system' }),
      config,
      { touchActivity: false, eventMeta: { via: 'escalation' } },
    )
    expect(out.escalation).toMatchObject({
      automatic: true,
      ruleId: 'r1',
      reason: 'Regra "Violou": resolução violada',
      createdById: null,
    })
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorKind: 'SYSTEM',
        meta: expect.objectContaining({ ruleId: 'r1', automatic: true }),
      }),
    )
  })

  it.each([
    'FIRST_RESPONSE_AT_RISK',
    'FIRST_RESPONSE_BREACHED',
    'RESOLUTION_AT_RISK',
    'NO_UPDATE',
  ] as const)('labels the %s trigger', async (trigger) => {
    const rule = createFakeSdEscalationRule({ trigger, actions: {} })
    const out = expectOk(
      await runSdEscalationRule(
        createFakeSdTicket(),
        rule as SdEscalationRule,
        sdSystemActor('sla'),
        config,
      ),
    )
    expect(out.escalation.reason).toMatch(/^Regra "Escalar violação": /)
  })

  it('rejects invalid rule actions', async () => {
    const rule = createFakeSdEscalationRule({ actions: { kind: 'FUNCTIONAL' } })
    expectErr(
      await runSdEscalationRule(
        createFakeSdTicket(),
        rule,
        sdSystemActor('sla'),
        config,
      ),
      'VALIDATION_ERROR',
    )
    expect(update).not.toHaveBeenCalled()
  })
})
