import {
  CheckmarkCircle02Icon,
  Clock01Icon,
  Folder01Icon,
  Tag01Icon,
  UserIcon,
  ViewIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import type { SdKbArticleDTO } from '@/types/sd-kb-article'
import { sdKbRelativeTime } from './sd-kb-utils'

/** Autor, última atualização, tempo de leitura, visualizações, categoria e tags. */
export function SdKbArticleMeta({
  article,
  showViews = true,
}: {
  article: SdKbArticleDTO
  showViews?: boolean
}) {
  const author = article.updatedBy ?? article.createdBy
  return (
    <div className='flex flex-wrap items-center gap-x-4 gap-y-1.5 text-muted-foreground text-xs'>
      {author && (
        <span className='inline-flex items-center gap-1'>
          <SteelIcon icon={UserIcon} size={13} strokeWidth={2} />
          {author.name}
        </span>
      )}
      <span
        className='inline-flex items-center gap-1'
        title={new Date(article.updatedAt).toLocaleString('pt-BR')}
      >
        <SteelIcon icon={Clock01Icon} size={13} strokeWidth={2} />
        Atualizado {sdKbRelativeTime(article.updatedAt)} ·{' '}
        {article.readingMinutes} min de leitura
      </span>
      {showViews && (
        <span className='inline-flex items-center gap-1'>
          <SteelIcon icon={ViewIcon} size={13} strokeWidth={2} />
          {article.viewCount}{' '}
          {article.viewCount === 1 ? 'visualização' : 'visualizações'}
        </span>
      )}
      {article.reuseCount > 0 && (
        <span className='inline-flex items-center gap-1'>
          <SteelIcon icon={CheckmarkCircle02Icon} size={13} strokeWidth={2} />
          Resolveu {article.reuseCount}{' '}
          {article.reuseCount === 1 ? 'chamado' : 'chamados'}
        </span>
      )}
      {article.category && (
        <span className='inline-flex items-center gap-1'>
          <SteelIcon icon={Folder01Icon} size={13} strokeWidth={2} />
          {article.category.name}
        </span>
      )}
      {article.tags.length > 0 && (
        <span className='inline-flex flex-wrap items-center gap-1'>
          <SteelIcon icon={Tag01Icon} size={13} strokeWidth={2} />
          {article.tags.map((tag) => (
            <Badge key={tag} variant='secondary' className='h-4 px-1.5'>
              {tag}
            </Badge>
          ))}
        </span>
      )}
    </div>
  )
}
