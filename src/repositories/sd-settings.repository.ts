import type { Prisma, SdSettings } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { Result } from '@/src/lib/result'
import { SD_DEFAULT_TICKET_PREFIXES } from '@/src/schemas/sd-settings.schema'
import { sdDb } from './sd-config-db'

export type SdSettingsUpdateData = Omit<
  Prisma.SdSettingsUncheckedUpdateInput,
  'id' | 'workspaceId' | 'nextTicketNumber' | 'createdAt' | 'updatedAt'
>

export const SdSettingsRepository = {
  /** Lê a configuração; cria a linha com os padrões na primeira leitura. */
  async getOrCreate(workspaceId: string): Promise<Result<SdSettings>> {
    return sdDb('Failed to load ServiceDesk settings', () =>
      prisma.sdSettings.upsert({
        where: { workspaceId },
        create: { workspaceId, ticketPrefixes: SD_DEFAULT_TICKET_PREFIXES },
        update: {},
      }),
    )
  },

  async update(
    workspaceId: string,
    data: SdSettingsUpdateData,
  ): Promise<Result<SdSettings>> {
    return sdDb('Failed to update ServiceDesk settings', () =>
      prisma.sdSettings.upsert({
        where: { workspaceId },
        create: {
          ...(data as Prisma.SdSettingsUncheckedCreateInput),
          workspaceId,
          ticketPrefixes:
            (data.ticketPrefixes as Prisma.InputJsonValue | undefined) ??
            SD_DEFAULT_TICKET_PREFIXES,
        },
        update: data,
      }),
    )
  },

  /** A conexão do WhatsApp existe na workspace e é do módulo ServiceDesk? */
  async whatsappConnectionExists(
    workspaceId: string,
    connectionId: string,
  ): Promise<Result<boolean>> {
    return sdDb('Failed to check ServiceDesk WhatsApp connection', async () => {
      const count = await prisma.whatsAppConnection.count({
        where: { id: connectionId, workspaceId, module: 'SERVICE_DESK' },
      })
      return count > 0
    })
  },
}
