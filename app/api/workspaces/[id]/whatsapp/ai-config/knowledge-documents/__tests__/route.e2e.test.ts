import { describe, expect, it } from 'vitest'
import {
  addMember,
  authenticatedOwner,
  deleteJson,
  getJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'

function uploadFormData(filename: string, contentType: string, text: string) {
  const form = new FormData()
  form.set('file', new File([text], filename, { type: contentType }))
  return form
}

describe('GET /api/workspaces/[id]/whatsapp/ai-config/knowledge-documents', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(
      `${BASE_URL}/api/workspaces/ws1/whatsapp/ai-config/knowledge-documents`,
    )
    expect(res.status).toBe(401)
  })

  it('should return 403 for a plain member', async () => {
    const { workspace } = await authenticatedOwner()
    const member = await addMember(workspace.id, 'MEMBER')

    const res = await getJson(
      `/api/workspaces/${workspace.id}/whatsapp/ai-config/knowledge-documents`,
      member.cookie,
    )

    expect(res.status).toBe(403)
  })

  it('should return an empty list for a fresh workspace', async () => {
    const { user, workspace } = await authenticatedOwner()

    const res = await getJson(
      `/api/workspaces/${workspace.id}/whatsapp/ai-config/knowledge-documents`,
      user.cookie,
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })
})

describe('POST /api/workspaces/[id]/whatsapp/ai-config/knowledge-documents', () => {
  it('should upload a plain text document and mark it READY', async () => {
    const { user, workspace } = await authenticatedOwner()

    const res = await fetch(
      `${BASE_URL}/api/workspaces/${workspace.id}/whatsapp/ai-config/knowledge-documents`,
      {
        method: 'POST',
        headers: { Cookie: user.cookie },
        body: uploadFormData(
          'horarios.txt',
          'text/plain',
          'Horário de funcionamento: 9h às 18h',
        ),
      },
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.status).toBe('READY')
    expect(body.data.filename).toBe('horarios.txt')
    expect(body.data).not.toHaveProperty('extractedText')
  })

  it('should reject an unsupported file type with 422', async () => {
    const { user, workspace } = await authenticatedOwner()

    const res = await fetch(
      `${BASE_URL}/api/workspaces/${workspace.id}/whatsapp/ai-config/knowledge-documents`,
      {
        method: 'POST',
        headers: { Cookie: user.cookie },
        body: uploadFormData('foto.png', 'image/png', 'not-a-real-image'),
      },
    )

    expect(res.status).toBe(422)
  })

  it('should return 403 for a plain member', async () => {
    const { workspace } = await authenticatedOwner()
    const member = await addMember(workspace.id, 'MEMBER')

    const res = await fetch(
      `${BASE_URL}/api/workspaces/${workspace.id}/whatsapp/ai-config/knowledge-documents`,
      {
        method: 'POST',
        headers: { Cookie: member.cookie },
        body: uploadFormData('a.txt', 'text/plain', 'conteúdo'),
      },
    )

    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/workspaces/[id]/whatsapp/ai-config/knowledge-documents/[documentId]', () => {
  it('should remove a previously uploaded document', async () => {
    const { user, workspace } = await authenticatedOwner()

    const uploadRes = await fetch(
      `${BASE_URL}/api/workspaces/${workspace.id}/whatsapp/ai-config/knowledge-documents`,
      {
        method: 'POST',
        headers: { Cookie: user.cookie },
        body: uploadFormData('a.txt', 'text/plain', 'conteúdo'),
      },
    )
    const uploaded = (await uploadRes.json()).data

    const deleteRes = await deleteJson(
      `/api/workspaces/${workspace.id}/whatsapp/ai-config/knowledge-documents/${uploaded.id}`,
      user.cookie,
    )
    expect(deleteRes.status).toBe(200)

    const listRes = await getJson(
      `/api/workspaces/${workspace.id}/whatsapp/ai-config/knowledge-documents`,
      user.cookie,
    )
    const list = (await listRes.json()).data
    expect(list).toEqual([])
  })

  it('should return 404 for a nonexistent document', async () => {
    const { user, workspace } = await authenticatedOwner()

    const res = await deleteJson(
      `/api/workspaces/${workspace.id}/whatsapp/ai-config/knowledge-documents/nonexistent`,
      user.cookie,
    )

    expect(res.status).toBe(404)
  })
})
