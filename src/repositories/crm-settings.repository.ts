import type { CrmLeadStage, CrmSettings } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const CrmSettingsRepository = {
  /** `null` = a workspace nunca salvou configurações (valem os padrões). */
  async findByWorkspace(
    workspaceId: string,
  ): Promise<Result<CrmSettings | null>> {
    try {
      const settings = await prisma.crmSettings.findUnique({
        where: { workspaceId },
      })
      return ok(settings)
    } catch (error) {
      return err(dbError('Failed to find CRM settings', error))
    }
  },

  /** Cria a linha na 1ª gravação (campos omitidos ficam no @default). */
  async upsert(
    workspaceId: string,
    data: {
      leadReopenStage?: CrmLeadStage
      proposalValidityDays?: number
      notifyProposalExpiry?: boolean
      updatedById: string
    },
  ): Promise<Result<CrmSettings>> {
    try {
      const settings = await prisma.crmSettings.upsert({
        where: { workspaceId },
        create: { workspaceId, ...data },
        update: data,
      })
      return ok(settings)
    } catch (error) {
      return err(dbError('Failed to save CRM settings', error))
    }
  },
}
