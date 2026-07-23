import { describe, expect, it } from 'vitest'
import {
  authenticatedOwner,
  createAuthenticatedUser,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'

// Don't reuse `defaultHeaders` here: it forces `Content-Type`: application/json
// which would clobber the multipart boundary that `fetch` sets from FormData
// (mirrors app/api/workspaces/[id]/projects/cover-image/__tests__/route.e2e.test.ts).
function fileForm(type: string, name: string) {
  const fd = new FormData()
  fd.append('file', new File([new Uint8Array([1, 2, 3])], name, { type }))
  return fd
}

function url(workspaceId: string, conversationId: string) {
  return `${BASE_URL}/api/workspaces/${workspaceId}/crm/ai/conversations/${conversationId}/attachments`
}

describe('POST /api/workspaces/[id]/crm/ai/conversations/[conversationId]/attachments', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(url('some-id', 'some-conversation'), {
      method: 'POST',
      body: fileForm('image/png', 'foto.png'),
    })
    expect(res.status).toBe(401)
  })

  it('should return 403 when user is not a workspace member', async () => {
    const { workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()

    const res = await fetch(url(workspace.id, 'some-conversation'), {
      method: 'POST',
      headers: { Cookie: stranger.cookie },
      body: fileForm('image/png', 'foto.png'),
    })
    expect(res.status).toBe(403)
  })

  it('should reject an unsupported content type with 422', async () => {
    const { user, workspace } = await authenticatedOwner()
    const conversation = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/ai/conversations`,
        {},
        user.cookie,
      )
    ).json()

    const res = await fetch(url(workspace.id, conversation.data.id), {
      method: 'POST',
      headers: { Cookie: user.cookie },
      body: fileForm('video/mp4', 'video.mp4'),
    })
    expect(res.status).toBe(422)
  })

  it('should reject a missing file with 422', async () => {
    const { user, workspace } = await authenticatedOwner()
    const conversation = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/ai/conversations`,
        {},
        user.cookie,
      )
    ).json()

    const res = await fetch(url(workspace.id, conversation.data.id), {
      method: 'POST',
      headers: { Cookie: user.cookie },
      body: new FormData(),
    })
    expect(res.status).toBe(422)
  })
})
