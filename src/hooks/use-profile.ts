'use client'

import { useCallback, useEffect, useState } from 'react'
import type {
  CreateProfileInput,
  ProfileDTO,
  UpdateProfileInput,
} from '@/src/schemas/profile.schema'

type ApiResponse<T> = { success: boolean; data?: T; message?: string }

const DEFAULT_BASE_PATH = '/api/workspaces'

function baseUrl(workspaceId: string, basePath: string): string {
  return `${basePath}/${workspaceId}/profiles`
}

function readError(json: unknown): string {
  const data = json as { message?: string }
  return data?.message ?? 'Não foi possível salvar.'
}

/** Lista os perfis de acesso do workspace, com refetch manual. */
export function useProfiles(workspaceId: string, basePath = DEFAULT_BASE_PATH) {
  const [profiles, setProfiles] = useState<ProfileDTO[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!workspaceId) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(baseUrl(workspaceId, basePath))
      const json: ApiResponse<ProfileDTO[]> = await res.json()
      if (!res.ok || !json.success || !json.data) {
        setError(json?.message ?? 'Não foi possível carregar os perfis.')
        return
      }
      setProfiles(json.data)
    } catch {
      setError('Erro de rede. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }, [workspaceId, basePath])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { profiles, isLoading, error, refetch }
}

export async function createProfile(
  workspaceId: string,
  input: CreateProfileInput,
  basePath = DEFAULT_BASE_PATH,
): Promise<{ ok: boolean; data?: ProfileDTO; message?: string }> {
  try {
    const res = await fetch(baseUrl(workspaceId, basePath), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const json = await res.json()
    if (!res.ok || !json.success) return { ok: false, message: readError(json) }
    return { ok: true, data: json.data as ProfileDTO }
  } catch {
    return { ok: false, message: 'Erro de rede. Tente novamente.' }
  }
}

export async function updateProfile(
  workspaceId: string,
  profileId: string,
  input: UpdateProfileInput,
  basePath = DEFAULT_BASE_PATH,
): Promise<{ ok: boolean; data?: ProfileDTO; message?: string }> {
  try {
    const res = await fetch(`${baseUrl(workspaceId, basePath)}/${profileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const json = await res.json()
    if (!res.ok || !json.success) return { ok: false, message: readError(json) }
    return { ok: true, data: json.data as ProfileDTO }
  } catch {
    return { ok: false, message: 'Erro de rede. Tente novamente.' }
  }
}

export async function deleteProfile(
  workspaceId: string,
  profileId: string,
  basePath = DEFAULT_BASE_PATH,
): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch(`${baseUrl(workspaceId, basePath)}/${profileId}`, {
      method: 'DELETE',
    })
    const json = await res.json()
    if (!res.ok || !json.success) return { ok: false, message: readError(json) }
    return { ok: true }
  } catch {
    return { ok: false, message: 'Erro de rede. Tente novamente.' }
  }
}

export async function setMemberProfile(
  workspaceId: string,
  userId: string,
  profileId: string | null,
  basePath = DEFAULT_BASE_PATH,
): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch(
      `${basePath}/${workspaceId}/members/${userId}/profile`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId }),
      },
    )
    const json = await res.json()
    if (!res.ok || !json.success) return { ok: false, message: readError(json) }
    return { ok: true }
  } catch {
    return { ok: false, message: 'Erro de rede. Tente novamente.' }
  }
}
