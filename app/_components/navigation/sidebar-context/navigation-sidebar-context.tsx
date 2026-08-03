import type { ReactNode } from 'react'

export function ContextSidebar({ children }: { children: ReactNode }) {
  return (
    <aside className='flex h-full w-62.5 flex-col border-r border-border p-3'>
      <div className='flex-1 space-y-4 overflow-y-auto'>{children}</div>
    </aside>
  )
}
