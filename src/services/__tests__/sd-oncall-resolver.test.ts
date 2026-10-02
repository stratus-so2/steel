import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeSdOnCallOverride,
  createFakeSdOnCallSchedule,
} from '@/src/__tests__/factories/sd-oncall.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { resolveSdOnCall } from '@/src/lib/servicedesk/oncall'
import { toSdOnCallSpec } from '@/src/mappers/sd-oncall.mapper'

vi.mock('@/src/repositories/sd-oncall.repository')

import { SdOnCallRepository } from '@/src/repositories/sd-oncall.repository'
import {
  resolveSdOnCallForDepartment,
  sdOnCallEscalationTarget,
  sdOnCallNotifyUserIds,
  sdOnCallSlotForLevel,
} from '../sd-oncall-resolver'

const repo = vi.mocked(SdOnCallRepository)
const WS = 'ws1'
const AT = new Date('2026-10-06T00:00:00.000Z')

/** Escala com duas camadas: u1/u2 na primeira chamada, chefes na retaguarda. */
function twoLayers() {
  const base = createFakeSdOnCallSchedule({ id: 'sch-1' })
  return createFakeSdOnCallSchedule({
    id: 'sch-1',
    layers: [
      base.layers[0],
      {
        id: 'layer-2',
        scheduleId: 'sch-1',
        name: 'Retaguarda',
        level: 2,
        participants: [
          {
            id: 'part-3',
            layerId: 'layer-2',
            userId: 'boss',
            position: 0,
            user: {
              id: 'boss',
              name: 'Chefe',
              email: 'boss@steel.test',
              image: null,
            },
          },
        ],
      },
    ],
  })
}

beforeEach(() => {
  repo.findActiveForDepartment.mockResolvedValue(ok(twoLayers()))
  repo.listOverridesInRange.mockResolvedValue(ok([]))
})

describe('resolveSdOnCallForDepartment', () => {
  it('resolves the schedule that covers the department', async () => {
    const resolution = expectOk(
      await resolveSdOnCallForDepartment(WS, 'dep-1', AT),
    )
    expect(resolution).toMatchObject({ scheduleId: 'sch-1', applies: true })
    expect(resolution?.layers.map((slot) => slot.userId)).toEqual([
      'u1',
      'boss',
    ])
    expect(repo.findActiveForDepartment).toHaveBeenCalledWith(WS, 'dep-1')
    expect(repo.listOverridesInRange).toHaveBeenCalledWith(
      'sch-1',
      AT,
      new Date(AT.getTime() + 1),
    )
  })

  it('answers null when there is no schedule', async () => {
    repo.findActiveForDepartment.mockResolvedValue(ok(null))
    expect(
      expectOk(await resolveSdOnCallForDepartment(WS, 'dep-1', AT)),
    ).toBeNull()
  })

  it('lets the override win', async () => {
    repo.listOverridesInRange.mockResolvedValue(
      ok([createFakeSdOnCallOverride({ layerId: 'layer-1', userId: 'troca' })]),
    )
    const resolution = expectOk(
      await resolveSdOnCallForDepartment(
        WS,
        'dep-1',
        new Date('2026-10-07T12:00:00.000Z'),
      ),
    )
    expect(resolution?.layers[0]).toMatchObject({
      userId: 'troca',
      source: 'override',
    })
  })

  it('propagates the database errors', async () => {
    repo.findActiveForDepartment.mockResolvedValue(err(databaseError()))
    expectErr(
      await resolveSdOnCallForDepartment(WS, 'dep-1', AT),
      'DATABASE_ERROR',
    )
    repo.findActiveForDepartment.mockResolvedValue(ok(twoLayers()))
    repo.listOverridesInRange.mockResolvedValue(err(databaseError()))
    expectErr(
      await resolveSdOnCallForDepartment(WS, 'dep-1', AT),
      'DATABASE_ERROR',
    )
  })
})

describe('sdOnCallSlotForLevel', () => {
  const resolution = () => resolveSdOnCall(AT, toSdOnCallSpec(twoLayers()), [])

  it('finds the exact layer', () => {
    expect(sdOnCallSlotForLevel(resolution(), 1)?.userId).toBe('u1')
    expect(sdOnCallSlotForLevel(resolution(), 2)?.userId).toBe('boss')
  })

  it('falls back to the deepest layer below the level asked', () => {
    // Nível 5 sem camada: fica na retaguarda, a última que existe.
    expect(sdOnCallSlotForLevel(resolution(), 5)?.level).toBe(2)
  })

  it('falls back to the first layer when the level is below every layer', () => {
    const single = resolveSdOnCall(
      AT,
      toSdOnCallSpec(
        createFakeSdOnCallSchedule({
          layers: [{ ...twoLayers().layers[1], id: 'layer-2', level: 3 }],
        }),
      ),
      [],
    )
    expect(sdOnCallSlotForLevel(single, 1)?.level).toBe(3)
  })

  it('answers null for a schedule without layers', () => {
    const empty = resolveSdOnCall(
      AT,
      toSdOnCallSpec(createFakeSdOnCallSchedule({ layers: [] })),
      [],
    )
    expect(sdOnCallSlotForLevel(empty, 1)).toBeNull()
  })
})

describe('sdOnCallNotifyUserIds', () => {
  it('takes the target layer and the backup above it', () => {
    const resolution = resolveSdOnCall(AT, toSdOnCallSpec(twoLayers()), [])
    expect(sdOnCallNotifyUserIds(resolution, 1)).toEqual(['u1', 'boss'])
    expect(sdOnCallNotifyUserIds(resolution, 2)).toEqual(['boss'])
  })

  it('skips the layers without anybody', () => {
    const schedule = twoLayers()
    const resolution = resolveSdOnCall(
      AT,
      toSdOnCallSpec({
        ...schedule,
        layers: [
          { ...schedule.layers[0], participants: [] },
          schedule.layers[1],
        ],
      }),
      [],
    )
    expect(sdOnCallNotifyUserIds(resolution, 1)).toEqual(['boss'])
  })

  it('answers an empty list for a schedule with nobody', () => {
    const resolution = resolveSdOnCall(
      AT,
      toSdOnCallSpec(createFakeSdOnCallSchedule({ layers: [] })),
      [],
    )
    expect(sdOnCallNotifyUserIds(resolution, 1)).toEqual([])
  })

  it('does not repeat the same person covering two layers', () => {
    const schedule = twoLayers()
    const resolution = resolveSdOnCall(AT, toSdOnCallSpec(schedule), [
      {
        id: 'ov-geral',
        layerId: null,
        userId: 'coringa',
        startsAt: new Date('2026-10-05T00:00:00.000Z'),
        endsAt: new Date('2026-10-09T00:00:00.000Z'),
        reason: null,
      },
    ])
    expect(sdOnCallNotifyUserIds(resolution, 1)).toEqual(['coringa'])
  })
})

describe('sdOnCallEscalationTarget', () => {
  it('answers the slot of the level asked', async () => {
    const target = expectOk(await sdOnCallEscalationTarget(WS, 'dep-1', AT, 2))
    expect(target).toMatchObject({
      scheduleId: 'sch-1',
      scheduleName: 'Plantão de redes',
    })
    expect(target?.slot?.userId).toBe('boss')
  })

  it('answers null without a schedule', async () => {
    repo.findActiveForDepartment.mockResolvedValue(ok(null))
    expect(
      expectOk(await sdOnCallEscalationTarget(WS, 'dep-1', AT, 1)),
    ).toBeNull()
  })

  it('answers null inside the business hours of the calendar', async () => {
    repo.findActiveForDepartment.mockResolvedValue(
      ok(
        createFakeSdOnCallSchedule({
          calendarId: 'cal-1',
          calendar: {
            id: 'cal-1',
            name: 'Comercial',
            timezone: 'America/Sao_Paulo',
            schedule: { mon: [['08:00', '18:00']] },
            holidays: [],
            is24x7: false,
          },
        }),
      ),
    )
    // Segunda, 10:00 em São Paulo: a fila normal atende.
    expect(
      expectOk(
        await sdOnCallEscalationTarget(
          WS,
          'dep-1',
          new Date('2026-10-05T13:00:00.000Z'),
          1,
        ),
      ),
    ).toBeNull()
    // Segunda, 23:00: aí sim o plantão vale.
    expect(
      expectOk(
        await sdOnCallEscalationTarget(
          WS,
          'dep-1',
          new Date('2026-10-06T02:00:00.000Z'),
          1,
        ),
      )?.slot?.userId,
    ).toBe('u1')
  })

  it('answers null while the schedule is off', async () => {
    repo.findActiveForDepartment.mockResolvedValue(
      ok(createFakeSdOnCallSchedule({ active: false })),
    )
    expect(
      expectOk(await sdOnCallEscalationTarget(WS, 'dep-1', AT, 1)),
    ).toBeNull()
  })

  it('propagates the database error', async () => {
    repo.findActiveForDepartment.mockResolvedValue(err(databaseError()))
    expectErr(
      await sdOnCallEscalationTarget(WS, 'dep-1', AT, 1),
      'DATABASE_ERROR',
    )
  })
})
