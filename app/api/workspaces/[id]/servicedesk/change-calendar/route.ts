import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { SdChangeCalendarQuerySchema } from '@/src/schemas/sd-change-window.schema'
import { SdChangeWindowService } from '@/src/services/sd-change-window.service'

/**
 * Calendário de mudanças do intervalo (`?from=&to=&kind=`): ocorrências das
 * janelas + mudanças agendadas com conflitos e congelamentos já resolvidos.
 */
export const GET = sdConfigRoute({
  query: SdChangeCalendarQuerySchema,
  handler: ({ userId, params, query }) =>
    SdChangeWindowService.calendar(userId, params.id, query),
})
