import type { ModuleKind, WorkspaceModuleConnection } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const WorkspaceConnectionRepository = {
  async findByWorkspaceAndModule(
    workspaceId: string,
    module: ModuleKind,
  ): Promise<Result<WorkspaceModuleConnection | null>> {
    try {
      const connection = await prisma.workspaceModuleConnection.findUnique({
        where: { workspaceId_module: { workspaceId, module } },
      })
      return ok(connection)
    } catch (error) {
      return err(dbError('Failed to find workspace module connection', error))
    }
  },

  async listByWorkspace(
    workspaceId: string,
  ): Promise<Result<WorkspaceModuleConnection[]>> {
    try {
      const connections = await prisma.workspaceModuleConnection.findMany({
        where: { workspaceId },
        orderBy: { module: 'asc' },
      })
      return ok(connections)
    } catch (error) {
      return err(dbError('Failed to list workspace module connections', error))
    }
  },

  async upsert(data: {
    workspaceId: string
    module: ModuleKind
    host: string
    port: number
    username: string
    encryptedPassword: string
    database: string
    sslEnabled: boolean
    createdById: string
  }): Promise<Result<WorkspaceModuleConnection>> {
    try {
      const connection = await prisma.workspaceModuleConnection.upsert({
        where: {
          workspaceId_module: {
            workspaceId: data.workspaceId,
            module: data.module,
          },
        },
        create: data,
        update: {
          host: data.host,
          port: data.port,
          username: data.username,
          encryptedPassword: data.encryptedPassword,
          database: data.database,
          sslEnabled: data.sslEnabled,
        },
      })
      return ok(connection)
    } catch (error) {
      return err(dbError('Failed to save workspace module connection', error))
    }
  },

  async delete(id: string): Promise<Result<void>> {
    try {
      await prisma.workspaceModuleConnection.delete({ where: { id } })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete workspace module connection', error))
    }
  },
}
