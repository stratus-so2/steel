import { logger } from '@/lib/axiom/logger'
import { sdIntegrationRequestFailed } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  type SdGithubExternalState,
  type SdGithubRefKind,
  type SdGithubRepoRef,
  sdGithubState,
} from './integrations'

/**
 * Cliente mínimo da API REST do GitHub usado pelo ServiceDesk. Único ponto
 * do módulo que fala com o GitHub, para os testes dublarem tudo
 * (`vi.mock('@/src/lib/servicedesk/github-client')`).
 *
 * Autenticação por **token do workspace** (PAT fine-grained ou token de um
 * GitHub App já instalado): o token vai no header e nunca em log nem em
 * resposta de API.
 */

const API = 'https://api.github.com'

export interface GithubItem {
  number: number
  title: string
  kind: SdGithubRefKind
  state: SdGithubExternalState
  htmlUrl: string
}

interface GithubIssuePayload {
  number?: number
  title?: string
  state?: string
  html_url?: string
  merged?: boolean
  merged_at?: string | null
  pull_request?: { merged_at?: string | null } | null
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'steel-servicedesk',
  }
}

async function request<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<Result<T>> {
  try {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: { ...headers(token), ...(init.headers ?? {}) },
    })
    if (!response.ok) {
      logger.warn('servicedesk.github.request_failed', {
        path,
        status: response.status,
      })
      return err(
        sdIntegrationRequestFailed(
          response.status === 404
            ? 'Repositório ou item não encontrado no GitHub (confira o token e o acesso)'
            : `O GitHub recusou a chamada (${response.status})`,
        ),
      )
    }
    return ok((await response.json()) as T)
  } catch {
    logger.warn('servicedesk.github.network_error', { path })
    return err(sdIntegrationRequestFailed('O GitHub não respondeu'))
  }
}

function toItem(
  payload: GithubIssuePayload,
  ref: SdGithubRepoRef,
  fallbackNumber: number,
): GithubItem {
  const isPull =
    payload.pull_request !== undefined && payload.pull_request !== null
  const number = payload.number ?? fallbackNumber
  return {
    number,
    title: payload.title ?? `#${number}`,
    kind: isPull ? 'GITHUB_PULL_REQUEST' : 'GITHUB_ISSUE',
    state: sdGithubState(payload),
    htmlUrl:
      payload.html_url ??
      `https://github.com/${ref.owner}/${ref.repo}/issues/${number}`,
  }
}

export const GithubClient = {
  /** Confere que o token enxerga o repositório (usado ao conectar). */
  async checkRepo(
    token: string,
    ref: SdGithubRepoRef,
  ): Promise<Result<{ fullName: string; private: boolean }>> {
    const result = await request<{ full_name?: string; private?: boolean }>(
      `/repos/${ref.owner}/${ref.repo}`,
      token,
    )
    if (!result.ok) return result
    return ok({
      fullName: result.value.full_name ?? `${ref.owner}/${ref.repo}`,
      private: result.value.private === true,
    })
  },

  /**
   * Issue ou PR pelo número. O endpoint `/issues/{n}` também responde para
   * PRs (com `pull_request` no corpo), mas o estado "mesclado" só existe no
   * endpoint de PR — por isso ele é consultado quando o item é um PR.
   */
  async getItem(
    token: string,
    ref: SdGithubRepoRef,
    number: number,
  ): Promise<Result<GithubItem>> {
    const issue = await request<GithubIssuePayload>(
      `/repos/${ref.owner}/${ref.repo}/issues/${number}`,
      token,
    )
    if (!issue.ok) return issue
    const item = toItem(issue.value, ref, number)
    if (item.kind !== 'GITHUB_PULL_REQUEST') return ok(item)

    const pull = await request<GithubIssuePayload>(
      `/repos/${ref.owner}/${ref.repo}/pulls/${number}`,
      token,
    )
    if (!pull.ok) return ok(item)
    return ok({ ...item, state: sdGithubState(pull.value) })
  },

  /** Abre uma issue no repositório conectado. */
  async createIssue(
    token: string,
    ref: SdGithubRepoRef,
    input: { title: string; body: string },
  ): Promise<Result<GithubItem>> {
    const result = await request<GithubIssuePayload>(
      `/repos/${ref.owner}/${ref.repo}/issues`,
      token,
      { method: 'POST', body: JSON.stringify(input) },
    )
    if (!result.ok) return result
    return ok(toItem(result.value, ref, 0))
  },
}
