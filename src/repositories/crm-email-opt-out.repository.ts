import type { CrmEmailOptOut, CrmEmailOptOutSource } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

/** Endereços e pessoas descadastrados de um workspace — usado para excluir
 * destinatários ao montar e ao enviar campanhas. */
export type CrmEmailOptOutIndex = {
  emails: Set<string>
  personIds: Set<string>
}

export const CrmEmailOptOutRepository = {
  async listByWorkspace(
    workspaceId: string,
  ): Promise<Result<CrmEmailOptOut[]>> {
    try {
      const optOuts = await prisma.crmEmailOptOut.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
      })
      return ok(optOuts)
    } catch (error) {
      return err(dbError('Failed to list CRM email opt-outs', error))
    }
  },

  async indexByWorkspace(
    workspaceId: string,
  ): Promise<Result<CrmEmailOptOutIndex>> {
    try {
      const optOuts = await prisma.crmEmailOptOut.findMany({
        where: { workspaceId },
        select: { email: true, personId: true },
      })
      return ok({
        emails: new Set(optOuts.map((o) => o.email)),
        personIds: new Set(
          optOuts.flatMap((o) => (o.personId ? [o.personId] : [])),
        ),
      })
    } catch (error) {
      return err(dbError('Failed to index CRM email opt-outs', error))
    }
  },

  /** Idempotente: o primeiro descadastro de um endereço vence (preserva
   * quando/como ele aconteceu). `created` indica se é novo. */
  async upsert(data: {
    workspaceId: string
    email: string
    personId?: string | null
    campaignId?: string | null
    source: CrmEmailOptOutSource
  }): Promise<Result<{ optOut: CrmEmailOptOut; created: boolean }>> {
    const email = data.email.trim().toLowerCase()
    try {
      const existing = await prisma.crmEmailOptOut.findUnique({
        where: {
          workspaceId_email: { workspaceId: data.workspaceId, email },
        },
      })
      if (existing) return ok({ optOut: existing, created: false })

      const optOut = await prisma.crmEmailOptOut.upsert({
        where: {
          workspaceId_email: { workspaceId: data.workspaceId, email },
        },
        create: { ...data, email },
        update: {},
      })
      return ok({ optOut, created: true })
    } catch (error) {
      return err(dbError('Failed to upsert CRM email opt-out', error))
    }
  },
}
