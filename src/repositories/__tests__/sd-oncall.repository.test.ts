import { describe, expect, it } from 'vitest'
import {
  SD_ONCALL_ROTATION_START,
  seedSdOnCallLayer,
  seedSdOnCallOverride,
  seedSdOnCallSchedule,
} from '@/src/__tests__/factories/sd-oncall.factory'
import {
  seedSdCalendar,
  seedSdDepartment,
} from '@/src/__tests__/factories/sd-ticket-context.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { SdOnCallRepository } from '../sd-oncall.repository'

async function scenario() {
  const [workspace, other] = await Promise.all([
    seedWorkspace(),
    seedWorkspace(),
  ])
  const [admin, agent, backup] = await Promise.all([
    seedUser(),
    seedUser(),
    seedUser(),
  ])
  const department = await seedSdDepartment(workspace.id)
  return { workspace, other, admin, agent, backup, department }
}

describe('SdOnCallRepository — escalas', () => {
  it('creates, lists, finds, updates and soft-deletes', async () => {
    const { workspace, other, admin, department } = await scenario()
    const calendar = await seedSdCalendar(workspace.id)

    const created = expectOk(
      await SdOnCallRepository.create(workspace.id, {
        name: 'Plantão de redes',
        departmentId: department.id,
        calendarId: calendar.id,
        rotation: 'DAILY',
        rotationStart: SD_ONCALL_ROTATION_START,
        handoffTime: '08:30',
        createdById: admin.id,
      }),
    )
    expect(created).toMatchObject({
      rotation: 'DAILY',
      handoffTime: '08:30',
      active: true,
      layers: [],
    })
    expect(created.department?.name).toBe('Suporte N1')
    expect(created.calendar?.id).toBe(calendar.id)

    const inactive = expectOk(
      await SdOnCallRepository.create(workspace.id, {
        name: 'Antiga',
        rotationStart: SD_ONCALL_ROTATION_START,
        active: false,
        createdById: admin.id,
      }),
    )

    expect(
      expectOk(await SdOnCallRepository.list(workspace.id)).map((s) => s.id),
    ).toEqual([created.id])
    expect(
      expectOk(
        await SdOnCallRepository.list(workspace.id, { includeInactive: true }),
      ).map((s) => s.name),
    ).toEqual(['Antiga', 'Plantão de redes'])
    expect(
      expectOk(
        await SdOnCallRepository.list(workspace.id, {
          departmentId: department.id,
        }),
      ).map((s) => s.id),
    ).toEqual([created.id])
    expect(expectOk(await SdOnCallRepository.list(other.id))).toEqual([])

    expect(
      expectOk(await SdOnCallRepository.findById(created.id, workspace.id))
        .name,
    ).toBe('Plantão de redes')
    expectErr(
      await SdOnCallRepository.findById(created.id, other.id),
      'SD_ONCALL_SCHEDULE_NOT_FOUND',
    )

    const updated = expectOk(
      await SdOnCallRepository.update(created.id, workspace.id, {
        name: 'Plantão NOC',
        rotation: 'BIWEEKLY',
        departmentId: null,
        calendarId: null,
      }),
    )
    expect(updated).toMatchObject({
      name: 'Plantão NOC',
      rotation: 'BIWEEKLY',
      departmentId: null,
      calendarId: null,
    })

    expectOk(await SdOnCallRepository.softDelete(created.id, workspace.id))
    expectErr(
      await SdOnCallRepository.findById(created.id, workspace.id),
      'SD_ONCALL_SCHEDULE_NOT_FOUND',
    )
    expect(
      expectOk(
        await SdOnCallRepository.list(workspace.id, { includeInactive: true }),
      ).map((s) => s.id),
    ).toEqual([inactive.id])
  })

  it('reports a missing row on update and delete', async () => {
    const { workspace } = await scenario()
    expectErr(
      await SdOnCallRepository.update('missing', workspace.id, {
        name: 'x',
      }),
      'SD_CONFIG_NOT_FOUND',
    )
    expectErr(
      await SdOnCallRepository.softDelete('missing', workspace.id),
      'SD_CONFIG_NOT_FOUND',
    )
  })

  it('prefers the schedule of the department over the workspace-wide one', async () => {
    const { workspace, admin, department } = await scenario()
    const general = await seedSdOnCallSchedule(workspace.id, admin.id, {
      name: 'Geral',
    })
    const found = expectOk(
      await SdOnCallRepository.findActiveForDepartment(
        workspace.id,
        department.id,
      ),
    )
    // Sem escala do time, a geral cobre.
    expect(found?.id).toBe(general.id)

    const own = await seedSdOnCallSchedule(workspace.id, admin.id, {
      name: 'Do time',
      departmentId: department.id,
    })
    expect(
      expectOk(
        await SdOnCallRepository.findActiveForDepartment(
          workspace.id,
          department.id,
        ),
      )?.id,
    ).toBe(own.id)

    // Sem departamento, só a geral entra.
    expect(
      expectOk(
        await SdOnCallRepository.findActiveForDepartment(workspace.id, null),
      )?.id,
    ).toBe(general.id)
  })

  it('ignores inactive and deleted schedules when resolving a department', async () => {
    const { workspace, admin, department } = await scenario()
    await seedSdOnCallSchedule(workspace.id, admin.id, {
      departmentId: department.id,
      active: false,
    })
    expect(
      expectOk(
        await SdOnCallRepository.findActiveForDepartment(
          workspace.id,
          department.id,
        ),
      ),
    ).toBeNull()
  })
})

describe('SdOnCallRepository — camadas e participantes', () => {
  it('creates layers, replaces the participant list and keeps the order', async () => {
    const { workspace, admin, agent, backup } = await scenario()
    const schedule = await seedSdOnCallSchedule(workspace.id, admin.id)

    const first = expectOk(
      await SdOnCallRepository.createLayer(schedule.id, {
        name: 'Primeira chamada',
        level: 1,
      }),
    )
    expectOk(
      await SdOnCallRepository.createLayer(schedule.id, {
        name: 'Retaguarda',
        level: 2,
      }),
    )
    // O nível é único na escala.
    expectErr(
      await SdOnCallRepository.createLayer(schedule.id, {
        name: 'Repetida',
        level: 1,
      }),
      'SD_CONFIG_CONFLICT',
    )

    expectOk(
      await SdOnCallRepository.setParticipants(first.id, [agent.id, backup.id]),
    )
    const loaded = expectOk(
      await SdOnCallRepository.findById(schedule.id, workspace.id),
    )
    expect(loaded.layers.map((layer) => layer.level)).toEqual([1, 2])
    expect(
      loaded.layers[0].participants.map((p) => [p.userId, p.position]),
    ).toEqual([
      [agent.id, 0],
      [backup.id, 1],
    ])

    // Reordenar = mandar a lista invertida.
    expectOk(
      await SdOnCallRepository.setParticipants(first.id, [backup.id, agent.id]),
    )
    expect(
      expectOk(
        await SdOnCallRepository.findLayer(first.id, schedule.id),
      ).participants.map((p) => p.userId),
    ).toEqual([backup.id, agent.id])

    // Lista vazia esvazia a camada.
    expectOk(await SdOnCallRepository.setParticipants(first.id, []))
    expect(
      expectOk(await SdOnCallRepository.findLayer(first.id, schedule.id))
        .participants,
    ).toEqual([])
  })

  it('renames, re-levels and deletes a layer inside its schedule', async () => {
    const { workspace, admin } = await scenario()
    const schedule = await seedSdOnCallSchedule(workspace.id, admin.id)
    const other = await seedSdOnCallSchedule(workspace.id, admin.id, {
      name: 'Outra',
    })
    const layer = await seedSdOnCallLayer(schedule.id)

    expectOk(
      await SdOnCallRepository.updateLayer(layer.id, schedule.id, {
        name: 'Nível 1',
        level: 3,
      }),
    )
    expect(
      expectOk(await SdOnCallRepository.findLayer(layer.id, schedule.id)),
    ).toMatchObject({ name: 'Nível 1', level: 3 })

    // Camada de outra escala não é alcançável.
    expectErr(
      await SdOnCallRepository.findLayer(layer.id, other.id),
      'SD_ONCALL_SCHEDULE_NOT_FOUND',
    )
    expectErr(
      await SdOnCallRepository.updateLayer(layer.id, other.id, { level: 9 }),
      'SD_CONFIG_NOT_FOUND',
    )
    expectErr(
      await SdOnCallRepository.deleteLayer(layer.id, other.id),
      'SD_CONFIG_NOT_FOUND',
    )

    expectOk(await SdOnCallRepository.deleteLayer(layer.id, schedule.id))
    expect(
      expectOk(await SdOnCallRepository.findById(schedule.id, workspace.id))
        .layers,
    ).toEqual([])
  })

  it('drops the participants with the layer', async () => {
    const { workspace, admin, agent } = await scenario()
    const schedule = await seedSdOnCallSchedule(workspace.id, admin.id)
    const layer = await seedSdOnCallLayer(schedule.id)
    expectOk(await SdOnCallRepository.setParticipants(layer.id, [agent.id]))
    expectOk(await SdOnCallRepository.deleteLayer(layer.id, schedule.id))
    expect(
      expectOk(await SdOnCallRepository.findById(schedule.id, workspace.id))
        .layers,
    ).toEqual([])
  })
})

describe('SdOnCallRepository — trocas', () => {
  it('creates, lists by window and deletes', async () => {
    const { workspace, other, admin, agent } = await scenario()
    const schedule = await seedSdOnCallSchedule(workspace.id, admin.id)
    const layer = await seedSdOnCallLayer(schedule.id)

    const created = expectOk(
      await SdOnCallRepository.createOverride(workspace.id, {
        scheduleId: schedule.id,
        layerId: layer.id,
        userId: agent.id,
        startsAt: new Date('2026-10-07T00:00:00.000Z'),
        endsAt: new Date('2026-10-08T00:00:00.000Z'),
        reason: 'Consulta',
        createdById: admin.id,
      }),
    )
    expect(created.user.id).toBe(agent.id)
    expect(created.schedule.name).toBe('Plantão de redes')

    await seedSdOnCallOverride(workspace.id, schedule.id, agent.id, admin.id, {
      startsAt: new Date('2026-11-01T00:00:00.000Z'),
      endsAt: new Date('2026-11-02T00:00:00.000Z'),
    })

    expect(
      expectOk(await SdOnCallRepository.listOverrides(workspace.id)),
    ).toHaveLength(2)
    expect(
      expectOk(
        await SdOnCallRepository.listOverrides(workspace.id, {
          from: new Date('2026-10-20T00:00:00.000Z'),
        }),
      ),
    ).toHaveLength(1)
    expect(
      expectOk(
        await SdOnCallRepository.listOverrides(workspace.id, {
          scheduleId: schedule.id,
          to: new Date('2026-10-10T00:00:00.000Z'),
          limit: 1,
        }),
      ).map((o) => o.id),
    ).toEqual([created.id])
    expect(expectOk(await SdOnCallRepository.listOverrides(other.id))).toEqual(
      [],
    )

    expect(
      expectOk(
        await SdOnCallRepository.listOverridesInRange(
          schedule.id,
          new Date('2026-10-07T12:00:00.000Z'),
          new Date('2026-10-07T12:00:01.000Z'),
        ),
      ).map((o) => o.id),
    ).toEqual([created.id])

    expect(
      expectOk(
        await SdOnCallRepository.findOverrideById(created.id, workspace.id),
      ).reason,
    ).toBe('Consulta')
    expectErr(
      await SdOnCallRepository.findOverrideById(created.id, other.id),
      'SD_ONCALL_SCHEDULE_NOT_FOUND',
    )

    expectOk(await SdOnCallRepository.deleteOverride(created.id, workspace.id))
    expectErr(
      await SdOnCallRepository.deleteOverride(created.id, workspace.id),
      'SD_CONFIG_NOT_FOUND',
    )
  })

  it('keeps the overrides when the schedule is soft-deleted', async () => {
    const { workspace, admin, agent } = await scenario()
    const schedule = await seedSdOnCallSchedule(workspace.id, admin.id)
    const override = await seedSdOnCallOverride(
      workspace.id,
      schedule.id,
      agent.id,
      admin.id,
    )
    expectOk(await SdOnCallRepository.softDelete(schedule.id, workspace.id))
    expect(
      expectOk(
        await SdOnCallRepository.listOverrides(workspace.id, {
          from: new Date('2026-10-01T00:00:00.000Z'),
        }),
      ).map((o) => o.id),
    ).toEqual([override.id])
  })
})
