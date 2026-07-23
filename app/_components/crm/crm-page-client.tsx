'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CrmAiChatPanel } from './crm-ai-chat-panel'
import { CrmCompaniesTable } from './crm-companies-table'
import { CrmCustomFieldsPanel } from './crm-custom-fields-panel'
import { CrmEmailCampaignsPanel } from './crm-email-campaigns-panel'
import { CrmEmailTemplatesPanel } from './crm-email-templates-panel'
import { CrmIntegrationKeysPanel } from './crm-integration-keys-panel'
import { CrmLandingPagesPanel } from './crm-landing-pages-panel'
import { CrmLeadsTable } from './crm-leads-table'
import { CrmMailingListsPanel } from './crm-mailing-lists-panel'
import { CrmNotesList } from './crm-notes-list'
import { CrmOpportunitiesBoard } from './crm-opportunities-board'
import { CrmPeopleTable } from './crm-people-table'
import { CrmPipelinesPanel } from './crm-pipelines-panel'
import { CrmProductsTable } from './crm-products-table'
import { CrmReportsPanel } from './crm-reports-panel'
import { CrmSocialPanel } from './crm-social-panel'
import { CrmTasksTable } from './crm-tasks-table'
import { CrmWorkflowsPanel } from './crm-workflows-panel'

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
          <TabsTrigger value='email-templates'>Templates de e-mail</TabsTrigger>
          <TabsTrigger value='email-campaigns'>Campanhas de e-mail</TabsTrigger>
          <TabsTrigger value='mailing-lists'>Listas de e-mail</TabsTrigger>
          <TabsTrigger value='workflows'>Workflows</TabsTrigger>
          <TabsTrigger value='landing-pages'>Landing pages</TabsTrigger>
          <TabsTrigger value='social'>Redes sociais</TabsTrigger>
          <TabsTrigger value='reports'>Relatórios</TabsTrigger>
          <TabsTrigger value='ai'>Assistente IA</TabsTrigger>
          <TabsTrigger value='integration-keys'>Chaves de API</TabsTrigger>
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
        <TabsContent value='email-templates'>
          <CrmEmailTemplatesPanel workspaceId={workspaceId} />
        </TabsContent>
        <TabsContent value='email-campaigns'>
          <CrmEmailCampaignsPanel workspaceId={workspaceId} />
        </TabsContent>
        <TabsContent value='mailing-lists'>
          <CrmMailingListsPanel workspaceId={workspaceId} />
        </TabsContent>
        <TabsContent value='workflows'>
          <CrmWorkflowsPanel workspaceId={workspaceId} />
        </TabsContent>
        <TabsContent value='landing-pages'>
          <CrmLandingPagesPanel workspaceId={workspaceId} />
        </TabsContent>
        <TabsContent value='social'>
          <CrmSocialPanel workspaceId={workspaceId} />
        </TabsContent>
        <TabsContent value='reports'>
          <CrmReportsPanel workspaceId={workspaceId} />
        </TabsContent>
        <TabsContent value='ai'>
          <CrmAiChatPanel workspaceId={workspaceId} />
        </TabsContent>
        <TabsContent value='integration-keys'>
          <CrmIntegrationKeysPanel workspaceId={workspaceId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
