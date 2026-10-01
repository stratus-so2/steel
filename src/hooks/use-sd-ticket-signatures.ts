import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  SdTicketSignatureDTO,
  SdTicketSignatureVerificationDTO,
} from '@/types/sd-ticket-signature'
import { apiFetch } from './_fetch'
import { sdJson, sdTicketTabKey, sdTicketTabUrl } from './_sd-ticket-tab'

export interface CreateSdTicketSignatureInput {
  signerName: string
  signerDocument?: string | null
  signerEmail?: string | null
  purpose?: string
  /** `data:image/png;base64,...` do canvas. */
  image: string
}

export function useSdTicketSignatures(workspaceId: string, ticketRef: string) {
  return useQuery({
    queryKey: sdTicketTabKey(workspaceId, ticketRef, 'signatures'),
    queryFn: () =>
      apiFetch<SdTicketSignatureDTO[]>(
        sdTicketTabUrl(workspaceId, ticketRef, 'signatures'),
        undefined,
        'Erro ao carregar as assinaturas',
      ),
    enabled: Boolean(workspaceId && ticketRef),
  })
}

export function useCreateSdTicketSignature(
  workspaceId: string,
  ticketRef: string,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSdTicketSignatureInput) =>
      apiFetch<SdTicketSignatureDTO>(
        sdTicketTabUrl(workspaceId, ticketRef, 'signatures'),
        sdJson('POST', input),
        'Erro ao salvar a assinatura',
      ),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: sdTicketTabKey(workspaceId, ticketRef, 'signatures'),
      }),
  })
}

/** Confere a integridade (recalcula o SHA-256 do PNG e do chamado). */
export function useVerifySdTicketSignature(
  workspaceId: string,
  ticketRef: string,
) {
  return useMutation({
    mutationFn: (signatureId: string) =>
      apiFetch<SdTicketSignatureVerificationDTO>(
        `${sdTicketTabUrl(workspaceId, ticketRef, 'signatures')}/${signatureId}/verify`,
        undefined,
        'Erro ao verificar a assinatura',
      ),
  })
}
