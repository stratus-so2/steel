import z from 'zod'
import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import {
  CreateSdChangeWindowSchema,
  SD_CHANGE_WINDOW_KINDS,
} from '@/src/schemas/sd-change-window.schema'
import { SdChangeWindowService } from '@/src/services/sd-change-window.service'

const ListQuery = z.object({
  kind: z.enum(SD_CHANGE_WINDOW_KINDS).optional(),
})

/** Janelas de manutenção e congelamento. Leitura: agentes; escrita: admins. */
export const GET = sdConfigRoute({
  query: ListQuery,
  handler: ({ userId, params, query }) =>
    SdChangeWindowService.list(userId, params.id, query),
})

export const POST = sdConfigRoute({
  consent: 'POST /api/workspaces/[id]/servicedesk/change-windows',
  body: CreateSdChangeWindowSchema,
  status: 201,
  handler: ({ userId, params, body }) =>
    SdChangeWindowService.create(userId, params.id, body),
})
