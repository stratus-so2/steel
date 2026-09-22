import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateSdCategorySchema } from '@/src/schemas/sd-category.schema'
import { SdCategoryService } from '@/src/services/sd-category.service'

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/categories/[categoryId]',
  body: UpdateSdCategorySchema,
  handler: ({ userId, params, body }) =>
    SdCategoryService.update(userId, params.id, params.categoryId, body),
})

export const DELETE = sdConfigRoute({
  consent: 'DELETE /api/workspaces/[id]/servicedesk/categories/[categoryId]',
  handler: ({ userId, params }) =>
    SdCategoryService.remove(userId, params.id, params.categoryId),
})
