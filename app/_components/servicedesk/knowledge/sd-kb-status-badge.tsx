import {
  CheckmarkCircle02Icon,
  Globe02Icon,
  PencilEdit02Icon,
  SquareLock02Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type {
  SdKbArticleStatusDTO,
  SdKbVisibilityDTO,
} from '@/types/sd-kb-article'
import { SD_KB_STATUS_LABEL, SD_KB_VISIBILITY_LABEL } from './sd-kb-utils'

export function SdKbStatusBadge({
  status,
  className,
}: {
  status: SdKbArticleStatusDTO
  className?: string
}) {
  const published = status === 'PUBLISHED'
  return (
    <Badge
      variant='outline'
      data-status={status}
      className={cn(
        'gap-1',
        published
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
          : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
        className,
      )}
    >
      <SteelIcon
        icon={published ? CheckmarkCircle02Icon : PencilEdit02Icon}
        size={12}
        strokeWidth={2}
      />
      {SD_KB_STATUS_LABEL[status]}
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
