import { describe, expect, it } from 'vitest'
import {
  createAuthenticatedUser,
  deleteJson,
  getJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { setupTabs, tabApi } from './sd-tab-e2e.helpers'

describe('ticket tasks', () => {
  it('is agent-only', async () => {
    const { workspace, requester, ticket } = await setupTabs()
    const base = tabApi(workspace.id, ticket.id)
    const list = await getJson(`${base}/tasks`, requester.cookie)
    expect(list.status).toBe(403)
    expect((await list.json()).error.code).toBe('SD_NOT_AGENT')
    const create = await postJson(
      `${base}/tasks`,
      { title: 'x' },
      requester.cookie,
    )
    expect((await create.json()).error.code).toBe('SD_NOT_AGENT')
  })

  it('creates, completes, reorders and deletes tasks', async () => {
    const { workspace, agent, ticket, other } = await setupTabs()
    const base = tabApi(workspace.id, ticket.id)

    const first = await postJson(
      `${base}/tasks`,
      {
        title: 'Trocar o fusor',
        assigneeId: agent.id,
        dueDate: new Date(Date.now() - 60_000).toISOString(),
      },
      agent.cookie,
    )
    expect(first.status).toBe(201)
    const a = (await first.json()).data
    expect(a.position).toBe(0)
    expect(a.assignee.id).toBe(agent.id)
    expect(a.overdue).toBe(true)

    const b = (
      await (
        await postJson(
          `${base}/tasks`,
          { title: 'Testar impressão' },
          agent.cookie,
        )
      ).json()
    ).data
    expect(b.position).toBe(1)

    const outsider = await createAuthenticatedUser()
    const badAssignee = await postJson(
      `${base}/tasks`,
      { title: 'x', assigneeId: outsider.id },
      agent.cookie,
    )
    expect(badAssignee.status).toBe(422)

    const done = await patchJson(
      `${base}/tasks/${a.id}`,
      { status: 'DONE' },
      agent.cookie,
    )
    expect(done.status).toBe(200)
    const doneBody = (await done.json()).data
    expect(doneBody.completedAt).not.toBeNull()
    expect(doneBody.overdue).toBe(false)

    const list = (await (await getJson(`${base}/tasks`, agent.cookie)).json())
      .data
    expect(list.progress).toEqual({ done: 1, total: 2, percent: 50 })

    const reopened = (
      await (
        await patchJson(
          `${base}/tasks/${a.id}`,
          { status: 'TODO' },
          agent.cookie,
        )
      ).json()
    ).data
    expect(reopened.completedAt).toBeNull()

    const reordered = await patchJson(
      `${base}/tasks/reorder`,
      { orderedIds: [b.id, a.id] },
      agent.cookie,
    )
    expect(reordered.status).toBe(200)
    expect(
      (await reordered.json()).data.items.map((t: { id: string }) => t.id),
    ).toEqual([b.id, a.id])

    const badOrder = await patchJson(
      `${base}/tasks/reorder`,
      { orderedIds: [a.id, 'nope'] },
      agent.cookie,
    )
    expect(badOrder.status).toBe(422)

    const cross = await patchJson(
      `${tabApi(workspace.id, other.id)}/tasks/${a.id}`,
      { title: 'x' },
      agent.cookie,
    )
    expect(cross.status).toBe(404)
    expect((await cross.json()).error.code).toBe('SD_TASK_NOT_FOUND')

    const removed = await deleteJson(`${base}/tasks/${b.id}`, agent.cookie)
    expect(removed.status).toBe(200)
    const after = (await (await getJson(`${base}/tasks`, agent.cookie)).json())
      .data
    expect(after.items).toHaveLength(1)

    const empty = await patchJson(`${base}/tasks/${a.id}`, {}, agent.cookie)
    expect(empty.status).toBe(422)
  })
})
