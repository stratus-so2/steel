import { z } from 'zod'
import {
  CreateCrmOpportunityLineItemSchema,
  CreateCrmOpportunitySchema,
  ReorderCrmOpportunitiesSchema,
  UpdateCrmOpportunityLineItemSchema,
  UpdateCrmOpportunitySchema,
} from '@/src/schemas/crm-opportunity.schema'
import {
  CreateCrmPipelineSchema,
  CreateCrmPipelineStageSchema,
  ReorderCrmPipelineStagesSchema,
  ReorderCrmPipelinesSchema,
  UpdateCrmPipelineSchema,
  UpdateCrmPipelineStageSchema,
} from '@/src/schemas/crm-pipeline.schema'
import type { ErrorSpec, RouteConfig } from '../../registry'
import {
  CrmOpportunityDTO,
  CrmOpportunityLineItemDTO,
  CrmPipelineDTO,
  CrmPipelineStageDTO,
} from '../../schemas/crm/opportunities'
import { CRM_ERRORS, crmAccess, describe, notFoundError } from './shared'

const TAG = ['CRM · Oportunidades'] as const

const OPPORTUNITY_PARAM = { opportunityId: 'ID da oportunidade.' }
const LINE_ITEM_PARAMS = {
  ...OPPORTUNITY_PARAM,
  lineItemId: 'ID do item de linha.',
}
const PIPELINE_PARAM = { pipelineId: 'ID do pipeline.' }
const STAGE_PARAMS = { ...PIPELINE_PARAM, stageId: 'ID da etapa.' }

const OPPORTUNITY_NOT_FOUND = notFoundError(
  'CrmOpportunity',
  'Oportunidade inexistente, excluída ou de outro workspace',
)
const LINE_ITEM_NOT_FOUND = notFoundError(
  'CrmOpportunityLineItem',
  'Item inexistente ou de outra oportunidade',
)
const PIPELINE_NOT_FOUND = notFoundError(
  'CrmPipeline',
  'Pipeline inexistente, excluído ou de outro workspace',
)
const STAGE_NOT_FOUND = notFoundError(
  'CrmPipelineStage',
  'Etapa inexistente ou de outro pipeline',
)
const CUSTOM_FIELD_INVALID: ErrorSpec = {
  code: 'CRM_CUSTOM_FIELD_INVALID',
  when: 'Valor de campo personalizado obrigatório ausente ou inválido',
}

const REORDER_NOTE =
  'Cada ID em `orderedIds` recebe `position` igual ao seu índice. IDs de fora do escopo fazem a transação falhar (`500 DATABASE_ERROR`).'

/** CRM · Oportunidades — `opportunities/**`, `pipelines/**`. */
export const crmOpportunitiesRoutes: RouteConfig[] = [
  /* ----------------------------- oportunidades ---------------------------- */
  {
    method: 'get',
    path: '/workspaces/{id}/crm/opportunities',
    tags: [...TAG],
    summary: 'Listar oportunidades',
    description: describe(
      'Oportunidades do workspace (com os campos personalizados em `customFields`), filtráveis por pipeline e etapa.',
      crmAccess('opportunities', 'VIEW'),
    ),
    query: {
      type: 'object',
      properties: {
        pipelineId: { type: 'string', description: 'Só deste pipeline.' },
        stageId: { type: 'string', description: 'Só desta etapa.' },
      },
    },
    responses: {
      200: {
        description: 'Oportunidades.',
        schema: z.array(CrmOpportunityDTO),
      },
    },
    errors: CRM_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/opportunities',
    tags: [...TAG],
    summary: 'Criar oportunidade',
    description: describe(
      [
        'Pipeline e etapa são opcionais:',
        '',
        '- sem nenhum → pipeline padrão do workspace (ou o primeiro) e sua primeira etapa `OPEN`;',
        '- só `pipelineId` → primeira etapa `OPEN` desse pipeline;',
        '- `stageId` exige `pipelineId` (senão `400 BAD_REQUEST`) e precisa pertencer a ele.',
        '',
        '`customFields` é chaveado pelo `definitionId` dos campos personalizados de oportunidade. Dispara os workflows de "oportunidade criada".',
      ].join('\n'),
      crmAccess('opportunities', 'CREATE'),
    ),
    consent: true,
    body: CreateCrmOpportunitySchema,
    responses: {
      201: { description: 'Oportunidade criada.', schema: CrmOpportunityDTO },
    },
    errors: [
      ...CRM_ERRORS,
      {
        code: 'BAD_REQUEST',
        message: 'Informe o pipeline ao definir a etapa',
        when: '`stageId` sem `pipelineId`',
      },
      PIPELINE_NOT_FOUND,
      STAGE_NOT_FOUND,
      {
        code: 'CRM_PIPELINE_NOT_FOUND',
        when: 'Workspace sem pipeline, ou pipeline sem etapas',
      },
      CUSTOM_FIELD_INVALID,
    ],
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/crm/opportunities/reorder',
    tags: [...TAG],
    summary: 'Reordenar oportunidades',
    description: describe(
      `Sem \`stageId\`, reordena globalmente (ordem da grade); com \`stageId\`, só dentro da etapa (quadro Kanban). ${REORDER_NOTE}`,
      crmAccess('opportunities', 'EDIT'),
    ),
    consent: true,
    body: ReorderCrmOpportunitiesSchema,
    responses: { 200: { description: 'Ordem salva.', schema: null } },
    errors: CRM_ERRORS,
  },
  {
    method: 'get',
    path: '/workspaces/{id}/crm/opportunities/{opportunityId}',
    tags: [...TAG],
    summary: 'Detalhe da oportunidade',
    description: crmAccess('opportunities', 'VIEW'),
    params: OPPORTUNITY_PARAM,
    responses: {
      200: { description: 'Oportunidade.', schema: CrmOpportunityDTO },
    },
    errors: [...CRM_ERRORS, OPPORTUNITY_NOT_FOUND],
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/crm/opportunities/{opportunityId}',
    tags: [...TAG],
    summary: 'Atualizar oportunidade',
    description: describe(
      [
        'Atualização parcial. `amount`, `probability`, `closeDate`, `companyId`, `pointOfContactId`, `ownerId` e `source` aceitam `null` para limpar.',
        '',
        'Mudar só `pipelineId` move a oportunidade para a primeira etapa `OPEN` do pipeline alvo; `stageId` precisa pertencer ao pipeline (o informado ou o atual). Dispara os workflows de "oportunidade atualizada".',
      ].join('\n'),
      crmAccess('opportunities', 'EDIT'),
    ),
    consent: true,
    params: OPPORTUNITY_PARAM,
    body: UpdateCrmOpportunitySchema,
    responses: {
      200: {
        description: 'Oportunidade atualizada.',
        schema: CrmOpportunityDTO,
      },
    },
    errors: [
      ...CRM_ERRORS,
      OPPORTUNITY_NOT_FOUND,
      PIPELINE_NOT_FOUND,
      STAGE_NOT_FOUND,
      {
        code: 'CRM_PIPELINE_NOT_FOUND',
        when: 'Pipeline alvo sem etapas',
      },
      CUSTOM_FIELD_INVALID,
    ],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/crm/opportunities/{opportunityId}',
    tags: [...TAG],
    summary: 'Excluir oportunidade',
    description: describe(
      'Exclusão lógica (soft delete). Dispara os workflows de "oportunidade excluída".',
      crmAccess('opportunities', 'DELETE'),
    ),
    consent: true,
    params: OPPORTUNITY_PARAM,
    responses: {
      200: { description: 'Oportunidade excluída.', schema: null },
    },
    errors: [...CRM_ERRORS, OPPORTUNITY_NOT_FOUND],
  },

  /* ----------------------------- itens de linha --------------------------- */
  {
    method: 'get',
    path: '/workspaces/{id}/crm/opportunities/{opportunityId}/line-items',
    tags: [...TAG],
    summary: 'Listar itens da oportunidade',
    description: describe(
      'Produtos/serviços da oportunidade, na ordem de inclusão.',
      crmAccess('opportunities', 'VIEW'),
    ),
    params: OPPORTUNITY_PARAM,
    responses: {
      200: {
        description: 'Itens de linha.',
        schema: z.array(CrmOpportunityLineItemDTO),
      },
    },
    errors: [...CRM_ERRORS, OPPORTUNITY_NOT_FOUND],
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/opportunities/{opportunityId}/line-items',
    tags: [...TAG],
    summary: 'Adicionar item à oportunidade',
    description: describe(
      '`productId` vincula o item ao catálogo, mas nome, preço e cobrança são os enviados no corpo (o cliente copia do produto). `total` = quantidade × preço × (1 − desconto/100). Padrões: `quantity` 1, `unitPrice` 0, `discountPct` 0, `billingType` `ONE_TIME`.',
      crmAccess('opportunities', 'CREATE'),
    ),
    consent: true,
    params: OPPORTUNITY_PARAM,
    body: CreateCrmOpportunityLineItemSchema,
    responses: {
      201: {
        description: 'Item criado.',
        schema: CrmOpportunityLineItemDTO,
      },
    },
    errors: [...CRM_ERRORS, OPPORTUNITY_NOT_FOUND],
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/crm/opportunities/{opportunityId}/line-items/{lineItemId}',
    tags: [...TAG],
    summary: 'Atualizar item da oportunidade',
    description: describe(
      'Atualização parcial; `total` é recalculado. Trocar `productId` atualiza o item no lugar, copiando nome, preço e cobrança do novo produto para os campos não enviados; `productId: null` desvincula do catálogo.',
      crmAccess('opportunities', 'EDIT'),
    ),
    consent: true,
    params: LINE_ITEM_PARAMS,
    body: UpdateCrmOpportunityLineItemSchema,
    responses: {
      200: {
        description: 'Item atualizado.',
        schema: CrmOpportunityLineItemDTO,
      },
    },
    errors: [
      ...CRM_ERRORS,
      OPPORTUNITY_NOT_FOUND,
      LINE_ITEM_NOT_FOUND,
      notFoundError('CrmProduct', 'Novo `productId` inexistente'),
    ],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/crm/opportunities/{opportunityId}/line-items/{lineItemId}',
    tags: [...TAG],
    summary: 'Remover item da oportunidade',
    description: crmAccess('opportunities', 'DELETE'),
    consent: true,
    params: LINE_ITEM_PARAMS,
    responses: { 200: { description: 'Item removido.', schema: null } },
    errors: [...CRM_ERRORS, OPPORTUNITY_NOT_FOUND, LINE_ITEM_NOT_FOUND],
  },

  /* ------------------------------- pipelines ------------------------------ */
  {
    method: 'get',
    path: '/workspaces/{id}/crm/pipelines',
    tags: [...TAG],
    summary: 'Listar pipelines',
    description: describe(
      'Pipelines de vendas do workspace, na ordem definida (`position`).',
      crmAccess('pipelines', 'VIEW'),
    ),
    responses: {
      200: { description: 'Pipelines.', schema: z.array(CrmPipelineDTO) },
    },
    errors: CRM_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/pipelines',
    tags: [...TAG],
    summary: 'Criar pipeline',
    description: describe(
      'O pipeline nasce sem etapas e entra no fim da lista — crie as etapas em seguida. `isDefault` marca o pipeline usado quando a oportunidade é criada sem `pipelineId` (não desmarca os demais).',
      crmAccess('pipelines', 'CREATE'),
    ),
    consent: true,
    body: CreateCrmPipelineSchema,
    responses: {
      201: { description: 'Pipeline criado.', schema: CrmPipelineDTO },
    },
    errors: CRM_ERRORS,
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/crm/pipelines/reorder',
    tags: [...TAG],
    summary: 'Reordenar pipelines',
    description: describe(REORDER_NOTE, crmAccess('pipelines', 'EDIT')),
    consent: true,
    body: ReorderCrmPipelinesSchema,
    responses: { 200: { description: 'Ordem salva.', schema: null } },
    errors: CRM_ERRORS,
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/crm/pipelines/{pipelineId}',
    tags: [...TAG],
    summary: 'Atualizar pipeline',
    description: describe(
      'Renomeia ou marca/desmarca como padrão.',
      crmAccess('pipelines', 'EDIT'),
    ),
    consent: true,
    params: PIPELINE_PARAM,
    body: UpdateCrmPipelineSchema,
    responses: {
      200: { description: 'Pipeline atualizado.', schema: CrmPipelineDTO },
    },
    errors: [...CRM_ERRORS, PIPELINE_NOT_FOUND],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/crm/pipelines/{pipelineId}',
    tags: [...TAG],
    summary: 'Excluir pipeline',
    description: describe(
      'Exclusão lógica (soft delete); as oportunidades do pipeline não são movidas.',
      crmAccess('pipelines', 'DELETE'),
    ),
    consent: true,
    params: PIPELINE_PARAM,
    responses: { 200: { description: 'Pipeline excluído.', schema: null } },
    errors: [...CRM_ERRORS, PIPELINE_NOT_FOUND],
  },

  /* -------------------------------- etapas -------------------------------- */
  {
    method: 'get',
    path: '/workspaces/{id}/crm/pipelines/{pipelineId}/stages',
    tags: [...TAG],
    summary: 'Listar etapas do pipeline',
    description: describe(
      'Etapas na ordem do funil (`position`).',
      crmAccess('pipelines', 'VIEW'),
    ),
    params: PIPELINE_PARAM,
    responses: {
      200: { description: 'Etapas.', schema: z.array(CrmPipelineStageDTO) },
    },
    errors: [...CRM_ERRORS, PIPELINE_NOT_FOUND],
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/pipelines/{pipelineId}/stages',
    tags: [...TAG],
    summary: 'Criar etapa',
    description: describe(
      'A etapa entra no fim do funil. `category` (`OPEN`/`WON`/`LOST`) define como o forecast a conta. Padrões: `probability` 0, `category` `OPEN`.',
      crmAccess('pipelines', 'CREATE'),
    ),
    consent: true,
    params: PIPELINE_PARAM,
    body: CreateCrmPipelineStageSchema,
    responses: {
      201: { description: 'Etapa criada.', schema: CrmPipelineStageDTO },
    },
    errors: [...CRM_ERRORS, PIPELINE_NOT_FOUND],
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/crm/pipelines/{pipelineId}/stages/reorder',
    tags: [...TAG],
    summary: 'Reordenar etapas',
    description: describe(REORDER_NOTE, crmAccess('pipelines', 'EDIT')),
    consent: true,
    params: PIPELINE_PARAM,
    body: ReorderCrmPipelineStagesSchema,
    responses: { 200: { description: 'Ordem salva.', schema: null } },
    errors: [...CRM_ERRORS, PIPELINE_NOT_FOUND],
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/crm/pipelines/{pipelineId}/stages/{stageId}',
    tags: [...TAG],
    summary: 'Atualizar etapa',
    description: describe(
      'Atualização parcial.',
      crmAccess('pipelines', 'EDIT'),
    ),
    consent: true,
    params: STAGE_PARAMS,
    body: UpdateCrmPipelineStageSchema,
    responses: {
      200: { description: 'Etapa atualizada.', schema: CrmPipelineStageDTO },
    },
    errors: [...CRM_ERRORS, PIPELINE_NOT_FOUND, STAGE_NOT_FOUND],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/crm/pipelines/{pipelineId}/stages/{stageId}',
    tags: [...TAG],
    summary: 'Excluir etapa',
    description: describe(
      'Exclusão definitiva. Bloqueada enquanto houver oportunidades na etapa.',
      crmAccess('pipelines', 'DELETE'),
    ),
    consent: true,
    params: STAGE_PARAMS,
    responses: { 200: { description: 'Etapa excluída.', schema: null } },
    errors: [
      ...CRM_ERRORS,
      PIPELINE_NOT_FOUND,
      STAGE_NOT_FOUND,
      {
        code: 'CRM_PIPELINE_STAGE_IN_USE',
        when: 'Há oportunidades vinculadas à etapa',
      },
    ],
  },
]
