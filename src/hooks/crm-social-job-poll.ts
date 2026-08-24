import type { ErrorResponse, SuccessResponse } from '@/types/http-response'

type JobStatus<T> = {
  state: 'pending' | 'completed' | 'failed'
  result: T | null
  error: string | null
  code: string | null
}

/**
 * Faz polling de um job de publish assíncrono (YouTube/Instagram — mídia
 * grande demais pra caber num único request síncrono) até `completed` ou
 * `failed`. Resolve/rejeita com o mesmo formato que o antigo publish
 * síncrono devolvia, então quem chama (`mutateAsync`) não muda.
 *
 * `makeError` constrói o erro a lançar — cada plataforma tem sua própria
 * classe `CrmSocialApiError` (assinaturas diferentes entre os hooks), então
 * quem chama decide como embrulhar `message`/`code`. Preservar o `code` é o
 * que permite a UI detectar "reconecte a conta" mesmo quando a falha veio
 * de dentro do job, não de um erro HTTP direto.
 */
export async function pollCrmSocialPublishJob<T>(
  statusUrl: string,
  makeError: (message: string, code: string | null) => Error,
  opts: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<T> {
  const interval = opts.intervalMs ?? 2000
  const timeout = opts.timeoutMs ?? 10 * 60 * 1000
  const startedAt = Date.now()

  while (true) {
    const res = await fetch(statusUrl)
    const json = (await res.json().catch(() => null)) as
      | SuccessResponse<JobStatus<T>>
      | ErrorResponse
      | null

    if (!res.ok || !json?.success) {
      const message =
        (json && !json.success ? json.message : undefined) ??
        'Falha ao consultar a publicação'
      throw makeError(message, null)
    }

    const { state, result, error, code } = json.data
    if (state === 'completed') return result as T
    if (state === 'failed') throw makeError(error ?? 'Falha ao publicar', code)

    if (Date.now() - startedAt > timeout) {
      throw makeError('Tempo excedido aguardando a publicação', null)
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
}
