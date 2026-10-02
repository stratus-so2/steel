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

const STATUS_STYLE: Record<SdKbArticleStatusDTO, string> = {
  PUBLISHED:
    'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  IN_REVIEW: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400',
  DRAFT:
    'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
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
