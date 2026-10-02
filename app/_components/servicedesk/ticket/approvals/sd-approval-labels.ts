import type { SdApprovalStatusDTO } from '@/types/sd-ticket-approval'

import { SD_TONE } from '../../sd-tone'
export const SD_APPROVAL_STATUS_LABEL: Record<SdApprovalStatusDTO, string> = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovada',
  REJECTED: 'Reprovada',
  CANCELED: 'Cancelada',
  EXPIRED: 'Expirada',
}

export const SD_APPROVAL_STATUS_STYLE: Record<SdApprovalStatusDTO, string> = {
  PENDING: SD_TONE.amber,
  APPROVED: SD_TONE.emerald,
  REJECTED: 'bg-destructive/10 text-destructive',
  CANCELED: 'bg-muted text-muted-foreground',
  EXPIRED: 'bg-muted text-muted-foreground',
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isSdEmail(value: string): boolean {
  return EMAIL.test(value.trim())
}
