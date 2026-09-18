import { z } from 'zod'
import {
  CreateCrmProductSchema,
  ReorderCrmProductsSchema,
  UpdateCrmProductSchema,
} from '@/src/schemas/crm-product.schema'
import type { RouteConfig } from '../../registry'
import { CrmProductDTO } from '../../schemas/crm/products'
import { CRM_ERRORS, crmAccess, describe, notFoundError } from './shared'

const TAG = ['CRM · Produtos'] as const
const PRODUCT_PARAM = { productId: 'ID do produto.' }
const PRODUCT_NOT_FOUND = notFoundError(
  'CrmProduct',
  'Produto inexistente, excluído ou de outro workspace',
)
const SKU_CONFLICT = {
  code: 'CRM_PRODUCT_CONFLICT',
  when: 'Já existe um produto com o mesmo SKU no workspace',
} as const

const REORDER_TEXT =
  '`orderedIds` define a nova ordem: cada produto recebe `position` igual ao seu índice. IDs de outro workspace fazem a transação falhar (`500 DATABASE_ERROR`).'

/** CRM · Produtos — `products/**`. */
export const crmProductsRoutes: RouteConfig[] = [
  {
    method: 'get',
    path: '/workspaces/{id}/crm/products',
    tags: [...TAG],
    summary: 'Listar produtos',
    description: describe(
      'Catálogo de produtos do workspace, na ordem definida pelo usuário (`position`). Excluídos não aparecem.',
      crmAccess('products', 'VIEW'),
    ),
    query: {
      type: 'object',
      properties: {
        active: {
          type: 'string',
          enum: ['true', 'false'],
          description:
            '`true` lista só os ativos, `false` só os inativos; omitido lista todos.',
        },
      },
    },
    responses: {
      200: { description: 'Produtos.', schema: z.array(CrmProductDTO) },
    },
    errors: CRM_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/products',
    tags: [...TAG],
    summary: 'Criar produto',
    description: describe(
      'O produto entra no fim da lista. Padrões: `unitPrice` 0, `currency` `BRL`, `billingType` `ONE_TIME`, `active` true.',
      crmAccess('products', 'CREATE'),
    ),
    consent: true,
    body: CreateCrmProductSchema,
    responses: {
      201: { description: 'Produto criado.', schema: CrmProductDTO },
    },
    errors: [...CRM_ERRORS, SKU_CONFLICT],
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/crm/products/reorder',
    tags: [...TAG],
    summary: 'Reordenar produtos',
    description: describe(REORDER_TEXT, crmAccess('products', 'EDIT')),
    consent: true,
    body: ReorderCrmProductsSchema,
    responses: { 200: { description: 'Ordem salva.', schema: null } },
    errors: CRM_ERRORS,
  },
  {
    method: 'get',
    path: '/workspaces/{id}/crm/products/{productId}',
    tags: [...TAG],
    summary: 'Detalhe do produto',
    description: crmAccess('products', 'VIEW'),
    params: PRODUCT_PARAM,
    responses: { 200: { description: 'Produto.', schema: CrmProductDTO } },
    errors: [...CRM_ERRORS, PRODUCT_NOT_FOUND],
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/crm/products/{productId}',
    tags: [...TAG],
    summary: 'Atualizar produto',
    description: describe(
      'Atualização parcial. `sku` e `description` aceitam `null` (ou `""`) para limpar o valor. Itens de linha já criados em oportunidades não mudam (guardam um snapshot do produto).',
      crmAccess('products', 'EDIT'),
    ),
    consent: true,
    params: PRODUCT_PARAM,
    body: UpdateCrmProductSchema,
    responses: {
      200: { description: 'Produto atualizado.', schema: CrmProductDTO },
    },
    errors: [...CRM_ERRORS, PRODUCT_NOT_FOUND, SKU_CONFLICT],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/crm/products/{productId}',
    tags: [...TAG],
    summary: 'Excluir produto',
    description: describe(
      'Exclusão lógica (soft delete): o produto some do catálogo, mas os itens de linha que o referenciam continuam intactos.',
      crmAccess('products', 'DELETE'),
    ),
    consent: true,
    params: PRODUCT_PARAM,
    responses: { 200: { description: 'Produto excluído.', schema: null } },
    errors: [...CRM_ERRORS, PRODUCT_NOT_FOUND],
  },
]
