'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CrmCompaniesTable } from './crm-companies-table'
import { CrmPeopleTable } from './crm-people-table'

export function CrmPageClient({ workspaceId }: { workspaceId: string }) {
  return (
    <div className='flex h-full flex-col gap-4 p-4'>
      <Tabs defaultValue='companies'>
        <TabsList>
          <TabsTrigger value='companies'>Empresas</TabsTrigger>
          <TabsTrigger value='people'>Pessoas</TabsTrigger>
        </TabsList>
        <TabsContent value='companies'>
          <CrmCompaniesTable workspaceId={workspaceId} />
        </TabsContent>
        <TabsContent value='people'>
          <CrmPeopleTable workspaceId={workspaceId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
