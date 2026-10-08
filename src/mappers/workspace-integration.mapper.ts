import type { WorkspaceIntegration } from '@prisma/client'
import { parseWorkspaceSlackConfig } from '@/src/lib/integrations/config'
import type { WorkspaceIntegrationDTO } from '@/types/workspace-integration'

/**
 * `WorkspaceIntegration` → DTO. Token and webhook secret are deliberately
 * left out: the DTO only says **whether** a secret exists.
 */
export function toWorkspaceIntegrationDTO(
  integration: WorkspaceIntegration,
): WorkspaceIntegrationDTO {
  const slack =
    integration.kind === 'SLACK'
      ? parseWorkspaceSlackConfig(integration.config)
      : null
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
    lastEventType: integration.lastEventType,
    lastCheckedAt: integration.lastCheckedAt?.toISOString() ?? null,
    slack: slack
      ? { routes: slack.routes, waitingMinutes: slack.waitingMinutes }
      : null,
    createdAt: integration.createdAt.toISOString(),
    updatedAt: integration.updatedAt.toISOString(),
  }
}
