import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import {
  CreateSdScheduledReportSchema,
  ListSdScheduledReportsSchema,
} from '@/src/schemas/sd-report.schema'
import { SdReportService } from '@/src/services/sd-report.service'

export const GET = sdConfigRoute({
  query: ListSdScheduledReportsSchema,
  handler: ({ userId, params, query }) =>
    SdReportService.list(userId, params.id, query),
})

export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/reports',
  body: CreateSdScheduledReportSchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    SdReportService.create(userId, params.id, body),
})
