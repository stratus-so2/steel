import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { AddSdDepartmentMemberSchema } from '@/src/schemas/sd-department.schema'
import { SdDepartmentService } from '@/src/services/sd-department.service'

export const POST = sdConfigRoute({
  consent:
    'POST /api/workspaces/[id]/servicedesk/departments/[departmentId]/members',
  body: AddSdDepartmentMemberSchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    SdDepartmentService.addMember(userId, params.id, params.departmentId, body),
})
