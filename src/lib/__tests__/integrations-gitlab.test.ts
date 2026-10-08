import { describe, expect, it } from 'vitest'
import {
  GITLAB_DEFAULT_BASE_URL,
  gitlabHost,
  gitlabItemUrl,
  gitlabLinkKey,
  gitlabState,
  normalizeGitlabBaseUrl,
  parseGitlabItemRef,
  parseGitlabLinkKey,
  parseGitlabProject,
  verifyGitlabToken,
} from '../integrations/gitlab'

describe('normalizeGitlabBaseUrl', () => {
  it('defaults to gitlab.com and normalizes the instance URL', () => {
    expect(normalizeGitlabBaseUrl(null)).toBe(GITLAB_DEFAULT_BASE_URL)
    expect(normalizeGitlabBaseUrl(undefined)).toBe(GITLAB_DEFAULT_BASE_URL)
    expect(normalizeGitlabBaseUrl('  ')).toBe(GITLAB_DEFAULT_BASE_URL)
    expect(normalizeGitlabBaseUrl('https://git.acme.com/')).toBe(
      'https://git.acme.com',
    )
    expect(normalizeGitlabBaseUrl('https://acme.com/gitlab//')).toBe(
      'https://acme.com/gitlab',
    )
  })

  it('refuses non-HTTPS, credentials in the URL and private hosts (SSRF guard)', () => {
    for (const bad of [
      'http://gitlab.com',
      'ftp://gitlab.com',
      'nao e url',
      'https://user:pass@gitlab.com',
      'https://localhost',
      'https://gitlab.localhost',
      'https://gitlab.internal',
      'https://nas.local',
      'https://127.0.0.1',
      'https://10.0.0.5',
      'https://172.20.1.1',
      'https://192.168.0.10',
      'https://169.254.169.254',
      'https://100.64.0.1',
      'https://0.0.0.0',
      'https://[::1]',
      'https://[fd00::1]',
    ]) {
      expect(normalizeGitlabBaseUrl(bad)).toBeNull()
    }
    expect(normalizeGitlabBaseUrl('https://172.32.0.1')).toBe(
      'https://172.32.0.1',
    )
    expect(normalizeGitlabBaseUrl('https://8.8.8.8')).toBe('https://8.8.8.8')
  })
})

describe('parseGitlabProject', () => {
  it('accepts the path, the project URL and the SSH clone URL', () => {
    expect(parseGitlabProject('grupo/projeto')).toBe('grupo/projeto')
    expect(parseGitlabProject('/grupo/sub/projeto.git/')).toBe(
      'grupo/sub/projeto',
    )
    expect(
      parseGitlabProject('https://gitlab.com/grupo/projeto/-/issues'),
    ).toBe('grupo/projeto')
    expect(
      parseGitlabProject(
        'https://git.acme.com/grupo/projeto',
        'https://git.acme.com/',
      ),
    ).toBe('grupo/projeto')
    expect(parseGitlabProject('git@gitlab.com:grupo/projeto.git')).toBe(
      'grupo/projeto',
    )
  })

  it('refuses another instance, a single segment and odd characters', () => {
    expect(parseGitlabProject('')).toBeNull()
    expect(parseGitlabProject('projeto')).toBeNull()
    expect(parseGitlabProject('grupo/pro jeto')).toBeNull()
    expect(
      parseGitlabProject(
        'https://outro.com/grupo/projeto',
        'https://gitlab.com',
      ),
    ).toBeNull()
  })
})

describe('parseGitlabItemRef', () => {
  it('reads URLs of issues and merge requests', () => {
    expect(
      parseGitlabItemRef('https://gitlab.com/grupo/sub/projeto/-/issues/12'),
    ).toEqual({ project: 'grupo/sub/projeto', iid: 12, kind: 'GITLAB_ISSUE' })
    expect(
      parseGitlabItemRef(
        'https://git.acme.com/grupo/projeto/-/merge_requests/7#note_1',
      ),
    ).toEqual({
      project: 'grupo/projeto',
      iid: 7,
      kind: 'GITLAB_MERGE_REQUEST',
    })
  })

  it('reads scoped and plain references with the sigil', () => {
    expect(parseGitlabItemRef('grupo/projeto#3')).toEqual({
      project: 'grupo/projeto',
      iid: 3,
      kind: 'GITLAB_ISSUE',
    })
    expect(parseGitlabItemRef('grupo/projeto!4')).toEqual({
      project: 'grupo/projeto',
      iid: 4,
      kind: 'GITLAB_MERGE_REQUEST',
    })
    expect(parseGitlabItemRef('#5')).toEqual({
      project: null,
      iid: 5,
      kind: 'GITLAB_ISSUE',
    })
    expect(parseGitlabItemRef('!6')).toEqual({
      project: null,
      iid: 6,
      kind: 'GITLAB_MERGE_REQUEST',
    })
    expect(parseGitlabItemRef(' 8 ')).toEqual({
      project: null,
      iid: 8,
      kind: null,
    })
  })

  it('refuses empty, zero and garbage', () => {
    expect(parseGitlabItemRef('')).toBeNull()
    expect(parseGitlabItemRef('#0')).toBeNull()
    expect(parseGitlabItemRef('qualquer coisa')).toBeNull()
  })
})

describe('link keys, URLs and states', () => {
  it('builds and parses the link key with the sigil', () => {
    expect(gitlabLinkKey('g/p', 3, 'GITLAB_ISSUE')).toBe('g/p#3')
    expect(gitlabLinkKey('g/p', 4, 'GITLAB_MERGE_REQUEST')).toBe('g/p!4')
    expect(parseGitlabLinkKey('g/sub/p!4')).toEqual({
      project: 'g/sub/p',
      iid: 4,
      kind: 'GITLAB_MERGE_REQUEST',
    })
    expect(parseGitlabLinkKey('g/p#3')?.kind).toBe('GITLAB_ISSUE')
    expect(parseGitlabLinkKey('sem-numero')).toBeNull()
  })

  it('builds the item URL', () => {
    expect(gitlabItemUrl('https://gitlab.com/', 'g/p', 3, 'GITLAB_ISSUE')).toBe(
      'https://gitlab.com/g/p/-/issues/3',
    )
    expect(
      gitlabItemUrl('https://gitlab.com', 'g/p', 4, 'GITLAB_MERGE_REQUEST'),
    ).toBe('https://gitlab.com/g/p/-/merge_requests/4')
  })

  it('maps the GitLab state', () => {
    expect(gitlabState('opened')).toBe('open')
    expect(gitlabState('closed')).toBe('closed')
    expect(gitlabState('locked')).toBe('closed')
    expect(gitlabState('merged')).toBe('merged')
    expect(gitlabState(null)).toBe('open')
  })

  it('extracts the host for labels', () => {
    expect(gitlabHost('https://git.acme.com/gitlab')).toBe('git.acme.com')
    expect(gitlabHost('nao url')).toBe('nao url')
  })
})

describe('verifyGitlabToken', () => {
  it('compares the secret token in constant time', () => {
    expect(
      verifyGitlabToken({ secret: 'segredo-123', token: 'segredo-123' }),
    ).toBe(true)
    expect(
      verifyGitlabToken({ secret: 'segredo-123', token: 'segredo-124' }),
    ).toBe(false)
    expect(verifyGitlabToken({ secret: 'segredo-123', token: 'curto' })).toBe(
      false,
    )
    expect(verifyGitlabToken({ secret: 'segredo-123', token: null })).toBe(
      false,
    )
    expect(verifyGitlabToken({ secret: '', token: '' })).toBe(false)
  })
})
