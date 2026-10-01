import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { IssueSdPortalAccessDTO } from '@/src/schemas/sd-portal.schema'
import type { SdPortalAccessDTO } from '@/types/sd-portal'
import { apiFetch } from './_fetch'

/**
 * Lado do **agente**: enviar e revogar o acesso ao portal externo de um
 * contato (`/api/workspaces/[id]/servicedesk/portal-access`). A tela do
 * contato e a do chamado usam estes hooks.
 */

export const sdPortalAccessKeys = {
  all: (workspaceId: string) => ['sd-portal-access', workspaceId] as const,
  byContact: (workspaceId: string, contactId: string) =>
    ['sd-portal-access', workspaceId, contactId] as const,
}

const base = (workspaceId: string) =>
  `/api/workspaces/${workspaceId}/servicedesk/portal-access`

/** Links emitidos para um contato (mais recentes primeiro). */
export function useSdPortalAccesses(
  workspaceId: string,
  contactId: string | null,
) {
  return useQuery({
    queryKey: sdPortalAccessKeys.byContact(workspaceId, contactId ?? ''),
    queryFn: () =>
      apiFetch<SdPortalAccessDTO[]>(
        `${base(workspaceId)}?contactId=${encodeURIComponent(contactId ?? '')}`,
        undefined,
        'Erro ao carregar os acessos do portal',
      ),
    enabled: contactId !== null && contactId.length > 0,
  })
}

/** Envia o link de acesso ao portal para o contato. */
export function useIssueSdPortalAccess(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: IssueSdPortalAccessDTO) =>
      apiFetch<SdPortalAccessDTO>(
        base(workspaceId),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        },
        'Não conseguimos enviar o acesso',
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: sdPortalAccessKeys.all(workspaceId),
      }),
  })
}

/** Revoga um link (e derruba a sessão aberta por ele). */
export function useRevokeSdPortalAccess(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (accessId: string) =>
      apiFetch<SdPortalAccessDTO>(
        `${base(workspaceId)}/${encodeURIComponent(accessId)}`,
        { method: 'DELETE' },
        'Não conseguimos revogar o acesso',
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: sdPortalAccessKeys.all(workspaceId),
      }),
  })
}
