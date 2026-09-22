import { describe, expect, it } from 'vitest'
import {
  addMember,
  authenticatedOwner,
  createAuthenticatedUser,
  defaultHeaders,
  deleteJson,
  getJson,
  patchJson,
  postJson,
  putJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'
import { prisma } from '@/src/lib/prisma'

const sd = (workspaceId: string, path: string) =>
  `/api/workspaces/${workspaceId}/servicedesk/${path}`

describe('ServiceDesk config — access', () => {
  it('returns 401 via middleware when unauthenticated', async () => {
    const res = await fetch(`${BASE_URL}${sd('x', 'config')}`, {
      headers: defaultHeaders,
    })
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-members and MODULE_DISABLED when the module is off', async () => {
    const { user, workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()
    expect(
      (await getJson(sd(workspace.id, 'settings'), stranger.cookie)).status,
    ).toBe(403)

    await prisma.workspaceModuleAccess.updateMany({
      where: { workspaceId: workspace.id, module: 'SERVICE_DESK' },
      data: { enabled: false },
    })
    const res = await getJson(sd(workspace.id, 'settings'), user.cookie)
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('MODULE_DISABLED')
  })

  it('lets requesters read the bootstrap but not write config or list agents', async () => {
    const { workspace } = await authenticatedOwner()
    const requester = await addMember(workspace.id, 'MEMBER')

    const me = await getJson(sd(workspace.id, 'me'), requester.cookie)
    expect(me.status).toBe(200)
    expect((await me.json()).data).toMatchObject({
      isAgent: false,
      isAdmin: false,
    })

    expect(
      (await getJson(sd(workspace.id, 'config'), requester.cookie)).status,
    ).toBe(200)

    const agents = await getJson(sd(workspace.id, 'agents'), requester.cookie)
    expect(agents.status).toBe(403)
    expect((await agents.json()).error.code).toBe('SD_NOT_AGENT')

    const write = await postJson(
      sd(workspace.id, 'departments'),
      { name: 'Hack' },
      requester.cookie,
    )
    expect(write.status).toBe(403)
  })
})

describe('ServiceDesk config — admin flows', () => {
  it('restores the ITIL defaults and serves them in the bootstrap', async () => {
    const { user, workspace } = await authenticatedOwner()

    const restored = await postJson(
      sd(workspace.id, 'settings/restore-defaults'),
      {},
      user.cookie,
    )
    expect(restored.status).toBe(200)
    expect((await restored.json()).data.phases).toBe(30)

    const res = await getJson(sd(workspace.id, 'config'), user.cookie)
    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data.me).toMatchObject({ isAgent: true, isAdmin: true })
    expect(data.phases).toHaveLength(4)
    expect(data.priorityMatrix).toHaveLength(9)
    expect(data.priorities.map((p: { level: number }) => p.level)).toEqual([
      1, 2, 3, 4,
    ])
    expect(data.categories.length).toBeGreaterThan(0)
  })

  it('manages departments, members and the depth rule', async () => {
    const { user, workspace } = await authenticatedOwner()
    const agent = await addMember(workspace.id, 'MEMBER')

    const root = await postJson(
      sd(workspace.id, 'departments'),
      { name: 'Service Desk' },
      user.cookie,
    )
    expect(root.status).toBe(201)
    const rootId = (await root.json()).data.id

    const child = await postJson(
      sd(workspace.id, 'departments'),
      { name: 'N1', parentId: rootId },
      user.cookie,
    )
    expect(child.status).toBe(201)
    const childId = (await child.json()).data.id

    const tooDeep = await postJson(
      sd(workspace.id, 'departments'),
      { name: 'N1.1', parentId: childId },
      user.cookie,
    )
    expect(tooDeep.status).toBe(422)
    expect((await tooDeep.json()).error.code).toBe(
      'SD_DEPARTMENT_DEPTH_EXCEEDED',
    )

    const added = await postJson(
      sd(workspace.id, `departments/${childId}/members`),
      { userId: agent.id, isLead: true },
      user.cookie,
    )
    expect(added.status).toBe(201)
    expect((await added.json()).data.members).toMatchObject([
      { userId: agent.id, isLead: true },
    ])

    const me = await getJson(sd(workspace.id, 'me'), agent.cookie)
    expect((await me.json()).data).toMatchObject({
      isAgent: true,
      leadDepartmentIds: [childId],
    })

    const agents = await getJson(sd(workspace.id, 'agents'), agent.cookie)
    expect(agents.status).toBe(200)

    const demoted = await patchJson(
      sd(workspace.id, `departments/${childId}/members/${agent.id}`),
      { isLead: false },
      user.cookie,
    )
    expect(demoted.status).toBe(200)
    const removed = await deleteJson(
      sd(workspace.id, `departments/${childId}/members/${agent.id}`),
      user.cookie,
    )
    expect(removed.status).toBe(200)
    expect(
      (await deleteJson(sd(workspace.id, `departments/${rootId}`), user.cookie))
        .status,
    ).toBe(200)
  })

  it('validates the catalog levels, custom field keys and the priority matrix', async () => {
    const { user, workspace } = await authenticatedOwner()

    const wrongLevel = await postJson(
      sd(workspace.id, 'categories'),
      { name: 'Rede', level: 'SERVICE' },
      user.cookie,
    )
    expect(wrongLevel.status).toBe(422)
    expect((await wrongLevel.json()).error.code).toBe(
      'SD_CATEGORY_LEVEL_INVALID',
    )

    const field = {
      entity: 'TICKET',
      key: 'assetTag',
      label: 'Patrimônio',
      type: 'TEXT',
    }
    expect(
      (await postJson(sd(workspace.id, 'custom-fields'), field, user.cookie))
        .status,
    ).toBe(201)
    const dup = await postJson(
      sd(workspace.id, 'custom-fields'),
      field,
      user.cookie,
    )
    expect(dup.status).toBe(409)
    expect((await dup.json()).error.code).toBe('SD_CONFIG_CONFLICT')

    const impact = await postJson(
      sd(workspace.id, 'impacts'),
      { name: 'Alto', level: 3 },
      user.cookie,
    )
    const urgency = await postJson(
      sd(workspace.id, 'urgencies'),
      { name: 'Alta', level: 3 },
      user.cookie,
    )
    const priority = await postJson(
      sd(workspace.id, 'priorities'),
      { name: 'P1', level: 4, color: '#ef4444' },
      user.cookie,
    )
    const cells = [
      {
        impactId: (await impact.json()).data.id,
        urgencyId: (await urgency.json()).data.id,
        priorityId: (await priority.json()).data.id,
      },
    ]
    const saved = await putJson(
      sd(workspace.id, 'priority-matrix'),
      { cells },
      user.cookie,
    )
    expect(saved.status).toBe(200)
    expect((await saved.json()).data).toEqual(cells)
  })

  it('saves phases and the transitions matrix of a type', async () => {
    const { user, workspace } = await authenticatedOwner()
    const make = async (name: string, category: string) =>
      (
        await (
          await postJson(
            sd(workspace.id, 'phases'),
            { ticketType: 'PROBLEM', name, category },
            user.cookie,
          )
        ).json()
      ).data
    const open = await make('Registrado', 'NEW')
    const done = await make('Resolvido', 'RESOLVED')
    expect(open.isInitial).toBe(true)

    const put = await putJson(
      sd(workspace.id, 'phases/transitions?type=PROBLEM'),
      { transitions: [{ fromPhaseId: open.id, toPhaseId: done.id }] },
      user.cookie,
    )
    expect(put.status).toBe(200)

    const list = await getJson(
      sd(workspace.id, 'phases/transitions?type=PROBLEM'),
      user.cookie,
    )
    expect((await list.json()).data).toHaveLength(1)

    const deleteInitial = await deleteJson(
      sd(workspace.id, `phases/${open.id}`),
      user.cookie,
    )
    expect(deleteInitial.status).toBe(409)
  })
})
