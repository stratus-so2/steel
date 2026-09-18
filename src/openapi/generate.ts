import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { semverToCalVer } from '@/lib/version'
import { buildOpenApiDocument, serializeOpenApiDocument } from './document'

/** Arquivo servido em `/openapi.json` e renderizado pelo Scalar. */
export const OPENAPI_OUTPUT = 'public/openapi.json'

/**
 * `info.version` = tag CalVer da última release sincronizada, derivada do
 * `version` do `package.json` (que guarda a forma semver — ADR 0003).
 */
export function openApiVersion(root: string): string {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8')) as {
    version: string
  }
  return semverToCalVer(pkg.version)
}

/** Conteúdo exato de `public/openapi.json` para o estado atual do código. */
export function generateOpenApiJson(root: string): string {
  return serializeOpenApiDocument(
    buildOpenApiDocument({ version: openApiVersion(root) }),
  )
}
