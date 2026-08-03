import { useMutation } from '@tanstack/react-query'
import { apiFetch } from './_fetch'

export function useUploadChangelogImage() {
  return useMutation({
    mutationFn: (file: File) =>
      apiFetch<{ url: string }>(
        '/api/admin/changelog/images/upload',
        {
          method: 'POST',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        },
        'Erro ao enviar imagem',
      ),
  })
}
