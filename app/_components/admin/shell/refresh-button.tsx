'use client'

import { RefreshIcon } from '@hugeicons-pro/core-stroke-rounded'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Recarrega os dados do Server Component da página, sem perder o scroll. */
export function RefreshButton({ label = 'Atualizar' }: { label?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant='outline'
      size='sm'
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <SteelIcon
        icon={RefreshIcon}
        strokeWidth={2}
        className={cn(pending && 'animate-spin')}
      />
      {label}
    </Button>
  )
}
