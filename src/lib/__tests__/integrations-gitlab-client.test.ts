import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeGitlabToken } from '@/src/__tests__/helpers/fake-tokens'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'

vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { logger } from '@/lib/axiom/logger'
import { GitlabClient } from '../integrations/gitlab-client'

const fetchMock = vi.fn()
const BASE = 'https://git.acme.com'
const TOKEN = fakeGitlabToken('segredo-de-teste-123456')

function reply(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('GitlabClient.checkProject', () => {
  it('calls the v4 API of the instance with the private token', async () => {
    fetchMock.mockResolvedValue(
      reply({
        id: 99,
        path_with_namespace: 'Grupo/Projeto',
        name: 'Projeto',
        web_url: 'https://git.acme.com/Grupo/Projeto',
      }),
    )
    expect(
      expectOk(await GitlabClient.checkProject(BASE, TOKEN, 'grupo/projeto')),
    ).toEqual({
      id: 99,
      pathWithNamespace: 'Grupo/Projeto',
      name: 'Projeto',
      webUrl: 'https://git.acme.com/Grupo/Projeto',
    })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://git.acme.com/api/v4/projects/grupo%2Fprojeto')
    expect(init.headers['PRIVATE-TOKEN']).toBe(TOKEN)
    expect(init.redirect).toBe('error')
    // The token never reaches a log.
    expect(JSON.stringify(vi.mocked(logger.warn).mock.calls)).not.toContain(
      TOKEN,
    )
  })

  it('fills missing fields from the request', async () => {
    fetchMock.mockResolvedValue(reply({}))
    expect(
      expectOk(await GitlabClient.checkProject(BASE, TOKEN, 'g/p')),
    ).toEqual({
      id: 0,
      pathWithNamespace: 'g/p',
      name: 'g/p',
      webUrl: 'https://git.acme.com/g/p',
    })
  })

  it('explains 401, 403, 404, other statuses and network failures', async () => {
    const cases: [number, string][] = [
      [401, 'inválido ou expirado'],
      [403, 'não tem permissão'],
      [404, 'não encontrado'],
      [500, '(500)'],
    ]
    for (const [status, message] of cases) {
      fetchMock.mockResolvedValueOnce(reply({}, status))
      const error = expectErr(
        await GitlabClient.checkProject(BASE, TOKEN, 'g/p'),
        'SD_INTEGRATION_REQUEST_FAILED',
      )
      expect(error.message).toContain(message)
    }
    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'))
    expect(
      expectErr(
        await GitlabClient.checkProject(BASE, TOKEN, 'g/p'),
        'SD_INTEGRATION_REQUEST_FAILED',
      ).message,
    ).toBe('O GitLab não respondeu')
    expect(logger.warn).toHaveBeenCalledWith(
      'integrations.gitlab.network_error',
      expect.any(Object),
    )
  })
})

describe('GitlabClient.getItem', () => {
  it('reads an issue and a merge request by iid', async () => {
    fetchMock.mockResolvedValueOnce(
      reply({
        iid: 3,
        title: 'Fila',
        state: 'closed',
        web_url: 'https://git.acme.com/g/p/-/issues/3',
      }),
    )
    expect(
      expectOk(
        await GitlabClient.getItem(BASE, TOKEN, 'g/p', 3, 'GITLAB_ISSUE'),
      ),
    ).toEqual({
      iid: 3,
      title: 'Fila',
      kind: 'GITLAB_ISSUE',
      state: 'closed',
      webUrl: 'https://git.acme.com/g/p/-/issues/3',
    })
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://git.acme.com/api/v4/projects/g%2Fp/issues/3',
    )

    fetchMock.mockResolvedValueOnce(reply({ state: 'merged' }))
    expect(
      expectOk(
        await GitlabClient.getItem(
          BASE,
          TOKEN,
          'g/p',
          7,
          'GITLAB_MERGE_REQUEST',
        ),
      ),
    ).toEqual({
      iid: 7,
      title: '!7',
      kind: 'GITLAB_MERGE_REQUEST',
      state: 'merged',
      webUrl: 'https://git.acme.com/g/p/-/merge_requests/7',
    })
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://git.acme.com/api/v4/projects/g%2Fp/merge_requests/7',
    )
  })

  it('propagates the provider error', async () => {
    fetchMock.mockResolvedValue(reply({}, 404))
    expectErr(
      await GitlabClient.getItem(BASE, TOKEN, 'g/p', 1, 'GITLAB_ISSUE'),
      'SD_INTEGRATION_REQUEST_FAILED',
    )
  })
})

describe('GitlabClient.createIssue', () => {
  it('posts title and description to the project', async () => {
    fetchMock.mockResolvedValue(
      reply({ iid: 12, title: '[PRB-1] Fila', state: 'opened' }),
    )
    expect(
      expectOk(
        await GitlabClient.createIssue(BASE, TOKEN, 'g/p', {
          title: '[PRB-1] Fila',
          description: 'Contexto',
        }),
      ),
    ).toEqual({
      iid: 12,
      title: '[PRB-1] Fila',
      kind: 'GITLAB_ISSUE',
      state: 'open',
      webUrl: 'https://git.acme.com/g/p/-/issues/12',
    })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://git.acme.com/api/v4/projects/g%2Fp/issues')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({
      title: '[PRB-1] Fila',
      description: 'Contexto',
    })
  })

  it('propagates the provider error', async () => {
    fetchMock.mockResolvedValue(reply({}, 403))
    expectErr(
      await GitlabClient.createIssue(BASE, TOKEN, 'g/p', {
        title: 't',
        description: 'd',
      }),
      'SD_INTEGRATION_REQUEST_FAILED',
    )
  })
})
