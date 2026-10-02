import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import {
  GenerateSdReportSchema,
  ListSdReportRunsSchema,
} from '@/src/schemas/sd-report.schema'
import { SdReportService } from '@/src/services/sd-report.service'

export const GET = sdConfigRoute({
  query: ListSdReportRunsSchema,
  handler: ({ userId, params, query }) =>
    SdReportService.runs(userId, params.id, query),
})

/** "Gerar agora": apura, grava os arquivos e envia na hora. */
export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/reports/runs',
  body: GenerateSdReportSchema,
  allowEmptyBody: true,
  status: 201,
  handler: ({ userId, params, body }) =>
    SdReportService.generateNow(userId, params.id, body),
})
