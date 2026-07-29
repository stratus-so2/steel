import { describe, expect, it } from 'vitest'
import {
  authenticatedOwner,
  getJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { prisma } from '@/src/lib/prisma'

describe('module isolation for dashboards and reports', () => {
  it('should keep CRM and WhatsApp dashboards in separate lists', async () => {
    const { user, workspace } = await authenticatedOwner()

    const crmRes = await postJson(
      `/api/workspaces/${workspace.id}/crm/dashboards`,
      { title: 'Painel CRM' },
      user.cookie,
    )
    expect(crmRes.status).toBe(201)

    const waRes = await postJson(
      `/api/workspaces/${workspace.id}/whatsapp/dashboards`,
      { title: 'Painel WhatsApp' },
      user.cookie,
    )
    expect(waRes.status).toBe(201)

    const crmList = await getJson(
      `/api/workspaces/${workspace.id}/crm/dashboards`,
      user.cookie,
    )
    const crmBody = await crmList.json()
    expect(crmBody.data.map((d: { title: string }) => d.title)).toEqual([
      'Painel CRM',
    ])

    const waList = await getJson(
      `/api/workspaces/${workspace.id}/whatsapp/dashboards`,
      user.cookie,
    )
    const waBody = await waList.json()
    expect(waBody.data.map((d: { title: string }) => d.title)).toEqual([
      'Painel WhatsApp',
    ])
  })

  it('should keep CRM and WhatsApp reports in separate lists', async () => {
    const { user, workspace } = await authenticatedOwner()

    await postJson(
      `/api/workspaces/${workspace.id}/crm/reports`,
      { name: 'Relatório CRM', source: 'company', columns: ['name'] },
      user.cookie,
    )
    await postJson(
      `/api/workspaces/${workspace.id}/whatsapp/reports`,
      {
        name: 'Relatório WhatsApp',
        source: 'whatsapp_conversation',
        columns: ['contactName'],
      },
      user.cookie,
    )

    const crmList = await getJson(
      `/api/workspaces/${workspace.id}/crm/reports`,
      user.cookie,
    )
    const crmBody = await crmList.json()
    expect(crmBody.data.map((r: { name: string }) => r.name)).toEqual([
      'Relatório CRM',
    ])

    const waList = await getJson(
      `/api/workspaces/${workspace.id}/whatsapp/reports`,
      user.cookie,
    )
    const waBody = await waList.json()
    expect(waBody.data.map((r: { name: string }) => r.name)).toEqual([
      'Relatório WhatsApp',
    ])
  })

  it('should run a whatsapp_conversation report and return real conversation rows', async () => {
    const { user, workspace } = await authenticatedOwner()

    const connection = await prisma.whatsAppConnection.create({
      data: {
        workspaceId: workspace.id,
        provider: 'ZAPI',
        label: 'Principal',
        phoneNumber: `5511${Date.now()}`.slice(0, 13),
        zapiInstanceId: `instance-${Date.now()}`,
        encryptedZapiToken: 'enc:token',
        createdById: user.id,
      },
    })
    const contact = await prisma.whatsAppContact.create({
      data: {
        workspaceId: workspace.id,
        waId: `5511987${Date.now()}`.slice(0, 13),
        name: 'Maria',
      },
    })
    await prisma.whatsAppConversation.create({
      data: {
        workspaceId: workspace.id,
        connectionId: connection.id,
        contactId: contact.id,
        status: 'NEW',
      },
    })

    const createRes = await postJson(
      `/api/workspaces/${workspace.id}/whatsapp/reports`,
      {
        name: 'Conversas',
        source: 'whatsapp_conversation',
        columns: ['contactName', 'status'],
      },
      user.cookie,
    )
    const report = (await createRes.json()).data

    const dataRes = await getJson(
      `/api/workspaces/${workspace.id}/whatsapp/reports/${report.id}/data`,
      user.cookie,
    )
    expect(dataRes.status).toBe(200)
    const data = (await dataRes.json()).data
    expect(data.total).toBe(1)
    expect(data.rows[0]['whatsapp_conversation.contactName']).toBe('Maria')
  })
})
