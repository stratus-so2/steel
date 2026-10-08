import { describe, expect, it } from 'vitest'
import {
  addMember,
  authenticatedOwner,
  deleteJson,
  getJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { prisma } from '@/src/lib/prisma'

describe('Steel AI memory routes', () => {
  it('adds, searches, edits and deletes personal facts', async () => {
    const { workspace } = await authenticatedOwner()
    const member = await addMember(workspace.id, 'MEMBER')
    const base = `/api/workspaces/${workspace.id}/ai/memories`

    const created = await postJson(
      base,
      { content: 'Prefiro respostas em tópicos' },
      member.cookie,
    )
    expect(created.status).toBe(201)
    const memory = (await created.json()).data
    expect(memory).toMatchObject({
      scope: 'PERSONAL',
      source: 'MANUAL',
      canEdit: true,
    })

    const dup = await postJson(
      base,
      { content: 'prefiro respostas em tópicos!' },
      member.cookie,
    )
    expect(dup.status).toBe(409)

    const list = (
      await (await getJson(`${base}?q=TÓPICOS`, member.cookie)).json()
    ).data
    expect(list.memoryEnabled).toBe(true)
    expect(list.personal).toHaveLength(1)

    const edited = await patchJson(
      `${base}/${memory.id}`,
      { content: 'Prefiro tabelas' },
      member.cookie,
    )
    expect(edited.status).toBe(200)
    expect((await edited.json()).data.content).toBe('Prefiro tabelas')

    const other = await addMember(workspace.id, 'MEMBER')
    expect(
      (await deleteJson(`${base}/${memory.id}`, other.cookie)).status,
    ).toBe(404)
    expect(
      (await deleteJson(`${base}/${memory.id}`, member.cookie)).status,
    ).toBe(200)
  })

  it('keeps workspace facts for admins and refuses secrets', async () => {
    const { user: owner, workspace } = await authenticatedOwner()
    const member = await addMember(workspace.id, 'MEMBER')
    const base = `/api/workspaces/${workspace.id}/ai/memories`

    const denied = await postJson(
      base,
      { scope: 'WORKSPACE', content: 'O suporte atende das 8h às 18h' },
      member.cookie,
    )
    expect(denied.status).toBe(403)
    const shared = await postJson(
      base,
      { scope: 'WORKSPACE', content: 'O suporte atende das 8h às 18h' },
      owner.cookie,
    )
    expect(shared.status).toBe(201)
    const id = (await shared.json()).data.id

    const seen = (await (await getJson(base, member.cookie)).json()).data
    expect(seen.workspace[0]).toMatchObject({ id, canEdit: false })
    expect(
      (await patchJson(`${base}/${id}`, { content: 'x' }, member.cookie))
        .status,
    ).toBe(403)

    const secret = await postJson(
      base,
      { content: 'A senha do Wi-Fi é abc12345' },
      owner.cookie,
    )
    expect(secret.status).toBe(422)
  })

  it('refuses new facts while memory is off, but still lists them', async () => {
    const { user, workspace } = await authenticatedOwner()
    await prisma.workspaceAiSettings.create({
      data: {
        workspaceId: workspace.id,
        enabledModels: ['openai:gpt-4o-mini'],
        crmAssistantModel: 'openai:gpt-4o-mini',
        whatsappReplyModel: 'openai:gpt-4o-mini',
        whatsappSentimentModel: 'openai:gpt-4o-mini',
        memoryEnabled: false,
      },
    })
    const base = `/api/workspaces/${workspace.id}/ai/memories`
    const res = await postJson(base, { content: 'Fato' }, user.cookie)
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('AI_MEMORY_DISABLED')
    const list = (await (await getJson(base, user.cookie)).json()).data
    expect(list.memoryEnabled).toBe(false)
  })

  it('forbids a non-member', async () => {
    const { workspace } = await authenticatedOwner()
    const { user: stranger } = await authenticatedOwner()
    const res = await getJson(
      `/api/workspaces/${workspace.id}/ai/memories`,
      stranger.cookie,
    )
    expect(res.status).toBe(403)
  })
})
