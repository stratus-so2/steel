import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Marks code executed on behalf of a Steel Agent (automatic or approved
 * writes). The event dispatcher reads it to stop loops: a write made by an
 * agent never triggers agents again (an agent that opens a ticket on
 * "ticket created" would otherwise call itself forever).
 */
interface SteelAgentRunContext {
  agentId: string
  runId: string
}

const storage = new AsyncLocalStorage<SteelAgentRunContext>()

export function runInSteelAgentContext<T>(
  context: SteelAgentRunContext,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(context, fn)
}

export function currentSteelAgentContext(): SteelAgentRunContext | undefined {
  return storage.getStore()
}
