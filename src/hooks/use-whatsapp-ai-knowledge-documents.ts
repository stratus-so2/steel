import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { WhatsAppAiKnowledgeDocumentDTO } from '@/types/whatsapp-ai-knowledge-document'
import { apiFetch } from './_fetch'

const DOCUMENTS_KEY = (workspaceId: string) =>
  ['whatsapp-ai-knowledge-documents', workspaceId] as const

export function useWhatsAppAiKnowledgeDocuments(workspaceId: string) {
  return useQuery({
    queryKey: DOCUMENTS_KEY(workspaceId),
    queryFn: () =>
      apiFetch<WhatsAppAiKnowledgeDocumentDTO[]>(
        `/api/workspaces/${workspaceId}/whatsapp/ai-config/knowledge-documents`,
        undefined,
        'Erro ao buscar documentos',
      ),
    staleTime: 15 * 1000,
  })
}

export function useUploadWhatsAppAiKnowledgeDocument(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData()
      formData.set('file', file)
      return apiFetch<WhatsAppAiKnowledgeDocumentDTO>(
        `/api/workspaces/${workspaceId}/whatsapp/ai-config/knowledge-documents`,
        { method: 'POST', body: formData },
        'Erro ao enviar documento',
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DOCUMENTS_KEY(workspaceId) })
    },
  })
}

export function useDeleteWhatsAppAiKnowledgeDocument(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (documentId: string) =>
      apiFetch<{ id: string }>(
        `/api/workspaces/${workspaceId}/whatsapp/ai-config/knowledge-documents/${documentId}`,
        { method: 'DELETE' },
        'Erro ao remover documento',
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DOCUMENTS_KEY(workspaceId) })
    },
  })
}
