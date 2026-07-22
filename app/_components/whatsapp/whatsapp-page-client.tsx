'use client'

import { useState } from 'react'
import { useWhatsAppRealtimeEvents } from '@/src/hooks/use-whatsapp-events'
import type { WhatsAppConversationDTO } from '@/types/whatsapp-conversation'
import { WhatsappConversationSidebar } from './whatsapp-conversation-sidebar'
import { WhatsappConversationView } from './whatsapp-conversation-view'

export function WhatsappPageClient({ workspaceId }: { workspaceId: string }) {
  const [selected, setSelected] = useState<WhatsAppConversationDTO | null>(null)

  useWhatsAppRealtimeEvents(workspaceId)

  return (
    <div className='flex h-full w-full'>
      <WhatsappConversationSidebar
        workspaceId={workspaceId}
        selectedConversationId={selected?.id ?? null}
        onSelect={setSelected}
      />
      {selected ? (
        <WhatsappConversationView
          workspaceId={workspaceId}
          conversation={selected}
          onSelectConversation={setSelected}
        />
      ) : (
        <div className='flex flex-1 items-center justify-center text-muted-foreground text-sm'>
          Selecione uma conversa para começar
        </div>
      )}
    </div>
  )
}
