'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AiMemoryDTO,
  AiMemoryListDTO,
  AiMemoryScopeDTO,
} from '@/types/ai-memory'
import { apiFetch } from './_fetch'

const base = (workspaceId: string) =>
  `/api/workspaces/${workspaceId}/ai/memories`
const JSON_HEADERS = { 'Content-Type': 'application/json' }

export const AI_MEMORY_KEY = (workspaceId: string) =>
  ['steel-ai', workspaceId, 'memories'] as const

export function useAiMemories(workspaceId: string, q = '') {
  const query = q.trim()
  return useQuery({
    queryKey: [...AI_MEMORY_KEY(workspaceId), query],
    queryFn: () =>
      apiFetch<AiMemoryListDTO>(
        query
          ? `${base(workspaceId)}?q=${encodeURIComponent(query)}`
          : base(workspaceId),
        undefined,
        'Erro ao carregar a memória',
      ),
    placeholderData: (previous) => previous,
  })
}

export function useCreateAiMemory(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { scope: AiMemoryScopeDTO; content: string }) =>
      apiFetch<AiMemoryDTO>(
        base(workspaceId),
        {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify(input),
        },
        'Erro ao salvar na memória',
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: AI_MEMORY_KEY(workspaceId) }),
  })
}

export function useUpdateAiMemory(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      apiFetch<AiMemoryDTO>(
        `${base(workspaceId)}/${id}`,
        {
          method: 'PATCH',
          headers: JSON_HEADERS,
          body: JSON.stringify({ content }),
        },
        'Erro ao salvar a memória',
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: AI_MEMORY_KEY(workspaceId) }),
  })
}

/** Also the "Desfazer" of the chat's "Memória salva" chip. */
export function useDeleteAiMemory(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string }>(
        `${base(workspaceId)}/${id}`,
        { method: 'DELETE' },
        'Erro ao apagar da memória',
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: AI_MEMORY_KEY(workspaceId) }),
  })
}
