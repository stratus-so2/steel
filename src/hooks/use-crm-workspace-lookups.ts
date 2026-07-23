'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from './_fetch'

export type LookupKind =
  | 'users'
  | 'companies'
  | 'people'
  | 'opportunities'
  | 'pipelines'
  | 'stages'
  | 'products'

export type Option = { value: string; label: string }

export type Lookups = {
  maps: Record<LookupKind, Record<string, string>>
  options: Record<LookupKind, Option[]>
}

/** Recurso da API por tipo de lookup (usuários vêm de `members`). */
const RESOURCE_PATH: Record<Exclude<LookupKind, 'stages'>, string> = {
  users: 'members',
  companies: 'companies',
  people: 'people',
  opportunities: 'opportunities',
  pipelines: 'pipelines',
  products: 'products',
}

type RawItem = { id: string; name?: string | null; email?: string | null }
type RawPipeline = { id: string; name: string }
type RawStage = { id: string; name: string }

function labelOf(item: RawItem): string {
  return item.name || item.email || item.id
}

function emptyLookups(): Lookups {
  const kinds: LookupKind[] = [
    'users',
    'companies',
    'people',
    'opportunities',
    'pipelines',
    'stages',
    'products',
  ]
  const maps = {} as Lookups['maps']
  const options = {} as Lookups['options']
  for (const kind of kinds) {
    maps[kind] = {}
    options[kind] = []
  }
  return { maps, options }
}

/** Busca as etapas de todos os pipelines da workspace e as achata. */
async function fetchAllStages(workspaceId: string): Promise<RawStage[]> {
  const pipelines = await apiFetch<RawPipeline[]>(
    `/api/workspaces/${workspaceId}/crm/pipelines`,
    undefined,
    'Erro ao buscar pipelines',
  ).catch(() => [] as RawPipeline[])

  const perPipeline = await Promise.all(
    pipelines.map((p) =>
      apiFetch<RawStage[]>(
        `/api/workspaces/${workspaceId}/crm/pipelines/${p.id}/stages`,
        undefined,
        'Erro ao buscar etapas',
      ).catch(() => [] as RawStage[]),
    ),
  )
  return perPipeline.flat()
}

/**
 * Busca os recursos relacionados (`kinds`) da workspace e devolve mapas
 * id→nome e listas de opções para resolver/selecionar relações nas grades
 * do CRM. `kinds` deve ser estável (definido em nível de módulo).
 */
export function useCrmWorkspaceLookups(
  workspaceId: string,
  kinds: LookupKind[],
) {
  const [lookups, setLookups] = useState<Lookups>(emptyLookups)
  const [isLoading, setIsLoading] = useState(true)

  const kindsKey = JSON.stringify(kinds)

  useEffect(() => {
    if (!workspaceId) return
    let active = true
    setIsLoading(true)

    const currentKinds = JSON.parse(kindsKey) as LookupKind[]

    ;(async () => {
      const results = await Promise.all(
        currentKinds.map(async (kind) => {
          try {
            if (kind === 'stages') {
              return [kind, await fetchAllStages(workspaceId)] as const
            }
            const items = await apiFetch<RawItem[]>(
              `/api/workspaces/${workspaceId}/crm/${RESOURCE_PATH[kind]}`,
              undefined,
              'Erro ao buscar dados relacionados',
            )
            return [kind, items] as const
          } catch {
            return [kind, [] as RawItem[]] as const
          }
        }),
      )

      if (!active) return

      const next = emptyLookups()
      for (const [kind, items] of results) {
        for (const item of items) {
          const label = labelOf(item)
          next.maps[kind][item.id] = label
          next.options[kind].push({ value: item.id, label })
        }
      }

      setLookups(next)
      setIsLoading(false)
    })()

    return () => {
      active = false
    }
  }, [workspaceId, kindsKey])

  return { lookups, isLoading }
}
