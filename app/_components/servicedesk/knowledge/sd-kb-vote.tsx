'use client'

import {
  ThumbsDownIcon,
  ThumbsUpIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import { useVoteSdKbArticle } from '@/src/hooks/use-sd-knowledge'
import type { SdKbVoteDTO } from '@/types/sd-kb-article'
import { sdKbHelpfulRatio } from './sd-kb-utils'

/** "Este artigo ajudou?" — um voto por usuário, com as contagens. */
export function SdKbVote({
  workspaceId,
  articleId,
  helpfulCount,
  notHelpfulCount,
  myVote,
  className,
}: {
  workspaceId: string
  articleId: string
  helpfulCount: number
  notHelpfulCount: number
  myVote: SdKbVoteDTO
  className?: string
}) {
  const vote = useVoteSdKbArticle(workspaceId, articleId)
  const ratio = sdKbHelpfulRatio({ helpfulCount, notHelpfulCount })

  function cast(helpful: boolean) {
    const current = myVote === 'up' ? true : myVote === 'down' ? false : null
    // Clicar de novo no mesmo voto retira o voto.
    vote.mutate(current === helpful ? null : helpful, {
      onSuccess: (result) => {
        if (result.myVote) notify.success('Obrigado pelo retorno!')
      },
      onError: notify.error,
    })
  }

  return (
    <section
      aria-label='Avaliação do artigo'
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3',
        className,
      )}
    >
      <div>
        <p className='font-medium text-sm'>Este artigo ajudou?</p>
        {ratio !== null && (
          <p className='text-muted-foreground text-xs'>
            {ratio}% acharam útil ({helpfulCount + notHelpfulCount}{' '}
            {helpfulCount + notHelpfulCount === 1 ? 'voto' : 'votos'})
          </p>
        )}
      </div>
      <div className='flex gap-2'>
        <Button
          variant={myVote === 'up' ? 'default' : 'outline'}
          size='sm'
          aria-pressed={myVote === 'up'}
          disabled={vote.isPending}
          onClick={() => cast(true)}
        >
          <SteelIcon icon={ThumbsUpIcon} strokeWidth={2} />
          Sim
          <span className='tabular-nums opacity-70'>{helpfulCount}</span>
        </Button>
        <Button
          variant={myVote === 'down' ? 'default' : 'outline'}
          size='sm'
          aria-pressed={myVote === 'down'}
          disabled={vote.isPending}
          onClick={() => cast(false)}
        >
          <SteelIcon icon={ThumbsDownIcon} strokeWidth={2} />
          Não
          <span className='tabular-nums opacity-70'>{notHelpfulCount}</span>
        </Button>
      </div>
    </section>
  )
}
