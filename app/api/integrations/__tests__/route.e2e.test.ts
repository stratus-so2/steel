import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import { seedSdPhaseFlow } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { authenticatedOwner, defaultHeaders } from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'
import { encryptConnectionSecret } from '@/src/lib/crypto'
import { prisma } from '@/src/lib/prisma'

/**
 * Public repository webhooks (ADR 0024). No session: GitHub is verified by
 * HMAC, GitLab by the secret token. Bodies are built in the test.
 */

const GITHUB_URL = `${BASE_URL}/api/integrations/github/webhook`
const GITLAB_URL = `${BASE_URL}/api/integrations/gitlab/webhook`
const SECRET = 'segredo-do-webhook-de-teste'

async function setup(kind: 'GITHUB' | 'GITLAB') {
  const { user, workspace } = await authenticatedOwner()
  const flow = await seedSdPhaseFlow(workspace.id, 'PROBLEM')
  const ticket = await seedSdTicket(workspace.id, flow.inProgress.id, {
    type: 'PROBLEM',
  })
  const integration = await prisma.workspaceIntegration.create({
    data: {
      workspaceId: workspace.id,
      createdById: user.id,
      kind,
      externalId: kind === 'GITHUB' ? 'owner/repo' : 'grupo/projeto',
      baseUrl: kind === 'GITLAB' ? 'https://gitlab.com' : null,
      encryptedToken: await encryptConnectionSecret('token-de-teste'),
      encryptedSigningSecret: await encryptConnectionSecret(SECRET),
      config: {},
    },
  })
  const link = await prisma.sdIntegrationLink.create({
    data: {
      workspaceId: workspace.id,
      integrationId: integration.id,
      ticketId: ticket.id,
      kind: kind === 'GITHUB' ? 'GITHUB_ISSUE' : 'GITLAB_MERGE_REQUEST',
      externalKey: kind === 'GITHUB' ? 'owner/repo#42' : 'grupo/projeto!7',
      externalState: 'open',
    },
  })
  return { integration, link, ticket }
}

function sendGitlab(
  body: unknown,
  token: string | null = SECRET,
  uuid?: string,
) {
  const headers: Record<string, string> = {
    ...defaultHeaders,
    'X-Gitlab-Event': 'Merge Request Hook',
    'X-Gitlab-Event-UUID': uuid ?? `u-${Math.random()}`,
  }
  if (token) headers['X-Gitlab-Token'] = token
  return fetch(GITLAB_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

const mergedMr = {
  object_kind: 'merge_request',
  project: { path_with_namespace: 'grupo/projeto' },
  object_attributes: {
    iid: 7,
    title: 'Corrige a fila',
    state: 'merged',
    action: 'merge',
    url: 'https://gitlab.com/grupo/projeto/-/merge_requests/7',
  },
}

describe('POST /api/integrations/gitlab/webhook', () => {
  it('is public and refuses a missing or wrong token without writing', async () => {
    const { link } = await setup('GITLAB')
    expect((await sendGitlab(mergedMr, null)).status).toBe(401)
    expect((await sendGitlab(mergedMr, 'outro-segredo')).status).toBe(401)
    const untouched = await prisma.sdIntegrationLink.findUnique({
      where: { id: link.id },
    })
    expect(untouched?.externalState).toBe('open')
  })

  it('refuses an unknown project and an invalid body', async () => {
    await setup('GITLAB')
    expect(
      (
        await sendGitlab({
          ...mergedMr,
          project: { path_with_namespace: 'ninguem/conectou' },
        })
      ).status,
    ).toBe(503)
    const res = await fetch(GITLAB_URL, {
      method: 'POST',
      headers: defaultHeaders,
      body: 'nao-json',
    })
    expect(res.status).toBe(422)
  })

  it('mirrors the merged MR once (idempotent) and stamps the last event', async () => {
    const { link, ticket, integration } = await setup('GITLAB')
    const first = await sendGitlab(mergedMr, SECRET, 'uuid-1')
    expect(first.status).toBe(200)
    expect((await first.json()).data).toEqual({
      outcome: 'state_updated',
      state: 'merged',
    })
    const again = await sendGitlab(mergedMr, SECRET, 'uuid-1')
    expect((await again.json()).data.outcome).toBe('duplicate')

    const updated = await prisma.sdIntegrationLink.findUnique({
      where: { id: link.id },
    })
    expect(updated?.externalState).toBe('merged')
    expect(
      await prisma.sdTicketMessage.count({ where: { ticketId: ticket.id } }),
    ).toBe(1)
    const row = await prisma.workspaceIntegration.findUnique({
      where: { id: integration.id },
    })
    expect(row?.lastEventType).toBe('gitlab:merge_request.merge')
    expect(row?.lastEventAt).not.toBeNull()
  })
})

describe('POST /api/integrations/github/webhook', () => {
  it('mirrors the closed issue through the new path', async () => {
    const { link } = await setup('GITHUB')
    const body = JSON.stringify({
      action: 'closed',
      repository: { full_name: 'owner/repo' },
      issue: { number: 42, state: 'closed', title: 'Fila' },
    })
    const res = await fetch(GITHUB_URL, {
      method: 'POST',
      headers: {
        ...defaultHeaders,
        'X-GitHub-Event': 'issues',
        'X-GitHub-Delivery': `d-${Math.random()}`,
        'X-Hub-Signature-256': `sha256=${createHmac('sha256', SECRET)
          .update(body, 'utf8')
          .digest('hex')}`,
      },
      body,
    })
    expect(res.status).toBe(200)
    expect((await res.json()).data.outcome).toBe('state_updated')
    const updated = await prisma.sdIntegrationLink.findUnique({
      where: { id: link.id },
    })
    expect(updated?.externalState).toBe('closed')
  })

  it('answers the ping without a session', async () => {
    const res = await fetch(GITHUB_URL, {
      method: 'POST',
      headers: { ...defaultHeaders, 'X-GitHub-Event': 'ping' },
      body: '{}',
    })
    expect(res.status).toBe(200)
  })
})
