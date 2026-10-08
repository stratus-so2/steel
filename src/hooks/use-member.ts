import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  ListMembersResult,
  MemberImportResult,
  MemberRole,
} from '@/types/member'
import { apiFetch } from './_fetch'

const MEMBER_KEY = ['members'] as const
const INVITATION_KEY = ['invitations'] as const

export interface ListMembersParams {
  search?: string
  roles?: string[]
  sortBy: string
  sortOrder: 'asc' | 'desc'
  page: number
  pageSize: number
}

function toQueryString(params: ListMembersParams): string {
  const search = new URLSearchParams()
  if (params.search) search.set('search', params.search)
  if (params.roles?.length) search.set('roles', params.roles.join(','))
  search.set('sortBy', params.sortBy)
  search.set('sortOrder', params.sortOrder)
  search.set('page', String(params.page))
  search.set('pageSize', String(params.pageSize))
  return search.toString()
}

/** Paginated member directory of Settings > Members (OWNER/ADMIN). */
export function useMembers(
  workspaceId: string | null,
  params: ListMembersParams,
) {
  return useQuery({
    queryKey: [MEMBER_KEY, workspaceId, params],
    queryFn: () =>
      apiFetch<ListMembersResult>(
        `/api/workspaces/${workspaceId}/members/directory?${toQueryString(params)}`,
        undefined,
        'Erro ao buscar membros',
      ),
    enabled: !!workspaceId,
    placeholderData: (previous) => previous,
  })
}

/** Members and seat usage change together with invitations. */
function useInvalidateMembers(workspaceId: string) {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: [MEMBER_KEY, workspaceId] })
    queryClient.invalidateQueries({ queryKey: [INVITATION_KEY, workspaceId] })
  }
}

export function useUpdateMemberRole(workspaceId: string) {
  const invalidate = useInvalidateMembers(workspaceId)

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: MemberRole }) =>
      apiFetch<{ userId: string; role: MemberRole }>(
        `/api/workspaces/${workspaceId}/members/${userId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role }),
        },
        'Erro ao alterar o cargo',
      ),
    onSuccess: invalidate,
  })
}

export function useRemoveMember(workspaceId: string) {
  const invalidate = useInvalidateMembers(workspaceId)

  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<{ userId: string }>(
        `/api/workspaces/${workspaceId}/members/${userId}`,
        { method: 'DELETE' },
        'Erro ao remover o membro',
      ),
    onSuccess: invalidate,
  })
}

export function useImportMembers(workspaceId: string) {
  const invalidate = useInvalidateMembers(workspaceId)

  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return apiFetch<MemberImportResult>(
        `/api/workspaces/${workspaceId}/members/import`,
        { method: 'POST', body: formData },
        'Erro ao importar membros',
      )
    },
    onSuccess: invalidate,
  })
}
