import { describe, expect, it } from 'vitest'
import { seedMembership } from '@/src/__tests__/factories/membership.factory'
import {
  seedSdIntegration,
  seedSdIntegrationLink,
} from '@/src/__tests__/factories/sd-integration.factory'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import { seedSdPhase } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdIntegrationRepository } from '../sd-integration.repository'
import { WorkspaceIntegrationRepository } from '../workspace-integration.repository'

async function setup() {
  const [workspace, other, user] = await Promise.all([
    seedWorkspace(),
    seedWorkspace(),
    seedUser(),
  ])
  const phase = await seedSdPhase(workspace.id)
  const ticket = await seedSdTicket(workspace.id, phase.id)
  return { workspace, other, user, ticket }
}

describe('SdIntegrationRepository — vínculos', () => {
  it('lista os vínculos do chamado em ordem de criação', async () => {
    const { workspace, user, ticket } = await setup()
    const integration = await seedSdIntegration(workspace.id, user.id)
    await seedSdIntegrationLink(workspace.id, integration.id, ticket.id, {
      externalKey: 'owner/repo#1',
    })
    await seedSdIntegrationLink(workspace.id, integration.id, ticket.id, {
      kind: 'SLACK_THREAD',
      externalKey: 'C1:1.1',
      externalState: null,
    })
    const rows = expectOk(
      await SdIntegrationRepository.listLinks(workspace.id, ticket.id),
    )
    expect(rows.map((r) => r.externalKey)).toEqual(['owner/repo#1', 'C1:1.1'])
  })

  it('acha o vínculo por id no escopo do workspace', async () => {
    const { workspace, other, user, ticket } = await setup()
    const integration = await seedSdIntegration(workspace.id, user.id)
    const link = await seedSdIntegrationLink(
      workspace.id,
      integration.id,
      ticket.id,
    )
    expect(
      expectOk(await SdIntegrationRepository.findLink(link.id, workspace.id))
        .id,
    ).toBe(link.id)
    expectErr(
      await SdIntegrationRepository.findLink(link.id, other.id),
      'SD_INTEGRATION_LINK_NOT_FOUND',
    )
  })

  it('finds the repository link by key, whatever the item kind', async () => {
    const { workspace, user, ticket } = await setup()
    const integration = await seedSdIntegration(workspace.id, user.id, {
      kind: 'GITHUB',
      externalId: 'owner/repo',
    })
    await seedSdIntegrationLink(workspace.id, integration.id, ticket.id, {
      kind: 'GITHUB_PULL_REQUEST',
      externalKey: 'owner/repo#9',
    })
    expect(
      expectOk(
        await SdIntegrationRepository.findRepoLinkByKey(
          integration.id,
          'GITHUB',
          'owner/repo#9',
        ),
      )?.kind,
    ).toBe('GITHUB_PULL_REQUEST')
    expect(
      expectOk(
        await SdIntegrationRepository.findRepoLinkByKey(
          integration.id,
          'GITHUB',
          'owner/repo#404',
        ),
      ),
    ).toBeNull()
    // GitLab keys only match GitLab link kinds.
    const gitlab = await seedSdIntegration(workspace.id, user.id, {
      kind: 'GITLAB',
      externalId: 'grupo/projeto',
    })
    await seedSdIntegrationLink(workspace.id, gitlab.id, ticket.id, {
      kind: 'GITLAB_MERGE_REQUEST',
      externalKey: 'grupo/projeto!7',
    })
    expect(
      expectOk(
        await SdIntegrationRepository.findRepoLinkByKey(
          gitlab.id,
          'GITLAB',
          'grupo/projeto!7',
        ),
      )?.kind,
    ).toBe('GITLAB_MERGE_REQUEST')
    expect(
      expectOk(
        await SdIntegrationRepository.findRepoLinkByKey(
          gitlab.id,
          'GITHUB',
          'grupo/projeto!7',
        ),
      ),
    ).toBeNull()
  })

  it('acha a thread do Slack e ignora vínculos de outro tipo', async () => {
    const { workspace, user, ticket } = await setup()
    const integration = await seedSdIntegration(workspace.id, user.id)
    await seedSdIntegrationLink(workspace.id, integration.id, ticket.id, {
      kind: 'SLACK_THREAD',
      externalKey: 'C1:1.1',
    })
    await seedSdIntegrationLink(workspace.id, integration.id, ticket.id, {
      kind: 'GITHUB_ISSUE',
      externalKey: 'C1:1.1-github',
    })
    expect(
      expectOk(
        await SdIntegrationRepository.findSlackThread(integration.id, 'C1:1.1'),
      )?.ticketId,
    ).toBe(ticket.id)
    expect(
      expectOk(
        await SdIntegrationRepository.findSlackThread(
          integration.id,
          'C1:1.1-github',
        ),
      ),
    ).toBeNull()
  })

  it('findLinkByExternalKey filtra por tipo', async () => {
    const { workspace, user, ticket } = await setup()
    const integration = await seedSdIntegration(workspace.id, user.id)
    await seedSdIntegrationLink(workspace.id, integration.id, ticket.id, {
      kind: 'GITHUB_ISSUE',
      externalKey: 'owner/repo#3',
    })
    expect(
      expectOk(
        await SdIntegrationRepository.findLinkByExternalKey(
          integration.id,
          'GITHUB_ISSUE',
          'owner/repo#3',
        ),
      )?.externalKey,
    ).toBe('owner/repo#3')
    expect(
      expectOk(
        await SdIntegrationRepository.findLinkByExternalKey(
          integration.id,
          'SLACK_THREAD',
          'owner/repo#3',
        ),
      ),
    ).toBeNull()
  })

  it('cria, atualiza e remove o vínculo (e recusa duplicata)', async () => {
    const { workspace, other, user, ticket } = await setup()
    const integration = await seedSdIntegration(workspace.id, user.id)
    const created = expectOk(
      await SdIntegrationRepository.createLink({
        workspaceId: workspace.id,
        integrationId: integration.id,
        ticketId: ticket.id,
        kind: 'GITHUB_ISSUE',
        externalKey: 'owner/repo#5',
        externalUrl: 'https://github.com/owner/repo/issues/5',
        externalState: 'open',
        meta: { title: 'T' },
        createdById: user.id,
      }),
    )
    expect(created.externalState).toBe('open')

    const duplicate = expectErr(
      await SdIntegrationRepository.createLink({
        workspaceId: workspace.id,
        integrationId: integration.id,
        ticketId: ticket.id,
        kind: 'GITHUB_ISSUE',
        externalKey: 'owner/repo#5',
      }),
      'SD_CONFIG_CONFLICT',
    )
    expect(duplicate.message).toContain('já está vinculado')

    expectOk(
      await SdIntegrationRepository.updateLink(created.id, {
        externalState: 'merged',
        meta: { title: 'Outro' },
      }),
    )
    const updated = await prisma.sdIntegrationLink.findUnique({
      where: { id: created.id },
    })
    expect(updated?.externalState).toBe('merged')
    expect(updated?.meta).toEqual({ title: 'Outro' })

    // Outro workspace não apaga o vínculo.
    expectOk(await SdIntegrationRepository.removeLink(created.id, other.id))
    expect(
      await prisma.sdIntegrationLink.findUnique({ where: { id: created.id } }),
    ).not.toBeNull()

    expectOk(await SdIntegrationRepository.removeLink(created.id, workspace.id))
    expect(
      await prisma.sdIntegrationLink.findUnique({ where: { id: created.id } }),
    ).toBeNull()
  })

  it('updateLink de vínculo inexistente vira SD_CONFIG_NOT_FOUND', async () => {
    expectErr(
      await SdIntegrationRepository.updateLink('inexistente', {
        externalState: 'closed',
      }),
      'SD_CONFIG_NOT_FOUND',
    )
  })
})

describe('SdIntegrationRepository.listRepoLinksToSync', () => {
  it('traz só vínculos abertos de integrações vivas e chamados não fechados', async () => {
    const { workspace, user } = await setup()
    const phases = await Promise.all([
      seedSdPhase(workspace.id, { name: 'Aberto', category: 'IN_PROGRESS' }),
      seedSdPhase(workspace.id, { name: 'Fechado', category: 'CLOSED' }),
    ])
    const [openPhase, closedPhase] = phases
    const integration = await seedSdIntegration(workspace.id, user.id, {
      kind: 'GITHUB',
      externalId: 'owner/repo',
    })

    const openTicket = await seedSdTicket(workspace.id, openPhase.id)
    const closedTicket = await seedSdTicket(workspace.id, closedPhase.id)
    const deletedTicket = await seedSdTicket(workspace.id, openPhase.id, {
      deletedAt: new Date(),
    })

    const wanted = await seedSdIntegrationLink(
      workspace.id,
      integration.id,
      openTicket.id,
      { externalKey: 'owner/repo#1', externalState: 'open' },
    )
    await seedSdIntegrationLink(workspace.id, integration.id, openTicket.id, {
      externalKey: 'owner/repo#2',
      externalState: 'merged',
    })
    await seedSdIntegrationLink(workspace.id, integration.id, openTicket.id, {
      kind: 'SLACK_THREAD',
      externalKey: 'C1:1.1',
      externalState: 'open',
    })
    await seedSdIntegrationLink(workspace.id, integration.id, closedTicket.id, {
      externalKey: 'owner/repo#3',
      externalState: 'open',
    })
    await seedSdIntegrationLink(
      workspace.id,
      integration.id,
      deletedTicket.id,
      { externalKey: 'owner/repo#4', externalState: 'open' },
    )

    const gitlab = await seedSdIntegration(workspace.id, user.id, {
      kind: 'GITLAB',
      externalId: 'grupo/projeto',
    })
    const gitlabLink = await seedSdIntegrationLink(
      workspace.id,
      gitlab.id,
      openTicket.id,
      {
        kind: 'GITLAB_ISSUE',
        externalKey: 'grupo/projeto#5',
        externalState: 'closed',
      },
    )

    const rows = expectOk(await SdIntegrationRepository.listRepoLinksToSync(50))
    expect(rows.map((r) => r.id).sort()).toEqual(
      [wanted.id, gitlabLink.id].sort(),
    )
    expect(rows.find((r) => r.id === wanted.id)?.integration.kind).toBe(
      'GITHUB',
    )
    await prisma.sdIntegrationLink.delete({ where: { id: gitlabLink.id } })

    // Integração desconectada sai da reconciliação.
    expectOk(
      await WorkspaceIntegrationRepository.disconnect(
        integration.id,
        workspace.id,
      ),
    )
    expect(
      expectOk(await SdIntegrationRepository.listRepoLinksToSync(50)),
    ).toEqual([])
  })

  it('aceita o recorte por workspace e o limite', async () => {
    const [{ workspace, user }, { workspace: another }] = await Promise.all([
      setup(),
      setup(),
    ])
    const phase = await seedSdPhase(workspace.id, {
      name: 'Aberto',
      category: 'IN_PROGRESS',
    })
    const ticket = await seedSdTicket(workspace.id, phase.id)
    const integration = await seedSdIntegration(workspace.id, user.id, {
      kind: 'GITHUB',
      externalId: 'owner/repo',
    })
    await seedSdIntegrationLink(workspace.id, integration.id, ticket.id, {
      externalKey: 'owner/repo#1',
    })
    await seedSdIntegrationLink(workspace.id, integration.id, ticket.id, {
      externalKey: 'owner/repo#2',
    })

    expect(
      expectOk(
        await SdIntegrationRepository.listRepoLinksToSync(1, workspace.id),
      ),
    ).toHaveLength(1)
    expect(
      expectOk(
        await SdIntegrationRepository.listRepoLinksToSync(50, another.id),
      ),
    ).toEqual([])
  })
})

describe('SdIntegrationRepository.isTopPriorityTicket', () => {
  it('is true only for the highest priority level of the workspace', async () => {
    const { workspace, ticket } = await setup()
    // No priority → not urgent.
    expect(
      expectOk(
        await SdIntegrationRepository.isTopPriorityTicket(
          workspace.id,
          ticket.id,
        ),
      ),
    ).toBe(false)

    const [low, high] = await Promise.all([
      prisma.sdPriority.create({
        data: { workspaceId: workspace.id, name: 'Baixa', level: 1 },
      }),
      prisma.sdPriority.create({
        data: { workspaceId: workspace.id, name: 'Crítica', level: 4 },
      }),
    ])
    await prisma.sdTicket.update({
      where: { id: ticket.id },
      data: { priorityId: low.id },
    })
    expect(
      expectOk(
        await SdIntegrationRepository.isTopPriorityTicket(
          workspace.id,
          ticket.id,
        ),
      ),
    ).toBe(false)
    await prisma.sdTicket.update({
      where: { id: ticket.id },
      data: { priorityId: high.id },
    })
    expect(
      expectOk(
        await SdIntegrationRepository.isTopPriorityTicket(
          workspace.id,
          ticket.id,
        ),
      ),
    ).toBe(true)
    // Another workspace never sees the ticket.
    expect(
      expectOk(
        await SdIntegrationRepository.isTopPriorityTicket(
          'other-ws',
          ticket.id,
        ),
      ),
    ).toBe(false)
  })
})

describe('SdIntegrationRepository — apoio do fluxo', () => {
  it('acha o membro do workspace pelo e-mail, ignorando a caixa', async () => {
    const { workspace } = await setup()
    const member = await seedUser({ email: 'Ana@Acme.Test' })
    const outsider = await seedUser({ email: 'bob@acme.test' })
    await seedMembership({ userId: member.id, workspaceId: workspace.id })

    expect(
      expectOk(
        await SdIntegrationRepository.findWorkspaceUserByEmail(
          workspace.id,
          'ana@acme.test',
        ),
      )?.id,
    ).toBe(member.id)
    expect(
      expectOk(
        await SdIntegrationRepository.findWorkspaceUserByEmail(
          workspace.id,
          outsider.email,
        ),
      ),
    ).toBeNull()
    expect(
      expectOk(
        await SdIntegrationRepository.findWorkspaceUserByEmail(
          workspace.id,
          'ninguem@acme.test',
        ),
      ),
    ).toBeNull()
  })

  it('cria a mensagem pública do chamado', async () => {
    const { workspace, user, ticket } = await setup()
    const created = expectOk(
      await SdIntegrationRepository.createTicketMessage({
        workspaceId: workspace.id,
        ticketId: ticket.id,
        authorKind: 'AGENT',
        authorUserId: user.id,
        body: '<p>Resolvido pelo Slack</p>',
      }),
    )
    const row = await prisma.sdTicketMessage.findUnique({
      where: { id: created.id },
    })
    expect(row?.visibility).toBe('PUBLIC')
    expect(row?.authorKind).toBe('AGENT')
    expect(row?.body).toContain('Resolvido pelo Slack')
  })

  it('mensagem de chamado inexistente vira erro de banco', async () => {
    const { workspace } = await setup()
    expectErr(
      await SdIntegrationRepository.createTicketMessage({
        workspaceId: workspace.id,
        ticketId: 'inexistente',
        authorKind: 'SYSTEM',
        authorUserId: null,
        body: '<p>x</p>',
      }),
    )
  })
})
