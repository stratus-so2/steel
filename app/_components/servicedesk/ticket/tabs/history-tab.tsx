'use client'

import { useEffect, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { notify } from '@/lib/notify'
import {
  flattenSdMessages,
  useDeleteSdTicketMessage,
  useSdTicketMessages,
  useUpdateSdTicketMessage,
} from '@/src/hooks/use-sd-ticket-messages'
import { useSdTicketRealtime } from '@/src/hooks/use-sd-tickets'
import { SdMessageBubble } from '../history/sd-message-bubble'
import { SdMessageComposer } from '../history/sd-message-composer'
import type { SdTicketTabProps } from './types'

const CLOSED = new Set(['CLOSED', 'CANCELED'])

/**
 * Histórico do chamado = chat ao vivo (SSE). Agentes veem e escrevem notas
 * internas; no portal (`mode: 'requester'`) só as mensagens públicas chegam
 * da API.
 */
export function SdTicketHistoryTab({
  workspaceId,
  ticket,
  mode,
}: SdTicketTabProps) {
  const ticketRef = ticket.id
  useSdTicketRealtime(workspaceId)
  const query = useSdTicketMessages(workspaceId, ticketRef)
  const update = useUpdateSdTicketMessage(workspaceId, ticketRef)
  const remove = useDeleteSdTicketMessage(workspaceId, ticketRef)
  const messages = useMemo(
    () => flattenSdMessages(query.data?.pages),
    [query.data?.pages],
  )
  const bottom = useRef<HTMLDivElement>(null)
  const lastId = messages.at(-1)?.id
  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: 'end', behavior: 'smooth' })
  }, [lastId])

  const closed = CLOSED.has(ticket.phase.category)

  return (
    <div className='flex h-full min-h-[28rem] flex-col'>
      <div className='flex flex-1 flex-col gap-3 overflow-y-auto p-4'>
        {query.hasNextPage ? (
          <div className='flex justify-center'>
            <Button
              size='xs'
              variant='outline'
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              Carregar anteriores
            </Button>
          </div>
        ) : null}

        {query.error ? (
          <p className='text-center text-destructive text-sm'>
            {query.error.message}
          </p>
        ) : query.isLoading ? (
          <p className='text-center text-muted-foreground text-sm'>
            Carregando histórico…
          </p>
        ) : messages.length === 0 ? (
          <p className='py-10 text-center text-muted-foreground text-sm'>
            Nenhuma mensagem ainda. Comece a conversa abaixo.
          </p>
        ) : (
          messages.map((m) => (
            <SdMessageBubble
              key={m.id}
              message={m}
              pending={update.isPending || remove.isPending}
              onEdit={(body) =>
                update
                  .mutateAsync({ messageId: m.id, body })
                  .catch((error) => notify.error(error))
              }
              onDelete={() =>
                remove.mutate(m.id, {
                  onError: (error) => notify.error(error),
                })
              }
            />
          ))
        )}
        <div ref={bottom} />
      </div>

      <SdMessageComposer
        workspaceId={workspaceId}
        ticketRef={ticketRef}
        mode={mode}
        disabled={closed}
        disabledReason={
          closed ? 'Chamado encerrado — não aceita novas mensagens.' : undefined
        }
      />
    </div>
  )
}
