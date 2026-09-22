import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import {
  CreateSdCategorySchema,
  ListSdCategoriesSchema,
} from '@/src/schemas/sd-category.schema'
import { SdCategoryService } from '@/src/services/sd-category.service'

export const GET = sdConfigRoute({
  query: ListSdCategoriesSchema,
  handler: ({ userId, params, query }) =>
    SdCategoryService.list(userId, params.id, query),
})

export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/categories',
  body: CreateSdCategorySchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    SdCategoryService.create(userId, params.id, body),
})
