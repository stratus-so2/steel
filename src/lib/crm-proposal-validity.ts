import type { CrmProposalStatus } from '@prisma/client'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Brasília (America/Sao_Paulo) é UTC-3 fixo desde o fim do horário de verão
 * (2019). Validade é regra comercial "por dia", então basta o offset fixo.
 */
const SAO_PAULO_OFFSET_MS = -3 * 60 * 60 * 1000

/** Status em que a validade corre (enviada ao cliente e ainda sem resposta). */
export const CRM_PROPOSAL_EXPIRABLE_STATUSES = [
  'SENT',
  'VIEWED',
] as const satisfies readonly CrmProposalStatus[]

/**
 * Último instante em que a proposta ainda vale: a validade cobre o dia
 * inteiro de `validUntil` no fuso de São Paulo (vale até 23:59:59.999).
 */
export function proposalValidityEnd(validUntil: Date): Date {
  const local = new Date(validUntil.getTime() + SAO_PAULO_OFFSET_MS)
  const nextLocalMidnight = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() + 1,
  )
  return new Date(nextLocalMidnight - 1 - SAO_PAULO_OFFSET_MS)
}

/**
 * Validade padrão de uma proposta nova: fim do dia `from + days` (São Paulo).
 */
export function defaultProposalValidUntil(from: Date, days: number): Date {
  return proposalValidityEnd(new Date(from.getTime() + days * DAY_MS))
}

const validityDateFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
})

/** Data de validade para mensagens ao usuário (dd/mm/aaaa, São Paulo). */
export function formatProposalValidity(validUntil: Date): string {
  return validityDateFormat.format(validUntil)
}

/** A data de validade (se houver) já passou? Independe do status. */
export function isProposalValidityPast(
  validUntil: Date | null,
  now: Date = new Date(),
): boolean {
  if (!validUntil) return false
  return now.getTime() > proposalValidityEnd(validUntil).getTime()
}

/**
 * A proposta está vencida? `EXPIRED` sempre; `SENT`/`VIEWED` com a data de
 * validade já passada também (o job diário ainda não rodou). `validUntil`
 * nulo = sem validade (inclui as propostas legadas). Rascunhos e propostas
 * já respondidas (aceita/recusada) nunca são "vencidas".
 */
export function isCrmProposalExpired(
  proposal: { status: CrmProposalStatus; validUntil: Date | null },
  now: Date = new Date(),
): boolean {
  if (proposal.status === 'EXPIRED') return true
  if (
    !(CRM_PROPOSAL_EXPIRABLE_STATUSES as readonly string[]).includes(
      proposal.status,
    )
  ) {
    return false
  }
  return isProposalValidityPast(proposal.validUntil, now)
}
