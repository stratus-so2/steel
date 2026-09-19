import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Contexto de uma requisição de API, preenchido ao longo do handler e lido
 * pelo log de requisição do `withAxiom` (lib/axiom/server.ts): quem
 * (usuário/workspace, para "usuários únicos" do painel Analytics) e qual
 * erro de domínio a resposta carregou. Fora de um `withAxiom` (worker,
 * testes, Server Components) as anotações são ignoradas.
 */
export interface RequestContext {
  userId?: string
  workspaceId?: string
  errorCode?: string
  errorMessage?: string
}

const storage = new AsyncLocalStorage<RequestContext>()

export function runWithRequestContext<T>(
  context: RequestContext,
  fn: () => T,
): T {
  return storage.run(context, fn)
}

export function currentRequestContext(): RequestContext | undefined {
  return storage.getStore()
}

/** Acrescenta dados ao contexto da requisição atual (no-op fora dela). */
export function annotateRequest(patch: RequestContext): void {
  const store = storage.getStore()
  if (!store) return
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) store[key as keyof RequestContext] = value
  }
}
