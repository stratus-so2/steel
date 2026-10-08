import { constantTimeEqual } from '@/src/lib/servicedesk/integrations'

/**
 * Pure part of the GitLab integration (gitlab.com and self-managed): base
 * URL validation, project/item references, link keys, item state and the
 * webhook token check. No I/O here.
 *
 * GitLab numbers issues and merge requests **separately** (`#42` and `!42`
 * are different items), so the link key carries the sigil.
 */

export const GITLAB_DEFAULT_BASE_URL = 'https://gitlab.com'

export type GitlabRefKind = 'GITLAB_ISSUE' | 'GITLAB_MERGE_REQUEST'
export type RepoExternalState = 'open' | 'closed' | 'merged'

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '::'
  ) {
    return true
  }
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    )
  }
  // IPv6 unique-local / link-local literals.
  return /^(fc|fd|fe8|fe9|fea|feb)[0-9a-f]*:/.test(host)
}

/**
 * Normalizes the GitLab instance URL (`https://gitlab.example.com`, no
 * path, no trailing slash). Only HTTPS and public hosts: the server sends the
 * workspace token to this address, so loopback and private ranges are
 * refused (SSRF guard for literal hosts).
 */
export function normalizeGitlabBaseUrl(
  input: string | null | undefined,
): string | null {
  const trimmed = (input ?? '').trim()
  if (trimmed === '') return GITLAB_DEFAULT_BASE_URL
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null
  if (url.username || url.password) return null
  if (isPrivateHost(url.hostname)) return null
  const path = url.pathname.replace(/\/+$/, '')
  return `${url.origin}${path}`
}

const SEGMENT = /^[A-Za-z0-9._-]+$/

function cleanPath(path: string): string | null {
  const parts = path
    .replace(/^\/+|\/+$/g, '')
    .replace(/\.git$/, '')
    .split('/')
  if (parts.length < 2) return null
  if (!parts.every((part) => SEGMENT.test(part))) return null
  return parts.join('/')
}

/**
 * Project path (`group/subgroup/project`) from the path itself, the project
 * URL on the instance or the SSH clone URL. Numeric ids are not accepted:
 * the webhook payload identifies the project by `path_with_namespace`.
 */
export function parseGitlabProject(
  input: string,
  baseUrl: string = GITLAB_DEFAULT_BASE_URL,
): string | null {
  const trimmed = input.trim()
  if (trimmed === '') return null
  const base = baseUrl.replace(/\/+$/, '')
  if (/^https?:\/\//i.test(trimmed)) {
    if (!trimmed.toLowerCase().startsWith(`${base.toLowerCase()}/`)) {
      return null
    }
    const rest = trimmed.slice(base.length).split('/-/')[0]
    return cleanPath(rest)
  }
  const ssh = trimmed.match(/^git@[^:]+:(.+)$/)
  return cleanPath(ssh ? ssh[1] : trimmed)
}

export interface GitlabItemRef {
  project: string | null
  iid: number
  /** `null` when the reference is a bare number (an issue by default). */
  kind: GitlabRefKind | null
}

/**
 * Item reference: `#42` (issue), `!42` (merge request), `42`,
 * `group/project#42`, `group/project!42` or the item URL
 * (`…/group/project/-/issues/42`, `…/-/merge_requests/42`).
 */
export function parseGitlabItemRef(input: string): GitlabItemRef | null {
  const trimmed = input.trim()
  if (trimmed === '') return null

  const url = trimmed.match(
    /^https?:\/\/[^/]+(?:\/[^/]+)*?\/((?:[A-Za-z0-9._-]+\/)+[A-Za-z0-9._-]+)\/-\/(issues|merge_requests)\/(\d+)/i,
  )
  if (url) {
    return {
      project: url[1],
      iid: Number(url[3]),
      kind:
        url[2].toLowerCase() === 'merge_requests'
          ? 'GITLAB_MERGE_REQUEST'
          : 'GITLAB_ISSUE',
    }
  }

  const scoped = trimmed.match(
    /^((?:[A-Za-z0-9._-]+\/)+[A-Za-z0-9._-]+)([#!])(\d+)$/,
  )
  if (scoped) {
    return {
      project: scoped[1],
      iid: Number(scoped[3]),
      kind: scoped[2] === '!' ? 'GITLAB_MERGE_REQUEST' : 'GITLAB_ISSUE',
    }
  }

  const plain = trimmed.match(/^([#!]?)(\d+)$/)
  if (plain) {
    const iid = Number(plain[2])
    if (iid <= 0) return null
    return {
      project: null,
      iid,
      kind:
        plain[1] === '!'
          ? 'GITLAB_MERGE_REQUEST'
          : plain[1] === '#'
            ? 'GITLAB_ISSUE'
            : null,
    }
  }
  return null
}

/** `externalKey` of the link: `group/project#42` or `group/project!42`. */
export function gitlabLinkKey(
  project: string,
  iid: number,
  kind: GitlabRefKind,
): string {
  return `${project}${kind === 'GITLAB_MERGE_REQUEST' ? '!' : '#'}${iid}`
}

export function parseGitlabLinkKey(
  key: string,
): { project: string; iid: number; kind: GitlabRefKind } | null {
  const match = key.match(/^(.+)([#!])(\d+)$/)
  if (!match) return null
  return {
    project: match[1],
    iid: Number(match[3]),
    kind: match[2] === '!' ? 'GITLAB_MERGE_REQUEST' : 'GITLAB_ISSUE',
  }
}

export function gitlabItemUrl(
  baseUrl: string,
  project: string,
  iid: number,
  kind: GitlabRefKind,
): string {
  const segment = kind === 'GITLAB_MERGE_REQUEST' ? 'merge_requests' : 'issues'
  return `${baseUrl.replace(/\/+$/, '')}/${project}/-/${segment}/${iid}`
}

/** GitLab `state` (`opened`, `closed`, `merged`, `locked`) → link state. */
export function gitlabState(
  state: string | null | undefined,
): RepoExternalState {
  if (state === 'merged') return 'merged'
  if (state === 'closed' || state === 'locked') return 'closed'
  return 'open'
}

/** `X-Gitlab-Token` is the secret itself (no HMAC): constant-time compare. */
export function verifyGitlabToken(input: {
  secret: string
  token: string | null
}): boolean {
  if (!input.secret || !input.token) return false
  return constantTimeEqual(input.secret, input.token)
}

/** Host of the instance, for labels (`gitlab.com`, `git.acme.com`). */
export function gitlabHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host
  } catch {
    return baseUrl
  }
}
