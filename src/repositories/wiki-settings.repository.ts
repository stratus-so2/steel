import { notFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const WikiSettingsRepository = {
  async isEnabled(workspaceId: string): Promise<Result<boolean>> {
    try {
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { wikiEnabled: true },
      })
      if (!workspace) return err(notFound('Workspace'))
      return ok(workspace.wikiEnabled)
    } catch (error) {
      return err(dbError('Failed to read wiki settings', error))
    }
  },

  async setEnabled(
    workspaceId: string,
    enabled: boolean,
  ): Promise<Result<boolean>> {
    try {
      const workspace = await prisma.workspace.update({
        where: { id: workspaceId },
        data: { wikiEnabled: enabled },
        select: { wikiEnabled: true },
      })
      return ok(workspace.wikiEnabled)
    } catch (error) {
      return err(dbError('Failed to update wiki settings', error))
    }
  },
}
