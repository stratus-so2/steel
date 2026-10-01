import { prisma } from '@/src/lib/prisma'
import { SdDashboardSeedService } from '@/src/services/sd-dashboard-seed.service'
import { SdSeedService } from '@/src/services/sd-seed.service'

/**
 * Semeia os padrões ITIL do ServiceDesk (fases, matriz de prioridade, SLAs,
 * calendários, catálogo de exemplo, tipos de CI, dashboards Analítico e
 * KPIs/TV...) nos workspaces que já
 * tinham o módulo SERVICE_DESK habilitado antes do seed automático existir.
 * Idempotente — seguro rodar mais de uma vez.
 *
 *   pnpm seed:servicedesk
 */
async function main() {
  const grants = await prisma.workspaceModuleAccess.findMany({
    where: { module: 'SERVICE_DESK', enabled: true },
    select: { workspaceId: true, grantedById: true },
  })

  console.log(`${grants.length} workspace(s) com o ServiceDesk habilitado.`)

  let ok = 0
  let failed = 0

  for (const grant of grants) {
    const result = await SdSeedService.seedDefaults(
      grant.workspaceId,
      grant.grantedById,
    )
    if (!result.ok) {
      failed += 1
      console.error(`✗ ${grant.workspaceId}: ${result.error.code}`)
      continue
    }
    const dashboards = await SdDashboardSeedService.seedDefaults(
      grant.workspaceId,
      grant.grantedById,
    )
    if (!dashboards.ok) {
      failed += 1
      console.error(
        `✗ ${grant.workspaceId} (dashboards): ${dashboards.error.code}`,
      )
      continue
    }
    ok += 1
    console.log(`✓ ${grant.workspaceId}`, result.value, dashboards.value)
  }

  console.log(`Concluído: ${ok} ok, ${failed} falha(s).`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
