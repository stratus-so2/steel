import { afterAll, afterEach } from 'vitest'
import { prisma } from '@/src/lib/prisma'

afterEach(async () => {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      sessions, accounts, verifications,
      subscriptions, memberships, workspaces, users,
      incident_updates, incidents,
      health_checks, component_dailies,
      backups, admin_audit_logs, admin_operations
    CASCADE
  `)
})

afterAll(async () => {
  await prisma.$disconnect()
})
