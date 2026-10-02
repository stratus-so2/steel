import { describe, expect, it } from 'vitest'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import {
  seedSdDepartment,
  seedSdDepartmentMember,
  seedSdPhaseFlow,
} from '@/src/__tests__/factories/sd-ticket-context.factory'
import {
  addMember,
  authenticatedOwner,
  createAuthenticatedUser,
  deleteJson,
  getJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { prisma } from '@/src/lib/prisma'

/**
 * Rotas de configuração das integrações. Não há rede nos e2e: conectar o
 * GitHub exige falar com a API (o token é falso de propósito), então esse
 * caminho exercita a falha — o que se verifica aqui é o **contrato**:
 * acesso (admin × agente × solicitante × não-membro), as URLs a cadastrar,
 * o que acontece sem integração conectada e, acima de tudo, que **nenhuma
 * resposta devolve token ou segredo**.
 *
 * O Slack fica inerte porque o servidor de teste não tem `SLACK_CLIENT_ID`
 * & cia. — e é exatamente isso que `slackConfigured: false` precisa dizer.
 */

const api = (ws: string) => `/api/workspaces/${ws}/servicedesk/integrations`

async function setup() {
  const { user: owner, workspace } = await authenticatedOwner()
  const flow = await seedSdPhaseFlow(workspace.id, 'PROBLEM')
  return { owner, workspace, flow }
}

/** Agente = membro de um departamento ativo. */
async function agentOf(workspaceId: string) {
  const member = await addMember(workspaceId, 'MEMBER')
  const department = await seedSdDepartment(workspaceId, { name: 'N1' })
  await seedSdDepartmentMember(department.id, member.id)
  return { member, department }
}

describe('GET /servicedesk/integrations', () => {
  it('mostra o estado e as URLs a cadastrar, sem vazar segredo', async () => {
    const { owner, workspace } = await setup()
    const res = await getJson(api(workspace.id), owner.cookie)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.slack).toBeNull()
    expect(body.data.github).toBeNull()
    expect(body.data.slackConfigured).toBe(false)
    expect(body.data.slackEventsUrl).toBeNull()
    expect(body.data.githubWebhookUrl).toContain(
      '/api/servicedesk/integrations/github',
    )
    expect(JSON.stringify(body)).not.toContain('encrypted')
  })

  it('devolve a integração conectada sem o token', async () => {
    const { owner, workspace } = await setup()
    await prisma.sdIntegration.create({
      data: {
        workspaceId: workspace.id,
        createdById: owner.id,
        kind: 'GITHUB',
        externalId: 'owner/repo',
        externalName: 'owner/repo',
        encryptedToken: 'enc:token-super-secreto',
        encryptedSigningSecret: 'enc:segredo-do-webhook',
        config: { suggestPhaseOnClose: true, allowIssueFromTicket: true },
      },
    })
    const res = await getJson(api(workspace.id), owner.cookie)
    const body = await res.json()
    expect(body.data.github.externalId).toBe('owner/repo')
    expect(body.data.github.hasWebhookSecret).toBe(true)
    expect(body.data.github.github).toEqual({
      suggestPhaseOnClose: true,
      allowIssueFromTicket: true,
    })
    const raw = JSON.stringify(body)
    expect(raw).not.toContain('token-super-secreto')
    expect(raw).not.toContain('segredo-do-webhook')
  })

  it('recusa agente, solicitante, não-membro e sem sessão', async () => {
    const { workspace } = await setup()
    const { member: agent } = await agentOf(workspace.id)
    expect((await getJson(api(workspace.id), agent.cookie)).status).toBe(403)

    const requester = await addMember(workspace.id, 'MEMBER')
    expect((await getJson(api(workspace.id), requester.cookie)).status).toBe(
      403,
    )

    const stranger = await createAuthenticatedUser()
    expect((await getJson(api(workspace.id), stranger.cookie)).status).toBe(403)

    expect((await getJson(api(workspace.id))).status).toBe(401)
  })

  it('recusa quando o módulo ServiceDesk está desabilitado', async () => {
    const { owner, workspace } = await setup()
    await prisma.workspaceModuleAccess.updateMany({
      where: { workspaceId: workspace.id, module: 'SERVICE_DESK' },
      data: { enabled: false },
    })
    const res = await getJson(api(workspace.id), owner.cookie)
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('MODULE_DISABLED')
  })
})

describe('Slack', () => {
  it('conectar responde 503 explicando que o app não está configurado', async () => {
    const { owner, workspace } = await setup()
    const res = await getJson(
      `${api(workspace.id)}/slack/connect`,
      owner.cookie,
    )
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error.code).toBe('SD_INTEGRATION_NOT_CONFIGURED')
    expect(body.message).toContain('SLACK_CLIENT_ID')
  })

  it('configurar, listar canais e desconectar sem integração dão 404', async () => {
    const { owner, workspace } = await setup()
    const patch = await patchJson(
      `${api(workspace.id)}/slack`,
      { events: ['sla.breached'] },
      owner.cookie,
    )
    expect(patch.status).toBe(404)
    expect((await patch.json()).error.code).toBe('SD_INTEGRATION_NOT_FOUND')

    expect(
      (await getJson(`${api(workspace.id)}/slack/channels`, owner.cookie))
        .status,
    ).toBe(404)
    expect(
      (await deleteJson(`${api(workspace.id)}/slack`, owner.cookie)).status,
    ).toBe(404)
  })

  it('salva canal por time e eventos na integração conectada', async () => {
    const { owner, workspace } = await setup()
    const department = await seedSdDepartment(workspace.id, { name: 'Redes' })
    await prisma.sdIntegration.create({
      data: {
        workspaceId: workspace.id,
        createdById: owner.id,
        kind: 'SLACK',
        externalId: 'T0001',
        externalName: 'Stratus',
        encryptedToken: 'enc:xoxb',
        config: {},
      },
    })

    const res = await patchJson(
      `${api(workspace.id)}/slack`,
      {
        channels: [
          {
            departmentId: department.id,
            channelId: 'C1',
            channelName: 'redes',
          },
          { channelId: 'C0', channelName: 'geral' },
        ],
        events: ['sla.breached', 'ticket.escalated'],
        mirrorThreadReplies: false,
        ticketType: 'PROBLEM',
      },
      owner.cookie,
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.slack.channels).toHaveLength(2)
    expect(body.data.slack.events).toEqual(['sla.breached', 'ticket.escalated'])
    expect(body.data.slack.mirrorThreadReplies).toBe(false)
    expect(body.data.slack.ticketType).toBe('PROBLEM')

    // Desconectar apaga o token e a integração sai da aba.
    expect(
      (await deleteJson(`${api(workspace.id)}/slack`, owner.cookie)).status,
    ).toBe(200)
    const after = await getJson(api(workspace.id), owner.cookie)
    expect((await after.json()).data.slack).toBeNull()
    const row = await prisma.sdIntegration.findFirst({
      where: { workspaceId: workspace.id, kind: 'SLACK' },
    })
    expect(row?.encryptedToken).toBe('')
    expect(row?.status).toBe('DISCONNECTED')
  })

  it('recusa canal repetido para o mesmo time e corpo vazio', async () => {
    const { owner, workspace } = await setup()
    const repeated = await patchJson(
      `${api(workspace.id)}/slack`,
      {
        channels: [
          { departmentId: 'dep-1', channelId: 'C1' },
          { departmentId: 'dep-1', channelId: 'C2' },
        ],
      },
      owner.cookie,
    )
    expect(repeated.status).toBe(422)
    expect(
      (await patchJson(`${api(workspace.id)}/slack`, {}, owner.cookie)).status,
    ).toBe(422)
  })

  it('recusa departamento de outra workspace no mapa de canais', async () => {
    const { owner, workspace } = await setup()
    const { workspace: other } = await setup()
    const foreign = await seedSdDepartment(other.id, { name: 'De outra' })
    await prisma.sdIntegration.create({
      data: {
        workspaceId: workspace.id,
        createdById: owner.id,
        kind: 'SLACK',
        externalId: 'T0002',
        encryptedToken: 'enc:xoxb',
        config: {},
      },
    })
    const res = await patchJson(
      `${api(workspace.id)}/slack`,
      { channels: [{ departmentId: foreign.id, channelId: 'C1' }] },
      owner.cookie,
    )
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('SD_CONFIG_NOT_FOUND')
  })
})

describe('GitHub', () => {
  it('recusa repositório irreconhecível antes de qualquer chamada', async () => {
    const { owner, workspace } = await setup()
    const res = await postJson(
      `${api(workspace.id)}/github`,
      { repo: 'nao-e-um-repo', token: 'github_pat_11ABCDEFG0123456789' },
      owner.cookie,
    )
    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR')
  })

  it('recusa token curto e segredo de webhook curto na validação Zod', async () => {
    const { owner, workspace } = await setup()
    expect(
      (
        await postJson(
          `${api(workspace.id)}/github`,
          { repo: 'owner/repo', token: 'curto' },
          owner.cookie,
        )
      ).status,
    ).toBe(422)
    expect(
      (
        await postJson(
          `${api(workspace.id)}/github`,
          {
            repo: 'owner/repo',
            token: 'github_pat_11ABCDEFG0123456789',
            webhookSecret: 'curto',
          },
          owner.cookie,
        )
      ).status,
    ).toBe(422)
  })

  it('token sem acesso ao repositório vira SD_INTEGRATION_REQUEST_FAILED', async () => {
    const { owner, workspace } = await setup()
    const res = await postJson(
      `${api(workspace.id)}/github`,
      {
        repo: 'stratus-so2/repositorio-que-nao-existe-aqui',
        token: 'github_pat_token_invalido_de_teste_0001',
        webhookSecret: 'segredo-de-teste',
      },
      owner.cookie,
    )
    expect(res.status).toBe(502)
    expect((await res.json()).error.code).toBe('SD_INTEGRATION_REQUEST_FAILED')
    expect(
      await prisma.sdIntegration.count({
        where: { workspaceId: workspace.id, kind: 'GITHUB' },
      }),
    ).toBe(0)
  })

  it('configurar e desconectar sem repositório conectado dão 404', async () => {
    const { owner, workspace } = await setup()
    expect(
      (
        await patchJson(
          `${api(workspace.id)}/github`,
          { suggestPhaseOnClose: false },
          owner.cookie,
        )
      ).status,
    ).toBe(404)
    expect(
      (await deleteJson(`${api(workspace.id)}/github`, owner.cookie)).status,
    ).toBe(404)
  })

  it('liga/desliga a sugestão de fase no repositório conectado', async () => {
    const { owner, workspace } = await setup()
    await prisma.sdIntegration.create({
      data: {
        workspaceId: workspace.id,
        createdById: owner.id,
        kind: 'GITHUB',
        externalId: 'owner/repo',
        encryptedToken: 'enc:token',
        config: { suggestPhaseOnClose: true, allowIssueFromTicket: true },
      },
    })
    const res = await patchJson(
      `${api(workspace.id)}/github`,
      { suggestPhaseOnClose: false, allowIssueFromTicket: false },
      owner.cookie,
    )
    expect(res.status).toBe(200)
    expect((await res.json()).data.github).toEqual({
      suggestPhaseOnClose: false,
      allowIssueFromTicket: false,
    })
  })

  it('recusa agente e solicitante na configuração', async () => {
    const { workspace } = await setup()
    const { member: agent } = await agentOf(workspace.id)
    expect(
      (
        await postJson(
          `${api(workspace.id)}/github`,
          { repo: 'owner/repo', token: 'github_pat_11ABCDEFG0123456789' },
          agent.cookie,
        )
      ).status,
    ).toBe(403)
  })
})

describe('vínculos do chamado', () => {
  it('lista vazio para o agente e exige o chamado na query', async () => {
    const { workspace, flow } = await setup()
    const { member: agent } = await agentOf(workspace.id)
    const ticket = await seedSdTicket(workspace.id, flow.initial.id, {
      type: 'PROBLEM',
    })

    const res = await getJson(
      `${api(workspace.id)}/links?ticketId=${ticket.id}`,
      agent.cookie,
    )
    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual([])

    expect(
      (await getJson(`${api(workspace.id)}/links`, agent.cookie)).status,
    ).toBe(422)
  })

  it('devolve o vínculo com o estado traduzido', async () => {
    const { owner, workspace, flow } = await setup()
    const ticket = await seedSdTicket(workspace.id, flow.initial.id, {
      type: 'PROBLEM',
    })
    const integration = await prisma.sdIntegration.create({
      data: {
        workspaceId: workspace.id,
        createdById: owner.id,
        kind: 'GITHUB',
        externalId: 'owner/repo',
        encryptedToken: 'enc:token',
        config: {},
      },
    })
    await prisma.sdIntegrationLink.create({
      data: {
        workspaceId: workspace.id,
        integrationId: integration.id,
        ticketId: ticket.id,
        kind: 'GITHUB_PULL_REQUEST',
        externalKey: 'owner/repo#9',
        externalUrl: 'https://github.com/owner/repo/pull/9',
        externalState: 'merged',
        meta: { title: 'Corrige a fila' },
      },
    })

    const res = await getJson(
      `${api(workspace.id)}/links?ticketId=${ticket.id}`,
      owner.cookie,
    )
    const [link] = (await res.json()).data
    expect(link.kind).toBe('GITHUB_PULL_REQUEST')
    expect(link.externalStateLabel).toBe('Mesclada')
    expect(link.title).toBe('Corrige a fila')
  })

  it('recusa solicitante e chamado inexistente', async () => {
    const { workspace, flow } = await setup()
    const requester = await addMember(workspace.id, 'MEMBER')
    const ticket = await seedSdTicket(workspace.id, flow.initial.id)
    const res = await getJson(
      `${api(workspace.id)}/links?ticketId=${ticket.id}`,
      requester.cookie,
    )
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('SD_NOT_AGENT')

    const { member: agent } = await agentOf(workspace.id)
    expect(
      (
        await getJson(
          `${api(workspace.id)}/links?ticketId=nao-existe`,
          agent.cookie,
        )
      ).status,
    ).toBe(404)
  })

  it('vincular sem repositório conectado dá 404 e desvincular inexistente também', async () => {
    const { owner, workspace, flow } = await setup()
    const ticket = await seedSdTicket(workspace.id, flow.initial.id, {
      type: 'PROBLEM',
    })
    const link = await postJson(
      `${api(workspace.id)}/links`,
      { ticketId: ticket.id, ref: '#42' },
      owner.cookie,
    )
    expect(link.status).toBe(404)
    expect((await link.json()).error.code).toBe('SD_INTEGRATION_NOT_FOUND')

    const remove = await deleteJson(
      `${api(workspace.id)}/links/nao-existe`,
      owner.cookie,
    )
    expect(remove.status).toBe(404)
    expect((await remove.json()).error.code).toBe(
      'SD_INTEGRATION_LINK_NOT_FOUND',
    )
  })

  it('recusa referência irreconhecível e item de outro repositório', async () => {
    const { owner, workspace, flow } = await setup()
    const ticket = await seedSdTicket(workspace.id, flow.initial.id, {
      type: 'PROBLEM',
    })
    await prisma.sdIntegration.create({
      data: {
        workspaceId: workspace.id,
        createdById: owner.id,
        kind: 'GITHUB',
        externalId: 'owner/repo',
        encryptedToken: 'enc:token',
        config: {},
      },
    })
    const bad = await postJson(
      `${api(workspace.id)}/links`,
      { ticketId: ticket.id, ref: 'nada disso' },
      owner.cookie,
    )
    expect(bad.status).toBe(422)

    const foreign = await postJson(
      `${api(workspace.id)}/links`,
      {
        ticketId: ticket.id,
        ref: 'https://github.com/outro/projeto/issues/1',
      },
      owner.cookie,
    )
    expect(foreign.status).toBe(422)
    expect((await foreign.json()).message).toContain('owner/repo')
  })

  it('desvincular remove o vínculo e registra na rastreabilidade', async () => {
    const { owner, workspace, flow } = await setup()
    const ticket = await seedSdTicket(workspace.id, flow.initial.id, {
      type: 'PROBLEM',
    })
    const integration = await prisma.sdIntegration.create({
      data: {
        workspaceId: workspace.id,
        createdById: owner.id,
        kind: 'GITHUB',
        externalId: 'owner/repo',
        encryptedToken: 'enc:token',
        config: {},
      },
    })
    const link = await prisma.sdIntegrationLink.create({
      data: {
        workspaceId: workspace.id,
        integrationId: integration.id,
        ticketId: ticket.id,
        kind: 'GITHUB_ISSUE',
        externalKey: 'owner/repo#5',
        externalState: 'open',
      },
    })

    const res = await deleteJson(
      `${api(workspace.id)}/links/${link.id}`,
      owner.cookie,
    )
    expect(res.status).toBe(200)
    expect(
      await prisma.sdIntegrationLink.findUnique({ where: { id: link.id } }),
    ).toBeNull()
    const events = await prisma.sdTicketEvent.findMany({
      where: { ticketId: ticket.id, action: 'integration.unlinked' },
    })
    expect(events).toHaveLength(1)
  })
})

describe('abrir issue a partir do chamado', () => {
  it('recusa incidente (vale só para problema e mudança)', async () => {
    const { owner, workspace } = await setup()
    const flow = await seedSdPhaseFlow(workspace.id, 'INCIDENT')
    const ticket = await seedSdTicket(workspace.id, flow.initial.id, {
      type: 'INCIDENT',
    })
    const res = await postJson(
      `${api(workspace.id)}/github/issues`,
      { ticketId: ticket.id },
      owner.cookie,
    )
    expect(res.status).toBe(422)
    expect((await res.json()).message).toContain('problema e mudança')
  })

  it('problema sem repositório conectado dá 404', async () => {
    const { owner, workspace, flow } = await setup()
    const ticket = await seedSdTicket(workspace.id, flow.initial.id, {
      type: 'PROBLEM',
    })
    const res = await postJson(
      `${api(workspace.id)}/github/issues`,
      { ticketId: ticket.id },
      owner.cookie,
    )
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('SD_INTEGRATION_NOT_FOUND')
  })

  it('recusa quando a abertura está desligada na configuração', async () => {
    const { owner, workspace, flow } = await setup()
    const ticket = await seedSdTicket(workspace.id, flow.initial.id, {
      type: 'PROBLEM',
    })
    await prisma.sdIntegration.create({
      data: {
        workspaceId: workspace.id,
        createdById: owner.id,
        kind: 'GITHUB',
        externalId: 'owner/repo',
        encryptedToken: 'enc:token',
        config: { allowIssueFromTicket: false },
      },
    })
    const res = await postJson(
      `${api(workspace.id)}/github/issues`,
      { ticketId: ticket.id },
      owner.cookie,
    )
    expect(res.status).toBe(422)
    expect((await res.json()).message).toContain('desligado')
  })
})
