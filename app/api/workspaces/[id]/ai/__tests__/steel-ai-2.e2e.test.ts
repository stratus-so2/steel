import { describe, expect, it } from 'vitest'
import {
  addMember,
  authenticatedOwner,
  defaultHeaders,
  deleteJson,
  getJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'
import { prisma } from '@/src/lib/prisma'

const base = (workspaceId: string) => `/api/workspaces/${workspaceId}/ai`

async function upload(
  path: string,
  cookie: string,
  file: { name: string; type: string; content: BlobPart },
) {
  const form = new FormData()
  form.append('file', new Blob([file.content], { type: file.type }), file.name)
  return fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { Origin: defaultHeaders.Origin, Cookie: cookie },
    body: form,
  })
}

async function setSwitches(
  workspaceId: string,
  data: { aiEnabled?: boolean; autopilotEnabled?: boolean },
) {
  await prisma.workspaceAiSettings.upsert({
    where: { workspaceId },
    update: data,
    create: {
      workspaceId,
      enabledModels: ['openai:gpt-4o-mini'],
      crmAssistantModel: 'openai:gpt-4o-mini',
      whatsappReplyModel: 'openai:gpt-4o-mini',
      whatsappSentimentModel: 'openai:gpt-4o-mini',
      ...data,
    },
  })
}

async function newConversation(workspaceId: string, cookie: string) {
  const res = await postJson(`${base(workspaceId)}/conversations`, {}, cookie)
  expect(res.status).toBe(201)
  return (await res.json()).data as { id: string }
}

describe('GET /ai/capabilities — Steel AI 2', () => {
  it('should report the switches, pickable models and attachment limits', async () => {
    const { user, workspace } = await authenticatedOwner()
    const res = await getJson(`${base(workspace.id)}/capabilities`, user.cookie)
    expect(res.status).toBe(200)
    const data = (await res.json()).data
    expect(data).toEqual(
      expect.objectContaining({
        aiEnabled: true,
        autopilotEnabled: false,
        models: expect.any(Array),
        attachments: expect.objectContaining({
          maxPerMessage: 5,
          maxImageBytes: 5 * 1024 * 1024,
        }),
      }),
    )
    for (const model of data.models) {
      expect(model).toEqual(
        expect.objectContaining({
          key: expect.any(String),
          inputUsdPer1M: expect.any(Number),
          outputUsdPer1M: expect.any(Number),
        }),
      )
    }
  })

  it('should keep answering, with aiEnabled false, when the AI is off', async () => {
    const { user, workspace } = await authenticatedOwner()
    await setSwitches(workspace.id, { aiEnabled: false })

    const caps = await getJson(
      `${base(workspace.id)}/capabilities`,
      user.cookie,
    )
    expect(caps.status).toBe(200)
    expect((await caps.json()).data).toEqual(
      expect.objectContaining({ aiEnabled: false, models: [] }),
    )

    for (const path of ['conversations', 'actions']) {
      const res = await getJson(`${base(workspace.id)}/${path}`, user.cookie)
      expect(res.status).toBe(403)
      expect((await res.json()).error.code).toBe('AI_DISABLED')
    }
    const created = await postJson(
      `${base(workspace.id)}/conversations`,
      {},
      user.cookie,
    )
    expect((await created.json()).error.code).toBe('AI_DISABLED')
  })
})

describe('Steel AI modes and models', () => {
  it('should refuse AUTOPILOT until the workspace enables it', async () => {
    const { user, workspace } = await authenticatedOwner()
    const refused = await postJson(
      `${base(workspace.id)}/conversations`,
      { mode: 'AUTOPILOT' },
      user.cookie,
    )
    expect(refused.status).toBe(403)
    expect((await refused.json()).error.code).toBe('AI_AUTOPILOT_DISABLED')

    const conversation = await newConversation(workspace.id, user.cookie)
    const send = await postJson(
      `${base(workspace.id)}/conversations/${conversation.id}/messages`,
      { content: 'Exclua o chamado 12', mode: 'AUTOPILOT' },
      user.cookie,
    )
    expect(send.status).toBe(403)
    expect((await send.json()).error.code).toBe('AI_AUTOPILOT_DISABLED')

    await setSwitches(workspace.id, { autopilotEnabled: true })
    const allowed = await postJson(
      `${base(workspace.id)}/conversations`,
      { mode: 'AUTOPILOT' },
      user.cookie,
    )
    expect(allowed.status).toBe(201)
    expect((await allowed.json()).data.mode).toBe('AUTOPILOT')
  })

  it('should save a usable model on the conversation and refuse others', async () => {
    const { user, workspace } = await authenticatedOwner()
    await setSwitches(workspace.id, {})
    const conversation = await newConversation(workspace.id, user.cookie)
    const path = `${base(workspace.id)}/conversations/${conversation.id}`

    const refused = await patchJson(
      path,
      { modelKey: 'anthropic:claude-opus-5' },
      user.cookie,
    )
    expect(refused.status).toBe(422)
    expect((await refused.json()).error.code).toBe('AI_MODEL_NOT_ENABLED')

    const reset = await patchJson(path, { modelKey: null }, user.cookie)
    expect(reset.status).toBe(200)
    expect((await reset.json()).data.modelKey).toBeNull()
  })
})

describe('Steel AI attachments', () => {
  it('should upload, serve and remove a document', async () => {
    const { user, workspace } = await authenticatedOwner()
    const conversation = await newConversation(workspace.id, user.cookie)
    const files = `${base(workspace.id)}/conversations/${conversation.id}/attachments`

    const res = await upload(files, user.cookie, {
      name: 'notas.md',
      type: '',
      content: '# Prazo\nEntregar na sexta.',
    })
    expect(res.status).toBe(201)
    const attachment = (await res.json()).data
    expect(attachment).toEqual(
      expect.objectContaining({
        kind: 'DOCUMENT',
        filename: 'notas.md',
        contentType: 'text/markdown',
        messageId: null,
        url: `${files}/${attachment.id}`,
      }),
    )

    const file = await fetch(`${BASE_URL}${attachment.url}`, {
      headers: { Cookie: user.cookie },
    })
    expect(file.status).toBe(200)
    expect(file.headers.get('content-security-policy')).toContain('sandbox')
    expect(await file.text()).toContain('Entregar na sexta.')

    const removed = await deleteJson(attachment.url, user.cookie)
    expect(removed.status).toBe(200)
    const gone = await getJson(attachment.url, user.cookie)
    expect(gone.status).toBe(404)
  })

  it('should refuse unsupported files and requests without a file', async () => {
    const { user, workspace } = await authenticatedOwner()
    const conversation = await newConversation(workspace.id, user.cookie)
    const files = `${base(workspace.id)}/conversations/${conversation.id}/attachments`

    const zip = await upload(files, user.cookie, {
      name: 'a.zip',
      type: 'application/zip',
      content: 'PK',
    })
    expect(zip.status).toBe(415)
    expect((await zip.json()).error.code).toBe('AI_ATTACHMENT_UNSUPPORTED')

    const empty = await fetch(`${BASE_URL}${files}`, {
      method: 'POST',
      headers: { Origin: defaultHeaders.Origin, Cookie: user.cookie },
      body: new FormData(),
    })
    expect(empty.status).toBe(400)
  })

  it('should keep attachments private to the conversation owner', async () => {
    const { user, workspace } = await authenticatedOwner()
    const member = await addMember(workspace.id)
    const conversation = await newConversation(workspace.id, user.cookie)
    const files = `${base(workspace.id)}/conversations/${conversation.id}/attachments`

    const theirs = await upload(files, member.cookie, {
      name: 'n.txt',
      type: 'text/plain',
      content: 'oi',
    })
    expect(theirs.status).toBe(404)

    const mine = await upload(files, user.cookie, {
      name: 'n.txt',
      type: 'text/plain',
      content: 'oi',
    })
    const attachment = (await mine.json()).data
    const peek = await getJson(attachment.url, member.cookie)
    expect(peek.status).toBe(404)
  })

  it('should refuse a message with attachments that are not the sender’s', async () => {
    const { user, workspace } = await authenticatedOwner()
    const conversation = await newConversation(workspace.id, user.cookie)
    const res = await postJson(
      `${base(workspace.id)}/conversations/${conversation.id}/messages`,
      { content: '', attachmentIds: ['not-mine'] },
      user.cookie,
    )
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('AI_ATTACHMENT_NOT_FOUND')

    const tooMany = await postJson(
      `${base(workspace.id)}/conversations/${conversation.id}/messages`,
      { content: 'x', attachmentIds: ['1', '2', '3', '4', '5', '6'] },
      user.cookie,
    )
    expect(tooMany.status).toBe(422)

    const nothing = await postJson(
      `${base(workspace.id)}/conversations/${conversation.id}/messages`,
      { content: '   ' },
      user.cookie,
    )
    expect(nothing.status).toBe(422)
  })
})
