import type { SdOptionDTO } from '@/types/sd-directory'
import { apiFetch } from './_fetch'

/** Query string sem os valores vazios (`undefined`, `null`, `''`). */
export function sdQueryString(
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    qs.set(key, String(value))
  }
  const str = qs.toString()
  return str ? `?${str}` : ''
}

export function sdBase(workspaceId: string, path: string): string {
  return `/api/workspaces/${workspaceId}/servicedesk/${path}`
}

export function sdJson(method: 'POST' | 'PATCH', body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

/** Busca de um seletor leve (`/options`). */
export function fetchSdOptions(
  workspaceId: string,
  path: string,
  params: Record<string, string | number | undefined>,
): Promise<SdOptionDTO[]> {
  return apiFetch<SdOptionDTO[]>(
    `${sdBase(workspaceId, path)}${sdQueryString(params)}`,
    undefined,
    'Erro ao buscar opções',
  )
}
