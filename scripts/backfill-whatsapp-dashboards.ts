import { prisma } from '@/src/lib/prisma'
import { WhatsAppDashboardSeedService } from '@/src/services/whatsapp-dashboard-seed.service'

/**
 * Semeia os dashboards/relatórios padrão do zap pros workspaces que já
 * tinham o módulo COMMUNICATION habilitado antes do seed automático existir.
 * Idempotente — seguro rodar mais de uma vez.
 *
 *   pnpm seed:whatsapp-dashboards
 */
async function main() {
  const grants = await prisma.workspaceModuleAccess.findMany({
    where: { module: 'COMMUNICATION', enabled: true },
    select: { workspaceId: true, grantedById: true },
  })

  console.log(`${grants.length} workspace(s) com o zap habilitado.`)

  let ok = 0
  let failed = 0

  for (const grant of grants) {
    const result = await WhatsAppDashboardSeedService.seedDefaults(
      grant.workspaceId,
      grant.grantedById,
    )
    if (!result.ok) {
      failed += 1
      console.error(`✗ ${grant.workspaceId}: ${result.error.code}`)
      continue
    }
    ok += 1
    console.log(`✓ ${grant.workspaceId}`)
  }

  console.log(`Concluído: ${ok} ok, ${failed} falha(s).`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
