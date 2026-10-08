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
 * ServiceDesk side of the integrations. The connections are workspace-level
 * since ADR 0024 (connect/disconnect live in `/api/workspaces/[id]/
 * integrations`); here: access (admin × agent × requester × non-member),
 * the module settings, the ticket links and, above all, that **no response
 * returns a token or secret**. No network in e2e: GitHub/GitLab calls fail
 * on purpose with fake tokens.
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
  it('shows the state and where to manage it, without leaking secrets', async () => {
    const { owner, workspace } = await setup()
    const res = await getJson(api(workspace.id), owner.cookie)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.slack).toBeNull()
    expect(body.data.github).toBeNull()
    expect(body.data.gitlab).toBeNull()
    expect(body.data.slackConfigured).toBe(false)
    expect(body.data.manageHref).toBe(
      `/${workspace.slug}/settings/integrations`,
    )
    expect(JSON.stringify(body)).not.toContain('encrypted')
  })

  it('returns the workspace connection without the token', async () => {
    const { owner, workspace } = await setup()
    await prisma.workspaceIntegration.create({
      data: {
        workspaceId: workspace.id,
        createdById: owner.id,
        kind: 'GITHUB',
        externalId: 'owner/repo',
        externalName: 'owner/repo',
        encryptedToken: 'enc:token-super-secreto',
        encryptedSigningSecret: 'enc:segredo-do-webhook',
        // Legacy shape (copied by the migration): mapped on read.
        config: { suggestPhaseOnClose: true, allowIssueFromTicket: true },
      },
    })
    const res = await getJson(api(workspace.id), owner.cookie)
    const body = await res.json()
    expect(body.data.github.externalId).toBe('owner/repo')
    expect(body.data.github.hasWebhookSecret).toBe(true)
    expect(body.data.github.repo).toEqual({
      suggestPhaseOnClose: true,
      allowIssueFromTicket: true,
    })
    const raw = JSON.stringify(body)
    expect(raw).not.toContain('token-super-secreto')
    expect(raw).not.toContain('segredo-do-webhook')
  })

  it('refuses agent, requester, non-member and no session', async () => {
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

  it('refuses when the ServiceDesk module is disabled', async () => {
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

describe('Slack (ServiceDesk settings)', () => {
  it('connecting and disconnecting moved to Ajustes > Integrações', async () => {
    const { owner, workspace } = await setup()
    expect(
      (await getJson(`${api(workspace.id)}/slack/connect`, owner.cookie))
        .status,
    ).toBe(404)
    expect(
      (await deleteJson(`${api(workspace.id)}/slack`, owner.cookie)).status,
    ).toBe(405)
  })

  it('settings and channels without a connection are 404', async () => {
    const { owner, workspace } = await setup()
    const patch = await patchJson(
      `${api(workspace.id)}/slack`,
      { mirrorThreadReplies: false },
      owner.cookie,
    )
    expect(patch.status).toBe(404)
    expect((await patch.json()).error.code).toBe('SD_INTEGRATION_NOT_FOUND')
    expect(
      (await getJson(`${api(workspace.id)}/slack/channels`, owner.cookie))
        .status,
    ).toBe(404)
  })

  it('saves team channels and switches, keeping the workspace rules', async () => {
    const { owner, workspace } = await setup()
    const department = await seedSdDepartment(workspace.id, { name: 'Redes' })
    const row = await prisma.workspaceIntegration.create({
      data: {
        workspaceId: workspace.id,
        createdById: owner.id,
        kind: 'SLACK',
        externalId: 'T0001',
        externalName: 'Stratus',
        encryptedToken: 'enc:xoxb',
        config: {
          routes: [{ event: 'crm.deal.won', channelId: 'C9' }],
        },
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
        ],
        mirrorThreadReplies: false,
        ticketType: 'PROBLEM',
      },
      owner.cookie,
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.slack.channels).toHaveLength(1)
    expect(body.data.slack.mirrorThreadReplies).toBe(false)
    expect(body.data.slack.ticketType).toBe('PROBLEM')
    const saved = await prisma.workspaceIntegration.findUnique({
      where: { id: row.id },
    })
    expect(saved?.config).toMatchObject({
      routes: [{ event: 'crm.deal.won', channelId: 'C9' }],
    })
  })

  it('refuses the old default channel, a repeated team and an empty body', async () => {
    const { owner, workspace } = await setup()
    for (const body of [
      { channels: [{ channelId: 'C0' }] },
      {
        channels: [
          { departmentId: 'dep-1', channelId: 'C1' },
          { departmentId: 'dep-1', channelId: 'C2' },
        ],
      },
      { events: ['sla.breached'] },
      {},
    ]) {
      expect(
        (await patchJson(`${api(workspace.id)}/slack`, body, owner.cookie))
          .status,
      ).toBe(422)
    }
  })

  it('refuses a team of another workspace', async () => {
    const { owner, workspace } = await setup()
    const { workspace: other } = await setup()
    const foreign = await seedSdDepartment(other.id, { name: 'De outra' })
    await prisma.workspaceIntegration.create({
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

describe('GitHub and GitLab (ServiceDesk settings)', () => {
  it('connecting moved to Ajustes > Integrações', async () => {
    const { owner, workspace } = await setup()
    expect(
      (
        await postJson(
          `${api(workspace.id)}/github`,
          { repo: 'owner/repo', token: 'github_pat_11ABCDEFG0123456789' },
          owner.cookie,
        )
      ).status,
    ).toBe(405)
  })

  it('settings without a connection are 404', async () => {
    const { owner, workspace } = await setup()
    for (const provider of ['github', 'gitlab']) {
      expect(
        (
          await patchJson(
            `${api(workspace.id)}/${provider}`,
            { suggestPhaseOnClose: false },
            owner.cookie,
          )
        ).status,
      ).toBe(404)
    }
  })

  it('toggles the phase suggestion of the connected repository and project', async () => {
    const { owner, workspace } = await setup()
    await prisma.workspaceIntegration.create({
      data: {
        workspaceId: workspace.id,
        createdById: owner.id,
        kind: 'GITHUB',
        externalId: 'owner/repo',
        encryptedToken: 'enc:token',
        config: { suggestPhaseOnClose: true, allowIssueFromTicket: true },
      },
    })
    await prisma.workspaceIntegration.create({
      data: {
        workspaceId: workspace.id,
        createdById: owner.id,
        kind: 'GITLAB',
        externalId: 'grupo/projeto',
        baseUrl: 'https://gitlab.com',
        encryptedToken: 'enc:token',
        config: {},
      },
    })
    const res = await patchJson(
      `${api(workspace.id)}/github`,
      { suggestPhaseOnClose: false, allowIssueFromTicket: false },
      owner.cookie,
    )
    expect(res.status).toBe(200)
    expect((await res.json()).data.repo).toEqual({
      suggestPhaseOnClose: false,
      allowIssueFromTicket: false,
    })
    const gl = await patchJson(
      `${api(workspace.id)}/gitlab`,
      { allowIssueFromTicket: false },
      owner.cookie,
    )
    expect(gl.status).toBe(200)
    expect((await gl.json()).data.repo).toEqual({
      suggestPhaseOnClose: true,
      allowIssueFromTicket: false,
    })
  })

  it('refuses agents and an empty body', async () => {
    const { owner, workspace } = await setup()
    const { member: agent } = await agentOf(workspace.id)
    expect(
      (
        await patchJson(
          `${api(workspace.id)}/github`,
          { suggestPhaseOnClose: false },
          agent.cookie,
        )
      ).status,
    ).toBe(403)
    expect(
      (await patchJson(`${api(workspace.id)}/gitlab`, {}, owner.cookie)).status,
    ).toBe(422)
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
    const integration = await prisma.workspaceIntegration.create({
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
    await prisma.workspaceIntegration.create({
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
    const integration = await prisma.workspaceIntegration.create({
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
    await prisma.workspaceIntegration.create({
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

  it('GitLab: without a project is 404, and an incident is refused', async () => {
    const { owner, workspace, flow } = await setup()
    const problem = await seedSdTicket(workspace.id, flow.initial.id, {
      type: 'PROBLEM',
    })
    const missing = await postJson(
      `${api(workspace.id)}/gitlab/issues`,
      { ticketId: problem.id },
      owner.cookie,
    )
    expect(missing.status).toBe(404)
    const incidentFlow = await seedSdPhaseFlow(workspace.id, 'INCIDENT')
    const incident = await seedSdTicket(workspace.id, incidentFlow.initial.id, {
      type: 'INCIDENT',
    })
    expect(
      (
        await postJson(
          `${api(workspace.id)}/gitlab/issues`,
          { ticketId: incident.id },
          owner.cookie,
        )
      ).status,
    ).toBe(422)
  })
})

describe('GET /servicedesk/integrations/providers', () => {
  it('lists the connected repositories to the agent', async () => {
    const { owner, workspace, flow } = await setup()
    const { member: agent } = await agentOf(workspace.id)
    const ticket = await seedSdTicket(workspace.id, flow.initial.id, {
      type: 'PROBLEM',
    })
    await prisma.workspaceIntegration.create({
      data: {
        workspaceId: workspace.id,
        createdById: owner.id,
        kind: 'GITLAB',
        externalId: 'grupo/projeto',
        baseUrl: 'https://gitlab.com',
        encryptedToken: 'enc:token-secreto',
        config: { servicedesk: { allowIssueFromTicket: false } },
      },
    })
    const res = await getJson(
      `${api(workspace.id)}/providers?ticketId=${ticket.id}`,
      agent.cookie,
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([
      {
        provider: 'GITLAB',
        project: 'grupo/projeto',
        allowIssueFromTicket: false,
      },
    ])
    expect(JSON.stringify(body)).not.toContain('token-secreto')
  })

  it('refuses the requester and needs the ticket', async () => {
    const { workspace, flow } = await setup()
    const requester = await addMember(workspace.id, 'MEMBER')
    const ticket = await seedSdTicket(workspace.id, flow.initial.id, {
      type: 'PROBLEM',
    })
    expect(
      (
        await getJson(
          `${api(workspace.id)}/providers?ticketId=${ticket.id}`,
          requester.cookie,
        )
      ).status,
    ).toBe(403)
    const { member: agent } = await agentOf(workspace.id)
    expect(
      (await getJson(`${api(workspace.id)}/providers`, agent.cookie)).status,
    ).toBe(422)
  })
})
