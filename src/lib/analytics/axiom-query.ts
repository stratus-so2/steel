import { analyticsQueryFailed } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'

/**
 * Cliente mínimo da API de consulta do Axiom (APL), com `fetch`:
 * `POST {url}/v1/datasets/_apl?format=tabular`, `Authorization: Bearer
 * <AXIOM_QUERY_TOKEN>`. O formato tabular devolve colunas; aqui viram
 * linhas `{ campo: valor }`. Nunca lança: erro de rede, timeout e resposta
 * não-2xx viram `ANALYTICS_QUERY_FAILED` com uma mensagem curta.
 */

export type AplRow = Record<string, unknown>

export interface AxiomQueryOptions {
  token: string
  url: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

interface TabularResponse {
  tables?: {
    fields: { name: string }[]
    columns: unknown[][]
  }[]
}

export function tabularToRows(body: TabularResponse): AplRow[] {
  const table = body.tables?.[0]
  if (!table) return []
  const length = table.columns[0]?.length ?? 0
  return Array.from({ length }, (_, i) =>
    Object.fromEntries(
      table.fields.map((field, j) => [field.name, table.columns[j]?.[i]]),
    ),
  )
}

export async function runApl(
  apl: string,
  window: { from: Date; to: Date },
  options: AxiomQueryOptions,
): Promise<Result<AplRow[]>> {
  const fetchImpl = options.fetchImpl ?? fetch
  const endpoint = `${options.url.replace(/\/+$/, '')}/v1/datasets/_apl?format=tabular`
  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apl,
        startTime: window.from.toISOString(),
        endTime: window.to.toISOString(),
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
      cache: 'no-store',
    })
    if (!response.ok) {
      let detail = ''
      try {
        const body = (await response.json()) as { message?: string }
        detail = body.message?.split('\n')[0]?.slice(0, 160) ?? ''
      } catch {
        // corpo não-JSON: fica só o status
      }
      return err(
        analyticsQueryFailed(
          `Axiom respondeu ${response.status}${detail ? `: ${detail}` : ''}`,
        ),
      )
    }
    return ok(tabularToRows((await response.json()) as TabularResponse))
  } catch (cause) {
    const timedOut =
      cause instanceof Error &&
      (cause.name === 'TimeoutError' || cause.name === 'AbortError')
    return err(
      analyticsQueryFailed(
        timedOut
          ? 'Axiom não respondeu a tempo'
          : `Falha ao consultar o Axiom: ${cause instanceof Error ? cause.message : String(cause)}`,
      ),
    )
  }
}
