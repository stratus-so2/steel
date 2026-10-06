import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeSdOnCallOverride,
  createFakeSdOnCallSchedule,
} from '@/src/__tests__/factories/sd-oncall.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-config.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-config.repository')
vi.mock('@/src/repositories/sd-oncall.repository')
vi.mock('../sd-notification.service', () => ({ notifySdUsers: vi.fn() }))

import { logger } from '@/lib/axiom/logger'
import { SdConfigRepository } from '@/src/repositories/sd-config.repository'
import { SdOnCallRepository } from '@/src/repositories/sd-oncall.repository'
import { notifySdUsers } from '../sd-notification.service'
import { formatSdOnCallMoment, SdOnCallService } from '../sd-oncall.service'

const repo = vi.mocked(SdOnCallRepository)
const config = vi.mocked(SdConfigRepository)
const notify = vi.mocked(notifySdUsers)
const WS = 'ws1'
const SCH = 'sch-1'

beforeEach(() => {
  vi.clearAllMocks()
  actAs('owner')
  config.findExistingRefs.mockResolvedValue(
    ok({
      departmentIds: [],
      calendarIds: [],
      userIds: ['u1', 'u2', 'u3'],
    } as never),
  )
  repo.findById.mockResolvedValue(ok(createFakeSdOnCallSchedule({ id: SCH })))
  repo.setParticipants.mockResolvedValue(ok(undefined))
  repo.listOverridesInRange.mockResolvedValue(ok([]))
  repo.createOverride.mockResolvedValue(ok(createFakeSdOnCallOverride()))
  notify.mockResolvedValue(ok({ recipients: 1, inApp: 1 }))
})

describe('formatSdOnCallMoment', () => {
  it('formats in the schedule time zone', () => {
    const at = new Date('2026-10-06T12:30:00.000Z')
    expect(formatSdOnCallMoment(at, 'America/Sao_Paulo')).toContain('09:30')
    expect(formatSdOnCallMoment(at, 'UTC')).toContain('12:30')
  })

  it('falls back to UTC on an invalid zone', () => {
    const at = new Date('2026-10-06T12:30:00.000Z')
    expect(formatSdOnCallMoment(at, 'Nowhere/Invalid')).toContain('12:30')
  })
})

describe('SdOnCallService.setParticipants · notice', () => {
  it('tells only the people who just joined the layer', async () => {
    expectOk(
      await SdOnCallService.setParticipants('u1', WS, SCH, 'layer-1', {
        userIds: ['u2', 'u3', 'u1'],
      }),
    )
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WS,
        event: 'oncall.shift',
        userIds: ['u3'],
        actorId: 'u1',
        title: 'Você entrou no plantão "Plantão de redes"',
      }),
    )
    const { hrefFor } = notify.mock.calls[0][0]
    expect(hrefFor('acme')).toBe('/acme/servicedesk/settings?tab=oncall')
  })

  it('stays quiet on a pure reorder', async () => {
    expectOk(
      await SdOnCallService.setParticipants('u1', WS, SCH, 'layer-1', {
        userIds: ['u2', 'u1'],
      }),
    )
    expect(notify).not.toHaveBeenCalled()
  })

  it('does not notify when saving fails', async () => {
    repo.setParticipants.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdOnCallService.setParticipants('u1', WS, SCH, 'layer-1', {
        userIds: ['u3'],
      }),
    )
    expect(notify).not.toHaveBeenCalled()
  })

  it('keeps the change when the notice fails', async () => {
    notify.mockResolvedValue(err(databaseError()))
    expectOk(
      await SdOnCallService.setParticipants('u1', WS, SCH, 'layer-1', {
        userIds: ['u3'],
      }),
    )
    expect(logger.warn).toHaveBeenCalledWith(
      'servicedesk.oncall.notify_failed',
      expect.objectContaining({ scheduleId: SCH, reason: 'DATABASE_ERROR' }),
    )
  })
})

describe('SdOnCallService.createOverride · notice', () => {
  const startsAt = new Date('2026-10-10T12:00:00.000Z')
  const endsAt = new Date('2026-10-11T12:00:00.000Z')

  it('tells the person covering the shift, with the window in the schedule zone', async () => {
    expectOk(
      await SdOnCallService.createOverride('u1', WS, {
        scheduleId: SCH,
        userId: 'u3',
        startsAt,
        endsAt,
        reason: 'Férias do titular',
      }),
    )
    const [input] = notify.mock.calls[0]
    expect(input).toMatchObject({
      event: 'oncall.shift',
      userIds: ['u3'],
      actorId: 'u1',
      title: 'Você cobre o plantão "Plantão de redes"',
    })
    expect(input.body).toContain('09:00')
    expect(input.body).toContain('America/Sao_Paulo')
    expect(input.body).toContain('Férias do titular')
  })

  it('omits the reason when there is none', async () => {
    expectOk(
      await SdOnCallService.createOverride('u1', WS, {
        scheduleId: SCH,
        userId: 'u3',
        startsAt,
        endsAt,
      }),
    )
    expect(notify.mock.calls[0][0].body.endsWith(')' + '.')).toBe(true)
  })

  it('does not notify when the override clashes', async () => {
    repo.listOverridesInRange.mockResolvedValue(
      ok([
        createFakeSdOnCallOverride({
          layerId: null,
          startsAt,
          endsAt,
        }),
      ]),
    )
    expectErr(
      await SdOnCallService.createOverride('u1', WS, {
        scheduleId: SCH,
        userId: 'u3',
        startsAt,
        endsAt,
      }),
    )
    expect(notify).not.toHaveBeenCalled()
  })
})
