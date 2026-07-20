'use client'

import { type ReactNode, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

export function MessageScroller({
  children,
  className,
  dependencyKey,
}: {
  children: ReactNode
  className?: string
  dependencyKey?: string | number
}) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [dependencyKey])

  return (
    <div className={cn('flex-1 overflow-y-auto', className)}>
      <div className='flex flex-col gap-2 p-4'>
        {children}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
