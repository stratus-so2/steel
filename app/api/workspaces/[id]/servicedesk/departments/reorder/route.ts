import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { ReorderSdConfigSchema } from '@/src/schemas/sd-config.schema'
import { SdDepartmentService } from '@/src/services/sd-department.service'

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/departments/reorder',
  body: ReorderSdConfigSchema,
  handler: ({ userId, params, body }) =>
    SdDepartmentService.reorder(userId, params.id, body.orderedIds),
})
