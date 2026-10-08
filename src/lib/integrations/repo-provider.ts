import type { WorkspaceIntegration } from '@prisma/client'
import { validationError } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { GithubClient } from '@/src/lib/servicedesk/github-client'
import {
  parseSdGithubItemRef,
  parseSdGithubRepo,
  sdGithubLinkKey,
} from '@/src/lib/servicedesk/integrations'
import type { RepoIntegrationKind } from './catalog'
import {
  GITLAB_DEFAULT_BASE_URL,
  type GitlabRefKind,
  gitlabLinkKey,
  parseGitlabItemRef,
  type RepoExternalState,
} from './gitlab'
import { GitlabClient } from './gitlab-client'

/**
 * One interface over GitHub and GitLab for the ticket links (same capability
 * set): parse a reference typed by the agent, read an item, open an issue
 * and build the link key. GitHub issues and PRs share numbers; GitLab
 * issues (`#n`) and merge requests (`!n`) do not.
 */

export type RepoItemKind =
  | 'GITHUB_ISSUE'
  | 'GITHUB_PULL_REQUEST'
  | GitlabRefKind

export interface RepoTarget {
  provider: RepoIntegrationKind
  /** `owner/repo` (GitHub) or `group/project` (GitLab). */
  project: string
  /** GitLab instance; `https://github.com` for GitHub. */
  baseUrl: string
}

export interface RepoRef {
  /** Project named in the reference (`null` = the connected one). */
  project: string | null
  number: number
  /** `null` = resolved by the API (GitHub) or an issue (GitLab). */
  kind: RepoItemKind | null
}

export interface RepoItem {
  number: number
  title: string
  kind: RepoItemKind
  state: RepoExternalState
  url: string
  /** Link `externalKey`. */
  key: string
}

export const REPO_PROVIDER_LABEL: Record<RepoIntegrationKind, string> = {
  GITHUB: 'GitHub',
  GITLAB: 'GitLab',
}

/** Connected repository/project of a connection (`null` if unreadable). */
export function repoTarget(
  integration: WorkspaceIntegration,
): RepoTarget | null {
  if (integration.kind === 'GITHUB') {
    const ref = parseSdGithubRepo(integration.externalId)
    if (!ref) return null
    return {
      provider: 'GITHUB',
      project: `${ref.owner}/${ref.repo}`,
      baseUrl: 'https://github.com',
    }
  }
  if (integration.kind === 'GITLAB') {
    if (!integration.externalId.includes('/')) return null
    return {
      provider: 'GITLAB',
      project: integration.externalId,
      baseUrl: integration.baseUrl ?? GITLAB_DEFAULT_BASE_URL,
    }
  }
  return null
}

export function parseRepoRef(
  provider: RepoIntegrationKind,
  input: string,
): RepoRef | null {
  if (provider === 'GITHUB') {
    const ref = parseSdGithubItemRef(input)
    if (!ref) return null
    return {
      project: ref.owner && ref.repo ? `${ref.owner}/${ref.repo}` : null,
      number: ref.number,
      kind: ref.kind,
    }
  }
  const ref = parseGitlabItemRef(input)
  if (!ref) return null
  return { project: ref.project, number: ref.iid, kind: ref.kind }
}

/**
 * Which provider a reference points at, from its shape alone: a GitLab
 * sigil/URL (`!42`, `/-/issues/`) or a github.com URL. `null` = ambiguous
 * (`#42`, `owner/repo#42`).
 */
export function inferRepoProvider(input: string): RepoIntegrationKind | null {
  const trimmed = input.trim()
  if (/^https?:\/\/(www\.)?github\.com\//i.test(trimmed)) return 'GITHUB'
  if (/\/-\/(issues|merge_requests)\/\d+/i.test(trimmed)) return 'GITLAB'
  if (/!\d+$/.test(trimmed)) return 'GITLAB'
  return null
}

function linkKey(
  target: RepoTarget,
  number: number,
  kind: RepoItemKind,
): string {
  if (target.provider === 'GITHUB') {
    const [owner, repo] = target.project.split('/')
    return sdGithubLinkKey({ owner, repo }, number)
  }
  return gitlabLinkKey(target.project, number, kind as GitlabRefKind)
}

/** Reference of another repository/project than the connected one. */
export function isForeignRef(target: RepoTarget, ref: RepoRef): boolean {
  return (
    ref.project !== null &&
    ref.project.toLowerCase() !== target.project.toLowerCase()
  )
}

export const RepoProvider = {
  async getItem(
    target: RepoTarget,
    token: string,
    ref: RepoRef,
  ): Promise<Result<RepoItem>> {
    if (target.provider === 'GITHUB') {
      const [owner, repo] = target.project.split('/')
      const item = await GithubClient.getItem(
        token,
        { owner, repo },
        ref.number,
      )
      if (!item.ok) return item
      return ok({
        number: item.value.number,
        title: item.value.title,
        kind: item.value.kind,
        state: item.value.state,
        url: item.value.htmlUrl,
        key: linkKey(target, item.value.number, item.value.kind),
      })
    }
    const kind: GitlabRefKind =
      ref.kind === 'GITLAB_MERGE_REQUEST'
        ? 'GITLAB_MERGE_REQUEST'
        : 'GITLAB_ISSUE'
    const item = await GitlabClient.getItem(
      target.baseUrl,
      token,
      target.project,
      ref.number,
      kind,
    )
    if (!item.ok) return item
    return ok({
      number: item.value.iid,
      title: item.value.title,
      kind: item.value.kind,
      state: item.value.state,
      url: item.value.webUrl,
      key: linkKey(target, item.value.iid, item.value.kind),
    })
  },

  async createIssue(
    target: RepoTarget,
    token: string,
    input: { title: string; body: string },
  ): Promise<Result<RepoItem>> {
    if (target.provider === 'GITHUB') {
      const [owner, repo] = target.project.split('/')
      const item = await GithubClient.createIssue(token, { owner, repo }, input)
      if (!item.ok) return item
      return ok({
        number: item.value.number,
        title: item.value.title,
        kind: item.value.kind,
        state: item.value.state,
        url: item.value.htmlUrl,
        key: linkKey(target, item.value.number, item.value.kind),
      })
    }
    const item = await GitlabClient.createIssue(
      target.baseUrl,
      token,
      target.project,
      { title: input.title, description: input.body },
    )
    if (!item.ok) return item
    if (item.value.iid <= 0) {
      return err(validationError('O GitLab não devolveu o número da issue'))
    }
    return ok({
      number: item.value.iid,
      title: item.value.title,
      kind: item.value.kind,
      state: item.value.state,
      url: item.value.webUrl,
      key: linkKey(target, item.value.iid, item.value.kind),
    })
  },
}
