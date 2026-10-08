import { logFields } from '@/lib/axiom/log-fields'
import { logger } from '@/lib/axiom/logger'
import { sdIntegrationRequestFailed } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  type GitlabRefKind,
  gitlabItemUrl,
  gitlabState,
  type RepoExternalState,
} from './gitlab'

/**
 * Minimal GitLab REST v4 client (gitlab.com or self-managed). The only place
 * that talks to GitLab, so the tests double it whole
 * (`vi.mock('@/src/lib/integrations/gitlab-client')`).
 *
 * Auth: personal, project or group access token in `PRIVATE-TOKEN`. The
 * token never goes to a log or an API response.
 */

const TIMEOUT_MS = 10_000

export interface GitlabProject {
  id: number
  pathWithNamespace: string
  name: string
  webUrl: string
}

export interface GitlabItem {
  iid: number
  title: string
  kind: GitlabRefKind
  state: RepoExternalState
  webUrl: string
}

interface GitlabItemPayload {
  iid?: number
  title?: string
  state?: string
  web_url?: string
}

async function request<T>(
  baseUrl: string,
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<Result<T>> {
  try {
    const response = await fetch(`${baseUrl}/api/v4${path}`, {
      ...init,
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'PRIVATE-TOKEN': token,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'steel-integrations',
      },
    })
    if (!response.ok) {
      logger.warn(
        'integrations.gitlab.request_failed',
        logFields(
          { component: 'GitlabClient' },
          { path, status: response.status },
        ),
      )
      const message =
        response.status === 401
          ? 'O GitLab recusou o token (inválido ou expirado)'
          : response.status === 403
            ? 'O token do GitLab não tem permissão para esta operação'
            : response.status === 404
              ? 'Projeto ou item não encontrado no GitLab (confira o token e o acesso)'
              : `O GitLab recusou a chamada (${response.status})`
      return err(sdIntegrationRequestFailed(message))
    }
    return ok((await response.json()) as T)
  } catch {
    logger.warn(
      'integrations.gitlab.network_error',
      logFields({ component: 'GitlabClient' }, { path }),
    )
    return err(sdIntegrationRequestFailed('O GitLab não respondeu'))
  }
}

function projectPath(project: string): string {
  return `/projects/${encodeURIComponent(project)}`
}

function toItem(
  payload: GitlabItemPayload,
  baseUrl: string,
  project: string,
  kind: GitlabRefKind,
  fallbackIid: number,
): GitlabItem {
  const iid = payload.iid ?? fallbackIid
  return {
    iid,
    title:
      payload.title ?? `${kind === 'GITLAB_MERGE_REQUEST' ? '!' : '#'}${iid}`,
    kind,
    state: gitlabState(payload.state),
    webUrl: payload.web_url ?? gitlabItemUrl(baseUrl, project, iid, kind),
  }
}

export const GitlabClient = {
  /** Checks the token sees the project (connect and "test connection"). */
  async checkProject(
    baseUrl: string,
    token: string,
    project: string,
  ): Promise<Result<GitlabProject>> {
    const result = await request<{
      id?: number
      path_with_namespace?: string
      name?: string
      web_url?: string
    }>(baseUrl, projectPath(project), token)
    if (!result.ok) return result
    const path = result.value.path_with_namespace ?? project
    return ok({
      id: result.value.id ?? 0,
      pathWithNamespace: path,
      name: result.value.name ?? path,
      webUrl: result.value.web_url ?? `${baseUrl}/${path}`,
    })
  },

  /** Issue or merge request by its project-scoped number (`iid`). */
  async getItem(
    baseUrl: string,
    token: string,
    project: string,
    iid: number,
    kind: GitlabRefKind,
  ): Promise<Result<GitlabItem>> {
    const segment =
      kind === 'GITLAB_MERGE_REQUEST' ? 'merge_requests' : 'issues'
    const result = await request<GitlabItemPayload>(
      baseUrl,
      `${projectPath(project)}/${segment}/${iid}`,
      token,
    )
    if (!result.ok) return result
    return ok(toItem(result.value, baseUrl, project, kind, iid))
  },

  /** Opens an issue in the connected project. */
  async createIssue(
    baseUrl: string,
    token: string,
    project: string,
    input: { title: string; description: string },
  ): Promise<Result<GitlabItem>> {
    const result = await request<GitlabItemPayload>(
      baseUrl,
      `${projectPath(project)}/issues`,
      token,
      { method: 'POST', body: JSON.stringify(input) },
    )
    if (!result.ok) return result
    return ok(toItem(result.value, baseUrl, project, 'GITLAB_ISSUE', 0))
  },
}
