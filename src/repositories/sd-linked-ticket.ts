import type { Prisma } from '@prisma/client'

/**
 * Seleção enxuta de `sd_tickets` para as abas "Chamados" dos cadastros
 * (cliente/empresa, contato e item de configuração). A fatia de cadastros
 * lê os chamados direto do banco para não depender do service de chamados.
 */
export const sdLinkedTicketSelect = {
  id: true,
  number: true,
  type: true,
  title: true,
  createdAt: true,
  phase: { select: { name: true, category: true } },
} satisfies Prisma.SdTicketSelect

export type SdLinkedTicketRow = Prisma.SdTicketGetPayload<{
  select: typeof sdLinkedTicketSelect
}>
