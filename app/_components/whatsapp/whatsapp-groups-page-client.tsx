'use client'

import { useState } from 'react'
import { useWhatsAppRealtimeEvents } from '@/src/hooks/use-whatsapp-events'
import type { WhatsAppGroupDTO } from '@/types/whatsapp-group'
import { WhatsappGroupSidebar } from './whatsapp-group-sidebar'
import { WhatsappGroupView } from './whatsapp-group-view'

export function WhatsappGroupsPageClient({
  workspaceId,
}: {
  workspaceId: string
}) {
  const [selected, setSelected] = useState<WhatsAppGroupDTO | null>(null)

  useWhatsAppRealtimeEvents(workspaceId)

  return (
    <div className='flex h-full w-full'>
      <WhatsappGroupSidebar
        workspaceId={workspaceId}
        selectedGroupId={selected?.id ?? null}
        onSelect={setSelected}
      />
      {selected ? (
        <WhatsappGroupView
          workspaceId={workspaceId}
          group={selected}
          onLeft={() => setSelected(null)}
        />
      ) : (
        <div className='flex flex-1 items-center justify-center text-muted-foreground text-sm'>
          Selecione um grupo para começar
        </div>
      )}
    </div>
  )
}
