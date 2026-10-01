/**
 * Alvos do motor de notificações do ServiceDesk — parte pura (sem I/O), para
 * que quem dispara um evento monte o recorte do chamado sem puxar o service
 * (e os testes não precisem dublar isso).
 */

/**
 * Contato do chamado. Os canais (e-mail/WhatsApp) não vêm aqui: quando o
 * contato não é usuário da plataforma, o motor os lê do cadastro na hora da
 * entrega.
 */
export interface SdNotifyContact {
  id: string
  name: string
  /** Usuário da plataforma vinculado ao contato, se houver. */
  userId: string | null
}

/** O mínimo que o motor precisa saber do chamado. */
export interface SdNotifyTicket {
  id: string
  number: number
  /** `INC-000123`. */
  code: string
  title: string
  assigneeId: string | null
  requesterId: string | null
  departmentId: string | null
  participantIds: string[]
  contact: SdNotifyContact | null
}

/** Caminho interno da tela do chamado. */
export function sdTicketNotificationHref(slug: string, number: number): string {
  return `/${slug}/servicedesk/tickets/${number}`
}

/**
 * Hora local (0–23) de `at` no fuso `timeZone` — usada pelo resumo diário,
 * que roda de hora em hora e só dispara na hora combinada do workspace.
 * Fuso inválido cai no horário UTC.
 */
export function sdLocalHour(at: Date, timeZone: string): number {
  try {
    return Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        hour: '2-digit',
      }).format(at),
    )
  } catch {
    return at.getUTCHours()
  }
}

/**
 * Chamado (p. ex. `SdTicketWithRelations`, ou o recorte da aprovação
 * pública) → o que o motor usa.
 */
export function sdNotifyTicketOf(
  ticket: {
    id: string
    number: number
    title: string
    assigneeId: string | null
    requesterId: string | null
    departmentId: string | null
    participants: { userId: string }[]
    contact: { id: string; name: string; userId: string | null } | null
  },
  code: string,
): SdNotifyTicket {
  return {
    id: ticket.id,
    number: ticket.number,
    code,
    title: ticket.title,
    assigneeId: ticket.assigneeId,
    requesterId: ticket.requesterId,
    departmentId: ticket.departmentId,
    participantIds: ticket.participants.map((p) => p.userId),
    contact: ticket.contact
      ? {
          id: ticket.contact.id,
          name: ticket.contact.name,
          userId: ticket.contact.userId,
        }
      : null,
  }
}
