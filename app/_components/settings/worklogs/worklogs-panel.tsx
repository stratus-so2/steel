'use client'

import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProductivityPanel } from './productivity-panel'
import { WorklogEntries } from './worklog-entries'

type Tab = 'entries' | 'productivity'

/** Ajustes › Registros de trabalho: entries and the productivity panel. */
export function WorklogsPanel({ workspaceId }: { workspaceId: string }) {
  const [tab, setTab] = useState<Tab>('entries')
  return (
    <div className='space-y-5'>
      <Tabs
        value={tab}
        onValueChange={(value) =>
          setTab(value === 'productivity' ? 'productivity' : 'entries')
        }
      >
        <TabsList aria-label='Visão'>
          <TabsTrigger value='entries'>Apontamentos</TabsTrigger>
          <TabsTrigger value='productivity'>Produtividade</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === 'entries' ? (
        <WorklogEntries workspaceId={workspaceId} />
      ) : (
        <ProductivityPanel workspaceId={workspaceId} />
      )}
    </div>
  )
}
