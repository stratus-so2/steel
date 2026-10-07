'use client'

import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { useInboxAiPending } from '@/src/hooks/use-notifications'
import { NotificationAiPendingCard } from './notification-ai-pending-card'

/** Clock shared by every countdown of the panel (ticks every 15 s). */
function useNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}

/**
 * "Pendências da IA" view of the inbox: what the Steel AI is waiting on the
 * user for, most urgent first, decided right here.
 */
export function NotificationAiPendingPanel({
  workspaceId,
  slug,
}: {
  workspaceId: string
  slug: string
}) {
  const pending = useInboxAiPending(workspaceId)
  const now = useNow()
  const items = pending.data?.items ?? []

  if (pending.isLoading) {
    return (
      <div className='space-y-3 p-4' aria-busy='true'>
        {[0, 1].map((row) => (
          <Skeleton key={row} className='h-32 w-full rounded-xl' />
        ))}
      </div>
    )
  }

  if (pending.isError) {
    return (
      <p className='px-6 py-10 text-center text-destructive text-sm'>
        Não foi possível carregar as pendências da IA.
      </p>
    )
  }

  if (items.length === 0) {
    return (
      <p className='px-6 py-10 text-center text-muted-foreground text-sm'>
        Nenhuma pendência da IA. Quando o Steel AI (modo Build) ou um agente
        propuser uma alteração, ela aparece aqui para você decidir.
      </p>
    )
  }

  return (
    <section
      aria-label='Pendências da IA'
      className='mx-auto w-full max-w-3xl space-y-3 p-4'
    >
      {items.map((item) => (
        <NotificationAiPendingCard
          key={item.action.id}
          workspaceId={workspaceId}
          slug={slug}
          item={item}
          now={now}
        />
      ))}
    </section>
  )
}
