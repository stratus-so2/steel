'use client'

import * as React from 'react'
import { notify } from '@/lib/notify'
import { useKbEditorContext } from './use-sd-kb-editor-context'

/** Upload de mídia do editor da KB (port de `use-wiki-media` do Nexo). */

export interface UploadedSdKbMedia {
  key: string
  url: string
  name: string
}

interface UploadResponse {
  data?: { key: string; url: string; name: string }
  message?: string
}

export function uploadSdKbMediaXhr(
  workspaceId: string,
  articleId: string,
  file: File,
  onProgress: (progress: number) => void,
): Promise<{ key: string; url: string; name: string }> {
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', file)

    const xhr = new XMLHttpRequest()
    xhr.open(
      'POST',
      `/api/workspaces/${workspaceId}/servicedesk/knowledge/${articleId}/media`,
    )

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }

    xhr.onload = () => {
      let body: UploadResponse | null = null
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        body = null
      }
      if (xhr.status >= 200 && xhr.status < 300 && body?.data) {
        resolve(body.data)
      } else {
        reject(new Error(body?.message ?? 'Erro ao enviar arquivo'))
      }
    }

    xhr.onerror = () => reject(new Error('Erro ao enviar arquivo'))
    xhr.send(formData)
  })
}

export function useUploadSdKbMedia() {
  const { workspaceId, articleId } = useKbEditorContext()
  const [isUploading, setIsUploading] = React.useState(false)
  const [uploadingFile, setUploadingFile] = React.useState<File>()
  const [progress, setProgress] = React.useState(0)
  const [uploadedFile, setUploadedFile] = React.useState<UploadedSdKbMedia>()

  const uploadFile = React.useCallback(
    async (file: File) => {
      setIsUploading(true)
      setUploadingFile(file)
      setProgress(0)
      try {
        const result = await uploadSdKbMediaXhr(
          workspaceId,
          articleId,
          file,
          setProgress,
        )
        const uploaded: UploadedSdKbMedia = { ...result, name: file.name }
        setUploadedFile(uploaded)
        return uploaded
      } catch (error) {
        notify.error(
          error instanceof Error ? error.message : 'Erro ao enviar arquivo',
        )
        throw error
      } finally {
        setProgress(0)
        setIsUploading(false)
        setUploadingFile(undefined)
      }
    },
    [workspaceId, articleId],
  )

  return { isUploading, progress, uploadedFile, uploadFile, uploadingFile }
}
