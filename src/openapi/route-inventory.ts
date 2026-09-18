import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { compareStrings, type HttpMethod } from './registry'

/**
 * Inventário das rotas reais: varre `app/api/**\/route.ts`, lê os métodos
 * HTTP exportados e converte o caminho de pastas do App Router em path
 * OpenAPI (relativo a `/api`).
 *
 *   app/api/workspaces/[id]/route.ts        → /workspaces/{id}
 *   app/api/auth/[...all]/route.ts          → /auth/{all}      (catch-all)
 *   app/api/docs/[[...slug]]/route.ts       → /docs/{slug}     (catch-all opcional)
 *   app/api/(grupo)/x/route.ts              → /x               (route group)
 */

export interface RouteOperation {
  method: HttpMethod
  /** Path OpenAPI relativo a `/api`. */
  path: string
  /** Arquivo `route.ts`, relativo à raiz do repositório. */
  file: string
  /**
   * Para catch-all: prefixo coberto (`/auth/`). Qualquer operação documentada
   * sob o prefixo, com o mesmo método, conta como documentação da rota.
   */
  catchAllPrefix?: string
}

const EXPORTED_METHOD =
  /^export\s+(?:const|let|var|async\s+function|function)\s+(GET|POST|PUT|PATCH|DELETE|HEAD)\b/gm
const EXPORTED_LIST = /^export\s+(?:const\s*)?\{([^}]*)\}/gm

export function exportedMethods(source: string): HttpMethod[] {
  const methods = new Set<string>()
  for (const match of source.matchAll(EXPORTED_METHOD)) methods.add(match[1])
  for (const match of source.matchAll(EXPORTED_LIST)) {
    for (const part of match[1].split(',')) {
      // `GET`, `handler as GET`
      const name = part
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim()
      if (name && /^(GET|POST|PUT|PATCH|DELETE|HEAD)$/.test(name)) {
        methods.add(name)
      }
    }
  }
  return [...methods].map((method) => method.toLowerCase() as HttpMethod)
}

/** Converte os segmentos de pasta (sem `app/api`) em path OpenAPI. */
export function folderToOpenApiPath(segments: string[]): {
  path: string
  catchAllPrefix?: string
} {
  const parts: string[] = []
  let catchAllPrefix: string | undefined
  for (const segment of segments) {
    if (/^\(.*\)$/.test(segment)) continue // route group
    if (segment.startsWith('@')) continue // parallel route slot
    const optionalCatchAll = /^\[\[\.\.\.(.+)\]\]$/.exec(segment)
    const catchAll = /^\[\.\.\.(.+)\]$/.exec(segment)
    const dynamic = /^\[(.+)\]$/.exec(segment)
    if (optionalCatchAll || catchAll) {
      catchAllPrefix = `/${parts.join('/')}${parts.length ? '/' : ''}`
      parts.push(`{${(optionalCatchAll ?? catchAll)?.[1]}}`)
    } else if (dynamic) {
      parts.push(`{${dynamic[1]}}`)
    } else {
      parts.push(segment)
    }
  }
  return { path: `/${parts.join('/')}`, catchAllPrefix }
}

function findRouteFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') continue
    // Pastas `_privadas` não são roteáveis no App Router.
    if (entry.isDirectory() && entry.name.startsWith('_')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...findRouteFiles(full))
    else if (entry.name === 'route.ts' || entry.name === 'route.tsx')
      files.push(full)
  }
  return files
}

export function listRouteOperations(root: string): RouteOperation[] {
  const apiDir = join(root, 'app', 'api')
  const operations: RouteOperation[] = []
  for (const file of findRouteFiles(apiDir)) {
    const segments = relative(apiDir, file).split(sep).slice(0, -1)
    const { path, catchAllPrefix } = folderToOpenApiPath(segments)
    const source = readFileSync(file, 'utf-8')
    for (const method of exportedMethods(source)) {
      operations.push({
        method,
        path,
        file: relative(root, file).split(sep).join('/'),
        ...(catchAllPrefix !== undefined && { catchAllPrefix }),
      })
    }
  }
  return operations.sort((a, b) =>
    compareStrings(operationKey(a), operationKey(b)),
  )
}

/** `GET /workspaces/{id}` — a chave usada no allowlist e nos relatórios. */
export function operationKey(op: { method: string; path: string }): string {
  return `${op.method.toUpperCase()} ${op.path}`
}

/** Operação documentada cobre a rota real? */
export function isCoveredBy(
  route: RouteOperation,
  documented: string,
): boolean {
  const [method, path] = documented.split(' ')
  if (method !== route.method.toUpperCase()) return false
  if (path === route.path) return true
  return (
    route.catchAllPrefix !== undefined && path.startsWith(route.catchAllPrefix)
  )
}
