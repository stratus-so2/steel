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

describe('SdIntegrationRepository — integrações', () => {
  it('lista as integrações do workspace sem as excluídas', async () => {
    const { workspace, other, user } = await setup()
    await seedSdIntegration(workspace.id, user.id, { kind: 'SLACK' })
    await seedSdIntegration(workspace.id, user.id, {
      kind: 'GITHUB',
      externalId: 'owner/repo',
    })
    const gone = await seedSdIntegration(workspace.id, user.id, {
      kind: 'SLACK',
      externalId: 'T-removido',
      deletedAt: new Date(),
    })
    await seedSdIntegration(other.id, user.id, { kind: 'SLACK' })

    const rows = expectOk(await SdIntegrationRepository.list(workspace.id))
    expect(rows.map((r) => r.kind).sort()).toEqual(['GITHUB', 'SLACK'])
    expect(rows.every((r) => r.id !== gone.id)).toBe(true)
  })

  it('acha por tipo e devolve null quando não há', async () => {
    const { workspace, user } = await setup()
    const slack = await seedSdIntegration(workspace.id, user.id)
    expect(
      expectOk(await SdIntegrationRepository.findByKind(workspace.id, 'SLACK'))
        ?.id,
    ).toBe(slack.id)
    expect(
      expectOk(
        await SdIntegrationRepository.findByKind(workspace.id, 'GITHUB'),
      ),
    ).toBeNull()
  })

  it('requireByKind devolve SD_INTEGRATION_NOT_FOUND sem integração', async () => {
    const { workspace, user } = await setup()
    await seedSdIntegration(workspace.id, user.id)
    expectOk(await SdIntegrationRepository.requireByKind(workspace.id, 'SLACK'))
    expectErr(
      await SdIntegrationRepository.requireByKind(workspace.id, 'GITHUB'),
      'SD_INTEGRATION_NOT_FOUND',
    )
  })

  it('acha por id e pela identificação externa (caminho do webhook)', async () => {
    const { workspace, user } = await setup()
    const integration = await seedSdIntegration(workspace.id, user.id, {
      externalId: 'T-ABC',
    })
    expect(
      expectOk(await SdIntegrationRepository.findById(integration.id))?.id,
    ).toBe(integration.id)
    expect(
      expectOk(await SdIntegrationRepository.findByExternalId('SLACK', 'T-ABC'))
        ?.workspaceId,
    ).toBe(workspace.id)
    expect(
      expectOk(
        await SdIntegrationRepository.findByExternalId('SLACK', 'T-OUTRO'),
      ),
    ).toBeNull()
    expect(
      expectOk(await SdIntegrationRepository.findById('inexistente')),
    ).toBeNull()
  })

  it('upsert cria e revive a mesma integração em vez de colidir', async () => {
    const { workspace, user } = await setup()
    const created = expectOk(
      await SdIntegrationRepository.upsert(workspace.id, 'SLACK', 'T-1', {
        encryptedToken: 'enc:a',
        createdById: user.id,
        externalName: 'Stratus',
        config: { events: ['sla.breached'] },
      }),
    )
    expect(created.externalName).toBe('Stratus')

    expectOk(await SdIntegrationRepository.disconnect(created.id, workspace.id))
    const revived = expectOk(
      await SdIntegrationRepository.upsert(workspace.id, 'SLACK', 'T-1', {
        encryptedToken: 'enc:b',
        createdById: user.id,
        externalName: 'Stratus 2',
      }),
    )
    expect(revived.id).toBe(created.id)
    expect(revived.deletedAt).toBeNull()
    expect(revived.status).toBe('ACTIVE')
    expect(revived.encryptedToken).toBe('enc:b')
  })

  it('desconectar apaga o token e tira do alcance do webhook', async () => {
    const { workspace, user } = await setup()
    const integration = await seedSdIntegration(workspace.id, user.id, {
      externalId: 'T-X',
      encryptedSigningSecret: 'enc:hook',
    })
    expectOk(
      await SdIntegrationRepository.disconnect(integration.id, workspace.id),
    )
    const row = await prisma.sdIntegration.findUnique({
      where: { id: integration.id },
    })
    expect(row?.status).toBe('DISCONNECTED')
    expect(row?.encryptedToken).toBe('')
    expect(row?.encryptedSigningSecret).toBeNull()
    expect(
      expectOk(await SdIntegrationRepository.findByExternalId('SLACK', 'T-X')),
    ).toBeNull()
  })

  it('update e markError carimbam status e motivo', async () => {
    const { workspace, user } = await setup()
    const integration = await seedSdIntegration(workspace.id, user.id)
    expectOk(
      await SdIntegrationRepository.update(integration.id, workspace.id, {
        config: { events: ['ticket.escalated'] },
      }),
    )
    expectOk(
      await SdIntegrationRepository.markError(integration.id, 'x'.repeat(600)),
    )
    const row = await prisma.sdIntegration.findUnique({
      where: { id: integration.id },
    })
    expect(row?.status).toBe('ERROR')
    expect(row?.statusError).toHaveLength(500)
    expect(row?.config).toEqual({ events: ['ticket.escalated'] })
  })

  it('não deixa atualizar nem excluir integração de outro workspace', async () => {
    const { workspace, other, user } = await setup()
    const integration = await seedSdIntegration(workspace.id, user.id)
    expectErr(
      await SdIntegrationRepository.update(integration.id, other.id, {
        externalName: 'nope',
      }),
      'SD_CONFIG_NOT_FOUND',
    )
    expectErr(
      await SdIntegrationRepository.disconnect(integration.id, other.id),
      'SD_CONFIG_NOT_FOUND',
    )
  })
})

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

  it('acha o vínculo do GitHub pela chave, sem saber se é issue ou PR', async () => {
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
        await SdIntegrationRepository.findGithubLinkByKey(
          integration.id,
          'owner/repo#9',
        ),
      )?.kind,
    ).toBe('GITHUB_PULL_REQUEST')
    expect(
      expectOk(
        await SdIntegrationRepository.findGithubLinkByKey(
          integration.id,
          'owner/repo#404',
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

describe('SdIntegrationRepository.listGithubLinksToSync', () => {
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

    const rows = expectOk(
      await SdIntegrationRepository.listGithubLinksToSync(50),
    )
    expect(rows.map((r) => r.id)).toEqual([wanted.id])
    expect(rows[0].integration.kind).toBe('GITHUB')

    // Integração desconectada sai da reconciliação.
    expectOk(
      await SdIntegrationRepository.disconnect(integration.id, workspace.id),
    )
    expect(
      expectOk(await SdIntegrationRepository.listGithubLinksToSync(50)),
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
        await SdIntegrationRepository.listGithubLinksToSync(1, workspace.id),
      ),
    ).toHaveLength(1)
    expect(
      expectOk(
        await SdIntegrationRepository.listGithubLinksToSync(50, another.id),
      ),
    ).toEqual([])
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
