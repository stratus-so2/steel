import { z } from 'zod'
import { GetCrmForecastSchema } from '@/src/schemas/crm-forecast.schema'
import {
  CreateCrmQuotaSchema,
  ListCrmQuotasSchema,
  UpdateCrmQuotaSchema,
} from '@/src/schemas/crm-quota.schema'
import type { RouteConfig } from '../../registry'
import { CrmForecastDTO, CrmQuotaDTO } from '../../schemas/crm/forecast'
import {
  CRM_ERRORS,
  CRM_PRIVILEGED_ERRORS,
  crmAccess,
  describe,
  notFoundError,
} from './shared'

const TAG = ['CRM · Forecast e cotas'] as const
const QUOTA_PARAM = { quotaId: 'ID da meta.' }
const QUOTA_NOT_FOUND = notFoundError(
  'CrmQuota',
  'Meta inexistente ou de outro workspace',
)

/** CRM · Forecast e cotas — `forecast`, `quotas/**`. */
export const crmForecastRoutes: RouteConfig[] = [
  {
    method: 'get',
    path: '/workspaces/{id}/crm/forecast',
    tags: [...TAG],
    summary: 'Previsão de receita',
    description: describe(
      [
        'Uma linha por responsável × período (`periodKey` `AAAA-MM` ou `AAAA-Qn`, em UTC), a partir das oportunidades abertas e ganhas (pela `closeDate`) e das metas do período:',
        '',
        '- `wonAmount`: soma das oportunidades em etapas `WON`;',
        '- `weightedOpenAmount`: Σ(`amount` × `probability`/100) das abertas;',
        '- `forecastAmount` = ganho + pipeline ponderado;',
        '- `attainmentPct` = forecast / meta em %, `null` sem meta.',
      ].join('\n'),
      crmAccess('opportunities', 'VIEW'),
    ),
    query: GetCrmForecastSchema,
    responses: {
      200: { description: 'Forecast.', schema: CrmForecastDTO },
    },
    errors: CRM_ERRORS,
  },
  {
    method: 'get',
    path: '/workspaces/{id}/crm/quotas',
    tags: [...TAG],
    summary: 'Listar metas',
    description: describe(
      'Metas de venda por vendedor e período, com filtros opcionais.',
      crmAccess('privileged'),
    ),
    query: ListCrmQuotasSchema,
    responses: {
      200: { description: 'Metas.', schema: z.array(CrmQuotaDTO) },
    },
    errors: CRM_PRIVILEGED_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/quotas',
    tags: [...TAG],
    summary: 'Criar meta',
    description: describe(
      'Uma meta por responsável × período × `periodKey` (`AAAA-MM` para `MONTH`, `AAAA-Qn` para `QUARTER` — o mesmo formato do forecast, senão a meta não casa com as linhas).',
      crmAccess('privileged'),
    ),
    consent: true,
    body: CreateCrmQuotaSchema,
    responses: { 201: { description: 'Meta criada.', schema: CrmQuotaDTO } },
    errors: [
      ...CRM_PRIVILEGED_ERRORS,
      {
        code: 'CRM_QUOTA_CONFLICT',
        when: 'Já existe meta para o responsável no período',
      },
    ],
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/crm/quotas/{quotaId}',
    tags: [...TAG],
    summary: 'Atualizar meta',
    description: describe(
      'Só o valor-alvo (`targetAmount`) é editável; para mudar responsável ou período, exclua e crie outra.',
      crmAccess('privileged'),
    ),
    consent: true,
    params: QUOTA_PARAM,
    body: UpdateCrmQuotaSchema,
    responses: {
      200: { description: 'Meta atualizada.', schema: CrmQuotaDTO },
    },
    errors: [...CRM_PRIVILEGED_ERRORS, QUOTA_NOT_FOUND],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/crm/quotas/{quotaId}',
    tags: [...TAG],
    summary: 'Excluir meta',
    description: crmAccess('privileged'),
    consent: true,
    params: QUOTA_PARAM,
    responses: { 200: { description: 'Meta excluída.', schema: null } },
    errors: [...CRM_PRIVILEGED_ERRORS, QUOTA_NOT_FOUND],
  },
]
