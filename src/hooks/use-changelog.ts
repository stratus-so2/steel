import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  ChangelogDetailDTO,
  ChangelogSummaryDTO,
  ChangelogUserSearchResultDTO,
} from '@/types/changelog'
import { apiFetch } from './_fetch'

const CHANGELOGS_KEY = ['admin', 'changelog'] as const

interface CreateChangelogInput {
  subject: string
  items: { title: string; body: string; imageUrl?: string }[]
  userIds: string[]
  emails: string[]
}

export function useChangelogs() {
  return useQuery({
    queryKey: CHANGELOGS_KEY,
    queryFn: () =>
      apiFetch<ChangelogSummaryDTO[]>(
        '/api/admin/changelog',
        undefined,
        'Erro ao buscar changelogs',
      ),
    staleTime: 15 * 1000,
  })
}

export function useChangelog(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'changelog', id],
    queryFn: () =>
      apiFetch<ChangelogDetailDTO>(
        `/api/admin/changelog/${id}`,
        undefined,
        'Erro ao buscar changelog',
      ),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      query.state.data?.status === 'RUNNING' ? 3000 : false,
  })
}

export function useCreateChangelog() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateChangelogInput) =>
      apiFetch<ChangelogDetailDTO>(
        '/api/admin/changelog',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
        'Erro ao criar changelog',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHANGELOGS_KEY })
    },
  })
}

export function useStartChangelog() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<ChangelogDetailDTO>(
        `/api/admin/changelog/${id}/start`,
        { method: 'POST' },
        'Erro ao enviar changelog',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHANGELOGS_KEY })
    },
  })
}

export function useSearchChangelogUsers(query: string) {
  return useQuery({
    queryKey: ['admin', 'changelog', 'user-search', query],
    queryFn: () =>
      apiFetch<ChangelogUserSearchResultDTO[]>(
        `/api/admin/changelog/users/search?q=${encodeURIComponent(query)}`,
        undefined,
        'Erro ao buscar usuários',
      ),
    enabled: query.trim().length >= 2,
    staleTime: 30 * 1000,
  })
}
