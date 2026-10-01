import z from 'zod'
import { sdId } from './sd-config.schema'

/**
 * Caixas de e-mail do ServiceDesk (`SdMailbox`): o que a abertura e a
 * resposta de chamado por e-mail precisam. As senhas entram em claro e são
 * cifradas no service (`encryptConnectionSecret`); nunca voltam na API.
 */

const name = z.string().trim().min(1, 'Nome é obrigatório').max(120)
const address = z.email('Endereço de e-mail inválido').max(320)
const host = z.string().trim().min(1, 'Servidor é obrigatório').max(255)
const port = z.coerce.number().int().min(1).max(65_535)
const password = z.string().min(1, 'Senha é obrigatória').max(512)
const folder = z.string().trim().min(1).max(255)
const user = z.string().trim().min(1, 'Usuário é obrigatório').max(320)

/** Lista de remetentes: e-mail (`ana@x.com`) ou domínio (`@x.com`). */
const senderPattern = /^(@[^@\s]+\.[^@\s]+|[^@\s]+@[^@\s]+\.[^@\s]+)$/
const senderList = z
  .array(
    z
      .string()
      .trim()
      .toLowerCase()
      .min(1)
      .max(320)
      .regex(senderPattern, 'Use um e-mail (ana@x.com) ou domínio (@x.com)'),
  )
  .max(200, 'Até 200 remetentes')

const ticketType = z.enum(['INCIDENT', 'SERVICE_REQUEST', 'CHANGE', 'PROBLEM'])

export const CreateSdMailboxSchema = z.object({
  name,
  address,
  imapHost: host,
  imapPort: port.default(993),
  imapSecure: z.boolean().default(true),
  imapUser: user,
  imapPassword: password,
  folder: folder.default('INBOX'),
  /** Para onde a mensagem vai depois de virar chamado (vazio = fica). */
  processedFolder: folder.nullable().optional(),
  smtpHost: host.nullable().optional(),
  smtpPort: port.nullable().optional(),
  smtpSecure: z.boolean().default(true),
  smtpUser: user.nullable().optional(),
  /** Sem senha de SMTP, a resposta sai pela camada de e-mail do Steel. */
  smtpPassword: password.nullable().optional(),
  defaultType: ticketType.default('INCIDENT'),
  defaultDepartmentId: sdId.nullable().optional(),
  defaultCategoryId: sdId.nullable().optional(),
  defaultPriorityId: sdId.nullable().optional(),
  allowedSenders: senderList.default([]),
  blockedSenders: senderList.default([]),
  createUnknownContacts: z.boolean().default(true),
  sendAcknowledgement: z.boolean().default(true),
})
export type CreateSdMailboxDTO = z.infer<typeof CreateSdMailboxSchema>

export const UpdateSdMailboxSchema = z
  .object({
    name: name.optional(),
    imapHost: host.optional(),
    imapPort: port.optional(),
    imapSecure: z.boolean().optional(),
    imapUser: user.optional(),
    imapPassword: password.optional(),
    folder: folder.optional(),
    processedFolder: folder.nullable().optional(),
    smtpHost: host.nullable().optional(),
    smtpPort: port.nullable().optional(),
    smtpSecure: z.boolean().optional(),
    smtpUser: user.nullable().optional(),
    smtpPassword: password.nullable().optional(),
    defaultType: ticketType.optional(),
    defaultDepartmentId: sdId.nullable().optional(),
    defaultCategoryId: sdId.nullable().optional(),
    defaultPriorityId: sdId.nullable().optional(),
    allowedSenders: senderList.optional(),
    blockedSenders: senderList.optional(),
    createUnknownContacts: z.boolean().optional(),
    sendAcknowledgement: z.boolean().optional(),
    /** `ACTIVE` ↔ `PAUSED`: pausada, a caixa não é lida pelo worker. */
    status: z.enum(['ACTIVE', 'PAUSED']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo',
  })
export type UpdateSdMailboxDTO = z.infer<typeof UpdateSdMailboxSchema>
