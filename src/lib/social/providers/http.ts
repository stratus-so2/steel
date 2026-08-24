import { crmSocialOauthFailed } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'

/**
 * Extrai uma mensagem exibível do corpo de erro da Graph API (Meta). Prefere
 * `error_user_msg` — já vem localizado (pt-BR) e escrito para o usuário final
 * (ex.: "taxa de proporção inválida", "mídia não está pronta") — em vez do
 * `crmSocialOauthFailed()` genérico, que não diz o motivo real da falha.
 */
function graphErrorMessage(bodyText: string): string | undefined {
  try {
    const parsed = JSON.parse(bodyText) as {
      error?: { error_user_msg?: string; message?: string }
    }
    return parsed.error?.error_user_msg ?? parsed.error?.message
  } catch {
    return undefined
  }
}

/** POST `application/x-www-form-urlencoded` e devolve o JSON, ou `crmSocialOauthFailed`. */
export async function postForm<T>(
  url: string,
  body: Record<string, string>,
  headers: Record<string, string> = {},
): Promise<Result<T>> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        ...headers,
      },
      body: new URLSearchParams(body).toString(),
    })
    if (!response.ok) {
      const bodyText = await response.text().catch(() => '')
      console.error(
        '[social] POST falhou',
        url,
        response.status,
        bodyText.slice(0, 500),
      )
      return err(crmSocialOauthFailed(graphErrorMessage(bodyText)))
    }
    return ok((await response.json()) as T)
  } catch (error) {
    console.error('[social] POST erro de rede', url, error)
    return err(crmSocialOauthFailed())
  }
}

/** POST `application/json` autenticado por Bearer e devolve o JSON, ou `crmSocialOauthFailed`. */
export async function postJson<T>(
  url: string,
  accessToken: string,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<Result<T>> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const bodyText = await response.text().catch(() => '')
      console.error(
        '[social] POST json falhou',
        url,
        response.status,
        bodyText.slice(0, 500),
      )
      return err(crmSocialOauthFailed(graphErrorMessage(bodyText)))
    }
    return ok((await response.json()) as T)
  } catch (error) {
    console.error('[social] POST json erro de rede', url, error)
    return err(crmSocialOauthFailed())
  }
}

/** GET autenticado por Bearer (ou sem) e devolve o JSON, ou `crmSocialOauthFailed`. */
export async function getJson<T>(
  url: string,
  accessToken?: string,
  extraHeaders: Record<string, string> = {},
): Promise<Result<T>> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        ...extraHeaders,
      },
    })
    if (!response.ok) {
      const bodyText = await response.text().catch(() => '')
      console.error(
        '[social] GET falhou',
        url,
        response.status,
        bodyText.slice(0, 500),
      )
      return err(crmSocialOauthFailed(graphErrorMessage(bodyText)))
    }
    return ok((await response.json()) as T)
  } catch (error) {
    console.error('[social] GET erro de rede', url, error)
    return err(crmSocialOauthFailed())
  }
}

/** POST `multipart/form-data` (upload binário, ex.: foto do Facebook) e devolve o JSON. */
export async function postMultipart<T>(
  url: string,
  form: FormData,
): Promise<Result<T>> {
  try {
    const response = await fetch(url, { method: 'POST', body: form })
    if (!response.ok) {
      const bodyText = await response.text().catch(() => '')
      console.error(
        '[social] POST multipart falhou',
        url,
        response.status,
        bodyText.slice(0, 500),
      )
      return err(crmSocialOauthFailed(graphErrorMessage(bodyText)))
    }
    return ok((await response.json()) as T)
  } catch (error) {
    console.error('[social] POST multipart erro de rede', url, error)
    return err(crmSocialOauthFailed())
  }
}

/** `expires_in` (segundos) → `Date` absoluta, ou `null` quando ausente. */
export function expiresInToDate(expiresIn: unknown): Date | null {
  return typeof expiresIn === 'number' && expiresIn > 0
    ? new Date(Date.now() + expiresIn * 1000)
    : null
}
