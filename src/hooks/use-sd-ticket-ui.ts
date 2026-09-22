import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { SdOptionDTO } from '@/types/sd-directory'
import type {
  SdTicketDTO,
  SdTicketPageDTO,
  SdUserSummaryDTO,
} from '@/types/sd-ticket'
import { apiFetch } from './_fetch'
import { sdTicketKeys, sdTicketQueryString } from './use-sd-tickets'

/**
 * Auxiliares da UI de chamados (fatia ticket-ui) sobre as rotas do motor de
 * chamados: seletor de chamado (item pai / vincular filho), participantes
 * adicionados logo após abrir o chamado e o pai de outro chamado.
 */

const base = (ws: string) => `/api/workspaces/${ws}/servicedesk/tickets`

const JSON_HEADERS = { 'Content-Type': 'application/json' }

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
        headers: JSON_HEADERS,
        body: JSON.stringify({ userId }),
      },
      'Erro ao adicionar participante',
    )
  }
  return participants
}

/**
 * Define o pai de **outro** chamado (aba "Itens filhos": vincular um
 * existente como filho ou desvincular). `useSetSdTicketParent` fixa o
 * chamado na criação do hook; aqui o filho vem em cada chamada.
 */
export function useSetSdTicketParentOf(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      ticketId,
      parentId,
    }: {
      ticketId: string
      parentId: string | null
    }) =>
      apiFetch<SdTicketDTO>(
        `${base(workspaceId)}/${encodeURIComponent(ticketId)}/parent`,
        {
          method: 'PATCH',
          headers: JSON_HEADERS,
          body: JSON.stringify({ parentId }),
        },
        'Erro ao definir o item pai',
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: sdTicketKeys.all(workspaceId) }),
  })
}
