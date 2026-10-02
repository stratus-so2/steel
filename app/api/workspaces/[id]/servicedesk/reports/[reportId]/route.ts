import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateSdScheduledReportSchema } from '@/src/schemas/sd-report.schema'
import { SdReportService } from '@/src/services/sd-report.service'

export const GET = sdConfigRoute({
  handler: ({ userId, params }) =>
    SdReportService.get(userId, params.id, params.reportId),
})

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/reports/[reportId]',
  body: UpdateSdScheduledReportSchema,
  handler: ({ userId, params, body }) =>
    SdReportService.update(userId, params.id, params.reportId, body),
})

export const DELETE = sdConfigRoute({
  consent: 'DELETE /api/workspaces/[id]/servicedesk/reports/[reportId]',
  handler: ({ userId, params }) =>
    SdReportService.remove(userId, params.id, params.reportId),
})
