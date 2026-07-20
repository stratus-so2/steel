import { useMutation } from '@tanstack/react-query'
import { apiFetch } from './_fetch'

export function useUploadWhatsAppMedia(workspaceId: string) {
  return useMutation({
    mutationFn: (file: File) =>
      apiFetch<{ url: string }>(
        `/api/workspaces/${workspaceId}/whatsapp/media/upload`,
        {
          method: 'POST',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        },
        'Erro ao enviar arquivo',
      ),
  })
}
