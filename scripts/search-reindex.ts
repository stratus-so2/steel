import { prisma } from '@/src/lib/prisma'
import { SearchIndexService } from '@/src/services/search-index.service'

/**
 * Rebuilds the global search index (`search_documents`) inline — no worker
 * needed. With no argument, every workspace; with an id or slug, just that
 * one. Safe to run any time: it upserts and drops only stale documents.
 *
 *   pnpm search:reindex [workspaceIdOrSlug]
 */
async function main() {
  const identifier = process.argv[2]
  const startedAt = Date.now()

  if (!identifier) {
    const result = await SearchIndexService.reindexAll()
    if (!result.ok) throw new Error(result.error.message)
    console.log(
      `Search index rebuilt: ${result.value.workspaces} workspace(s), ` +
        `${result.value.indexed} document(s), ${result.value.removed} removed, ` +
        `${result.value.failed} failed — ${Date.now() - startedAt} ms`,
    )
    if (result.value.failed > 0) process.exitCode = 1
    return
  }

  const workspace = await prisma.workspace.findFirst({
    where: { OR: [{ id: identifier }, { slug: identifier }] },
    select: { id: true, slug: true },
  })
  if (!workspace) {
    console.error(`Workspace "${identifier}" not found.`)
    process.exitCode = 1
    return
  }

  const result = await SearchIndexService.reindexWorkspace(workspace.id)
  if (!result.ok) throw new Error(result.error.message)
  console.log(
    `Search index rebuilt for ${workspace.slug}: ${result.value.indexed} ` +
      `document(s), ${result.value.removed} removed — ${Date.now() - startedAt} ms`,
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
