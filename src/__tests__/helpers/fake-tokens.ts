/**
 * Fake provider tokens for tests. Built at runtime so the source never holds
 * a literal that matches the secret scanners' patterns (gitleaks
 * `gitlab-pat`), while still looking like the real format.
 */
export function fakeGitlabToken(body = 'x'.repeat(20)): string {
  return ['glpat', body].join('-')
}
