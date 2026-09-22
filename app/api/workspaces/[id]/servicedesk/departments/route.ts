import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import {
  CreateSdDepartmentSchema,
  ListSdDepartmentsSchema,
} from '@/src/schemas/sd-department.schema'
import { SdDepartmentService } from '@/src/services/sd-department.service'

export const GET = sdConfigRoute({
  query: ListSdDepartmentsSchema,
  handler: ({ userId, params, query }) =>
    SdDepartmentService.list(userId, params.id, query),
})

export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/departments',
  body: CreateSdDepartmentSchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    SdDepartmentService.create(userId, params.id, body),
})
