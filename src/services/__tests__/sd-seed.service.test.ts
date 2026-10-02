import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-config.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import type { SdSeedSummary } from '@/src/repositories/sd-seed.repository'
import {
  SdHolidaysSchema,
  SdWeeklyScheduleSchema,
} from '@/src/schemas/sd-calendar.schema'
import {
  SdAutomationActionsSchema,
  SdConditionsSchema,
  SdEscalationActionsSchema,
} from '@/src/schemas/sd-rule.schema'
import { SdTicketTemplateDefaultsSchema } from '@/src/schemas/sd-ticket-template.schema'

vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/lib/axiom/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-seed.repository')

import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import { SdSeedRepository } from '@/src/repositories/sd-seed.repository'
import { SdSeedService } from '../sd-seed.service'
import { SD_SEED_PLAN, type SdSeedPlan } from '../sd-seed-data'

const repo = vi.mocked(SdSeedRepository)
const WS = 'ws1'
const summary = { phases: 30, calendars: 2 } as SdSeedSummary

beforeEach(() => {
  actAs('owner')
})

describe('SdSeedService.seedDefaults', () => {
  it('applies the ITIL plan and audits', async () => {
    repo.apply.mockResolvedValue(ok(summary))
    expect(expectOk(await SdSeedService.seedDefaults(WS, 'admin'))).toEqual(
      summary,
    )
    expect(repo.apply).toHaveBeenCalledWith(WS, 'admin', SD_SEED_PLAN)
    expect(logger.info).toHaveBeenCalledWith(
      'servicedesk.seed.applied',
      expect.objectContaining({
        workspaceId: WS,
        summary: JSON.stringify(summary),
      }),
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_seed',
        action: 'create',
        targetId: WS,
        meta: summary,
      }),
    )
  })

  it('accepts a custom plan', async () => {
    repo.apply.mockResolvedValue(ok(summary))
    const plan = { ...SD_SEED_PLAN, catalog: [] } as SdSeedPlan
    expectOk(await SdSeedService.seedDefaults(WS, 'admin', plan))
    expect(repo.apply).toHaveBeenCalledWith(WS, 'admin', plan)
  })

  it('logs and audits failures', async () => {
    repo.apply.mockResolvedValue(err(databaseError()))
    expectErr(await SdSeedService.seedDefaults(WS, 'admin'), 'DATABASE_ERROR')
    expect(logger.error).toHaveBeenCalledWith(
      'servicedesk.seed.failed',
      expect.objectContaining({ workspaceId: WS, error: 'DATABASE_ERROR' }),
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure', reason: 'DATABASE_ERROR' }),
    )
  })
})

describe('SdSeedService.restoreDefaults', () => {
  it('lets admins restore the defaults', async () => {
    repo.apply.mockResolvedValue(ok(summary))
    expectOk(await SdSeedService.restoreDefaults('u1', WS))
    expect(repo.apply).toHaveBeenCalledWith(WS, 'u1', SD_SEED_PLAN)
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'sd_seed', action: 'restore' }),
    )
  })

  it.each([
    ['requester', 'FORBIDDEN'],
    ['agent', 'FORBIDDEN'],
    ['stranger', 'FORBIDDEN'],
    ['disabled', 'MODULE_DISABLED'],
  ] as const)('denies %s', async (actor, code) => {
    actAs(actor)
    expectErr(await SdSeedService.restoreDefaults('u1', WS), code)
    expect(repo.apply).not.toHaveBeenCalled()
  })
})

describe('SdSeedService.seedPhases', () => {
  it('seeds only the missing phases of one type', async () => {
    repo.applyPhases.mockResolvedValue(ok({ created: 7, kept: 1 }))

    expect(
      expectOk(await SdSeedService.seedPhases('u1', WS, 'INCIDENT')),
    ).toEqual({ created: 7, kept: 1 })
    expect(repo.applyPhases).toHaveBeenCalledWith(
      WS,
      'INCIDENT',
      SD_SEED_PLAN.phases.INCIDENT,
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_seed',
        action: 'restore',
        targetId: WS,
        meta: expect.objectContaining({ ticketType: 'INCIDENT' }),
      }),
    )
  })

  it('accepts a custom plan', async () => {
    repo.applyPhases.mockResolvedValue(ok({ created: 0, kept: 0 }))
    const plan = {
      ...SD_SEED_PLAN,
      phases: { ...SD_SEED_PLAN.phases, CHANGE: [] },
    } as SdSeedPlan

    expectOk(await SdSeedService.seedPhases('u1', WS, 'CHANGE', plan))
    expect(repo.applyPhases).toHaveBeenCalledWith(WS, 'CHANGE', [])
  })

  it('propagates a repository failure', async () => {
    repo.applyPhases.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdSeedService.seedPhases('u1', WS, 'PROBLEM'),
      'DATABASE_ERROR',
    )
  })

  it.each([
    ['requester', 'FORBIDDEN'],
    ['agent', 'FORBIDDEN'],
    ['stranger', 'FORBIDDEN'],
    ['disabled', 'MODULE_DISABLED'],
  ] as const)('denies %s', async (actor, code) => {
    actAs(actor)
    expectErr(await SdSeedService.seedPhases('u1', WS, 'INCIDENT'), code)
    expect(repo.applyPhases).not.toHaveBeenCalled()
  })
})

describe('SD_SEED_PLAN sanity', () => {
  it('has exactly one initial phase per ticket type with valid percents', () => {
    for (const phases of Object.values(SD_SEED_PLAN.phases)) {
      expect(phases.filter((p) => p.isInitial)).toHaveLength(1)
      for (const p of phases) {
        expect(p.completionPercent).toBeGreaterThanOrEqual(0)
        expect(p.completionPercent).toBeLessThanOrEqual(100)
      }
      expect(new Set(phases.map((p) => p.color)).size).toBe(phases.length)
    }
    expect(Object.keys(SD_SEED_PLAN.phases)).toEqual([
      'INCIDENT',
      'SERVICE_REQUEST',
      'CHANGE',
      'PROBLEM',
    ])
  })

  it('has the ITIL 3×3 matrix over 4 priorities', () => {
    expect(SD_SEED_PLAN.impacts.map((i) => i.level)).toEqual([1, 2, 3])
    expect(SD_SEED_PLAN.urgencies.map((u) => u.level)).toEqual([1, 2, 3])
    expect(SD_SEED_PLAN.priorities.map((p) => p.level)).toEqual([1, 2, 3, 4])
    expect(SD_SEED_PLAN.priorities.filter((p) => p.isDefault)).toHaveLength(1)
    expect(SD_SEED_PLAN.matrix).toHaveLength(9)
    expect(
      new Set(
        SD_SEED_PLAN.matrix.map((c) => `${c.impactLevel}:${c.urgencyLevel}`),
      ).size,
    ).toBe(9)
    expect(
      SD_SEED_PLAN.matrix.find(
        (c) => c.impactLevel === 3 && c.urgencyLevel === 3,
      )?.priorityLevel,
    ).toBe(4)
    expect(SD_SEED_PLAN.severities).toHaveLength(4)
  })

  it('has valid calendars, SLA targets and rules', () => {
    for (const calendar of SD_SEED_PLAN.calendars) {
      expect(SdWeeklyScheduleSchema.safeParse(calendar.schedule).success).toBe(
        true,
      )
      expect(SdHolidaysSchema.safeParse(calendar.holidays).success).toBe(true)
    }
    expect(SD_SEED_PLAN.calendars.filter((c) => c.isDefault)).toHaveLength(1)
    const names = new Set(SD_SEED_PLAN.calendars.map((c) => c.name))
    for (const policy of SD_SEED_PLAN.slaPolicies) {
      expect(names.has(policy.calendarName)).toBe(true)
      expect(SdConditionsSchema.safeParse(policy.conditions).success).toBe(true)
    }
    const standard = SD_SEED_PLAN.slaPolicies.find((p) => p.isDefault)
    expect(standard?.targets).toHaveLength(4)
    for (const rule of SD_SEED_PLAN.escalationRules) {
      expect(SdEscalationActionsSchema.safeParse(rule.actions).success).toBe(
        true,
      )
    }
    for (const rule of SD_SEED_PLAN.automationRules) {
      expect(SdAutomationActionsSchema.safeParse(rule.actions).success).toBe(
        true,
      )
    }
    for (const template of SD_SEED_PLAN.templates) {
      expect(
        SdTicketTemplateDefaultsSchema.safeParse(template.defaults).success,
      ).toBe(true)
    }
  })

  it('seeds the CMDB types, departments and classifications', () => {
    expect(SD_SEED_PLAN.configItemTypes).toHaveLength(13)
    expect(SD_SEED_PLAN.departments.filter((d) => d.actorIsLead)).toHaveLength(
      1,
    )
    expect(
      SD_SEED_PLAN.classifications.filter((c) => c.kind === 'TICKET'),
    ).toHaveLength(6)
    expect(
      SD_SEED_PLAN.classifications.filter((c) => c.kind === 'SOLUTION'),
    ).toHaveLength(8)
    expect(SD_SEED_PLAN.catalog).toHaveLength(4)
  })
})
