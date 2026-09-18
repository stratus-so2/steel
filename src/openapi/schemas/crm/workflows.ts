import {
  CrmWorkflowOutputSchema,
  CrmWorkflowVersionOutputSchema,
} from '@/src/schemas/crm-workflow.schema'
import { dto } from '../../common'

/** DTOs de workflows do CRM (`src/schemas/crm-workflow.schema.ts`, seção outputs). */

export const CrmWorkflowDTO = dto(
  'CrmWorkflow',
  CrmWorkflowOutputSchema.meta({
    description:
      'Workflow de automação. `activeVersionId` aponta a versão `ACTIVE` que os gatilhos executam; a edição acontece sempre no draft.',
  }),
)

export const CrmWorkflowVersionDTO = dto(
  'CrmWorkflowVersion',
  CrmWorkflowVersionOutputSchema.meta({
    description:
      'Versão do workflow (`DRAFT` editável, `ACTIVE` em execução, `ARCHIVED` histórico) com a definição do canvas: `trigger`, `nodes` e `edges`.',
  }),
)
