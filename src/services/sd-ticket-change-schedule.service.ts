import type { Result } from '@/src/lib/result'
import type { SdTicketChangeScheduleDTO } from '@/types/sd-change'
import { loadSdTicketChangeSchedule } from './sd-change-schedule'
import { loadSdTicketTab } from './sd-ticket-tab-support'

/**
 * Bloco "agenda da mudança" da tela do chamado: a janela planejada, as
 * janelas de manutenção/congelamento que a cobrem e os conflitos detectados.
 *
 * Fica num arquivo só seu (e não em `sd-change-schedule.ts`) porque esse é
 * importado pelo `SdTicketEngine`: juntar os dois fecharia um ciclo de
 * importação entre o motor e a aba.
 */
export const SdTicketChangeScheduleService = {
  async get(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
  ): Promise<Result<SdTicketChangeScheduleDTO>> {
    const scope = await loadSdTicketTab(
      actorId,
      workspaceId,
      ticketRef,
      'VIEW',
      { agentOnly: true },
    )
    if (!scope.ok) return scope
    const { ticket } = scope.value
    return loadSdTicketChangeSchedule({
      workspaceId,
      ticketId: ticket.id,
      type: ticket.type,
      configItemId: ticket.configItemId,
      departmentId: ticket.departmentId,
      plannedStartAt: ticket.plannedStartAt,
      plannedEndAt: ticket.plannedEndAt,
    })
  },
}
