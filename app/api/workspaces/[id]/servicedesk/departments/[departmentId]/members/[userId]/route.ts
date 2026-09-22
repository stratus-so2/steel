import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateSdDepartmentMemberSchema } from '@/src/schemas/sd-department.schema'
import { SdDepartmentService } from '@/src/services/sd-department.service'

export const PATCH = sdConfigRoute({
  consent:
    'PATCH /api/workspaces/[id]/servicedesk/departments/[departmentId]/members/[userId]',
  body: UpdateSdDepartmentMemberSchema,
  handler: ({ userId, params, body }) =>
    SdDepartmentService.updateMember(
      userId,
      params.id,
      params.departmentId,
      params.userId,
      body.isLead,
    ),
})

export const DELETE = sdConfigRoute({
  consent:
    'DELETE /api/workspaces/[id]/servicedesk/departments/[departmentId]/members/[userId]',
  handler: ({ userId, params }) =>
    SdDepartmentService.removeMember(
      userId,
      params.id,
      params.departmentId,
      params.userId,
    ),
})
