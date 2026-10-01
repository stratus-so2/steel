import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeSdOnCallOverride,
  createFakeSdOnCallSchedule,
  SD_ONCALL_ROTATION_START,
} from '@/src/__tests__/factories/sd-oncall.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-config.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { CreateSdOnCallScheduleSchema } from '@/src/schemas/sd-oncall.schema'

vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-config.repository')
vi.mock('@/src/repositories/sd-oncall.repository')

import { auditMutation } from '@/lib/axiom/audit'
import { SdConfigRepository } from '@/src/repositories/sd-config.repository'
import { SdOnCallRepository } from '@/src/repositories/sd-oncall.repository'
import { SdOnCallService } from '../sd-oncall.service'

const repo = vi.mocked(SdOnCallRepository)
const config = vi.mocked(SdConfigRepository)
const WS = 'ws1'
const SCH = 'sch-1'

const dto = CreateSdOnCallScheduleSchema.parse({
  name: 'Plantão de redes',
  departmentId: 'dep-1',
  rotationStart: SD_ONCALL_ROTATION_START.toISOString(),
})

beforeEach(() => {
  actAs('owner')
  config.findExistingRefs.mockResolvedValue(
    ok({
      departmentIds: ['dep-1'],
      calendarIds: ['cal-1'],
      userIds: ['u1', 'u2', 'u3'],
    } as never),
  )
  repo.list.mockResolvedValue(ok([createFakeSdOnCallSchedule({ id: SCH })]))
  repo.findById.mockResolvedValue(ok(createFakeSdOnCallSchedule({ id: SCH })))
  repo.create.mockResolvedValue(ok(createFakeSdOnCallSchedule({ id: SCH })))
  repo.update.mockResolvedValue(ok(createFakeSdOnCallSchedule({ id: SCH })))
  repo.softDelete.mockResolvedValue(ok(undefined))
  repo.createLayer.mockResolvedValue(ok(createFakeSdOnCallSchedule().layers[0]))
  repo.updateLayer.mockResolvedValue(ok(undefined))
  repo.deleteLayer.mockResolvedValue(ok(undefined))
  repo.setParticipants.mockResolvedValue(ok(undefined))
  repo.listOverrides.mockResolvedValue(ok([createFakeSdOnCallOverride()]))
  repo.listOverridesInRange.mockResolvedValue(ok([]))
  repo.createOverride.mockResolvedValue(ok(createFakeSdOnCallOverride()))
  repo.findOverrideById.mockResolvedValue(ok(createFakeSdOnCallOverride()))
  repo.deleteOverride.mockResolvedValue(ok(undefined))
  repo.findActiveForDepartment.mockResolvedValue(
    ok(createFakeSdOnCallSchedule({ id: SCH })),
  )
})

describe('SdOnCallService.list / get', () => {
  it('lets agents read the schedules', async () => {
    actAs('agent')
    const list = expectOk(
      await SdOnCallService.list('u1', WS, { includeInactive: true }),
    )
    expect(list[0].layers[0].participants).toHaveLength(2)
    expect(repo.list).toHaveBeenCalledWith(WS, { includeInactive: true })
    expectOk(await SdOnCallService.list('u1', WS))
    expect(repo.list).toHaveBeenLastCalledWith(WS, { includeInactive: false })
    expect(expectOk(await SdOnCallService.get('u1', WS, SCH)).name).toBe(
      'Plantão de redes',
    )
  })

  it('refuses requesters, outsiders and a disabled module', async () => {
    actAs('requester')
    expectErr(await SdOnCallService.list('u1', WS), 'SD_NOT_AGENT')
    actAs('stranger')
    expectErr(await SdOnCallService.list('u1', WS), 'FORBIDDEN')
    actAs('disabled')
    expectErr(await SdOnCallService.list('u1', WS), 'MODULE_DISABLED')
  })

  it('propagates database errors', async () => {
    actAs('agent')
    repo.list.mockResolvedValue(err(databaseError()))
    expectErr(await SdOnCallService.list('u1', WS), 'DATABASE_ERROR')
    repo.findById.mockResolvedValue(err(databaseError()))
    expectErr(await SdOnCallService.get('u1', WS, SCH), 'DATABASE_ERROR')
  })
})

describe('SdOnCallService.create / update / remove', () => {
  it('creates a schedule and audits it', async () => {
    const created = expectOk(await SdOnCallService.create('u1', WS, dto))
    expect(created.id).toBe(SCH)
    expect(repo.create).toHaveBeenCalledWith(
      WS,
      expect.objectContaining({
        name: 'Plantão de redes',
        departmentId: 'dep-1',
        rotation: 'WEEKLY',
        handoffTime: '09:00',
        createdById: 'u1',
      }),
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_oncall_schedule',
        action: 'create',
        targetId: SCH,
      }),
    )
  })

  it('only lets module admins write', async () => {
    actAs('agent')
    expectErr(await SdOnCallService.create('u1', WS, dto), 'FORBIDDEN')
    expectErr(
      await SdOnCallService.update('u1', WS, SCH, { active: false }),
      'FORBIDDEN',
    )
    expectErr(await SdOnCallService.remove('u1', WS, SCH), 'FORBIDDEN')
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('refuses a department or calendar from another workspace', async () => {
    config.findExistingRefs.mockResolvedValue(
      ok({ departmentIds: [], calendarIds: [] } as never),
    )
    expectErr(
      await SdOnCallService.create('u1', WS, dto),
      'SD_CONFIG_NOT_FOUND',
    )
    expect(repo.create).not.toHaveBeenCalled()
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure' }),
    )
  })

  it('updates only the fields given', async () => {
    expectOk(
      await SdOnCallService.update('u1', WS, SCH, {
        handoffTime: '20:00',
        calendarId: 'cal-1',
        departmentId: null,
      }),
    )
    expect(repo.update).toHaveBeenCalledWith(SCH, WS, {
      handoffTime: '20:00',
      calendarId: 'cal-1',
      departmentId: null,
    })
  })

  it('reports an unknown schedule on update and delete', async () => {
    repo.findById.mockResolvedValue(
      err({ code: 'SD_ONCALL_SCHEDULE_NOT_FOUND', message: 'x', status: 404 }),
    )
    expectErr(
      await SdOnCallService.update('u1', WS, SCH, { active: false }),
      'SD_ONCALL_SCHEDULE_NOT_FOUND',
    )
    expectErr(
      await SdOnCallService.remove('u1', WS, SCH),
      'SD_ONCALL_SCHEDULE_NOT_FOUND',
    )
    expect(repo.update).not.toHaveBeenCalled()
    expect(repo.softDelete).not.toHaveBeenCalled()
  })

  it('soft-deletes the schedule', async () => {
    expectOk(await SdOnCallService.remove('u1', WS, SCH))
    expect(repo.softDelete).toHaveBeenCalledWith(SCH, WS)
  })

  it('propagates a database error of the write', async () => {
    repo.create.mockResolvedValue(err(databaseError()))
    expectErr(await SdOnCallService.create('u1', WS, dto), 'DATABASE_ERROR')
    repo.update.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdOnCallService.update('u1', WS, SCH, { active: true }),
      'DATABASE_ERROR',
    )
  })
})

describe('SdOnCallService — camadas', () => {
  it('adds a layer and returns the whole schedule', async () => {
    const saved = expectOk(
      await SdOnCallService.addLayer('u1', WS, SCH, {
        name: 'Retaguarda',
        level: 2,
      }),
    )
    expect(saved.id).toBe(SCH)
    expect(repo.createLayer).toHaveBeenCalledWith(SCH, {
      name: 'Retaguarda',
      level: 2,
    })
  })

  it('refuses a repeated level', async () => {
    expectErr(
      await SdOnCallService.addLayer('u1', WS, SCH, {
        name: 'Outra primeira',
        level: 1,
      }),
      'SD_ONCALL_LAYER_INVALID',
    )
    expect(repo.createLayer).not.toHaveBeenCalled()
  })

  it('renames a layer and rejects a level already taken', async () => {
    repo.findById.mockResolvedValue(
      ok(
        createFakeSdOnCallSchedule({
          id: SCH,
          layers: [
            ...createFakeSdOnCallSchedule().layers,
            {
              id: 'layer-2',
              scheduleId: SCH,
              name: 'Retaguarda',
              level: 2,
              participants: [],
            },
          ],
        }),
      ),
    )
    expectOk(
      await SdOnCallService.updateLayer('u1', WS, SCH, 'layer-1', {
        name: 'N1',
      }),
    )
    expect(repo.updateLayer).toHaveBeenCalledWith('layer-1', SCH, {
      name: 'N1',
    })
    expectErr(
      await SdOnCallService.updateLayer('u1', WS, SCH, 'layer-1', { level: 2 }),
      'SD_ONCALL_LAYER_INVALID',
    )
    // Manter o próprio nível é válido.
    expectOk(
      await SdOnCallService.updateLayer('u1', WS, SCH, 'layer-1', { level: 1 }),
    )
  })

  it('reports an unknown layer', async () => {
    expectErr(
      await SdOnCallService.updateLayer('u1', WS, SCH, 'nope', { name: 'x' }),
      'SD_ONCALL_LAYER_INVALID',
    )
    expectErr(
      await SdOnCallService.removeLayer('u1', WS, SCH, 'nope'),
      'SD_ONCALL_LAYER_INVALID',
    )
    expectErr(
      await SdOnCallService.setParticipants('u1', WS, SCH, 'nope', {
        userIds: ['u1'],
      }),
      'SD_ONCALL_LAYER_INVALID',
    )
  })

  it('removes a layer', async () => {
    expectOk(await SdOnCallService.removeLayer('u1', WS, SCH, 'layer-1'))
    expect(repo.deleteLayer).toHaveBeenCalledWith('layer-1', SCH)
  })

  it('propagates the repository errors of the layer writes', async () => {
    repo.createLayer.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdOnCallService.addLayer('u1', WS, SCH, { name: 'x', level: 3 }),
      'DATABASE_ERROR',
    )
    repo.updateLayer.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdOnCallService.updateLayer('u1', WS, SCH, 'layer-1', {
        name: 'x',
      }),
      'DATABASE_ERROR',
    )
    repo.deleteLayer.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdOnCallService.removeLayer('u1', WS, SCH, 'layer-1'),
      'DATABASE_ERROR',
    )
    repo.setParticipants.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdOnCallService.setParticipants('u1', WS, SCH, 'layer-1', {
        userIds: ['u1'],
      }),
      'DATABASE_ERROR',
    )
  })

  it('propagates a failure to load the schedule of every layer write', async () => {
    repo.findById.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdOnCallService.addLayer('u1', WS, SCH, { name: 'x', level: 2 }),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdOnCallService.updateLayer('u1', WS, SCH, 'layer-1', {
        name: 'x',
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdOnCallService.removeLayer('u1', WS, SCH, 'layer-1'),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdOnCallService.setParticipants('u1', WS, SCH, 'layer-1', {
        userIds: ['u1'],
      }),
      'DATABASE_ERROR',
    )
    expect(repo.createLayer).not.toHaveBeenCalled()
    expect(repo.setParticipants).not.toHaveBeenCalled()
  })

  it('fails when the schedule disappears while reloading', async () => {
    repo.findById
      .mockResolvedValueOnce(ok(createFakeSdOnCallSchedule({ id: SCH })))
      .mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdOnCallService.removeLayer('u1', WS, SCH, 'layer-1'),
      'DATABASE_ERROR',
    )
  })
})

describe('SdOnCallService — participantes', () => {
  it('replaces the list in the given order', async () => {
    expectOk(
      await SdOnCallService.setParticipants('u1', WS, SCH, 'layer-1', {
        userIds: ['u2', 'u1'],
      }),
    )
    expect(repo.setParticipants).toHaveBeenCalledWith('layer-1', ['u2', 'u1'])
  })

  it('accepts an empty layer', async () => {
    expectOk(
      await SdOnCallService.setParticipants('u1', WS, SCH, 'layer-1', {
        userIds: [],
      }),
    )
    expect(repo.setParticipants).toHaveBeenCalledWith('layer-1', [])
  })

  it('refuses a participant who is not a member', async () => {
    config.findExistingRefs.mockResolvedValue(ok({ userIds: [] } as never))
    expectErr(
      await SdOnCallService.setParticipants('u1', WS, SCH, 'layer-1', {
        userIds: ['intruso'],
      }),
      'SD_CONFIG_NOT_FOUND',
    )
    expect(repo.setParticipants).not.toHaveBeenCalled()
  })

  it('only lets admins change the rotation', async () => {
    actAs('agent')
    expectErr(
      await SdOnCallService.setParticipants('u1', WS, SCH, 'layer-1', {
        userIds: ['u1'],
      }),
      'FORBIDDEN',
    )
  })
})

describe('SdOnCallService — trocas', () => {
  const overrideDto = {
    scheduleId: SCH,
    layerId: 'layer-1',
    userId: 'u3',
    startsAt: new Date('2026-10-07T00:00:00.000Z'),
    endsAt: new Date('2026-10-08T00:00:00.000Z'),
    reason: 'Consulta',
  }

  it('lists the overrides that have not ended yet', async () => {
    actAs('agent')
    const list = expectOk(
      await SdOnCallService.listOverrides('u1', WS, { limit: 10 }),
    )
    expect(list[0].reason).toBe('Consulta médica')
    expect(repo.listOverrides).toHaveBeenCalledWith(
      WS,
      expect.objectContaining({ limit: 10, from: expect.any(Date) }),
    )
  })

  it('keeps an explicit window', async () => {
    actAs('agent')
    const from = new Date('2026-01-01T00:00:00.000Z')
    expectOk(await SdOnCallService.listOverrides('u1', WS, { from, limit: 5 }))
    expect(repo.listOverrides).toHaveBeenCalledWith(
      WS,
      expect.objectContaining({ from }),
    )
  })

  it('registers an override', async () => {
    const created = expectOk(
      await SdOnCallService.createOverride('u1', WS, overrideDto),
    )
    expect(created.scheduleName).toBe('Plantão de redes')
    expect(repo.createOverride).toHaveBeenCalledWith(WS, {
      scheduleId: SCH,
      layerId: 'layer-1',
      userId: 'u3',
      startsAt: overrideDto.startsAt,
      endsAt: overrideDto.endsAt,
      reason: 'Consulta',
      createdById: 'u1',
    })
  })

  it('accepts an override without layer and without reason', async () => {
    expectOk(
      await SdOnCallService.createOverride('u1', WS, {
        scheduleId: SCH,
        userId: 'u3',
        startsAt: overrideDto.startsAt,
        endsAt: overrideDto.endsAt,
      }),
    )
    expect(repo.createOverride).toHaveBeenCalledWith(
      WS,
      expect.objectContaining({ layerId: null, reason: null }),
    )
  })

  it('refuses an override that overlaps the same layer', async () => {
    repo.listOverridesInRange.mockResolvedValue(
      ok([
        createFakeSdOnCallOverride({
          layerId: 'layer-1',
          startsAt: new Date('2026-10-07T12:00:00.000Z'),
          endsAt: new Date('2026-10-09T00:00:00.000Z'),
        }),
      ]),
    )
    expectErr(
      await SdOnCallService.createOverride('u1', WS, overrideDto),
      'SD_ONCALL_OVERRIDE_OVERLAP',
    )
    expect(repo.createOverride).not.toHaveBeenCalled()
  })

  it('allows an override on another layer in the same window', async () => {
    repo.listOverridesInRange.mockResolvedValue(
      ok([createFakeSdOnCallOverride({ layerId: 'layer-9' })]),
    )
    repo.findById.mockResolvedValue(
      ok(
        createFakeSdOnCallSchedule({
          id: SCH,
          layers: [
            ...createFakeSdOnCallSchedule().layers,
            {
              id: 'layer-9',
              scheduleId: SCH,
              name: 'Retaguarda',
              level: 2,
              participants: [],
            },
          ],
        }),
      ),
    )
    expectOk(await SdOnCallService.createOverride('u1', WS, overrideDto))
    expect(repo.createOverride).toHaveBeenCalled()
  })

  it('refuses an unknown layer, an unknown schedule and a stranger', async () => {
    expectErr(
      await SdOnCallService.createOverride('u1', WS, {
        ...overrideDto,
        layerId: 'nope',
      }),
      'SD_ONCALL_LAYER_INVALID',
    )
    config.findExistingRefs.mockResolvedValue(ok({ userIds: [] } as never))
    expectErr(
      await SdOnCallService.createOverride('u1', WS, overrideDto),
      'SD_CONFIG_NOT_FOUND',
    )
    repo.findById.mockResolvedValue(
      err({ code: 'SD_ONCALL_SCHEDULE_NOT_FOUND', message: 'x', status: 404 }),
    )
    expectErr(
      await SdOnCallService.createOverride('u1', WS, overrideDto),
      'SD_ONCALL_SCHEDULE_NOT_FOUND',
    )
  })

  it('propagates the database errors of the override flow', async () => {
    repo.listOverridesInRange.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdOnCallService.createOverride('u1', WS, overrideDto),
      'DATABASE_ERROR',
    )
    repo.listOverridesInRange.mockResolvedValue(ok([]))
    repo.createOverride.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdOnCallService.createOverride('u1', WS, overrideDto),
      'DATABASE_ERROR',
    )
    repo.listOverrides.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdOnCallService.listOverrides('u1', WS, { limit: 10 }),
      'DATABASE_ERROR',
    )
  })

  it('deletes an override and reports a missing one', async () => {
    expectOk(await SdOnCallService.removeOverride('u1', WS, 'ov-1'))
    expect(repo.deleteOverride).toHaveBeenCalledWith('ov-1', WS)
    repo.findOverrideById.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdOnCallService.removeOverride('u1', WS, 'ov-1'),
      'DATABASE_ERROR',
    )
  })

  it('only lets admins touch the overrides', async () => {
    actAs('agent')
    expectErr(
      await SdOnCallService.createOverride('u1', WS, overrideDto),
      'FORBIDDEN',
    )
    expectErr(
      await SdOnCallService.removeOverride('u1', WS, 'ov-1'),
      'FORBIDDEN',
    )
  })
})

describe('SdOnCallService.now', () => {
  const at = new Date('2026-10-06T00:00:00.000Z')

  it('answers who is on call in every schedule', async () => {
    actAs('agent')
    const list = expectOk(await SdOnCallService.now('u1', WS, { at }))
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      scheduleName: 'Plantão de redes',
      applies: true,
      offHours: true,
    })
    expect(list[0].layers[0]).toMatchObject({
      userId: 'u1',
      source: 'rotation',
    })
    expect(repo.list).toHaveBeenCalledWith(WS)
  })

  it('answers for one department, using the schedule that covers it', async () => {
    actAs('agent')
    const list = expectOk(
      await SdOnCallService.now('u1', WS, { departmentId: 'dep-1', at }),
    )
    expect(list).toHaveLength(1)
    expect(repo.findActiveForDepartment).toHaveBeenCalledWith(WS, 'dep-1')
  })

  it('answers an empty list when the department has no schedule', async () => {
    actAs('agent')
    repo.findActiveForDepartment.mockResolvedValue(ok(null))
    expect(
      expectOk(
        await SdOnCallService.now('u1', WS, { departmentId: 'dep-1', at }),
      ),
    ).toEqual([])
  })

  it('defaults to the current instant', async () => {
    actAs('agent')
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-13T03:00:00.000Z'))
    const list = expectOk(await SdOnCallService.now('u1', WS))
    vi.useRealTimers()
    // Segundo período do rodízio: a vez é do segundo participante.
    expect(list[0].layers[0].userId).toBe('u2')
    expect(list[0].at).toBe('2026-10-13T03:00:00.000Z')
  })

  it('refuses requesters and propagates database errors', async () => {
    actAs('requester')
    expectErr(await SdOnCallService.now('u1', WS), 'SD_NOT_AGENT')
    actAs('agent')
    repo.listOverridesInRange.mockResolvedValue(err(databaseError()))
    expectErr(await SdOnCallService.now('u1', WS, { at }), 'DATABASE_ERROR')
    repo.list.mockResolvedValue(err(databaseError()))
    expectErr(await SdOnCallService.now('u1', WS, { at }), 'DATABASE_ERROR')
    repo.findActiveForDepartment.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdOnCallService.now('u1', WS, { departmentId: 'dep-1', at }),
      'DATABASE_ERROR',
    )
  })
})

describe('SdOnCallService.timeline', () => {
  it('builds two weeks from now by default', async () => {
    actAs('agent')
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-06T00:00:00.000Z'))
    const timeline = expectOk(
      await SdOnCallService.timeline('u1', WS, SCH, { days: 14 }),
    )
    vi.useRealTimers()
    expect(timeline.from).toBe('2026-10-06T00:00:00.000Z')
    expect(timeline.to).toBe('2026-10-20T00:00:00.000Z')
    expect(timeline.layers[0].segments.map((s) => s.userId)).toEqual([
      'u1',
      'u2',
      'u1',
    ])
  })

  it('accepts an explicit window', async () => {
    actAs('agent')
    const from = new Date('2026-10-06T00:00:00.000Z')
    const timeline = expectOk(
      await SdOnCallService.timeline('u1', WS, SCH, { from, days: 1 }),
    )
    expect(timeline.to).toBe('2026-10-07T00:00:00.000Z')
    expect(repo.listOverridesInRange).toHaveBeenCalledWith(
      SCH,
      from,
      new Date('2026-10-07T00:00:00.000Z'),
    )
  })

  it('refuses requesters, unknown schedules and propagates errors', async () => {
    actAs('requester')
    expectErr(
      await SdOnCallService.timeline('u1', WS, SCH, { days: 14 }),
      'SD_NOT_AGENT',
    )
    actAs('agent')
    repo.listOverridesInRange.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdOnCallService.timeline('u1', WS, SCH, { days: 14 }),
      'DATABASE_ERROR',
    )
    repo.findById.mockResolvedValue(
      err({ code: 'SD_ONCALL_SCHEDULE_NOT_FOUND', message: 'x', status: 404 }),
    )
    expectErr(
      await SdOnCallService.timeline('u1', WS, SCH, { days: 14 }),
      'SD_ONCALL_SCHEDULE_NOT_FOUND',
    )
  })
})
