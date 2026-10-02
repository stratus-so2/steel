import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  Globe02Icon,
  PencilEdit02Icon,
  SquareLock02Icon,
  UserCheck01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type {
  SdKbArticleStatusDTO,
  SdKbVisibilityDTO,
} from '@/types/sd-kb-article'
import {
  SD_KB_STATUS_LABEL,
  SD_KB_VISIBILITY_LABEL,
  sdKbReviewOverdue,
} from './sd-kb-utils'

/**
 * Cor do fluxo editorial, em mapa fechado no padrão do repositório
 * (`bg-<c>-500/10` + `text-<c>-700 dark:text-<c>-300`): contraste nos dois
 * temas e classes visíveis ao Tailwind.
 */
const STATUS_STYLE: Record<SdKbArticleStatusDTO, string> = {
  PUBLISHED:
    'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  IN_REVIEW: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  DRAFT:
    'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
}

/** Ponto de status (árvore da base): a mesma faixa de cor do selo. */
export const SD_KB_STATUS_DOT: Record<SdKbArticleStatusDTO, string> = {
  PUBLISHED: 'bg-emerald-500',
  IN_REVIEW: 'bg-sky-500',
  DRAFT: 'bg-amber-500',
}

const STATUS_ICON: Record<SdKbArticleStatusDTO, typeof PencilEdit02Icon> = {
  PUBLISHED: CheckmarkCircle02Icon,
  IN_REVIEW: UserCheck01Icon,
  DRAFT: PencilEdit02Icon,
}

export function SdKbStatusBadge({
  status,
  className,
}: {
  status: SdKbArticleStatusDTO
  className?: string
}) {
  return (
    <Badge
      variant='outline'
      data-status={status}
      className={cn('gap-1', STATUS_STYLE[status], className)}
    >
      <SteelIcon icon={STATUS_ICON[status]} size={12} strokeWidth={2} />
      {SD_KB_STATUS_LABEL[status]}
    </Badge>
  )
}

/** Selo de validade vencida (KCS): o artigo precisa ser revisto. */
export function SdKbReviewDueBadge({
  reviewDueAt,
  now,
  className,
}: {
  reviewDueAt: string | null
  now?: number
  className?: string
}) {
  if (!sdKbReviewOverdue(reviewDueAt, now)) return null
  return (
    <Badge
      variant='outline'
      data-review='overdue'
      className={cn(
        'gap-1 border-destructive/40 bg-destructive/10 text-destructive',
        className,
      )}
    >
      <SteelIcon icon={Alert02Icon} size={12} strokeWidth={2} />
      Revisão vencida
    </Badge>
  )
}

export function SdKbVisibilityBadge({
  visibility,
  className,
}: {
  visibility: SdKbVisibilityDTO
  className?: string
}) {
  const portal = visibility === 'PORTAL'
  return (
    <Badge variant='secondary' className={cn('gap-1', className)}>
      <SteelIcon
        icon={portal ? Globe02Icon : SquareLock02Icon}
        size={12}
        strokeWidth={2}
      />
      {SD_KB_VISIBILITY_LABEL[visibility]}
    </Badge>
  )
}
