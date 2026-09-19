import { validationError } from '@/src/errors/app-error'
import { err, ok, type Result } from '@/src/lib/result'

export const INVALID_JSON_MESSAGE = 'Corpo inválido (JSON malformado)'

type ReadJsonBodyOptions = {
  /**
   * Aceita corpo vazio (ou só espaços) como `{}` — para rotas cujo body é
   * opcional (todos os campos do schema opcionais / ações sem payload).
   * JSON malformado continua virando `VALIDATION_ERROR`.
   */
  allowEmpty?: boolean
}

/**
 * Faz `JSON.parse` sem lançar: texto malformado vira `VALIDATION_ERROR` (422).
 * Útil quando o texto bruto é necessário antes do parse (ex.: verificação de
 * assinatura de webhook) ou quando o JSON chega dentro de um campo multipart.
 */
export function parseJson(text: string): Result<unknown> {
  try {
    return ok(JSON.parse(text))
  } catch {
    return err(validationError(INVALID_JSON_MESSAGE))
  }
}

/**
 * Lê o corpo JSON do request sem lançar: JSON malformado (ou corpo vazio,
 * salvo `allowEmpty`) vira `VALIDATION_ERROR` (422) em vez de estourar como
 * 500 na rota — ou, pior, de ser engolido como `{}` e seguir adiante.
 *
 * ```ts
 * const json = await readJsonBody(request)
 * if (!json.ok) return handleError(json.error)
 * const parsed = Schema.safeParse(json.value)
 * ```
 */
export async function readJsonBody(
  request: Request,
  options: ReadJsonBodyOptions = {},
): Promise<Result<unknown>> {
  let text: string
  try {
    text = await request.text()
  } catch {
    return err(validationError(INVALID_JSON_MESSAGE))
  }

  if (!text.trim()) {
    return options.allowEmpty
      ? ok({})
      : err(validationError(INVALID_JSON_MESSAGE))
  }

  return parseJson(text)
}
