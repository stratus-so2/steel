import type { Prisma, SdOnCallRotation } from '@prisma/client'
import { sdOnCallScheduleNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import type { Result } from '@/src/lib/result'
import { sdDb, sdDbFind } from './sd-config-db'

/**
 * Escalas de plantão: escala → camadas → participantes, mais as trocas
 * pontuais. A exclusão da escala é lógica (`deletedAt`) para as trocas já
 * registradas não perderem o contexto; camadas e participantes saem de
 * verdade (cascade), porque são a configuração do rodízio.
 */

const userRef = {
  select: { id: true, name: true, email: true, image: true },
} as const

const scheduleInclude = {
  department: { select: { id: true, name: true } },
  calendar: {
    select: {
      id: true,
      name: true,
      timezone: true,
      schedule: true,
      holidays: true,
      is24x7: true,
    },
  },
  layers: {
    orderBy: { level: 'asc' },
    include: {
      participants: {
        orderBy: { position: 'asc' },
        include: { user: userRef },
      },
    },
  },
} satisfies Prisma.SdOnCallScheduleInclude

export type SdOnCallScheduleWithRelations = Prisma.SdOnCallScheduleGetPayload<{
  include: typeof scheduleInclude
}>

const overrideInclude = {
  user: userRef,
  schedule: { select: { id: true, name: true } },
} satisfies Prisma.SdOnCallOverrideInclude

export type SdOnCallOverrideWithRelations = Prisma.SdOnCallOverrideGetPayload<{
  include: typeof overrideInclude
}>

export interface SdOnCallScheduleData {
  name?: string
  departmentId?: string | null
  timezone?: string
  rotation?: SdOnCallRotation
  rotationStart?: Date
  handoffTime?: string
  calendarId?: string | null
  active?: boolean
}

export interface SdOnCallLayerData {
  name?: string
  level?: number
}

export const SdOnCallRepository = {
  async list(
    workspaceId: string,
    options: { includeInactive?: boolean; departmentId?: string } = {},
  ): Promise<Result<SdOnCallScheduleWithRelations[]>> {
    return sdDb('Failed to list ServiceDesk on-call schedules', () =>
      prisma.sdOnCallSchedule.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          ...(options.includeInactive ? {} : { active: true }),
          ...(options.departmentId
            ? { departmentId: options.departmentId }
            : {}),
        },
        orderBy: [{ name: 'asc' }],
        include: scheduleInclude,
      }),
    )
  },

  async findById(
    scheduleId: string,
    workspaceId: string,
  ): Promise<Result<SdOnCallScheduleWithRelations>> {
    return sdDbFind(
      'Failed to find ServiceDesk on-call schedule',
      () =>
        prisma.sdOnCallSchedule.findFirst({
          where: { id: scheduleId, workspaceId, deletedAt: null },
          include: scheduleInclude,
        }),
      sdOnCallScheduleNotFound(),
    )
  },

  /**
   * Escala ativa que cobre o departamento: a do próprio departamento vem
   * antes da escala geral do workspace (`departmentId = null`), que serve de
   * rede quando o time não tem a sua.
   */
  async findActiveForDepartment(
    workspaceId: string,
    departmentId: string | null,
  ): Promise<Result<SdOnCallScheduleWithRelations | null>> {
    return sdDb(
      'Failed to find the ServiceDesk on-call schedule of the department',
      async () => {
        const schedules = await prisma.sdOnCallSchedule.findMany({
          where: {
            workspaceId,
            deletedAt: null,
            active: true,
            ...(departmentId
              ? { OR: [{ departmentId }, { departmentId: null }] }
              : { departmentId: null }),
          },
          orderBy: [{ createdAt: 'asc' }],
          include: scheduleInclude,
        })
        return (
          schedules.find((s) => s.departmentId === departmentId) ??
          schedules.find((s) => s.departmentId === null) ??
          null
        )
      },
    )
  },

  async create(
    workspaceId: string,
    data: SdOnCallScheduleData & {
      name: string
      rotationStart: Date
      createdById: string
    },
  ): Promise<Result<SdOnCallScheduleWithRelations>> {
    return sdDb('Failed to create ServiceDesk on-call schedule', () =>
      prisma.sdOnCallSchedule.create({
        data: { ...data, workspaceId },
        include: scheduleInclude,
      }),
    )
  },

  async update(
    scheduleId: string,
    workspaceId: string,
    data: SdOnCallScheduleData,
  ): Promise<Result<SdOnCallScheduleWithRelations>> {
    return sdDb('Failed to update ServiceDesk on-call schedule', () =>
      prisma.sdOnCallSchedule.update({
        where: { id: scheduleId, workspaceId },
        data,
        include: scheduleInclude,
      }),
    )
  },

  /** Exclusão lógica: sai das listas e para de valer. */
  async softDelete(
    scheduleId: string,
    workspaceId: string,
  ): Promise<Result<void>> {
    return sdDb('Failed to delete ServiceDesk on-call schedule', async () => {
      await prisma.sdOnCallSchedule.update({
        where: { id: scheduleId, workspaceId },
        data: { deletedAt: new Date(), active: false },
      })
    })
  },

  // ── Camadas ──────────────────────────────────────────────────────────────

  async createLayer(
    scheduleId: string,
    data: { name: string; level: number },
  ): Promise<Result<SdOnCallScheduleWithRelations['layers'][number]>> {
    return sdDb(
      'Failed to create ServiceDesk on-call layer',
      () =>
        prisma.sdOnCallLayer.create({
          data: { ...data, scheduleId },
          include: {
            participants: {
              orderBy: { position: 'asc' },
              include: { user: userRef },
            },
          },
        }),
      'Já existe uma camada com este nível na escala',
    )
  },

  async findLayer(
    layerId: string,
    scheduleId: string,
  ): Promise<Result<SdOnCallScheduleWithRelations['layers'][number]>> {
    return sdDbFind(
      'Failed to find ServiceDesk on-call layer',
      () =>
        prisma.sdOnCallLayer.findFirst({
          where: { id: layerId, scheduleId },
          include: {
            participants: {
              orderBy: { position: 'asc' },
              include: { user: userRef },
            },
          },
        }),
      sdOnCallScheduleNotFound(),
    )
  },

  async updateLayer(
    layerId: string,
    scheduleId: string,
    data: SdOnCallLayerData,
  ): Promise<Result<void>> {
    return sdDb(
      'Failed to update ServiceDesk on-call layer',
      async () => {
        await prisma.sdOnCallLayer.update({
          where: { id: layerId, scheduleId },
          data,
        })
      },
      'Já existe uma camada com este nível na escala',
    )
  },

  async deleteLayer(
    layerId: string,
    scheduleId: string,
  ): Promise<Result<void>> {
    return sdDb('Failed to delete ServiceDesk on-call layer', async () => {
      await prisma.sdOnCallLayer.delete({ where: { id: layerId, scheduleId } })
    })
  },

  /** Troca a lista inteira da camada; a ordem do array é a do rodízio. */
  async setParticipants(
    layerId: string,
    userIds: string[],
  ): Promise<Result<void>> {
    return sdDb('Failed to save ServiceDesk on-call participants', async () => {
      await prisma.$transaction([
        prisma.sdOnCallParticipant.deleteMany({ where: { layerId } }),
        ...(userIds.length > 0
          ? [
              prisma.sdOnCallParticipant.createMany({
                data: userIds.map((userId, position) => ({
                  layerId,
                  userId,
                  position,
                })),
              }),
            ]
          : []),
      ])
    })
  },

  // ── Trocas ───────────────────────────────────────────────────────────────

  async listOverrides(
    workspaceId: string,
    filters: {
      scheduleId?: string
      from?: Date
      to?: Date
      limit?: number
    } = {},
  ): Promise<Result<SdOnCallOverrideWithRelations[]>> {
    return sdDb('Failed to list ServiceDesk on-call overrides', () =>
      prisma.sdOnCallOverride.findMany({
        where: {
          workspaceId,
          ...(filters.scheduleId ? { scheduleId: filters.scheduleId } : {}),
          ...(filters.from ? { endsAt: { gt: filters.from } } : {}),
          ...(filters.to ? { startsAt: { lt: filters.to } } : {}),
        },
        orderBy: [{ startsAt: 'asc' }],
        take: filters.limit ?? 50,
        include: overrideInclude,
      }),
    )
  },

  /** Trocas que tocam a janela, para o rodízio e a linha do tempo. */
  async listOverridesInRange(
    scheduleId: string,
    from: Date,
    to: Date,
  ): Promise<Result<SdOnCallOverrideWithRelations[]>> {
    return sdDb('Failed to list ServiceDesk on-call overrides', () =>
      prisma.sdOnCallOverride.findMany({
        where: { scheduleId, startsAt: { lt: to }, endsAt: { gt: from } },
        orderBy: [{ startsAt: 'asc' }],
        include: overrideInclude,
      }),
    )
  },

  async findOverrideById(
    overrideId: string,
    workspaceId: string,
  ): Promise<Result<SdOnCallOverrideWithRelations>> {
    return sdDbFind(
      'Failed to find ServiceDesk on-call override',
      () =>
        prisma.sdOnCallOverride.findFirst({
          where: { id: overrideId, workspaceId },
          include: overrideInclude,
        }),
      sdOnCallScheduleNotFound(),
    )
  },

  async createOverride(
    workspaceId: string,
    data: {
      scheduleId: string
      layerId: string | null
      userId: string
      startsAt: Date
      endsAt: Date
      reason: string | null
      createdById: string
    },
  ): Promise<Result<SdOnCallOverrideWithRelations>> {
    return sdDb('Failed to create ServiceDesk on-call override', () =>
      prisma.sdOnCallOverride.create({
        data: { ...data, workspaceId },
        include: overrideInclude,
      }),
    )
  },

  async deleteOverride(
    overrideId: string,
    workspaceId: string,
  ): Promise<Result<void>> {
    return sdDb('Failed to delete ServiceDesk on-call override', async () => {
      await prisma.sdOnCallOverride.delete({
        where: { id: overrideId, workspaceId },
      })
    })
  },
}
