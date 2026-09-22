import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  SdPublicApprovalDTO,
  SdTicketApprovalDTO,
} from '@/types/sd-ticket-approval'
import { apiFetch } from './_fetch'
import { sdJson, sdTicketTabKey, sdTicketTabUrl } from './_sd-ticket-tab'

export type SdApproverInput =
  | { userId: string }
  | { email: string; name?: string | null }

export interface RequestSdTicketApprovalInput {
  approvers: SdApproverInput[]
  message?: string | null
  expiresInDays?: number
}

export function useSdTicketApprovals(workspaceId: string, ticketRef: string) {
  return useQuery({
    queryKey: sdTicketTabKey(workspaceId, ticketRef, 'approvals'),
    queryFn: () =>
      apiFetch<SdTicketApprovalDTO[]>(
        sdTicketTabUrl(workspaceId, ticketRef, 'approvals'),
        undefined,
        'Erro ao carregar as aprovações',
      ),
    enabled: Boolean(workspaceId && ticketRef),
  })
}

function useInvalidate(workspaceId: string, ticketRef: string) {
  const qc = useQueryClient()
  return () =>
    qc.invalidateQueries({
      queryKey: sdTicketTabKey(workspaceId, ticketRef, 'approvals'),
    })
}

export function useRequestSdTicketApproval(
  workspaceId: string,
  ticketRef: string,
) {
  const invalidate = useInvalidate(workspaceId, ticketRef)
  return useMutation({
    mutationFn: (input: RequestSdTicketApprovalInput) =>
      apiFetch<SdTicketApprovalDTO[]>(
        sdTicketTabUrl(workspaceId, ticketRef, 'approvals'),
        sdJson('POST', input),
        'Erro ao pedir a aprovação',
      ),
    onSuccess: invalidate,
  })
}

export function useCancelSdTicketApproval(
  workspaceId: string,
  ticketRef: string,
) {
  const invalidate = useInvalidate(workspaceId, ticketRef)
  return useMutation({
    mutationFn: (approvalId: string) =>
      apiFetch<SdTicketApprovalDTO>(
        `${sdTicketTabUrl(workspaceId, ticketRef, 'approvals')}/${approvalId}/cancel`,
        sdJson('POST', {}),
        'Erro ao cancelar a aprovação',
      ),
    onSuccess: invalidate,
  })
}

export function useResendSdTicketApproval(
  workspaceId: string,
  ticketRef: string,
) {
  const invalidate = useInvalidate(workspaceId, ticketRef)
  return useMutation({
    mutationFn: ({
      approvalId,
      expiresInDays,
    }: {
      approvalId: string
      expiresInDays?: number
    }) =>
      apiFetch<SdTicketApprovalDTO>(
        `${sdTicketTabUrl(workspaceId, ticketRef, 'approvals')}/${approvalId}/resend`,
        sdJson('POST', expiresInDays ? { expiresInDays } : {}),
        'Erro ao reenviar a aprovação',
      ),
    onSuccess: invalidate,
  })
}

/** Página pública: responde pelo token do e-mail (sem sessão). */
export function useRespondSdApproval(token: string) {
  return useMutation({
    mutationFn: (input: {
      decision: 'APPROVED' | 'REJECTED'
      comment?: string | null
    }) =>
      apiFetch<SdPublicApprovalDTO>(
        `/api/servicedesk/approvals/${encodeURIComponent(token)}`,
        sdJson('POST', input),
        'Não foi possível registrar a resposta',
      ),
  })
}
