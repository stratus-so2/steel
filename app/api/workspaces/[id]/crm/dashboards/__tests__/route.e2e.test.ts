import { describe, expect, it } from 'vitest'
import {
  authenticatedOwner,
  deleteJson,
  getJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'

describe('CRM dashboards', () => {
  it('should create a dashboard and manage its widgets', async () => {
    const { user, workspace } = await authenticatedOwner()

    const dashboard = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/dashboards`,
        { title: 'Visão geral' },
        user.cookie,
      )
    ).json()

    const widget = await postJson(
      `/api/workspaces/${workspace.id}/crm/dashboards/${dashboard.data.id}/widgets`,
      { type: 'CHART' },
      user.cookie,
    )
    expect(widget.status).toBe(201)
    const widgetBody = await widget.json()
    expect(widgetBody.data.w).toBe(4)

    const updated = await patchJson(
      `/api/workspaces/${workspace.id}/crm/dashboards/${dashboard.data.id}/widgets/${widgetBody.data.id}`,
      { w: 6 },
      user.cookie,
    )
    expect(updated.status).toBe(200)
    const updatedBody = await updated.json()
    expect(updatedBody.data.w).toBe(6)

    const list = await getJson(
      `/api/workspaces/${workspace.id}/crm/dashboards/${dashboard.data.id}/widgets`,
      user.cookie,
    )
    const listBody = await list.json()
    expect(listBody.data).toHaveLength(1)

    const deleted = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/dashboards/${dashboard.data.id}`,
      user.cookie,
    )
    expect(deleted.status).toBe(200)
  })
})
