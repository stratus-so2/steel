'use client'

import { useQuery } from '@tanstack/react-query'
import type { AiTemplatesDTO } from '@/types/ai-template'
import { apiFetch } from './_fetch'

export const AI_TEMPLATES_KEY = (workspaceId: string) =>
  ['ai-templates', workspaceId] as const

/** Ready-made agent and skill templates (empty unless OWNER/ADMIN). */
export function useAiTemplates(workspaceId: string) {
  return useQuery({
    queryKey: AI_TEMPLATES_KEY(workspaceId),
    queryFn: () =>
      apiFetch<AiTemplatesDTO>(
        `/api/workspaces/${workspaceId}/ai/templates`,
        undefined,
        'Erro ao carregar os modelos',
      ),
    staleTime: 5 * 60_000,
  })
}
