import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateSdDepartmentSchema } from '@/src/schemas/sd-department.schema'
import { SdDepartmentService } from '@/src/services/sd-department.service'

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/departments/[departmentId]',
  body: UpdateSdDepartmentSchema,
  handler: ({ userId, params, body }) =>
    SdDepartmentService.update(userId, params.id, params.departmentId, body),
})

export const DELETE = sdConfigRoute({
  consent: 'DELETE /api/workspaces/[id]/servicedesk/departments/[departmentId]',
  handler: ({ userId, params }) =>
    SdDepartmentService.remove(userId, params.id, params.departmentId),
})
