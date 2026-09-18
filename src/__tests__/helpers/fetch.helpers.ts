import { vi } from 'vitest'

/** Uma chamada capturada pelo `fetch` mockado: URL já normalizada + `init`. */
export type FetchCall = { url: string; init: RequestInit | undefined }

type FetchHandler = (
  url: string,
  init: RequestInit | undefined,
) => Response | Promise<Response>

/** Resposta JSON com status/headers opcionais (padrão 200). */
export function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
}

/** Resposta de texto cru — útil pra simular corpo de erro ou JSON malformado. */
export function textResponse(
  text: string,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(text, {
    status: init.status ?? 200,
    headers: init.headers,
  })
}

/**
 * Substitui o `fetch` global por um roteador de teste — nenhuma chamada sai
 * para a rede. O spy é restaurado pelo `vi.restoreAllMocks()` do setup unit.
 * Devolve `calls()` para inspecionar URL/método/headers/corpo enviados.
 */
export function mockFetch(handler: FetchHandler) {
  const spy = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url
      return handler(url, init)
    })

  return {
    spy,
    calls(): FetchCall[] {
      return spy.mock.calls.map(([input, init]) => ({
        url:
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url,
        init,
      }))
    },
  }
}

/** Header de uma chamada capturada, independente do formato do `init.headers`. */
export function headerOf(call: FetchCall, name: string): string | null {
  return new Headers(call.init?.headers).get(name)
}

/**
 * Resposta cujo corpo não pode ser lido (stream abortado no meio): `text()` e
 * `json()` rejeitam. Exercita os `.catch()` de leitura de corpo dos services.
 */
export function unreadableResponse(
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  const status = init.status ?? 200
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(init.headers),
    text: () => Promise.reject(new Error('body stream aborted')),
    json: () => Promise.reject(new Error('body stream aborted')),
  } as unknown as Response
}
