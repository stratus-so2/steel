import z from 'zod'
import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { CreateSdCabBoardSchema } from '@/src/schemas/sd-cab-board.schema'
import { booleanQuery } from '@/src/schemas/sd-config.schema'
import { SdCabBoardService } from '@/src/services/sd-cab-board.service'

const ListQuery = z.object({ includeInactive: booleanQuery })

/** Comitês de mudança (CAB). Leitura: agentes; escrita: admins. */
export const GET = sdConfigRoute({
  query: ListQuery,
  handler: ({ userId, params, query }) =>
    SdCabBoardService.list(userId, params.id, query),
})

export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/cab-boards',
  body: CreateSdCabBoardSchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    SdCabBoardService.create(userId, params.id, body),
})
