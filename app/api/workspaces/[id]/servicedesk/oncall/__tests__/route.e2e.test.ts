import { describe, expect, it } from 'vitest'
import {
  seedSdCalendar,
  seedSdDepartment,
  seedSdDepartmentMember,
} from '@/src/__tests__/factories/sd-ticket-context.factory'
import {
  addMember,
  authenticatedOwner,
  deleteJson,
  getJson,
  patchJson,
  postJson,
  putJson,
} from '@/src/__tests__/helpers/e2e'

const url = (ws: string) => `/api/workspaces/${ws}/servicedesk/oncall`

/** Segunda-feira, 09:00 em São Paulo. */
const ROTATION_START = '2026-10-05T12:00:00.000Z'

describe('/api/workspaces/[id]/servicedesk/oncall', () => {
  it('runs the whole life of a schedule: layers, rotation, swap and timeline', async () => {
    const { user: owner, workspace } = await authenticatedOwner()
    const department = await seedSdDepartment(workspace.id)
    const agent = await addMember(workspace.id, 'MEMBER')
    await seedSdDepartmentMember(department.id, agent.id)
    const backup = await addMember(workspace.id, 'MEMBER')
    await seedSdDepartmentMember(department.id, backup.id)
    const calendar = await seedSdCalendar(workspace.id)

    const created = await postJson(
      url(workspace.id),
      {
        name: 'Plantão de redes',
        departmentId: department.id,
        rotation: 'WEEKLY',
        rotationStart: ROTATION_START,
        handoffTime: '09:00',
        calendarId: calendar.id,
      },
      owner.cookie,
    )
    expect(created.status).toBe(201)
    const schedule = (await created.json()).data
    expect(schedule).toMatchObject({
      name: 'Plantão de redes',
      rotation: 'WEEKLY',
      handoffTime: '09:00',
      timezone: 'America/Sao_Paulo',
      active: true,
      layers: [],
    })
    expect(schedule.calendar.id).toBe(calendar.id)

    const layer = await postJson(
      `${url(workspace.id)}/${schedule.id}/layers`,
      { name: 'Primeira chamada', level: 1 },
      owner.cookie,
    )
    expect(layer.status).toBe(201)
    const withLayer = (await layer.json()).data
    expect(withLayer.layers).toHaveLength(1)
    const layerId = withLayer.layers[0].id

    // Nível repetido na mesma escala.
    const repeated = await postJson(
      `${url(workspace.id)}/${schedule.id}/layers`,
      { name: 'Outra', level: 1 },
      owner.cookie,
    )
    expect(repeated.status).toBe(422)
    expect((await repeated.json()).error.code).toBe('SD_ONCALL_LAYER_INVALID')

    // A ordem do array é a ordem do rodízio.
    const participants = await putJson(
      `${url(workspace.id)}/${schedule.id}/layers/${layerId}/participants`,
      { userIds: [agent.id, backup.id] },
      owner.cookie,
    )
    expect(participants.status).toBe(200)
    expect(
      (await participants.json()).data.layers[0].participants.map(
        (p: { user: { id: string } }) => p.user.id,
      ),
    ).toEqual([agent.id, backup.id])

    // Reordenar é mandar a lista invertida.
    const reordered = await putJson(
      `${url(workspace.id)}/${schedule.id}/layers/${layerId}/participants`,
      { userIds: [backup.id, agent.id] },
      owner.cookie,
    )
    expect(
      (await reordered.json()).data.layers[0].participants.map(
        (p: { user: { id: string } }) => p.user.id,
      ),
    ).toEqual([backup.id, agent.id])

    // O rodízio no primeiro período é do primeiro participante.
    const now = await getJson(
      `${url(workspace.id)}/now?departmentId=${department.id}&at=2026-10-06T03:00:00.000Z`,
      agent.cookie,
    )
    expect(now.status).toBe(200)
    const [current] = (await now.json()).data
    expect(current).toMatchObject({ applies: true, offHours: true })
    expect(current.layers[0]).toMatchObject({
      userId: backup.id,
      source: 'rotation',
      level: 1,
    })

    // Dentro do expediente do calendário a escala não vale.
    const businessHours = await getJson(
      `${url(workspace.id)}/now?departmentId=${department.id}&at=2026-10-05T13:00:00.000Z`,
      agent.cookie,
    )
    const [inside] = (await businessHours.json()).data
    expect(inside).toMatchObject({ applies: false, offHours: false })

    // Troca pontual na camada.
    const swap = await postJson(
      `${url(workspace.id)}/overrides`,
      {
        scheduleId: schedule.id,
        layerId,
        userId: agent.id,
        startsAt: '2026-10-07T00:00:00.000Z',
        endsAt: '2026-10-08T00:00:00.000Z',
        reason: 'Consulta médica',
      },
      owner.cookie,
    )
    expect(swap.status).toBe(201)
    const override = (await swap.json()).data
    expect(override).toMatchObject({
      scheduleName: 'Plantão de redes',
      reason: 'Consulta médica',
    })

    // Sobreposição na mesma camada é recusada.
    const clash = await postJson(
      `${url(workspace.id)}/overrides`,
      {
        scheduleId: schedule.id,
        layerId,
        userId: backup.id,
        startsAt: '2026-10-07T12:00:00.000Z',
        endsAt: '2026-10-09T00:00:00.000Z',
      },
      owner.cookie,
    )
    expect(clash.status).toBe(409)
    expect((await clash.json()).error.code).toBe('SD_ONCALL_OVERRIDE_OVERLAP')

    // A troca vence o rodízio na janela dela.
    const duringSwap = await getJson(
      `${url(workspace.id)}/now?departmentId=${department.id}&at=2026-10-07T03:00:00.000Z`,
      agent.cookie,
    )
    expect((await duringSwap.json()).data[0].layers[0]).toMatchObject({
      userId: agent.id,
      source: 'override',
    })

    const overrides = await getJson(
      `${url(workspace.id)}/overrides?scheduleId=${schedule.id}&from=2026-10-01T00:00:00.000Z`,
      agent.cookie,
    )
    expect((await overrides.json()).data).toHaveLength(1)

    const timeline = await getJson(
      `${url(workspace.id)}/${schedule.id}/timeline?from=${ROTATION_START}&days=14`,
      agent.cookie,
    )
    expect(timeline.status).toBe(200)
    const line = (await timeline.json()).data
    expect(line.to).toBe('2026-10-19T12:00:00.000Z')
    const [first] = line.layers
    expect(first.level).toBe(1)
    expect(first.segments.map((s: { userId: string }) => s.userId)).toEqual([
      backup.id,
      agent.id,
      backup.id,
      agent.id,
    ])
    expect(first.segments[1].source).toBe('override')

    const removedSwap = await deleteJson(
      `${url(workspace.id)}/overrides/${override.id}`,
      owner.cookie,
    )
    expect(removedSwap.status).toBe(200)

    const renamed = await patchJson(
      `${url(workspace.id)}/${schedule.id}`,
      { name: 'Plantão NOC', rotation: 'DAILY', calendarId: null },
      owner.cookie,
    )
    expect((await renamed.json()).data).toMatchObject({
      name: 'Plantão NOC',
      rotation: 'DAILY',
      calendar: null,
    })

    const removedLayer = await deleteJson(
      `${url(workspace.id)}/${schedule.id}/layers/${layerId}`,
      owner.cookie,
    )
    expect((await removedLayer.json()).data.layers).toEqual([])

    const removed = await deleteJson(
      `${url(workspace.id)}/${schedule.id}`,
      owner.cookie,
    )
    expect(removed.status).toBe(200)
    const gone = await getJson(
      `${url(workspace.id)}/${schedule.id}`,
      owner.cookie,
    )
    expect(gone.status).toBe(404)
    expect((await gone.json()).error.code).toBe('SD_ONCALL_SCHEDULE_NOT_FOUND')
  })

  it('lets agents read and keeps the writes with the module admins', async () => {
    const { user: owner, workspace } = await authenticatedOwner()
    const department = await seedSdDepartment(workspace.id)
    const agent = await addMember(workspace.id, 'MEMBER')
    await seedSdDepartmentMember(department.id, agent.id)

    const created = await postJson(
      url(workspace.id),
      { name: 'Plantão', rotationStart: ROTATION_START },
      owner.cookie,
    )
    const schedule = (await created.json()).data

    const list = await getJson(url(workspace.id), agent.cookie)
    expect(list.status).toBe(200)
    expect((await list.json()).data).toHaveLength(1)

    const refused = await postJson(
      url(workspace.id),
      { name: 'Minha escala', rotationStart: ROTATION_START },
      agent.cookie,
    )
    expect(refused.status).toBe(403)

    const refusedLayer = await postJson(
      `${url(workspace.id)}/${schedule.id}/layers`,
      { name: 'Primeira', level: 1 },
      agent.cookie,
    )
    expect(refusedLayer.status).toBe(403)

    const refusedSwap = await postJson(
      `${url(workspace.id)}/overrides`,
      {
        scheduleId: schedule.id,
        userId: agent.id,
        startsAt: '2026-10-07T00:00:00.000Z',
        endsAt: '2026-10-08T00:00:00.000Z',
      },
      agent.cookie,
    )
    expect(refusedSwap.status).toBe(403)
  })

  it('refuses requesters (no department)', async () => {
    const { workspace } = await authenticatedOwner()
    const requester = await addMember(workspace.id, 'MEMBER')
    for (const path of ['', '/now', '/overrides']) {
      const res = await getJson(`${url(workspace.id)}${path}`, requester.cookie)
      expect(res.status).toBe(403)
      expect((await res.json()).error.code).toBe('SD_NOT_AGENT')
    }
  })

  it('validates the payloads and the cross-workspace ids', async () => {
    const { user: owner, workspace } = await authenticatedOwner()
    const other = await authenticatedOwner()

    const badTime = await postJson(
      url(workspace.id),
      { name: 'x', rotationStart: ROTATION_START, handoffTime: '25:00' },
      owner.cookie,
    )
    expect(badTime.status).toBe(400)

    const badTimezone = await postJson(
      url(workspace.id),
      { name: 'x', rotationStart: ROTATION_START, timezone: 'Marte/Olympus' },
      owner.cookie,
    )
    expect(badTimezone.status).toBe(400)

    const foreignDepartment = await seedSdDepartment(other.workspace.id)
    const crossWorkspace = await postJson(
      url(workspace.id),
      {
        name: 'x',
        rotationStart: ROTATION_START,
        departmentId: foreignDepartment.id,
      },
      owner.cookie,
    )
    expect(crossWorkspace.status).toBe(404)
    expect((await crossWorkspace.json()).error.code).toBe('SD_CONFIG_NOT_FOUND')

    const created = await postJson(
      url(workspace.id),
      { name: 'Plantão', rotationStart: ROTATION_START },
      owner.cookie,
    )
    const schedule = (await created.json()).data

    const invertedWindow = await postJson(
      `${url(workspace.id)}/overrides`,
      {
        scheduleId: schedule.id,
        userId: owner.id,
        startsAt: '2026-10-08T00:00:00.000Z',
        endsAt: '2026-10-07T00:00:00.000Z',
      },
      owner.cookie,
    )
    expect(invertedWindow.status).toBe(400)

    // Escala de outra workspace não é alcançável.
    const foreign = await getJson(
      `${url(other.workspace.id)}/${schedule.id}`,
      other.user.cookie,
    )
    expect(foreign.status).toBe(404)
  })
})
