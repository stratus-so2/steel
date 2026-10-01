import type { SdApprovalStatusDTO } from '@/types/sd-ticket-approval'

export const SD_APPROVAL_STATUS_LABEL: Record<SdApprovalStatusDTO, string> = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovada',
  REJECTED: 'Reprovada',
  CANCELED: 'Cancelada',
  EXPIRED: 'Expirada',
}

export const SD_APPROVAL_STATUS_STYLE: Record<SdApprovalStatusDTO, string> = {
  PENDING: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  APPROVED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  REJECTED: 'bg-destructive/10 text-destructive',
  CANCELED: 'bg-muted text-muted-foreground',
  EXPIRED: 'bg-muted text-muted-foreground',
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isSdEmail(value: string): boolean {
  return EMAIL.test(value.trim())
}
