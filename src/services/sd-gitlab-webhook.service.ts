import { SdIntegrationEventCache } from '@/src/cache/sd-integration-event.cache'
import {
  sdIntegrationNotConfigured,
  sdIntegrationSignatureInvalid,
  validationError,
} from '@/src/errors'
import {
  type GitlabRefKind,
  gitlabLinkKey,
  gitlabState,
  type RepoExternalState,
  verifyGitlabToken,
} from '@/src/lib/integrations/gitlab'
import { err, ok, type Result } from '@/src/lib/result'
import { SdIntegrationRepository } from '@/src/repositories/sd-integration.repository'
import { WorkspaceIntegrationRepository } from '@/src/repositories/workspace-integration.repository'
import { assertModuleEnabled } from './authz'
import {
  applySdGithubState,
  verifiedIntegration,
} from './sd-github-webhook.service'

/**
 * Public GitLab entry (`POST /api/integrations/gitlab/webhook`, gitlab.com
 * or self-managed): mirrors the state of the issue/merge request linked to a
 * ticket — same behaviour as the GitHub webhook.
 *
 * GitLab does not sign the body: it sends the project's "Secret token" in
 * `X-Gitlab-Token`, compared in constant time with the stored secret of each
 * connection of the project (`project.path_with_namespace` only finds the
 * candidates). Idempotent by `X-Gitlab-Event-UUID` / `Idempotency-Key` —
 * GitLab retries failed deliveries.
 */

export type SdGitlabWebhookOutcome =
  | 'state_updated'
  | 'duplicate'
  | 'ignored'
  | 'unlinked'

export interface SdGitlabWebhookResult {
  outcome: SdGitlabWebhookOutcome
  state?: RepoExternalState
}

export interface SdGitlabWebhookInput {
  rawBody: string
  token: string | null
  /** `X-Gitlab-Event` (`Issue Hook`, `Merge Request Hook`, …). */
  event: string | null
  /** `X-Gitlab-Event-UUID` or `Idempotency-Key`. */
  deliveryId: string | null
}

interface GitlabWebhookBody {
  object_kind?: string
  project?: { path_with_namespace?: string }
  object_attributes?: {
    iid?: number
    title?: string
    state?: string
    action?: string
    url?: string
  }
}

const KINDS: Record<string, GitlabRefKind> = {
  issue: 'GITLAB_ISSUE',
  merge_request: 'GITLAB_MERGE_REQUEST',
}

function parseBody(rawBody: string): GitlabWebhookBody | null {
  try {
    const parsed: unknown = JSON.parse(rawBody)
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as GitlabWebhookBody)
      : null
  } catch {
    return null
  }
}

export const SdGitlabWebhookService = {
  async handle(
    input: SdGitlabWebhookInput,
  ): Promise<Result<SdGitlabWebhookResult>> {
    const body = parseBody(input.rawBody)
    if (!body) return err(validationError('Corpo do GitLab inválido'))

    const project = body.project?.path_with_namespace
    if (!project) return err(validationError('Projeto ausente no payload'))

    const found = await WorkspaceIntegrationRepository.findManyByExternalId(
      'GITLAB',
      project,
    )
    if (!found.ok) return found
    const live = found.value.filter((row) => row.status !== 'DISCONNECTED')
    if (live.length === 0) {
      return err(
        sdIntegrationNotConfigured(
          'Este projeto não está conectado a nenhum workspace',
        ),
      )
    }

    const { integration, withSecret } = await verifiedIntegration(
      live,
      (secret) => verifyGitlabToken({ secret, token: input.token }),
    )
    if (!integration) {
      if (withSecret === 0) {
        return err(
          sdIntegrationNotConfigured(
            'A integração do GitLab está sem segredo de webhook configurado',
          ),
        )
      }
      return err(sdIntegrationSignatureInvalid('Token do GitLab inválido'))
    }

    const kind = body.object_kind ? KINDS[body.object_kind] : undefined
    await WorkspaceIntegrationRepository.markEvent(
      integration.id,
      `gitlab:${body.object_kind ?? input.event ?? 'unknown'}${
        body.object_attributes?.action
          ? `.${body.object_attributes.action}`
          : ''
      }`,
    )

    const enabled = await assertModuleEnabled(
      integration.workspaceId,
      'SERVICE_DESK',
    )
    if (!enabled.ok) return enabled

    const attributes = body.object_attributes
    const iid = attributes?.iid
    if (!kind || !iid) return ok({ outcome: 'ignored' })

    const delivery =
      input.deliveryId ??
      `${project}:${kind}:${iid}:${attributes?.action ?? ''}:${attributes?.state ?? ''}`
    const first = await SdIntegrationEventCache.claim('gitlab', delivery)
    if (!first) return ok({ outcome: 'duplicate' })

    const externalKey = gitlabLinkKey(integration.externalId, iid, kind)
    const link = await SdIntegrationRepository.findRepoLinkByKey(
      integration.id,
      'GITLAB',
      externalKey,
    )
    if (!link.ok) {
      await SdIntegrationEventCache.release('gitlab', delivery)
      return link
    }
    if (!link.value) return ok({ outcome: 'unlinked' })

    // Every action is accepted: an unchanged state is a no-op.
    const state = gitlabState(attributes?.state)
    const applied = await applySdGithubState({
      integration,
      link: link.value,
      state,
      kind,
      title: attributes?.title ?? null,
      url: attributes?.url ?? null,
      via: 'webhook',
    })
    if (!applied.ok) {
      await SdIntegrationEventCache.release('gitlab', delivery)
      return applied
    }
    return ok({ outcome: applied.value ? 'state_updated' : 'ignored', state })
  },
}
