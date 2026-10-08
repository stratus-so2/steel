'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AiSkillDTO, AiSkillListDTO } from '@/types/ai-skill'
import type { AiConversationModeDTO } from '@/types/steel-ai'
import { apiFetch } from './_fetch'

const base = (workspaceId: string) => `/api/workspaces/${workspaceId}/ai/skills`
const JSON_HEADERS = { 'Content-Type': 'application/json' }

export const AI_SKILLS_KEY = (workspaceId: string) =>
  ['steel-ai', workspaceId, 'skills'] as const

/** Body of create/update from the skill form. */
export interface AiSkillInput {
  scope?: 'WORKSPACE' | 'PERSONAL'
  slug?: string
  name?: string
  description?: string
  instructions?: string
  mode?: AiConversationModeDTO | null
  toolNames?: string[]
  enabled?: boolean
}

export function useAiSkills(workspaceId: string) {
  return useQuery({
    queryKey: AI_SKILLS_KEY(workspaceId),
    queryFn: () =>
      apiFetch<AiSkillListDTO>(
        base(workspaceId),
        undefined,
        'Erro ao carregar as skills',
      ),
    staleTime: 60 * 1000,
  })
}

/** Enabled skills, for the "/" picker of the composer. */
export function useEnabledAiSkills(workspaceId: string): AiSkillDTO[] {
  const skills = useAiSkills(workspaceId)
  return (skills.data?.skills ?? []).filter((skill) => skill.enabled)
}

export function useCreateAiSkill(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AiSkillInput) =>
      apiFetch<AiSkillDTO>(
        base(workspaceId),
        {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify(input),
        },
        'Erro ao criar a skill',
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: AI_SKILLS_KEY(workspaceId) }),
  })
}

export function useUpdateAiSkill(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: AiSkillInput & { id: string }) =>
      apiFetch<AiSkillDTO>(
        `${base(workspaceId)}/${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          headers: JSON_HEADERS,
          body: JSON.stringify(input),
        },
        'Erro ao salvar a skill',
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: AI_SKILLS_KEY(workspaceId) }),
  })
}

export function useDeleteAiSkill(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string }>(
        `${base(workspaceId)}/${encodeURIComponent(id)}`,
        { method: 'DELETE' },
        'Erro ao excluir a skill',
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: AI_SKILLS_KEY(workspaceId) }),
  })
}
