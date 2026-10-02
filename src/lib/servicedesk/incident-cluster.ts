/**
 * Agrupamento de incidentes repetidos — **lib pura** (ADR 0016).
 *
 * A assinatura de um incidente é `categoria:subcategoria:serviço:termos`,
 * onde os termos são as palavras significativas do título, normalizadas
 * (sem acento, sem pontuação, sem palavra de ligação) e **ordenadas**, para
 * que "Servidor de e-mail fora do ar" e "E-mail fora do ar no servidor"
 * caiam no mesmo grupo.
 *
 * Nada de LLM e nada de banco: a detecção é determinística e auditável —
 * dá para explicar por que dois chamados foram agrupados lendo a
 * assinatura. Quem carrega e grava é o `SdRiskService`; abrir o problema é
 * sempre ação de um agente.
 */

/** Mínimo de incidentes para o grupo virar sugestão de problema. */
export const SD_CLUSTER_MIN_TICKETS = 3

/** Janela de observação (dias) do agrupamento. */
export const SD_CLUSTER_WINDOW_DAYS = 7

/** Quantos termos do título entram na assinatura. */
export const SD_CLUSTER_MAX_TERMS = 4

/** Tamanho mínimo de um termo significativo. */
const MIN_TERM_LENGTH = 3

/**
 * Palavras de ligação do português (e os verbos genéricos de chamado) que
 * não distinguem um incidente de outro.
 */
const SD_STOPWORDS = new Set([
  'ao',
  'aos',
  'com',
  'como',
  'da',
  'das',
  'de',
  'dela',
  'dele',
  'do',
  'dos',
  'em',
  'mais',
  'mas',
  'meu',
  'minha',
  'muito',
  'nao',
  'no',
  'nos',
  'num',
  'numa',
  'ou',
  'para',
  'pela',
  'pelo',
  'por',
  'que',
  'sem',
  'ser',
  'seu',
  'sua',
  'tem',
  'ter',
  'todo',
  'toda',
  'uma',
  'urgente',
  'favor',
  'chamado',
  'problema',
  'erro',
  'ajuda',
  'preciso',
  'esta',
  'estao',
  'esto',
  'sendo',
  'muita',
])

/** Minúsculas, sem acento e sem pontuação (mesma régua da busca da KB). */
export function sdNormalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Termos significativos do título, sem repetição e em ordem alfabética
 * (limitados a `SD_CLUSTER_MAX_TERMS`). Número puro é descartado: o que
 * varia de chamado para chamado (ramal, IP, protocolo) não agrupa nada.
 */
export function sdIncidentTerms(title: string): string[] {
  const terms = new Set<string>()
  for (const word of sdNormalizeText(title).split(' ')) {
    if (word.length < MIN_TERM_LENGTH) continue
    if (SD_STOPWORDS.has(word)) continue
    if (/^\d+$/.test(word)) continue
    terms.add(word)
  }
  return [...terms].sort().slice(0, SD_CLUSTER_MAX_TERMS)
}

export interface SdClusterTicketInput {
  id: string
  title: string
  categoryId: string | null
  subcategoryId: string | null
  serviceId: string | null
  createdAt: Date
}

/**
 * Assinatura do incidente, ou `null` quando o título não tem nenhum termo
 * significativo — agrupar "urgente!!!" com "preciso de ajuda" juntaria
 * chamados que não têm nada a ver.
 */
export function sdIncidentSignature(
  ticket: Pick<
    SdClusterTicketInput,
    'title' | 'categoryId' | 'subcategoryId' | 'serviceId'
  >,
): string | null {
  const terms = sdIncidentTerms(ticket.title)
  if (terms.length === 0) return null
  const catalog = [
    ticket.categoryId ?? '-',
    ticket.subcategoryId ?? '-',
    ticket.serviceId ?? '-',
  ].join(':')
  return `${catalog}:${terms.join('-')}`
}

export interface SdIncidentGroup {
  signature: string
  /** Título do incidente mais recente do grupo. */
  title: string
  /** Ids dos incidentes, do mais antigo para o mais recente. */
  ticketIds: string[]
  /** Os incidentes do grupo, na mesma ordem de `ticketIds`. */
  tickets: SdClusterTicketInput[]
  firstSeenAt: Date
  lastSeenAt: Date
}

/** Quantos incidentes do grupo entraram depois de `at`. */
export function sdIncidentsSince(
  group: Pick<SdIncidentGroup, 'tickets'>,
  at: Date,
): number {
  return group.tickets.filter((t) => t.createdAt.getTime() > at.getTime())
    .length
}

/**
 * Agrupa os incidentes da janela por assinatura e devolve só os grupos que
 * passaram do corte (`minTickets`), do mais recente para o mais antigo.
 */
export function sdGroupIncidents(
  tickets: SdClusterTicketInput[],
  minTickets: number = SD_CLUSTER_MIN_TICKETS,
): SdIncidentGroup[] {
  const groups = new Map<string, SdClusterTicketInput[]>()
  for (const ticket of tickets) {
    const signature = sdIncidentSignature(ticket)
    if (!signature) continue
    const bucket = groups.get(signature)
    if (bucket) bucket.push(ticket)
    else groups.set(signature, [ticket])
  }

  const out: SdIncidentGroup[] = []
  for (const [signature, bucket] of groups) {
    if (bucket.length < minTickets) continue
    const ordered = [...bucket].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    )
    const newest = ordered[ordered.length - 1]
    out.push({
      signature,
      title: newest.title,
      ticketIds: ordered.map((t) => t.id),
      tickets: ordered,
      firstSeenAt: ordered[0].createdAt,
      lastSeenAt: newest.createdAt,
    })
  }
  return out.sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
}

/**
 * Descrição do problema sugerido, já com a lista dos incidentes — o agente
 * abre o chamado com o porquê escrito, não com uma tela em branco.
 */
export function sdClusterProblemDescription(
  group: Pick<SdIncidentGroup, 'ticketIds' | 'firstSeenAt' | 'lastSeenAt'>,
  codes: string[],
): string {
  const list = codes.length > 0 ? codes.join(', ') : group.ticketIds.join(', ')
  return [
    `<p>Problema aberto a partir de ${group.ticketIds.length} incidentes parecidos detectados pela análise preditiva.</p>`,
    `<p><strong>Incidentes:</strong> ${list}</p>`,
  ].join('')
}
