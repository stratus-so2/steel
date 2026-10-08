import type { SdIntegrationLink, WorkspaceIntegration } from '@prisma/client'
import {
  parseWorkspaceRepoConfig,
  parseWorkspaceSlackConfig,
} from '@/src/lib/integrations/config'
import {
  SD_GITHUB_STATE_LABEL,
  type SdGithubExternalState,
} from '@/src/lib/servicedesk/integrations'
import type {
  SdIntegrationDTO,
  SdIntegrationLinkDTO,
} from '@/types/sd-integration'

/**
 * Workspace connection (ServiceDesk view) / `SdIntegrationLink` → DTO. The
 * token and the webhook secret are deliberately left out: the DTO only says
 * **whether** a secret exists (`hasWebhookSecret`).
 */

export function toSdIntegrationDTO(
  integration: WorkspaceIntegration,
): SdIntegrationDTO {
  return {
    id: integration.id,
    kind: integration.kind,
    status: integration.status,
    statusError: integration.statusError,
    externalId: integration.externalId,
    externalName: integration.externalName,
    baseUrl: integration.baseUrl,
    hasWebhookSecret: integration.encryptedSigningSecret !== null,
    lastEventAt: integration.lastEventAt?.toISOString() ?? null,
    slack:
      integration.kind === 'SLACK'
        ? parseWorkspaceSlackConfig(integration.config).servicedesk
        : null,
    repo:
      integration.kind === 'SLACK'
        ? null
        : parseWorkspaceRepoConfig(integration.config).servicedesk,
    createdAt: integration.createdAt.toISOString(),
    updatedAt: integration.updatedAt.toISOString(),
  }
}

function stateLabel(state: string | null): string | null {
  if (!state) return null
  return SD_GITHUB_STATE_LABEL[state as SdGithubExternalState] ?? state
}

/** Título do item, guardado em `meta.title` quando o lado de lá informou. */
function linkTitle(meta: SdIntegrationLink['meta']): string | null {
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) {
    return null
  }
  const title = (meta as Record<string, unknown>).title
  return typeof title === 'string' && title.trim() !== '' ? title : null
}

export function toSdIntegrationLinkDTO(
  link: SdIntegrationLink,
): SdIntegrationLinkDTO {
  return {
    id: link.id,
    integrationId: link.integrationId,
    kind: link.kind,
    ticketId: link.ticketId,
    externalKey: link.externalKey,
    externalUrl: link.externalUrl,
    externalState: link.externalState,
    externalStateLabel: stateLabel(link.externalState),
    title: linkTitle(link.meta),
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString(),
  }
}
