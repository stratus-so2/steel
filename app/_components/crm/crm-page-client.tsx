'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CrmCompaniesTable } from './crm-companies-table'
import { CrmCustomFieldsPanel } from './crm-custom-fields-panel'
import { CrmLeadsTable } from './crm-leads-table'
import { CrmNotesList } from './crm-notes-list'
import { CrmOpportunitiesBoard } from './crm-opportunities-board'
import { CrmPeopleTable } from './crm-people-table'
import { CrmPipelinesPanel } from './crm-pipelines-panel'
import { CrmProductsTable } from './crm-products-table'
import { CrmTasksTable } from './crm-tasks-table'

export function CrmPageClient({ workspaceId }: { workspaceId: string }) {
  return (
    <div className='flex h-full flex-col gap-4 p-4'>
      <Tabs defaultValue='leads'>
        <TabsList>
          <TabsTrigger value='leads'>Leads</TabsTrigger>
          <TabsTrigger value='opportunities'>Oportunidades</TabsTrigger>
          <TabsTrigger value='companies'>Empresas</TabsTrigger>
          <TabsTrigger value='people'>Pessoas</TabsTrigger>
          <TabsTrigger value='tasks'>Tarefas</TabsTrigger>
          <TabsTrigger value='notes'>Notas</TabsTrigger>
          <TabsTrigger value='pipelines'>Pipelines</TabsTrigger>
          <TabsTrigger value='products'>Produtos</TabsTrigger>
          <TabsTrigger value='custom-fields'>Campos customizados</TabsTrigger>
        </TabsList>
        <TabsContent value='leads'>
          <CrmLeadsTable workspaceId={workspaceId} />
        </TabsContent>
        <TabsContent value='opportunities'>
          <CrmOpportunitiesBoard workspaceId={workspaceId} />
        </TabsContent>
        <TabsContent value='companies'>
          <CrmCompaniesTable workspaceId={workspaceId} />
        </TabsContent>
        <TabsContent value='people'>
          <CrmPeopleTable workspaceId={workspaceId} />
        </TabsContent>
        <TabsContent value='tasks'>
          <CrmTasksTable workspaceId={workspaceId} />
        </TabsContent>
        <TabsContent value='notes'>
          <CrmNotesList workspaceId={workspaceId} />
        </TabsContent>
        <TabsContent value='pipelines'>
          <CrmPipelinesPanel workspaceId={workspaceId} />
        </TabsContent>
        <TabsContent value='products'>
          <CrmProductsTable workspaceId={workspaceId} />
        </TabsContent>
        <TabsContent value='custom-fields'>
          <CrmCustomFieldsPanel workspaceId={workspaceId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
