import { describe, expect, it } from 'vitest'
import { authenticatedOwner, postJson } from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'

describe('POST /api/workspaces/[id]/crm/ai/conversations/[conversationId]/attachments', () => {
  it('should upload an image and link it to the next user message', async () => {
    const { user, workspace } = await authenticatedOwner()
    const conversation = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/ai/conversations`,
        {},
        user.cookie,
      )
    ).json()

    const form = new FormData()
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    form.append('file', new Blob([bytes], { type: 'image/png' }), 'foto.png')

    const uploaded = await fetch(
      `${BASE_URL}/api/workspaces/${workspace.id}/crm/ai/conversations/${conversation.data.id}/attachments`,
      {
        method: 'POST',
        headers: { Origin: BASE_URL, Cookie: user.cookie },
        body: form,
      },
    )
    expect(uploaded.status).toBe(201)
    const uploadedBody = await uploaded.json()
    expect(uploadedBody.data.kind).toBe('IMAGE')
    expect(uploadedBody.data.messageId).toBeNull()
    expect(uploadedBody.data.url).toContain('http')
  })

  it('should reject an unsupported content type', async () => {
    const { user, workspace } = await authenticatedOwner()
    const conversation = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/ai/conversations`,
        {},
        user.cookie,
      )
    ).json()

    const form = new FormData()
    form.append(
      'file',
      new Blob([new Uint8Array([1, 2, 3])], { type: 'video/mp4' }),
      'video.mp4',
    )

    const uploaded = await fetch(
      `${BASE_URL}/api/workspaces/${workspace.id}/crm/ai/conversations/${conversation.data.id}/attachments`,
      {
        method: 'POST',
        headers: { Origin: BASE_URL, Cookie: user.cookie },
        body: form,
      },
    )
    expect(uploaded.status).toBe(422)
  })
})
