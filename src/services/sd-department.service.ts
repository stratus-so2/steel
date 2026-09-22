import { sdDepartmentDepthExceeded, sdDepartmentNotFound } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { toSdDepartmentDTO } from '@/src/mappers/sd-department.mapper'
import { SdDepartmentRepository } from '@/src/repositories/sd-department.repository'
import type {
  AddSdDepartmentMemberDTO,
  CreateSdDepartmentDTO,
  ListSdDepartmentsDTO,
  UpdateSdDepartmentDTO,
} from '@/src/schemas/sd-department.schema'
import type { SdDepartmentDTO } from '@/types/sd-config'
import { SdAccess } from './sd-access'
import { assertSdRefs, sdAdminMutation } from './sd-config-support'

/** O pai precisa existir e ser raiz (dois níveis no máximo). */
async function assertParent(
  workspaceId: string,
  parentId: string,
  selfId?: string,
): Promise<Result<true>> {
  if (parentId === selfId) {
    return err(
      sdDepartmentDepthExceeded('Um departamento não pode ser pai de si mesmo'),
    )
  }
  const parent = await SdDepartmentRepository.findById(parentId, workspaceId)
  if (!parent.ok) return parent
  if (parent.value.parentId) return err(sdDepartmentDepthExceeded())
  return ok(true)
}

async function reload(
  departmentId: string,
  workspaceId: string,
): Promise<Result<SdDepartmentDTO>> {
  const department = await SdDepartmentRepository.findById(
    departmentId,
    workspaceId,
  )
  if (!department.ok) return department
  return ok(toSdDepartmentDTO(department.value))
}

export const SdDepartmentService = {
  async list(
    actorId: string,
    workspaceId: string,
    filters: ListSdDepartmentsDTO = { includeInactive: false },
  ): Promise<Result<SdDepartmentDTO[]>> {
    const ctx = await SdAccess.resolve(actorId, workspaceId)
    if (!ctx.ok) return ctx
    const rows = await SdDepartmentRepository.list(workspaceId, filters)
    if (!rows.ok) return rows
    return ok(rows.value.map(toSdDepartmentDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateSdDepartmentDTO,
  ): Promise<Result<SdDepartmentDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_department',
      action: 'create',
      targetId: (value) => value.id,
      run: async () => {
        if (dto.parentId) {
          const parent = await assertParent(workspaceId, dto.parentId)
          if (!parent.ok) return parent
        }
        const refs = await assertSdRefs(workspaceId, {
          calendarIds: [dto.calendarId],
        })
        if (!refs.ok) return refs

        const created = await SdDepartmentRepository.create(workspaceId, dto)
        if (!created.ok) return created
        return ok(toSdDepartmentDTO(created.value))
      },
    })
  },

  async update(
    actorId: string,
    workspaceId: string,
    departmentId: string,
    dto: UpdateSdDepartmentDTO,
  ): Promise<Result<SdDepartmentDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_department',
      action: 'update',
      targetId: departmentId,
      meta: { fields: Object.keys(dto) },
      run: async () => {
        const existing = await SdDepartmentRepository.findById(
          departmentId,
          workspaceId,
        )
        if (!existing.ok) return existing

        if (dto.parentId && dto.parentId !== existing.value.parentId) {
          const parent = await assertParent(
            workspaceId,
            dto.parentId,
            departmentId,
          )
          if (!parent.ok) return parent
          const children =
            await SdDepartmentRepository.countChildren(departmentId)
          if (!children.ok) return children
          if (children.value > 0) {
            return err(
              sdDepartmentDepthExceeded(
                'Um departamento com sub-departamentos não pode virar sub-departamento',
              ),
            )
          }
        }
        const refs = await assertSdRefs(workspaceId, {
          calendarIds: [dto.calendarId],
        })
        if (!refs.ok) return refs

        const updated = await SdDepartmentRepository.update(
          departmentId,
          workspaceId,
          dto,
        )
        if (!updated.ok) return updated
        return ok(toSdDepartmentDTO(updated.value))
      },
    })
  },

  /** Exclusão lógica (leva junto os sub-departamentos). */
  async remove(
    actorId: string,
    workspaceId: string,
    departmentId: string,
  ): Promise<Result<void>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_department',
      action: 'delete',
      targetId: departmentId,
      run: async () => {
        const existing = await SdDepartmentRepository.findById(
          departmentId,
          workspaceId,
        )
        if (!existing.ok) return existing
        return SdDepartmentRepository.softDelete(departmentId, workspaceId)
      },
    })
  },

  async reorder(
    actorId: string,
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_department',
      action: 'update',
      meta: { reorder: orderedIds.length },
      run: () => SdDepartmentRepository.reorder(workspaceId, orderedIds),
    })
  },

  /** Adiciona (ou atualiza o `isLead` de) um membro do workspace ao time. */
  async addMember(
    actorId: string,
    workspaceId: string,
    departmentId: string,
    dto: AddSdDepartmentMemberDTO,
  ): Promise<Result<SdDepartmentDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_department_member',
      action: 'create',
      targetId: departmentId,
      meta: { userId: dto.userId, isLead: dto.isLead },
      run: async () => {
        const existing = await SdDepartmentRepository.findById(
          departmentId,
          workspaceId,
        )
        if (!existing.ok) return existing
        const refs = await assertSdRefs(workspaceId, { userIds: [dto.userId] })
        if (!refs.ok) return refs
        const saved = await SdDepartmentRepository.upsertMember(
          departmentId,
          dto.userId,
          dto.isLead,
        )
        if (!saved.ok) return saved
        return reload(departmentId, workspaceId)
      },
    })
  },

  async updateMember(
    actorId: string,
    workspaceId: string,
    departmentId: string,
    userId: string,
    isLead: boolean,
  ): Promise<Result<SdDepartmentDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_department_member',
      action: 'update',
      targetId: departmentId,
      meta: { userId, isLead },
      run: async () => {
        const existing = await SdDepartmentRepository.findById(
          departmentId,
          workspaceId,
        )
        if (!existing.ok) return existing
        const saved = await SdDepartmentRepository.updateMember(
          departmentId,
          userId,
          isLead,
        )
        if (!saved.ok) return saved
        return reload(departmentId, workspaceId)
      },
    })
  },

  async removeMember(
    actorId: string,
    workspaceId: string,
    departmentId: string,
    userId: string,
  ): Promise<Result<SdDepartmentDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_department_member',
      action: 'delete',
      targetId: departmentId,
      meta: { userId },
      run: async () => {
        const existing = await SdDepartmentRepository.findById(
          departmentId,
          workspaceId,
        )
        if (!existing.ok) return existing
        if (!existing.value.members.some((m) => m.userId === userId)) {
          return err({
            ...sdDepartmentNotFound(),
            message: 'Usuário não pertence a este departamento',
          })
        }
        const removed = await SdDepartmentRepository.removeMember(
          departmentId,
          userId,
        )
        if (!removed.ok) return removed
        return reload(departmentId, workspaceId)
      },
    })
  },
}
