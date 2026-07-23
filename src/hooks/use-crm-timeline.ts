'use client'

import { useEffect, useState } from 'react'
import type { CrmActivityDTO } from '@/types/crm-activity'
import { apiFetch } from './_fetch'

/** Feed cronológico de atividades vinculadas a um registro (empresa, pessoa
 * ou oportunidade — os únicos vínculos que `ListCrmActivitiesSchema` filtra). */
export function useCrmTimeline(
  workspaceId: string,
  filter: { companyId?: string; personId?: string; opportunityId?: string },
) {
  const [items, setItems] = useState<CrmActivityDTO[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true
    setIsLoading(true)
    const params = new URLSearchParams()
    if (filter.companyId) params.set('companyId', filter.companyId)
    if (filter.personId) params.set('personId', filter.personId)
    if (filter.opportunityId) params.set('opportunityId', filter.opportunityId)

    apiFetch<CrmActivityDTO[]>(
      `/api/workspaces/${workspaceId}/crm/activities?${params.toString()}`,
      undefined,
      'Erro ao buscar atividades',
    )
      .then((data) => {
        if (active) setItems(data ?? [])
      })
      .catch(() => {
        if (active) setItems([])
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [workspaceId, filter.companyId, filter.personId, filter.opportunityId])

  return { items, isLoading }
}
