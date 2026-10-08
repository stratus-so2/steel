import { createHmac } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import { seedSdPhaseFlow } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { authenticatedOwner, defaultHeaders } from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'
import { encryptConnectionSecret } from '@/src/lib/crypto'
import { prisma } from '@/src/lib/prisma'

/**
 * Webhooks públicos das integrações. São rotas sem sessão (liberadas em
 * `PUBLIC_ROUTES`): o que as protege é a **assinatura**. Nada de rede aqui —
 * o corpo é montado e assinado no próprio teste.
 *
 * O Slack fica inerte neste servidor (sem `SLACK_SIGNING_SECRET`), então o
 * que se verifica dele é a degradação limpa: `503` explicando, nunca `401`
 * de sessão nem um 500.
 */

const SLACK_URL = `${BASE_URL}/api/servicedesk/integrations/slack`
const GITHUB_URL = `${BASE_URL}/api/servicedesk/integrations/github`
const WEBHOOK_SECRET = 'segredo-do-webhook-de-teste'

function githubSignature(body: string, secret = WEBHOOK_SECRET): string {
  return `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`
}

function sendGithub(
  body: unknown,
  options: {
    event?: string
    secret?: string
    signature?: string | null
    delivery?: string
  } = {},
) {
  const raw = JSON.stringify(body)
  const headers: Record<string, string> = {
    ...defaultHeaders,
    'X-GitHub-Event': options.event ?? 'issues',
    'X-GitHub-Delivery': options.delivery ?? `d-${Math.random()}`,
  }
  const signature =
    options.signature === undefined
      ? githubSignature(raw, options.secret)
      : options.signature
  if (signature) headers['X-Hub-Signature-256'] = signature
  return fetch(GITHUB_URL, { method: 'POST', headers, body: raw })
}

/** Workspace com um chamado de problema e a issue `owner/repo#42` vinculada. */
async function setupGithub(
  config: Prisma.InputJsonValue = {
    suggestPhaseOnClose: true,
    allowIssueFromTicket: true,
  },
  withSecret = true,
) {
  const { user, workspace } = await authenticatedOwner()
  const flow = await seedSdPhaseFlow(workspace.id, 'PROBLEM')
  const ticket = await seedSdTicket(workspace.id, flow.inProgress.id, {
    type: 'PROBLEM',
    title: 'Fila travando',
  })
  const integration = await prisma.workspaceIntegration.create({
    data: {
      workspaceId: workspace.id,
      createdById: user.id,
      kind: 'GITHUB',
      externalId: 'owner/repo',
      externalName: 'owner/repo',
      encryptedToken: await encryptConnectionSecret('github_pat_de_teste'),
      encryptedSigningSecret: withSecret
        ? await encryptConnectionSecret(WEBHOOK_SECRET)
        : null,
      config,
    },
  })
  const link = await prisma.sdIntegrationLink.create({
    data: {
      workspaceId: workspace.id,
      integrationId: integration.id,
      ticketId: ticket.id,
      kind: 'GITHUB_ISSUE',
      externalKey: 'owner/repo#42',
      externalUrl: 'https://github.com/owner/repo/issues/42',
      externalState: 'open',
    },
  })
  return { user, workspace, ticket, integration, link }
}

const closedIssue = {
  action: 'closed',
  repository: { full_name: 'owner/repo' },
  issue: {
    number: 42,
    title: 'Fila travando',
    state: 'closed',
    html_url: 'https://github.com/owner/repo/issues/42',
  },
}

describe('POST /api/servicedesk/integrations/slack (público)', () => {
  it('é rota pública: responde 503 de "não configurado", não 401 de sessão', async () => {
    const res = await fetch(SLACK_URL, {
      method: 'POST',
      headers: {
        ...defaultHeaders,
        'X-Slack-Signature': 'v0=abc',
        'X-Slack-Request-Timestamp': String(Math.floor(Date.now() / 1000)),
      },
      body: JSON.stringify({ type: 'url_verification', challenge: 'abc' }),
    })
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error.code).toBe('SD_INTEGRATION_NOT_CONFIGURED')
  })

  it('recusa corpo acima do teto antes de olhar o conteúdo', async () => {
    const res = await fetch(SLACK_URL, {
      method: 'POST',
      headers: defaultHeaders,
      body: 'x'.repeat(130 * 1024),
    })
    expect(res.status).toBe(413)
  })
})

describe('POST /api/servicedesk/integrations/github (público)', () => {
  it('é rota pública: o `ping` do GitHub responde 200 sem sessão', async () => {
    const res = await sendGithub({}, { event: 'ping' })
    expect(res.status).toBe(200)
    expect((await res.json()).data.outcome).toBe('ignored')
  })

  it('ignora eventos que não mexem em issue/PR', async () => {
    const res = await sendGithub({ action: 'synchronize' }, { event: 'push' })
    expect((await res.json()).data.outcome).toBe('ignored')
  })

  it('recusa corpo inválido e payload sem repositório', async () => {
    const raw = 'nao-e-json'
    const broken = await fetch(GITHUB_URL, {
      method: 'POST',
      headers: {
        ...defaultHeaders,
        'X-GitHub-Event': 'issues',
        'X-Hub-Signature-256': githubSignature(raw),
      },
      body: raw,
    })
    expect(broken.status).toBe(422)

    const noRepo = await sendGithub({ action: 'closed', issue: { number: 1 } })
    expect(noRepo.status).toBe(422)
  })

  it('recusa repositório que não está conectado a nenhum ServiceDesk', async () => {
    const res = await sendGithub({
      ...closedIssue,
      repository: { full_name: 'desconhecido/repo' },
    })
    expect(res.status).toBe(503)
    expect((await res.json()).error.code).toBe('SD_INTEGRATION_NOT_CONFIGURED')
  })

  it('recusa integração sem segredo de webhook configurado', async () => {
    await setupGithub(undefined, false)
    const res = await sendGithub(closedIssue)
    expect(res.status).toBe(503)
    expect((await res.json()).message).toContain('segredo de webhook')
  })

  it('recusa assinatura inválida, ausente e de outro segredo — sem gravar nada', async () => {
    const { link } = await setupGithub()

    const wrong = await sendGithub(closedIssue, { signature: 'sha256=dead' })
    expect(wrong.status).toBe(401)
    expect((await wrong.json()).error.code).toBe(
      'SD_INTEGRATION_SIGNATURE_INVALID',
    )

    expect((await sendGithub(closedIssue, { signature: null })).status).toBe(
      401,
    )
    expect(
      (await sendGithub(closedIssue, { secret: 'outro-segredo-qualquer' }))
        .status,
    ).toBe(401)

    const untouched = await prisma.sdIntegrationLink.findUnique({
      where: { id: link.id },
    })
    expect(untouched?.externalState).toBe('open')
  })

  it('espelha o fechamento no chamado, com a sugestão de fase', async () => {
    const { ticket, link } = await setupGithub()
    const res = await sendGithub(closedIssue)
    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual({
      outcome: 'state_updated',
      state: 'closed',
    })

    const updated = await prisma.sdIntegrationLink.findUnique({
      where: { id: link.id },
    })
    expect(updated?.externalState).toBe('closed')

    const events = await prisma.sdTicketEvent.findMany({
      where: { ticketId: ticket.id, action: 'integration.github_state' },
    })
    expect(events).toHaveLength(1)
    expect(events[0].toValue).toBe('closed')

    const messages = await prisma.sdTicketMessage.findMany({
      where: { ticketId: ticket.id },
    })
    expect(messages).toHaveLength(1)
    expect(messages[0].visibility).toBe('PUBLIC')
    expect(messages[0].authorKind).toBe('SYSTEM')
    expect(messages[0].body).toContain('Sugestão')

    // A fase do chamado **não** muda: a decisão fica com o agente.
    const after = await prisma.sdTicket.findUnique({
      where: { id: ticket.id },
      include: { phase: true },
    })
    expect(after?.phase.category).toBe('IN_PROGRESS')
  })

  it('não sugere fase quando o workspace desligou a sugestão', async () => {
    const { ticket } = await setupGithub({
      suggestPhaseOnClose: false,
      allowIssueFromTicket: true,
    })
    await sendGithub(closedIssue)
    const messages = await prisma.sdTicketMessage.findMany({
      where: { ticketId: ticket.id },
    })
    expect(messages[0].body).not.toContain('Sugestão')
  })

  it('é idempotente: a reentrega não duplica a mensagem', async () => {
    const { ticket } = await setupGithub()
    const delivery = `d-${Date.now()}`
    expect((await sendGithub(closedIssue, { delivery })).status).toBe(200)
    const again = await sendGithub(closedIssue, { delivery })
    expect((await again.json()).data.outcome).toBe('duplicate')
    expect(
      await prisma.sdTicketMessage.count({ where: { ticketId: ticket.id } }),
    ).toBe(1)
  })

  it('o mesmo estado reentregue com outra chave também não duplica', async () => {
    const { ticket } = await setupGithub()
    await sendGithub(closedIssue)
    const again = await sendGithub(closedIssue)
    expect((await again.json()).data.outcome).toBe('ignored')
    expect(
      await prisma.sdTicketMessage.count({ where: { ticketId: ticket.id } }),
    ).toBe(1)
  })

  it('reabertura volta o estado para aberta', async () => {
    const { link } = await setupGithub()
    await sendGithub(closedIssue)
    const res = await sendGithub({
      ...closedIssue,
      action: 'reopened',
      issue: { ...closedIssue.issue, state: 'open' },
    })
    expect((await res.json()).data.state).toBe('open')
    const updated = await prisma.sdIntegrationLink.findUnique({
      where: { id: link.id },
    })
    expect(updated?.externalState).toBe('open')
  })

  it('pull request mesclado vira `merged`', async () => {
    const { link } = await setupGithub()
    const res = await sendGithub(
      {
        action: 'closed',
        repository: { full_name: 'owner/repo' },
        pull_request: {
          number: 42,
          title: 'Corrige a fila',
          state: 'closed',
          merged: true,
          merged_at: '2026-10-02T12:00:00Z',
          html_url: 'https://github.com/owner/repo/pull/42',
        },
      },
      { event: 'pull_request' },
    )
    expect((await res.json()).data.state).toBe('merged')
    const updated = await prisma.sdIntegrationLink.findUnique({
      where: { id: link.id },
    })
    expect(updated?.externalState).toBe('merged')
  })

  it('item que nenhum chamado usa responde `unlinked`, sem efeito', async () => {
    const { ticket } = await setupGithub()
    const res = await sendGithub({
      ...closedIssue,
      issue: { ...closedIssue.issue, number: 999 },
    })
    expect((await res.json()).data.outcome).toBe('unlinked')
    expect(
      await prisma.sdTicketMessage.count({ where: { ticketId: ticket.id } }),
    ).toBe(0)
  })

  it('recusa quando o módulo ServiceDesk está desabilitado', async () => {
    const { workspace } = await setupGithub()
    await prisma.workspaceModuleAccess.updateMany({
      where: { workspaceId: workspace.id, module: 'SERVICE_DESK' },
      data: { enabled: false },
    })
    const res = await sendGithub(closedIssue)
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('MODULE_DISABLED')
  })

  it('integração desconectada deixa de receber webhook', async () => {
    const { integration } = await setupGithub()
    await prisma.workspaceIntegration.update({
      where: { id: integration.id },
      data: { deletedAt: new Date(), status: 'DISCONNECTED' },
    })
    const res = await sendGithub(closedIssue)
    expect(res.status).toBe(503)
  })
})
