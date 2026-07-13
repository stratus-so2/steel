import 'server-only'
import type { ModuleKind, PrismaClient } from '@prisma/client'
import { connectionNotFound } from '@/src/errors'
import { decryptConnectionSecret } from '@/src/lib/crypto'
import { buildModuleConnectionString } from '@/src/lib/module-db/connection-string'
import { createPrismaClient } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { WorkspaceConnectionRepository } from '@/src/repositories/workspace-connection.repository'

interface CacheEntry {
  client: PrismaClient
  lastUsedAt: number
}

// No existing multi-instance-connection precedent in the codebase (see
// src/lib/queue/connection.ts for the closest analog, a single cached
// connection with no eviction). Keep this simple: idle clients past the TTL
// are disconnected and dropped the next time any lookup runs.
const IDLE_TTL_MS = 10 * 60 * 1000
const cache = new Map<string, CacheEntry>()

function cacheKey(workspaceId: string, module: ModuleKind): string {
  return `${workspaceId}:${module}`
}

function evictIdleClients(): void {
  const now = Date.now()
  for (const [key, entry] of cache) {
    if (now - entry.lastUsedAt > IDLE_TTL_MS) {
      entry.client.$disconnect()
      cache.delete(key)
    }
  }
}

/**
 * Resolves a Prisma client for a workspace's module data. Only supports the
 * per-workspace external-connection override today — there is no shared
 * Steel-hosted fallback yet since none of the modules (ServiceDesk/CRM/
 * Communication) have a real domain schema to serve from a shared DB.
 */
export async function getModuleConnection(
  workspaceId: string,
  module: ModuleKind,
): Promise<Result<PrismaClient>> {
  evictIdleClients()

  const key = cacheKey(workspaceId, module)
  const cached = cache.get(key)
  if (cached) {
    cached.lastUsedAt = Date.now()
    return ok(cached.client)
  }

  const connectionResult =
    await WorkspaceConnectionRepository.findByWorkspaceAndModule(
      workspaceId,
      module,
    )
  if (!connectionResult.ok) return connectionResult
  if (!connectionResult.value) return err(connectionNotFound())

  const connection = connectionResult.value
  const password = await decryptConnectionSecret(connection.encryptedPassword)
  const connectionString = buildModuleConnectionString({
    host: connection.host,
    port: connection.port,
    username: connection.username,
    password,
    database: connection.database,
    sslEnabled: connection.sslEnabled,
  })

  const client = createPrismaClient(connectionString, { max: 3 })
  cache.set(key, { client, lastUsedAt: Date.now() })

  return ok(client)
}

/** Drops a cached client so the next lookup picks up fresh credentials. */
export function evictModuleConnection(
  workspaceId: string,
  module: ModuleKind,
): void {
  const key = cacheKey(workspaceId, module)
  const entry = cache.get(key)
  if (entry) {
    entry.client.$disconnect()
    cache.delete(key)
  }
}
