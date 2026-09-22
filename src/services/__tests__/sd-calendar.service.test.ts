import type { SdBusinessCalendar } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-config.helpers'
import { databaseError, sdConfigNotFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { CreateSdCalendarSchema } from '@/src/schemas/sd-calendar.schema'

vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-calendar.repository')

import { auditMutation } from '@/lib/axiom/audit'
import { SdCalendarRepository } from '@/src/repositories/sd-calendar.repository'
import { SdCalendarService } from '../sd-calendar.service'

const repo = vi.mocked(SdCalendarRepository)

function calendarRow(
  overrides: Partial<SdBusinessCalendar> = {},
): SdBusinessCalendar {
  const now = new Date('2026-01-01T00:00:00Z')
  return {
    id: 'c1',
    workspaceId: 'ws1',
    name: 'Comercial',
    timezone: 'America/Sao_Paulo',
    schedule: { mon: [['08:00', '18:00']] },
    holidays: [],
    is24x7: false,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

const input = CreateSdCalendarSchema.parse({
  name: 'Comercial',
  schedule: { mon: [['08:00', '18:00']] },
})

beforeEach(() => {
  actAs('admin')
  repo.list.mockResolvedValue(ok([calendarRow()]))
  repo.findById.mockResolvedValue(ok(calendarRow()))
  repo.countDefaults.mockResolvedValue(ok(1))
  repo.create.mockResolvedValue(ok(calendarRow()))
  repo.update.mockResolvedValue(ok(calendarRow({ name: 'Novo' })))
  repo.delete.mockResolvedValue(ok(undefined))
})

describe('SdCalendarService.list', () => {
  it('lets any member read', async () => {
    actAs('requester')
    const list = expectOk(await SdCalendarService.list('u1', 'ws1'))
    expect(list[0].schedule.mon).toEqual([['08:00', '18:00']])
  })

  it('refuses strangers and propagates db errors', async () => {
    actAs('stranger')
    expectErr(await SdCalendarService.list('u1', 'ws1'), 'FORBIDDEN')
    actAs('owner')
    repo.list.mockResolvedValue(err(databaseError()))
    expectErr(await SdCalendarService.list('u1', 'ws1'), 'DATABASE_ERROR')
  })
})

describe('SdCalendarService.create', () => {
  it('keeps isDefault false when a default exists', async () => {
    expectOk(await SdCalendarService.create('u1', 'ws1', input))
    expect(repo.create).toHaveBeenCalledWith(
      'ws1',
      expect.objectContaining({ isDefault: false }),
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_business_calendar',
        action: 'create',
        targetId: 'c1',
      }),
    )
  })

  it('makes the first calendar the default', async () => {
    repo.countDefaults.mockResolvedValue(ok(0))
    expectOk(await SdCalendarService.create('u1', 'ws1', input))
    expect(repo.create).toHaveBeenCalledWith(
      'ws1',
      expect.objectContaining({ isDefault: true }),
    )
  })

  it('propagates db errors', async () => {
    repo.countDefaults.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdCalendarService.create('u1', 'ws1', input),
      'DATABASE_ERROR',
    )
    repo.countDefaults.mockResolvedValue(ok(1))
    repo.create.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdCalendarService.create('u1', 'ws1', input),
      'DATABASE_ERROR',
    )
  })

  it.each([
    ['requester', 'FORBIDDEN'],
    ['agent', 'FORBIDDEN'],
    ['viewer', 'FORBIDDEN'],
    ['disabled', 'MODULE_DISABLED'],
  ] as const)('refuses %s', async (actor, code) => {
    actAs(actor)
    expectErr(await SdCalendarService.create('u1', 'ws1', input), code)
  })
})

describe('SdCalendarService.update', () => {
  it('updates', async () => {
    const dto = expectOk(
      await SdCalendarService.update('u1', 'ws1', 'c1', { name: 'Novo' }),
    )
    expect(dto.name).toBe('Novo')
    expect(repo.update).toHaveBeenCalledWith('c1', 'ws1', { name: 'Novo' })
  })

  it('refuses to unset the default calendar', async () => {
    repo.findById.mockResolvedValue(ok(calendarRow({ isDefault: true })))
    expectErr(
      await SdCalendarService.update('u1', 'ws1', 'c1', { isDefault: false }),
      'SD_CONFIG_CONFLICT',
    )
  })

  it('returns not found for another workspace calendar', async () => {
    repo.findById.mockResolvedValue(err(sdConfigNotFound()))
    expectErr(
      await SdCalendarService.update('u1', 'ws1', 'x', { name: 'a' }),
      'SD_CONFIG_NOT_FOUND',
    )
  })

  it('propagates update errors', async () => {
    repo.update.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdCalendarService.update('u1', 'ws1', 'c1', { name: 'a' }),
      'DATABASE_ERROR',
    )
  })
})

describe('SdCalendarService.remove', () => {
  it('deletes a non-default calendar', async () => {
    expectOk(await SdCalendarService.remove('u1', 'ws1', 'c1'))
    expect(repo.delete).toHaveBeenCalledWith('c1', 'ws1')
  })

  it('refuses to delete the default calendar', async () => {
    repo.findById.mockResolvedValue(ok(calendarRow({ isDefault: true })))
    expectErr(
      await SdCalendarService.remove('u1', 'ws1', 'c1'),
      'SD_CONFIG_CONFLICT',
    )
    expect(repo.delete).not.toHaveBeenCalled()
  })

  it('returns not found', async () => {
    repo.findById.mockResolvedValue(err(sdConfigNotFound()))
    expectErr(
      await SdCalendarService.remove('u1', 'ws1', 'c1'),
      'SD_CONFIG_NOT_FOUND',
    )
  })

  it('refuses agents', async () => {
    actAs('agent')
    expectErr(await SdCalendarService.remove('u1', 'ws1', 'c1'), 'FORBIDDEN')
  })
})
