import { describe, expect, it } from 'vitest'
import {
  authenticatedOwner,
  deleteJson,
  getJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'

describe('CRM reports', () => {
  it('should create a report and run its data against the source', async () => {
    const { user, workspace } = await authenticatedOwner()
    await postJson(
      `/api/workspaces/${workspace.id}/crm/companies`,
      { name: 'Acme', icp: true },
      user.cookie,
    )

    const created = await postJson(
      `/api/workspaces/${workspace.id}/crm/reports`,
      { name: 'Empresas', source: 'company', columns: ['name', 'icp'] },
      user.cookie,
    )
    expect(created.status).toBe(201)
    const createdBody = await created.json()

    const data = await getJson(
      `/api/workspaces/${workspace.id}/crm/reports/${createdBody.data.id}/data`,
      user.cookie,
    )
    expect(data.status).toBe(200)
    const dataBody = await data.json()
    expect(dataBody.data.rows).toEqual([
      { 'company.name': 'Acme', 'company.icp': true },
    ])
    expect(dataBody.data.columns).toEqual([
      { key: 'company.name', label: 'Nome' },
      { key: 'company.icp', label: 'PCI' },
    ])
    expect(dataBody.data.grouped).toBe(false)
    expect(dataBody.data.total).toBe(1)
  })

  it('should get a single report by id', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/reports`,
        { name: 'Empresas', source: 'company', columns: ['name'] },
        user.cookie,
      )
    ).json()

    const fetched = await getJson(
      `/api/workspaces/${workspace.id}/crm/reports/${created.data.id}`,
      user.cookie,
    )
    expect(fetched.status).toBe(200)
    const fetchedBody = await fetched.json()
    expect(fetchedBody.data.id).toBe(created.data.id)
    expect(fetchedBody.data.query.mode).toBe('join')
  })

  it('should update and delete a report', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/reports`,
        { name: 'Empresas', source: 'company', columns: ['name'] },
        user.cookie,
      )
    ).json()

    const updated = await patchJson(
      `/api/workspaces/${workspace.id}/crm/reports/${created.data.id}`,
      { name: 'Empresas ICP' },
      user.cookie,
    )
    expect(updated.status).toBe(200)

    const deleted = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/reports/${created.data.id}`,
      user.cookie,
    )
    expect(deleted.status).toBe(200)
  })

  it('should export the report data as CSV', async () => {
    const { user, workspace } = await authenticatedOwner()
    await postJson(
      `/api/workspaces/${workspace.id}/crm/companies`,
      { name: 'Acme' },
      user.cookie,
    )
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/reports`,
        { name: 'Empresas', source: 'company', columns: ['name'] },
        user.cookie,
      )
    ).json()

    const res = await getJson(
      `/api/workspaces/${workspace.id}/crm/reports/${created.data.id}/export`,
      user.cookie,
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    const body = await res.text()
    expect(body).toContain('Acme')
  })
})
