import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type RenderOptions, render } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { vi } from 'vitest'

// Fresh QueryClient per render: no retries (a failing query must surface the
// error state immediately) and no cache sharing between tests.
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })
}

export function renderWithQuery(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { client?: QueryClient },
) {
  const client = options?.client ?? createTestQueryClient()
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
  return { client, ...render(ui, { ...options, wrapper: Wrapper }) }
}

type RouteHandler = (
  url: string,
  init: RequestInit | undefined,
) => unknown | Promise<unknown>

export interface FetchRoute {
  method?: string
  // Substring or regex matched against the request URL (path + query).
  match: string | RegExp
  status?: number
  // Either a static `data` payload (wrapped in the success envelope) or a
  // handler returning one. Handlers returning a `Response` are passed through.
  data?: unknown
  handler?: RouteHandler
  error?: string
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

// Minimal msw-like fetch stub: routes are matched in order, first match wins.
// Unmatched requests fail loudly (500) so a test never silently depends on an
// endpoint it did not declare. Returns the spy so tests can assert calls.
export function mockFetch(routes: FetchRoute[]) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    const method = (init?.method ?? 'GET').toUpperCase()
    const route = routes.find(
      (r) =>
        (r.method ?? 'GET').toUpperCase() === method &&
        (typeof r.match === 'string'
          ? url.includes(r.match)
          : r.match.test(url)),
    )
    if (!route) {
      return jsonResponse(
        { success: false, message: `Unmocked ${method} ${url}` },
        500,
      )
    }
    const status = route.status ?? 200
    if (route.error || status >= 400) {
      return jsonResponse(
        { success: false, statusCode: status, message: route.error },
        status,
      )
    }
    const payload = route.handler ? await route.handler(url, init) : route.data
    if (payload instanceof Response) return payload
    return jsonResponse(
      { success: true, statusCode: status, data: payload },
      status,
    )
  })
  vi.stubGlobal('fetch', spy)
  return spy
}

// Parses the JSON body of the n-th call to the fetch spy matching `match`.
export function fetchBody(
  spy: ReturnType<typeof mockFetch>,
  match: string | RegExp,
  method = 'POST',
) {
  const call = spy.mock.calls.find(([input, init]) => {
    const url = typeof input === 'string' ? input : String(input)
    return (
      (init?.method ?? 'GET').toUpperCase() === method &&
      (typeof match === 'string' ? url.includes(match) : match.test(url))
    )
  })
  if (!call) return undefined
  const body = call[1]?.body
  return typeof body === 'string' ? JSON.parse(body) : body
}
