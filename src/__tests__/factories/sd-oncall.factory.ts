import { createId } from '@paralleldrive/cuid2'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type {
  SdOnCallOverrideWithRelations,
  SdOnCallScheduleWithRelations,
} from '@/src/repositories/sd-oncall.repository'

/**
 * Fábricas do plantão: `createFake*` para os testes unitários (sem banco) e
 * `seed*` para os de integração. A âncora padrão é segunda-feira
 * 2026-10-05 09:00 em São Paulo (12:00Z), que é a base dos testes do rodízio.
 */

export const SD_ONCALL_ROTATION_START = new Date('2026-10-05T12:00:00.000Z')

const now = () => new Date('2026-10-01T12:00:00.000Z')

function fakeUser(id: string) {
  return {
    id,
    name: `Agente ${id}`,
    email: `${id}@steel.test`,
    image: null,
  }
}

export function createFakeSdOnCallSchedule(
  overrides?: Partial<SdOnCallScheduleWithRelations>,
): SdOnCallScheduleWithRelations {
  const id = overrides?.id ?? createId()
  return {
    id,
    workspaceId: 'ws1',
    departmentId: 'dep-1',
    name: 'Plantão de redes',
    timezone: 'America/Sao_Paulo',
    rotation: 'WEEKLY',
    rotationStart: SD_ONCALL_ROTATION_START,
    handoffTime: '09:00',
    calendarId: null,
    active: true,
    createdById: 'u1',
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null,
    department: { id: 'dep-1', name: 'Redes' },
    calendar: null,
    layers: [
      {
        id: 'layer-1',
        scheduleId: id,
        name: 'Primeira chamada',
        level: 1,
        participants: [
          {
            id: 'part-1',
            layerId: 'layer-1',
            userId: 'u1',
            position: 0,
            user: fakeUser('u1'),
          },
          {
            id: 'part-2',
            layerId: 'layer-1',
            userId: 'u2',
            position: 1,
            user: fakeUser('u2'),
          },
        ],
      },
    ],
    ...overrides,
  }
}

export function createFakeSdOnCallOverride(
  overrides?: Partial<SdOnCallOverrideWithRelations>,
): SdOnCallOverrideWithRelations {
  return {
    id: createId(),
    workspaceId: 'ws1',
    scheduleId: 'sch-1',
    layerId: 'layer-1',
    userId: 'u3',
    startsAt: new Date('2026-10-07T00:00:00.000Z'),
    endsAt: new Date('2026-10-08T00:00:00.000Z'),
    reason: 'Consulta médica',
    createdById: 'u1',
    createdAt: now(),
    user: fakeUser('u3'),
    schedule: { id: 'sch-1', name: 'Plantão de redes' },
    ...overrides,
  }
}

/* ------------------------------ seeds (integração) ------------------------------ */

export async function seedSdOnCallSchedule(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<Prisma.SdOnCallScheduleUncheckedCreateInput>,
) {
  return prisma.sdOnCallSchedule.create({
    data: {
      workspaceId,
      createdById,
      name: 'Plantão de redes',
      rotationStart: SD_ONCALL_ROTATION_START,
      ...overrides,
    },
  })
}

export async function seedSdOnCallLayer(
  scheduleId: string,
  overrides?: Partial<Prisma.SdOnCallLayerUncheckedCreateInput>,
) {
  return prisma.sdOnCallLayer.create({
    data: { scheduleId, name: 'Primeira chamada', level: 1, ...overrides },
  })
}

export async function seedSdOnCallOverride(
  workspaceId: string,
  scheduleId: string,
  userId: string,
  createdById: string,
  overrides?: Partial<Prisma.SdOnCallOverrideUncheckedCreateInput>,
) {
  return prisma.sdOnCallOverride.create({
    data: {
      workspaceId,
      scheduleId,
      userId,
      createdById,
      startsAt: new Date('2026-10-07T00:00:00.000Z'),
      endsAt: new Date('2026-10-08T00:00:00.000Z'),
      ...overrides,
    },
  })
}
