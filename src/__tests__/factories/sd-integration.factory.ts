import { createId } from '@paralleldrive/cuid2'
import type {
  Prisma,
  SdIntegration,
  SdIntegrationLink,
} from '@prisma/client'
import { prisma } from '@/src/lib/prisma'

/**
 * Fábricas das integrações do ServiceDesk (Slack e GitHub). O
 * `encryptedToken` nasce como um texto qualquer: quem testa a decifragem
 * dubla `@/src/lib/crypto`, então o envelope não precisa ser real.
 */

const fixed = () => new Date('2026-10-02T12:00:00.000Z')

export function createFakeSdIntegration(
  overrides?: Partial<SdIntegration>,
): SdIntegration {
  return {
    id: 'int-slack-1',
    workspaceId: 'ws1',
    kind: 'SLACK',
    status: 'ACTIVE',
    statusError: null,
    externalId: 'T0001',
    externalName: 'Stratus',
    encryptedToken: 'enc:xoxb-token',
    encryptedSigningSecret: null,
    config: {},
    createdById: 'u1',
    createdAt: fixed(),
    updatedAt: fixed(),
    deletedAt: null,
    ...overrides,
  }
}

export function createFakeSdGithubIntegration(
  overrides?: Partial<SdIntegration>,
): SdIntegration {
  return createFakeSdIntegration({
    id: 'int-gh-1',
    kind: 'GITHUB',
    externalId: 'stratus-so2/steel',
    externalName: 'stratus-so2/steel',
    encryptedToken: 'enc:github_pat',
    encryptedSigningSecret: 'enc:hook-secret',
    config: { suggestPhaseOnClose: true, allowIssueFromTicket: true },
    ...overrides,
  })
}

export function createFakeSdIntegrationLink(
  overrides?: Partial<SdIntegrationLink>,
): SdIntegrationLink {
  return {
    id: 'link-1',
    workspaceId: 'ws1',
    integrationId: 'int-gh-1',
    ticketId: 't1',
    kind: 'GITHUB_ISSUE',
    externalKey: 'stratus-so2/steel#42',
    externalUrl: 'https://github.com/stratus-so2/steel/issues/42',
    externalState: 'open',
    meta: { title: 'Fila de e-mail travando' },
    createdById: 'u1',
    createdAt: fixed(),
    updatedAt: fixed(),
    ...overrides,
  }
}

export async function seedSdIntegration(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<Prisma.SdIntegrationUncheckedCreateInput>,
) {
  return prisma.sdIntegration.create({
    data: {
      workspaceId,
      createdById,
      kind: 'SLACK',
      externalId: `T-${createId()}`,
      externalName: 'Stratus',
      encryptedToken: 'enc:xoxb-token',
      config: {},
      ...overrides,
    },
  })
}

export async function seedSdIntegrationLink(
  workspaceId: string,
  integrationId: string,
  ticketId: string,
  overrides?: Partial<Prisma.SdIntegrationLinkUncheckedCreateInput>,
) {
  return prisma.sdIntegrationLink.create({
    data: {
      workspaceId,
      integrationId,
      ticketId,
      kind: 'GITHUB_ISSUE',
      externalKey: `owner/repo#${Math.floor(Math.random() * 100000)}`,
      externalState: 'open',
      ...overrides,
    },
  })
}
