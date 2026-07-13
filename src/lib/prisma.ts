import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { DATABASE_URL } from '@/lib/env/_server'

export function createPrismaClient(
  connectionString: string,
  opts?: { max?: number },
): PrismaClient {
  const adapter = new PrismaPg({
    connectionString,
    max: opts?.max ?? 5,
  })

  return new PrismaClient({ adapter })
}

export const prisma = createPrismaClient(DATABASE_URL)
