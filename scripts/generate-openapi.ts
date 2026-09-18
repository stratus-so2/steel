import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRegistry } from '../src/openapi/document'
import { generateOpenApiJson, OPENAPI_OUTPUT } from '../src/openapi/generate'
import {
  isCoveredBy,
  listRouteOperations,
} from '../src/openapi/route-inventory'

/**
 * Gera `public/openapi.json` a partir das registrações em `src/openapi/`.
 *
 *   pnpm openapi:generate           # reescreve o arquivo
 *   pnpm openapi:generate --check   # só compara (exit 1 se estiver desatualizado)
 *
 * Ver docs/api.md.
 */
const root = join(__dirname, '..')
const target = join(root, OPENAPI_OUTPUT)

function coverage(): string {
  const routes = listRouteOperations(root)
  const documented = createRegistry().listOperations()
  const covered = routes.filter((route) =>
    documented.some((op) => isCoveredBy(route, op)),
  ).length
  return `${covered}/${routes.length} operações de rota documentadas (${documented.length} operações no spec)`
}

function main(): void {
  const next = generateOpenApiJson(root)
  const current = (() => {
    try {
      return readFileSync(target, 'utf-8')
    } catch {
      return ''
    }
  })()

  if (process.argv.includes('--check')) {
    if (current !== next) {
      console.error(
        `${OPENAPI_OUTPUT} está desatualizado — rode \`pnpm openapi:generate\`.`,
      )
      process.exit(1)
    }
    console.log(`${OPENAPI_OUTPUT} em dia · ${coverage()}`)
    return
  }

  if (current === next) {
    console.log(`${OPENAPI_OUTPUT} já estava em dia · ${coverage()}`)
    return
  }
  writeFileSync(target, next)
  console.log(`${OPENAPI_OUTPUT} gerado · ${coverage()}`)
}

main()
