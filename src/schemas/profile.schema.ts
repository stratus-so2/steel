import { z } from 'zod'
import { PERMISSION_ACTIONS } from '@/src/lib/permissions'

/** Contrato da feature Profile (perfis de acesso / RBAC). */

const NameSchema = z
  .string()
  .trim()
  .min(1, 'Informe o nome do perfil')
  .max(60, 'Nome muito longo')

/**
 * Mapa `recurso → [ações]`. A chave aceita qualquer string; o service saneia
 * para o catálogo válido (`sanitizePermissions`), descartando pares inválidos.
 */
export const PermissionsSchema = z.record(
  z.string(),
  z.array(z.enum(PERMISSION_ACTIONS)),
)

export const CreateProfileSchema = z.object({
  name: NameSchema,
  permissions: PermissionsSchema,
})

export const UpdateProfileSchema = z
  .object({
    name: NameSchema,
    permissions: PermissionsSchema,
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualizar',
  })

export const ProfileOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  isSystem: z.boolean(),
  systemKey: z.string().nullable(),
  permissions: z.record(z.string(), z.array(z.string())),
  workspaceId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type CreateProfileInput = z.infer<typeof CreateProfileSchema>
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>
export type ProfileDTO = z.infer<typeof ProfileOutputSchema>
