import { describe, expect, it } from 'vitest'
import {
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
} from '@/src/__tests__/helpers/e2e'

const url = (ws: string) => `/api/workspaces/${ws}/servicedesk/saved-views`

describe('/api/workspaces/[id]/servicedesk/saved-views', () => {
  it('creates, shares, edits and deletes views with ownership rules', async () => {
    const { user: owner, workspace } = await authenticatedOwner()
    const department = await seedSdDepartment(workspace.id)
    const agent = await addMember(workspace.id, 'MEMBER')
    await seedSdDepartmentMember(department.id, agent.id)

    const created = await postJson(
      url(workspace.id),
      {
        name: 'Minha fila',
        ticketType: 'INCIDENT',
        mode: 'LIST',
        filters: { assigneeIds: ['me'], includeClosed: false },
        sort: [{ field: 'priority', order: 'desc' }],
        columns: ['code', 'title'],
      },
      agent.cookie,
    )
    expect(created.status).toBe(201)
    const view = (await created.json()).data
    expect(view).toMatchObject({ editable: true, shared: false, mode: 'LIST' })

    // Pessoal: o owner não enxerga nem altera.
    const ownerList = await getJson(url(workspace.id), owner.cookie)
    expect((await ownerList.json()).data).toHaveLength(0)
    const hidden = await patchJson(
      `${url(workspace.id)}/${view.id}`,
      { name: 'x' },
      owner.cookie,
    )
    expect(hidden.status).toBe(404)

    const shared = await patchJson(
      `${url(workspace.id)}/${view.id}`,
      { shared: true },
      agent.cookie,
    )
    expect((await shared.json()).data.shared).toBe(true)

    // Compartilhada: admin (owner) pode editar.
    const ownerView = await getJson(url(workspace.id), owner.cookie)
    const [visible] = (await ownerView.json()).data
    expect(visible.editable).toBe(true)
    const renamed = await patchJson(
      `${url(workspace.id)}/${view.id}`,
      { name: 'Fila do N1' },
      owner.cookie,
    )
    expect((await renamed.json()).data.name).toBe('Fila do N1')

    const deleted = await deleteJson(
      `${url(workspace.id)}/${view.id}`,
      agent.cookie,
    )
    expect(deleted.status).toBe(200)
  })

  it('refuses requesters (no department)', async () => {
    const { workspace } = await authenticatedOwner()
    const requester = await addMember(workspace.id, 'MEMBER')
    const res = await getJson(url(workspace.id), requester.cookie)
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('SD_NOT_AGENT')
  })

  it('validates the body', async () => {
    const { user, workspace } = await authenticatedOwner()
    const res = await postJson(url(workspace.id), { name: '' }, user.cookie)
    expect(res.status).toBe(422)
  })
})
