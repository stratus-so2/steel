import { describe, expect, it } from 'vitest'
import {
  addMember,
  authenticatedOwner,
  deleteJson,
  getJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'

const body = {
  slug: '/Resumo-Cliente',
  name: 'Resumo do cliente',
  description: 'Chamados e oportunidades de um cliente',
  instructions: 'Resuma os chamados e as oportunidades do cliente citado.',
  toolNames: ['ws_overview'],
}

describe('Steel AI skills routes', () => {
  it('lists the built-ins to any member', async () => {
    const { workspace } = await authenticatedOwner()
    const viewer = await addMember(workspace.id, 'VIEWER')
    const res = await getJson(
      `/api/workspaces/${workspace.id}/ai/skills`,
      viewer.cookie,
    )
    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data.canManageWorkspace).toBe(false)
    expect(data.skills.map((s: { slug: string }) => s.slug)).toEqual(
      expect.arrayContaining(['my-work', 'sla', 'pipeline', 'follow-ups']),
    )
  })

  it('forbids a non-member', async () => {
    const { workspace } = await authenticatedOwner()
    const { user: stranger } = await authenticatedOwner()
    const res = await getJson(
      `/api/workspaces/${workspace.id}/ai/skills`,
      stranger.cookie,
    )
    expect(res.status).toBe(403)
  })

  it('creates, edits and deletes a personal skill', async () => {
    const { workspace } = await authenticatedOwner()
    const member = await addMember(workspace.id, 'MEMBER')
    const base = `/api/workspaces/${workspace.id}/ai/skills`

    const created = await postJson(base, body, member.cookie)
    expect(created.status).toBe(201)
    const skill = (await created.json()).data
    expect(skill).toMatchObject({
      kind: 'PERSONAL',
      slug: 'resumo-cliente',
      canEdit: true,
    })

    const dup = await postJson(base, body, member.cookie)
    expect(dup.status).toBe(409)

    const edited = await patchJson(
      `${base}/${skill.id}`,
      { name: 'Resumo', enabled: false },
      member.cookie,
    )
    expect(edited.status).toBe(200)
    expect((await edited.json()).data).toMatchObject({
      name: 'Resumo',
      enabled: false,
    })

    // Another member does not see (nor change) someone else's skill.
    const other = await addMember(workspace.id, 'MEMBER')
    const hidden = await patchJson(
      `${base}/${skill.id}`,
      { name: 'x' },
      other.cookie,
    )
    expect(hidden.status).toBe(404)

    const removed = await deleteJson(`${base}/${skill.id}`, member.cookie)
    expect(removed.status).toBe(200)
  })

  it('keeps workspace skills and built-in toggles for admins', async () => {
    const { user: owner, workspace } = await authenticatedOwner()
    const member = await addMember(workspace.id, 'MEMBER')
    const base = `/api/workspaces/${workspace.id}/ai/skills`

    const denied = await postJson(
      base,
      { ...body, scope: 'WORKSPACE' },
      member.cookie,
    )
    expect(denied.status).toBe(403)
    const shared = await postJson(
      base,
      { ...body, scope: 'WORKSPACE' },
      owner.cookie,
    )
    expect(shared.status).toBe(201)

    const toggle = `${base}/${encodeURIComponent('builtin:sla')}`
    expect(
      (await patchJson(toggle, { enabled: false }, member.cookie)).status,
    ).toBe(403)
    const off = await patchJson(toggle, { enabled: false }, owner.cookie)
    expect(off.status).toBe(200)
    expect((await off.json()).data).toMatchObject({
      id: 'builtin:sla',
      enabled: false,
    })
    expect((await patchJson(toggle, { name: 'x' }, owner.cookie)).status).toBe(
      422,
    )
    expect((await deleteJson(toggle, owner.cookie)).status).toBe(403)

    const list = (await (await getJson(base, member.cookie)).json()).data
    const sla = list.skills.find((s: { id: string }) => s.id === 'builtin:sla')
    expect(sla.enabled).toBe(false)
  })

  it('validates the command and the built-in names', async () => {
    const { user, workspace } = await authenticatedOwner()
    const base = `/api/workspaces/${workspace.id}/ai/skills`
    expect(
      (await postJson(base, { ...body, slug: 'com espaço' }, user.cookie))
        .status,
    ).toBe(422)
    expect(
      (await postJson(base, { ...body, slug: 'my-work' }, user.cookie)).status,
    ).toBe(409)
    expect(
      (await postJson(base, { ...body, toolNames: ['nope_tool'] }, user.cookie))
        .status,
    ).toBe(422)
  })
})
