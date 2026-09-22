import { describe, expect, it } from 'vitest'
import {
  addMember,
  authenticatedOwner,
  createAuthenticatedUser,
  deleteJson,
  getJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'

const base = (workspaceId: string) =>
  `/api/workspaces/${workspaceId}/servicedesk/contacts`

describe('/api/workspaces/[id]/servicedesk/contacts', () => {
  it('returns 403 for a non-member and SD_NOT_AGENT for a requester', async () => {
    const { workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()
    expect((await getJson(base(workspace.id), stranger.cookie)).status).toBe(
      403,
    )
    const requester = await addMember(workspace.id, 'MEMBER')
    const res = await getJson(base(workspace.id), requester.cookie)
    expect((await res.json()).error.code).toBe('SD_NOT_AGENT')
  })

  it('creates a contact linked to a company, finds it by whatsapp and deletes it', async () => {
    const { user, workspace } = await authenticatedOwner()
    const company = (
      await (
        await postJson(
          `/api/workspaces/${workspace.id}/servicedesk/customers`,
          { kind: 'COMPANY', name: 'Acme' },
          user.cookie,
        )
      ).json()
    ).data

    const created = await postJson(
      base(workspace.id),
      {
        name: 'Ana',
        whatsapp: '(11) 98765-4321',
        userId: user.id,
        customers: [{ customerId: company.id }],
      },
      user.cookie,
    )
    expect(created.status).toBe(201)
    const contact = (await created.json()).data
    expect(contact).toMatchObject({
      whatsapp: '5511987654321',
      userId: user.id,
      customers: [{ id: company.id, name: 'Acme', isPrimary: true }],
    })

    const lookup = await getJson(
      `${base(workspace.id)}/lookup?whatsapp=551187654321`,
      user.cookie,
    )
    expect((await lookup.json()).data.id).toBe(contact.id)

    const byCustomer = await getJson(
      `${base(workspace.id)}?customerId=${company.id}`,
      user.cookie,
    )
    expect((await byCustomer.json()).data.total).toBe(1)

    const options = await getJson(
      `${base(workspace.id)}/options?customerId=${company.id}`,
      user.cookie,
    )
    expect((await options.json()).data[0]).toMatchObject({
      id: contact.id,
      label: 'Ana',
    })

    const updated = await patchJson(
      `${base(workspace.id)}/${contact.id}`,
      { jobTitle: 'TI', customers: [] },
      user.cookie,
    )
    expect((await updated.json()).data).toMatchObject({
      jobTitle: 'TI',
      customers: [],
    })

    const detail = await getJson(
      `${base(workspace.id)}/${contact.id}`,
      user.cookie,
    )
    expect((await detail.json()).data.recentTickets).toEqual([])

    expect(
      (await deleteJson(`${base(workspace.id)}/${contact.id}`, user.cookie))
        .status,
    ).toBe(200)
  })

  it('rejects a user that is not a workspace member and unknown customers', async () => {
    const { user, workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()
    const res = await postJson(
      base(workspace.id),
      { name: 'Ana', userId: stranger.id },
      user.cookie,
    )
    expect(res.status).toBe(422)

    const unknown = await postJson(
      base(workspace.id),
      { name: 'Ana', customers: [{ customerId: 'nope' }] },
      user.cookie,
    )
    expect(unknown.status).toBe(404)
    expect((await unknown.json()).error.code).toBe('SD_CUSTOMER_NOT_FOUND')
  })

  it('lookup requires whatsapp or email', async () => {
    const { user, workspace } = await authenticatedOwner()
    const res = await getJson(`${base(workspace.id)}/lookup`, user.cookie)
    expect(res.status).toBe(422)
  })
})
