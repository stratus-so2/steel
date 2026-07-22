'use client'

import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useWhatsAppRealtimeEvents } from '@/src/hooks/use-whatsapp-events'
import type { WhatsAppConversationDTO } from '@/types/whatsapp-conversation'
import type { WhatsAppGroupDTO } from '@/types/whatsapp-group'
import { WhatsappConversationSidebar } from './whatsapp-conversation-sidebar'
import { WhatsappConversationView } from './whatsapp-conversation-view'
import { WhatsappGroupSidebar } from './whatsapp-group-sidebar'
import { WhatsappGroupView } from './whatsapp-group-view'

export function WhatsappPageClient({ workspaceId }: { workspaceId: string }) {
  const [tab, setTab] = useState<'conversations' | 'groups'>('conversations')
  const [selected, setSelected] = useState<WhatsAppConversationDTO | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<WhatsAppGroupDTO | null>(
    null,
  )

  useWhatsAppRealtimeEvents(workspaceId)

  return (
    <div className='flex h-full w-full flex-col'>
      <div className='border-b px-3 pt-2'>
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as 'conversations' | 'groups')}
        >
          <TabsList>
            <TabsTrigger value='conversations'>Conversas</TabsTrigger>
            <TabsTrigger value='groups'>Grupos</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className='flex min-h-0 flex-1'>
        {tab === 'conversations' ? (
          <>
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
          </>
        ) : (
          <>
            <WhatsappGroupSidebar
              workspaceId={workspaceId}
              selectedGroupId={selectedGroup?.id ?? null}
              onSelect={setSelectedGroup}
            />
            {selectedGroup ? (
              <WhatsappGroupView
                workspaceId={workspaceId}
                group={selectedGroup}
                onLeft={() => setSelectedGroup(null)}
              />
            ) : (
              <div className='flex flex-1 items-center justify-center text-muted-foreground text-sm'>
                Selecione um grupo para começar
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
