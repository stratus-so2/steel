'use client'

import type { ComponentStatus } from '@prisma/client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { STATUS_META } from '@/src/services/status/status-map'

/**
 * Live system status in the footer: reads the public `/api/status` snapshot
 * once on mount and shows a coloured dot plus the overall state, linking to
 * `/status`. Until the answer arrives (or when it fails) it stays a neutral
 * "Status dos sistemas" link, so it never claims more than it knows.
 */
export function FooterStatus() {
  const [status, setStatus] = useState<ComponentStatus | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/status', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { data?: { overallStatus?: ComponentStatus } } | null) => {
        const overall = body?.data?.overallStatus
        if (overall && overall in STATUS_META) setStatus(overall)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [])

  const label =
    status === null
      ? 'Status dos sistemas'
      : status === 'OPERATIONAL'
        ? 'Todos os sistemas operacionais'
        : STATUS_META[status].label

  return (
    <Link
      href='/status'
      className='inline-flex self-start md:self-auto items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-primary hover:bg-muted'
    >
      <span
        aria-hidden
        data-testid='footer-status-dot'
        className={cn(
          'size-2 rounded-full',
          status ? STATUS_META[status].bar : 'bg-muted-foreground',
        )}
      />
      {label}
    </Link>
  )
}
