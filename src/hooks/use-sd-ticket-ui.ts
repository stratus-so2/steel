import type { SdOptionDTO } from '@/types/sd-directory'
import type { SdTicketPageDTO, SdUserSummaryDTO } from '@/types/sd-ticket'
import { apiFetch } from './_fetch'
import { sdTicketQueryString } from './use-sd-tickets'

/**
 * Auxiliares da UI de chamados (fatia ticket-ui) sobre as rotas do motor de
 * chamados: seletor de chamado (item pai / vincular filho) e participantes
 * adicionados logo após abrir o chamado.
 */

const base = (ws: string) => `/api/workspaces/${ws}/servicedesk/tickets`

/** Opções do seletor de chamado: código + título, fase como sublabel. */
export async function fetchSdTicketOptions(
  workspaceId: string,
  q: string | undefined,
  options: { excludeIds?: string[] } = {},
): Promise<SdOptionDTO[]> {
  const page = await apiFetch<SdTicketPageDTO>(
    `${base(workspaceId)}${sdTicketQueryString({
      q,
      includeClosed: true,
      pageSize: 20,
      sort: 'lastActivityAt',
      order: 'desc',
    })}`,
    undefined,
    'Erro ao buscar chamados',
  )
  const exclude = new Set(options.excludeIds ?? [])
  return page.items
    .filter((t) => !exclude.has(t.id))
    .map((t) => ({
      id: t.id,
      label: `${t.code} · ${t.title}`,
      sublabel: t.phase.name,
    }))
}

/** Adiciona participantes em sequência (a API recebe um por vez). */
export async function addSdTicketParticipants(
  workspaceId: string,
  ticketId: string,
  userIds: string[],
): Promise<SdUserSummaryDTO[]> {
  let participants: SdUserSummaryDTO[] = []
  for (const userId of userIds) {
    participants = await apiFetch<SdUserSummaryDTO[]>(
      `${base(workspaceId)}/${encodeURIComponent(ticketId)}/participants`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      },
      'Erro ao adicionar participante',
    )
  }
  return participants
}
