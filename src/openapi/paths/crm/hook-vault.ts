import { z } from 'zod'
import {
  CreateCrmHookVaultItemSchema,
  ReorderCrmHookVaultItemsSchema,
  UpdateCrmHookVaultItemSchema,
} from '@/src/schemas/crm-hook-vault.schema'
import type { RouteConfig } from '../../registry'
import { CrmHookVaultItemDTO } from '../../schemas/crm/hook-vault'
import { CRM_ERRORS, crmAccess, describe, notFoundError } from './shared'

/** CRM · IA — Hook Vault (ganchos de conteúdo para posts). */

const HOOK_PARAM = { description: 'ID do item do Hook Vault.' }

const HOOK_NOT_FOUND = notFoundError('CrmHookVaultItem', 'Item inexistente')

export const crmHookVaultRoutes: RouteConfig[] = [
  /* ------------------------------ Hook Vault ------------------------------ */
  {
    method: 'get',
    path: '/workspaces/{id}/crm/hook-vault',
    tags: ['CRM · IA'],
    summary: 'Listar itens do Hook Vault',
    description: describe(
      'Ganchos de conteúdo salvos pelo workspace, na ordem manual (`position`).',
      crmAccess('social', 'VIEW'),
    ),
    responses: {
      200: { description: 'Itens.', schema: z.array(CrmHookVaultItemDTO) },
    },
    errors: CRM_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/hook-vault',
    tags: ['CRM · IA'],
    summary: 'Criar item do Hook Vault',
    description: crmAccess('social', 'CREATE'),
    consent: true,
    body: CreateCrmHookVaultItemSchema,
    responses: {
      201: { description: 'Item criado.', schema: CrmHookVaultItemDTO },
    },
    errors: CRM_ERRORS,
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/crm/hook-vault/reorder',
    tags: ['CRM · IA'],
    summary: 'Reordenar itens do Hook Vault',
    description: describe(
      '`orderedIds` define a nova ordem (`position` = índice na lista).',
      crmAccess('social', 'EDIT'),
    ),
    consent: true,
    body: ReorderCrmHookVaultItemsSchema,
    responses: { 200: { description: 'Ordem salva.', schema: null } },
    errors: CRM_ERRORS,
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/crm/hook-vault/{itemId}',
    tags: ['CRM · IA'],
    summary: 'Atualizar item do Hook Vault',
    description: describe(
      'Atualização parcial — informe ao menos um campo.',
      crmAccess('social', 'EDIT'),
    ),
    consent: true,
    params: { itemId: HOOK_PARAM },
    body: UpdateCrmHookVaultItemSchema,
    responses: {
      200: { description: 'Item atualizado.', schema: CrmHookVaultItemDTO },
    },
    errors: [...CRM_ERRORS, HOOK_NOT_FOUND],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/crm/hook-vault/{itemId}',
    tags: ['CRM · IA'],
    summary: 'Excluir item do Hook Vault',
    description: describe(
      'Exclusão lógica (soft delete).',
      crmAccess('social', 'DELETE'),
    ),
    consent: true,
    params: { itemId: HOOK_PARAM },
    responses: { 200: { description: 'Item excluído.', schema: null } },
    errors: [...CRM_ERRORS, HOOK_NOT_FOUND],
  },
]
