import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

/**
 * Who to tell about workspace-level events that have no natural owner (a
 * WhatsApp connection went down, a template was rejected, a contract ran out
 * of franchise). Read-only lookups; the services decide what to send.
 */
export const NotificationAudienceRepository = {
  /**
   * OWNER/ADMIN members of the workspace, oldest membership first, capped at
   * `limit` so a large workspace never fans out to everybody.
   */
  async listPrivilegedUserIds(
    workspaceId: string,
    limit: number,
  ): Promise<Result<string[]>> {
    try {
      const rows = await prisma.membership.findMany({
        where: { workspaceId, role: { in: ['OWNER', 'ADMIN'] } },
        select: { userId: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: limit,
      })
      return ok(rows.map((row) => row.userId))
    } catch (error) {
      return err(dbError('Failed to list workspace admins', error))
    }
  },
}
