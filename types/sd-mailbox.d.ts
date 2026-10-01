import type { SdTicketTypeDTO } from './sd-ticket'

export type SdMailboxStatusDTO = 'ACTIVE' | 'ERROR' | 'PAUSED'

export type SdMailDirectionDTO = 'INBOUND' | 'OUTBOUND'

/**
 * Caixa de e-mail monitorada pelo ServiceDesk. As senhas (IMAP/SMTP) nunca
 * aparecem aqui — só o indicador de que estão configuradas.
 */
export interface SdMailboxDTO {
  id: string
  workspaceId: string
  name: string
  address: string
  status: SdMailboxStatusDTO
  statusError: string | null
  imapHost: string
  imapPort: number
  imapSecure: boolean
  imapUser: string
  folder: string
  processedFolder: string | null
  smtpHost: string | null
  smtpPort: number | null
  smtpSecure: boolean
  smtpUser: string | null
  /** `true` quando há senha de SMTP guardada (o envio sai pela caixa). */
  smtpConfigured: boolean
  defaultType: SdTicketTypeDTO
  defaultDepartmentId: string | null
  defaultCategoryId: string | null
  defaultPriorityId: string | null
  allowedSenders: string[]
  blockedSenders: string[]
  createUnknownContacts: boolean
  sendAcknowledgement: boolean
  lastSyncAt: string | null
  lastSeenUid: number | null
  createdAt: string
  updatedAt: string
}

/** Resultado do "testar conexão" (IMAP e, se houver, SMTP). */
export interface SdMailboxTestDTO {
  connected: boolean
  status: SdMailboxStatusDTO
  error: string | null
  /** Mensagens na pasta monitorada (`null` quando o IMAP falhou). */
  messages: number | null
  /** `null` quando a caixa não tem SMTP configurado. */
  smtp: boolean | null
}

/** Resultado de uma leitura da caixa (manual ou do worker). */
export interface SdMailboxSyncDTO {
  fetched: number
  opened: number
  appended: number
  skipped: number
  failed: number
}

/** Cabeçalhos do e-mail que gerou uma mensagem do histórico. */
export interface SdTicketMailMessageDTO {
  id: string
  /** Mensagem do histórico (`SdTicketMessage`) correspondente. */
  ticketMessageId: string | null
  direction: SdMailDirectionDTO
  fromAddress: string
  fromName: string | null
  toAddresses: string[]
  ccAddresses: string[]
  subject: string | null
  automatic: boolean
  createdAt: string
}
