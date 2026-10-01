import type { Prisma, SdTicketType } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { Result } from '@/src/lib/result'
import { sdDb } from './sd-config-db'

const ALERT_INCLUDE = {
  source: { select: { id: true, name: true } },
  configItem: { select: { id: true, name: true } },
  ticket: {
    select: {
      id: true,
      number: true,
      type: true,
      title: true,
      phase: { select: { name: true } },
    },
  },
} satisfies Prisma.SdMonitorAlertInclude

export type SdMonitorAlertWithRelations = Prisma.SdMonitorAlertGetPayload<{
  include: typeof ALERT_INCLUDE
}>

export interface SdMonitorAlertCreateData {
  workspaceId: string
  sourceId: string
  externalId: string
  subject: string
  body?: string | null
  severity?: string | null
  host?: string | null
  configItemId?: string | null
  ticketId?: string | null
  payload?: Prisma.InputJsonValue
  startedAt?: Date
}

export interface SdMonitorAlertUpdateData {
  status?: 'OPEN' | 'RESOLVED' | 'IGNORED'
  subject?: string
  body?: string | null
  severity?: string | null
  host?: string | null
  configItemId?: string | null
  ticketId?: string | null
  payload?: Prisma.InputJsonValue
  startedAt?: Date
  resolvedAt?: Date | null
}

export interface ListSdMonitorAlertsOptions {
  sourceId?: string
  ticketId?: string
  status?: 'OPEN' | 'RESOLVED' | 'IGNORED'
  limit?: number
}

/**
 * Alertas recebidos. `(sourceId, externalId)` é único: o mesmo problema
 * reenviado cai sempre na mesma linha — é isso que impede um segundo
 * chamado e liga a normalização ao chamado certo.
 */
export const SdMonitorAlertRepository = {
  async list(
    workspaceId: string,
    options: ListSdMonitorAlertsOptions = {},
  ): Promise<Result<SdMonitorAlertWithRelations[]>> {
    return sdDb('Failed to list ServiceDesk monitor alerts', () =>
      prisma.sdMonitorAlert.findMany({
        where: {
          workspaceId,
          ...(options.sourceId ? { sourceId: options.sourceId } : {}),
          ...(options.ticketId ? { ticketId: options.ticketId } : {}),
          ...(options.status ? { status: options.status } : {}),
        },
        include: ALERT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: options.limit ?? 20,
      }),
    )
  },

  /** Alerta já conhecido desta origem (chave de deduplicação). */
  async findByExternalId(
    sourceId: string,
    externalId: string,
  ): Promise<Result<SdMonitorAlertWithRelations | null>> {
    return sdDb('Failed to find ServiceDesk monitor alert', () =>
      prisma.sdMonitorAlert.findUnique({
        where: { sourceId_externalId: { sourceId, externalId } },
        include: ALERT_INCLUDE,
      }),
    )
  },

  async create(
    data: SdMonitorAlertCreateData,
  ): Promise<Result<SdMonitorAlertWithRelations>> {
    return sdDb('Failed to create ServiceDesk monitor alert', () =>
      prisma.sdMonitorAlert.create({ data, include: ALERT_INCLUDE }),
    )
  },

  async update(
    id: string,
    data: SdMonitorAlertUpdateData,
  ): Promise<Result<SdMonitorAlertWithRelations>> {
    return sdDb('Failed to update ServiceDesk monitor alert', () =>
      prisma.sdMonitorAlert.update({
        where: { id },
        data,
        include: ALERT_INCLUDE,
      }),
    )
  },

  /**
   * Primeira fase ativa do tipo nesta categoria (a `RESOLVED` do
   * encerramento automático, a inicial de uma reabertura por flapping).
   */
  async findPhaseIdByCategory(
    workspaceId: string,
    ticketType: SdTicketType,
    category: 'NEW' | 'IN_PROGRESS' | 'RESOLVED',
  ): Promise<Result<string | null>> {
    return sdDb('Failed to find ServiceDesk phase for monitoring', async () => {
      const row = await prisma.sdPhase.findFirst({
        where: { workspaceId, ticketType, category, active: true },
        select: { id: true },
        orderBy: [{ isInitial: 'desc' }, { position: 'asc' }],
      })
      return row?.id ?? null
    })
  },

  /**
   * Item de configuração do workspace cujo nome, código ou IP bate com o
   * host do alerta (sem diferenciar maiúsculas; ignora os excluídos).
   */
  async findConfigItemByHost(
    workspaceId: string,
    host: string,
  ): Promise<Result<{ id: string; name: string } | null>> {
    const match = { equals: host, mode: 'insensitive' as const }
    return sdDb('Failed to match ServiceDesk config item', () =>
      prisma.sdConfigItem.findFirst({
        where: {
          workspaceId,
          deletedAt: null,
          OR: [{ name: match }, { code: match }, { ipAddress: match }],
        },
        select: { id: true, name: true },
        orderBy: { createdAt: 'asc' },
      }),
    )
  },
}
