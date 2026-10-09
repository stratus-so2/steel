import { cn } from '@/lib/utils'
import type { ProductWindow } from '@/src/schemas/web-product-page.schema'
import { ProductVisualView } from './product-visual'

/**
 * A Steel workspace window, drawn: top bar with the workspace and search,
 * module sidebar with the page's screens, the main visual and an optional
 * side panel (the open record). Decorative — hidden from assistive tech.
 */
export function AppWindow({ frame }: { frame: ProductWindow }) {
  return (
    <div
      aria-hidden
      data-testid='app-window'
      className='overflow-hidden rounded-xl border border-border bg-background text-xs shadow-2xl select-none'
    >
      <div className='flex items-center gap-3 border-b border-border px-3 py-2'>
        <span className='flex size-5 items-center justify-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground'>
          S
        </span>
        <span className='font-medium text-foreground'>Acme Serviços</span>
        <span className='mx-auto hidden w-64 rounded-md border border-border bg-muted/40 px-2 py-1 text-muted-foreground sm:block'>
          Buscar… <span className='float-right'>Ctrl K</span>
        </span>
        <span className='ml-auto rounded-md border border-border px-2 py-0.5 text-muted-foreground sm:ml-0'>
          Steel AI
        </span>
      </div>
      <div className='flex min-h-0'>
        <nav className='hidden w-44 shrink-0 space-y-0.5 border-r border-border bg-muted/30 p-2 md:block'>
          <p className='px-2 pt-1 pb-2 font-medium text-foreground'>
            {frame.title}
          </p>
          {frame.nav.map((item, index) => (
            <p
              key={item}
              className={cn(
                'truncate rounded-md px-2 py-1.5',
                index === frame.active
                  ? 'bg-background font-medium text-foreground shadow-xs'
                  : 'text-muted-foreground',
              )}
            >
              {item}
            </p>
          ))}
        </nav>
        <div className='min-w-0 flex-1 p-3 sm:p-4'>
          <p className='mb-3 font-medium text-foreground'>
            {frame.nav[frame.active]}
          </p>
          <ProductVisualView visual={frame.body} />
        </div>
        {frame.aside && (
          <div className='hidden w-72 shrink-0 border-l border-border bg-muted/20 p-4 lg:block'>
            <ProductVisualView visual={frame.aside} />
          </div>
        )}
      </div>
    </div>
  )
}
