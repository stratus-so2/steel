import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { ReorderSdConfigSchema } from '@/src/schemas/sd-config.schema'
import { SdCategoryService } from '@/src/services/sd-category.service'

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/categories/reorder',
  body: ReorderSdConfigSchema,
  handler: ({ userId, params, body }) =>
    SdCategoryService.reorder(userId, params.id, body.orderedIds),
})
