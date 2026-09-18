import { z } from 'zod'
import { CreateCrmIntegrationKeySchema } from '@/src/schemas/crm-integration-key.schema'
import type { RouteConfig } from '../../registry'
import {
  CrmIntegrationKeyCreatedDTO,
  CrmIntegrationKeyDTO,
} from '../../schemas/crm/integrations'
import {
  CRM_PRIVILEGED_ERRORS,
  crmAccess,
  describe,
  notFoundError,
} from './shared'

/** CRM · Integrações — `integration-keys` (gestão das chaves da API de leads). */
export const crmIntegrationsRoutes: RouteConfig[] = [
  {
    method: 'get',
    path: '/workspaces/{id}/crm/integration-keys',
    tags: ['CRM · Integrações'],
    summary: 'Listar chaves de API',
    description: describe(
      'Chaves de integração do workspace, ativas e revogadas. O valor completo nunca é devolvido aqui — só o `prefix`.',
      crmAccess('privileged'),
    ),
    responses: {
      200: {
        description: 'Chaves de API.',
        schema: z.array(CrmIntegrationKeyDTO),
      },
    },
    errors: CRM_PRIVILEGED_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/integration-keys',
    tags: ['CRM · Integrações'],
    summary: 'Criar chave de API',
    description: describe(
      'Gera uma chave `crm_live_...` para a API pública de entrada de leads (`POST /crm/integrations/leads`). O valor em texto puro (`plaintextKey`) só aparece nesta resposta; o servidor guarda apenas o hash.',
      crmAccess('privileged'),
    ),
    consent: true,
    body: {
      schema: CreateCrmIntegrationKeySchema,
      example: { name: 'Site institucional' },
    },
    responses: {
      201: {
        description: 'Chave criada.',
        schema: CrmIntegrationKeyCreatedDTO,
      },
    },
    errors: CRM_PRIVILEGED_ERRORS,
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/crm/integration-keys/{keyId}',
    tags: ['CRM · Integrações'],
    summary: 'Revogar chave de API',
    description: describe(
      'Marca a chave como revogada (`revokedAt`); chamadas com ela passam a responder `401 CRM_INTEGRATION_KEY_INVALID`. O registro continua na listagem.',
      crmAccess('privileged'),
    ),
    params: { keyId: 'ID da chave de integração.' },
    consent: true,
    responses: { 200: { description: 'Chave revogada.', schema: null } },
    errors: [
      ...CRM_PRIVILEGED_ERRORS,
      notFoundError('CrmIntegrationApiKey', 'Chave inexistente no workspace'),
    ],
  },
]
