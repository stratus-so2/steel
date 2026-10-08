import { describe, expect, it } from 'vitest'
import {
  addMember,
  authenticatedOwner,
  createInvite,
  deleteJson,
  getJson,
  patchJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'
import { prisma } from '@/src/lib/prisma'

const base = (workspaceId: string) => `/api/workspaces/${workspaceId}/members`

describe('GET /api/workspaces/[id]/members/directory', () => {
  it('returns the paginated directory with seat usage for the owner', async () => {
    const { user, workspace } = await authenticatedOwner()
    await addMember(workspace.id, 'VIEWER')
    await createInvite(workspace.id, user.cookie)

    const res = await getJson(
      `${base(workspace.id)}/directory?sortBy=role&sortOrder=desc&pageSize=1`,
      user.cookie,
    )
    expect(res.status).toBe(200)
    const { data } = await res.json()

    expect(data.total).toBe(2)
    expect(data.members).toHaveLength(1)
    expect(data.members[0]).toMatchObject({ userId: user.id, role: 'OWNER' })
    expect(data.seats).toEqual({ used: 3, limit: 12 })
  })

  it('filters by role and search', async () => {
    const { user, workspace } = await authenticatedOwner()
    const viewer = await addMember(workspace.id, 'VIEWER')

    const res = await getJson(
      `${base(workspace.id)}/directory?roles=VIEWER&search=${encodeURIComponent(viewer.email)}`,
      user.cookie,
    )
    const { data } = await res.json()

    expect(data.members.map((m: { userId: string }) => m.userId)).toEqual([
      viewer.id,
    ])
  })

  it('returns 422 for an invalid query and 403 for a plain MEMBER', async () => {
    const { user, workspace } = await authenticatedOwner()
    const member = await addMember(workspace.id, 'MEMBER')

    expect(
      (await getJson(`${base(workspace.id)}/directory?page=0`, user.cookie))
        .status,
    ).toBe(422)
    expect(
      (await getJson(`${base(workspace.id)}/directory`, member.cookie)).status,
    ).toBe(403)
  })
})

describe('PATCH/DELETE /api/workspaces/[id]/members/[userId]', () => {
  it('lets the owner change a role and then remove the member', async () => {
    const { user, workspace } = await authenticatedOwner()
    const member = await addMember(workspace.id, 'MEMBER')
    const path = `${base(workspace.id)}/${member.id}`

    const patched = await patchJson(path, { role: 'ADMIN' }, user.cookie)
    expect(patched.status).toBe(200)
    expect((await patched.json()).data).toEqual({
      userId: member.id,
      role: 'ADMIN',
    })

    expect((await deleteJson(path, user.cookie)).status).toBe(200)
    expect(
      await prisma.membership.count({
        where: { userId: member.id, workspaceId: workspace.id },
      }),
    ).toBe(0)
    expect((await deleteJson(path, user.cookie)).status).toBe(404)
  })

  it('protects the owner and admins from another admin', async () => {
    const { user, workspace } = await authenticatedOwner()
    const admin = await addMember(workspace.id, 'ADMIN')
    const otherAdmin = await addMember(workspace.id, 'ADMIN')

    expect(
      (
        await patchJson(
          `${base(workspace.id)}/${user.id}`,
          { role: 'VIEWER' },
          admin.cookie,
        )
      ).status,
    ).toBe(403)
    expect(
      (await deleteJson(`${base(workspace.id)}/${otherAdmin.id}`, admin.cookie))
        .status,
    ).toBe(403)
  })

  it('returns 422 for OWNER as target role and 403 for a VIEWER actor', async () => {
    const { user, workspace } = await authenticatedOwner()
    const viewer = await addMember(workspace.id, 'VIEWER')
    const member = await addMember(workspace.id, 'MEMBER')

    expect(
      (
        await patchJson(
          `${base(workspace.id)}/${member.id}`,
          { role: 'OWNER' },
          user.cookie,
        )
      ).status,
    ).toBe(422)
    expect(
      (await deleteJson(`${base(workspace.id)}/${member.id}`, viewer.cookie))
        .status,
    ).toBe(403)
  })
})

describe('PATCH /api/workspaces/[id]/invitations/[invitationId]', () => {
  it('changes the role of a pending invitation', async () => {
    const { user, workspace } = await authenticatedOwner()
    await createInvite(workspace.id, user.cookie)
    const invite = await prisma.workspaceInvitation.findFirstOrThrow({
      where: { workspaceId: workspace.id },
    })

    const res = await patchJson(
      `/api/workspaces/${workspace.id}/invitations/${invite.id}`,
      { role: 'VIEWER' },
      user.cookie,
    )

    expect(res.status).toBe(200)
    expect((await res.json()).data.role).toBe('VIEWER')
  })
})

describe('POST /api/workspaces/[id]/members/import', () => {
  async function upload(workspaceId: string, cookie: string, csv: string) {
    const form = new FormData()
    form.append('file', new File([csv], 'membros.csv', { type: 'text/csv' }))
    return fetch(`${BASE_URL}${base(workspaceId)}/import`, {
      method: 'POST',
      headers: { Cookie: cookie, Origin: BASE_URL },
      body: form,
    })
  }

  it('creates one invitation per row and skips existing ones', async () => {
    const { user, workspace } = await authenticatedOwner()
    await createInvite(workspace.id, user.cookie, 'dup@example.com')

    const res = await upload(
      workspace.id,
      user.cookie,
      'email,role\nnew1@example.com,ADMIN\ndup@example.com,MEMBER\n',
    )

    expect(res.status).toBe(201)
    const { data } = await res.json()
    expect(data).toMatchObject({ invited: 1, skipped: 1, errors: 0 })
    const created = await prisma.workspaceInvitation.findFirstOrThrow({
      where: { workspaceId: workspace.id, email: 'new1@example.com' },
    })
    expect(created.role).toBe('ADMIN')
  })

  it('rejects a spreadsheet without an e-mail column', async () => {
    const { user, workspace } = await authenticatedOwner()

    const res = await upload(workspace.id, user.cookie, 'nome\nAna\n')

    expect(res.status).toBe(422)
  })

  it('forbids a plain MEMBER', async () => {
    const { workspace } = await authenticatedOwner()
    const member = await addMember(workspace.id, 'MEMBER')

    const res = await upload(workspace.id, member.cookie, 'email\na@b.com\n')

    expect(res.status).toBe(403)
  })
})
