'use client'

import { Delete02Icon } from '@hugeicons-pro/core-stroke-rounded'
import { type ChangeEvent, useRef } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { notify } from '@/lib/notify'
import {
  useDeleteWhatsAppAiKnowledgeDocument,
  useUploadWhatsAppAiKnowledgeDocument,
  useWhatsAppAiKnowledgeDocuments,
} from '@/src/hooks/use-whatsapp-ai-knowledge-documents'

const STATUS_LABEL: Record<string, string> = {
  PROCESSING: 'Processando',
  READY: 'Pronto',
  FAILED: 'Falhou',
}

export function WhatsappSettingsAiKnowledge({
  workspaceId,
}: {
  workspaceId: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const documents = useWhatsAppAiKnowledgeDocuments(workspaceId)
  const upload = useUploadWhatsAppAiKnowledgeDocument(workspaceId)
  const remove = useDeleteWhatsAppAiKnowledgeDocument(workspaceId)

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    upload.mutate(file, {
      onError: (error) => notify.error(error, 'Não foi possível enviar'),
    })
  }

  return (
    <div className='max-w-lg space-y-4'>
      <div>
        <h3 className='font-medium text-sm'>Base de conhecimento</h3>
        <p className='text-muted-foreground text-xs'>
          Documentos (PDF, DOCX ou TXT) cujo conteúdo a IA usa como referência
          para responder. Sem suporte a imagens digitalizadas.
        </p>
      </div>

      <div className='space-y-2 rounded-md border p-2'>
        {(documents.data ?? []).map((document) => (
          <div
            key={document.id}
            className='flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm'
          >
            <span className='truncate'>{document.filename}</span>
            <div className='flex shrink-0 items-center gap-2'>
              <Badge
                variant={
                  document.status === 'FAILED' ? 'destructive' : 'outline'
                }
              >
                {STATUS_LABEL[document.status] ?? document.status}
              </Badge>
              <Button
                size='icon-xs'
                variant='ghost'
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(document.id, {
                    onError: (error) =>
                      notify.error(error, 'Não foi possível remover'),
                  })
                }
              >
                <SteelIcon icon={Delete02Icon} size={14} />
              </Button>
            </div>
          </div>
        ))}
        {documents.data?.length === 0 && (
          <p className='px-2 py-1.5 text-muted-foreground text-xs'>
            Nenhum documento enviado ainda.
          </p>
        )}
      </div>

      <input
        ref={inputRef}
        type='file'
        accept='.pdf,.docx,.txt,.csv'
        className='hidden'
        onChange={handleFileChange}
      />
      <Button
        type='button'
        variant='outline'
        size='sm'
        disabled={upload.isPending}
        onClick={() => inputRef.current?.click()}
      >
        {upload.isPending ? 'Enviando...' : 'Enviar documento'}
      </Button>
    </div>
  )
}
