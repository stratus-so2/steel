/**
 * Versionamento CalVer do Steel (ver docs/adr/0003-calver-versioning.md).
 *
 * A fonte da verdade é a tag de release criada pelo CD: `YYYY.MM.DD[.N]`
 * (UTC; `.N` a partir do segundo deploy do dia). `public/openapi.json`
 * (`info.version`) guarda a tag literal; `package.json` guarda a forma
 * semver-válida (npm/pnpm rejeitam zero à esquerda), ex.:
 *
 *   2026.08.31   → 2026.8.31
 *   2026.08.28.4 → 2026.8.28-4
 */

const CALVER_TAG = /^(\d{4})\.(\d{2})\.(\d{2})(?:\.(\d+))?$/

export function isCalVerTag(tag: string): boolean {
  return CALVER_TAG.test(tag)
}

export function calVerToSemver(tag: string): string {
  const match = CALVER_TAG.exec(tag)
  if (!match) throw new Error(`Not a CalVer tag (YYYY.MM.DD[.N]): "${tag}"`)
  const [, year, month, day, n] = match
  const base = `${Number(year)}.${Number(month)}.${Number(day)}`
  return n ? `${base}-${Number(n)}` : base
}
