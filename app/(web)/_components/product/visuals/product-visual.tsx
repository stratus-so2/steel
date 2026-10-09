import { cn } from '@/lib/utils'
import type {
  ProductTone,
  ProductVisual,
} from '@/src/schemas/web-product-page.schema'
import {
  PRODUCT_TONE_DOT,
  PRODUCT_TONE_SOFT,
  PRODUCT_TONE_TEXT,
} from '../product-tone'

/**
 * Abstract UI compositions drawn with Steel's tokens. They stand in for
 * screenshots on the public product pages: crisp at any width, right in light
 * and dark, and always in sync with the copy because the content config feeds
 * them. Purely decorative — the copy next to each one carries the meaning — so
 * the whole visual is hidden from assistive tech.
 */
export function ProductVisualView({
  visual,
  className,
}: {
  visual: ProductVisual
  className?: string
}) {
  return (
    <div
      aria-hidden
      data-visual={visual.kind}
      className={cn('w-full text-xs select-none', className)}
    >
      <VisualBody visual={visual} />
    </div>
  )
}

function VisualBody({ visual }: { visual: ProductVisual }) {
  switch (visual.kind) {
    case 'fields':
      return <FieldsVisual visual={visual} />
    case 'timeline':
      return <TimelineVisual visual={visual} />
    case 'chart':
      return <ChartVisual visual={visual} />
    case 'list':
      return <ListVisual visual={visual} />
    case 'kanban':
      return <KanbanVisual visual={visual} />
    case 'chat':
      return <ChatVisual visual={visual} />
    case 'meters':
      return <MetersVisual visual={visual} />
    case 'toggles':
      return <TogglesVisual visual={visual} />
    case 'flow':
      return <FlowVisual visual={visual} />
    case 'table':
      return <TableVisual visual={visual} />
    case 'stats':
      return <StatsVisual visual={visual} />
    case 'article':
      return <ArticleVisual visual={visual} />
    case 'form':
      return <FormVisual visual={visual} />
  }
}

type Of<K extends ProductVisual['kind']> = Extract<ProductVisual, { kind: K }>

const panel =
  'rounded-lg border border-border bg-background shadow-sm overflow-hidden'

export function ToneChip({
  label,
  tone,
}: {
  label: string
  tone: ProductTone
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap',
        PRODUCT_TONE_SOFT[tone],
      )}
    >
      {label}
    </span>
  )
}

export function ToneDot({ tone }: { tone: ProductTone }) {
  return (
    <span
      className={cn('size-2 shrink-0 rounded-full', PRODUCT_TONE_DOT[tone])}
    />
  )
}

function FieldsVisual({ visual }: { visual: Of<'fields'> }) {
  return (
    <div className={panel}>
      <div className='space-y-1.5 border-b border-border px-4 py-3'>
        {visual.code && (
          <p className='font-mono text-[11px] text-muted-foreground'>
            {visual.code}
          </p>
        )}
        <p className='text-sm font-medium text-foreground'>{visual.title}</p>
        {visual.chips && (
          <div className='flex flex-wrap gap-1.5'>
            {visual.chips.map((chip) => (
              <ToneChip key={chip.label} {...chip} />
            ))}
          </div>
        )}
      </div>
      <dl className='divide-y divide-border'>
        {visual.rows.map((row) => (
          <div
            key={row.label}
            className='flex items-center justify-between gap-3 px-4 py-2'
          >
            <dt className='text-muted-foreground'>{row.label}</dt>
            <dd
              className={cn(
                'truncate text-right font-medium',
                PRODUCT_TONE_TEXT[row.tone ?? 'neutral'],
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function TimelineVisual({ visual }: { visual: Of<'timeline'> }) {
  return (
    <ol className='relative space-y-3 pl-5'>
      <span className='absolute top-1.5 bottom-1.5 left-[5px] w-px bg-border' />
      {visual.items.map((item) => (
        <li
          key={`${item.time}-${item.action}`}
          className='relative flex items-baseline gap-2'
        >
          <span className='absolute top-1 -left-5 size-[11px] rounded-full border-2 border-background bg-muted-foreground/40' />
          <p className='min-w-0 flex-1 text-foreground'>
            <span className='font-medium'>{item.actor}</span>{' '}
            <span className='text-muted-foreground'>{item.action}</span>
          </p>
          <span className='shrink-0 text-[11px] text-muted-foreground'>
            {item.time}
          </span>
        </li>
      ))}
    </ol>
  )
}

function ChartVisual({ visual }: { visual: Of<'chart'> }) {
  const { points } = visual
  const step = 100 / (points.length - 1)
  const coords = points.map((p, i) => `${(i * step).toFixed(2)},${100 - p}`)
  return (
    <div className={cn(panel, 'p-4')}>
      <div className='mb-3 flex items-center justify-between gap-2'>
        <p className='font-medium text-foreground'>{visual.title}</p>
        {visual.caption && (
          <span className='text-[11px] text-muted-foreground'>
            {visual.caption}
          </span>
        )}
      </div>
      {visual.variant === 'area' ? (
        <svg
          viewBox='0 0 100 100'
          preserveAspectRatio='none'
          className='h-28 w-full overflow-visible'
        >
          {[25, 50, 75].map((y) => (
            <line
              key={y}
              x1='0'
              x2='100'
              y1={y}
              y2={y}
              className='stroke-border'
              strokeWidth='0.5'
              vectorEffect='non-scaling-stroke'
            />
          ))}
          <polygon
            points={`0,100 ${coords.join(' ')} 100,100`}
            className='fill-brand/15'
          />
          <polyline
            points={coords.join(' ')}
            className='fill-none stroke-brand'
            strokeWidth='2'
            vectorEffect='non-scaling-stroke'
          />
        </svg>
      ) : (
        <div className='flex h-28 items-end gap-1.5'>
          {points.map((p, i) => (
            <span
              key={i}
              className='flex-1 rounded-t-sm bg-brand/70'
              style={{ height: `${Math.max(p, 4)}%` }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ListVisual({ visual }: { visual: Of<'list'> }) {
  return (
    <div className={panel}>
      <p className='border-b border-border px-4 py-2.5 font-medium text-foreground'>
        {visual.title}
      </p>
      <ul className='divide-y divide-border'>
        {visual.items.map((item) => (
          <li key={item.label} className='flex items-center gap-2.5 px-4 py-2'>
            <ToneDot tone={item.tone} />
            <span className='min-w-0 flex-1 truncate text-foreground'>
              {item.label}
            </span>
            {item.meta && (
              <span className='shrink-0 text-[11px] text-muted-foreground'>
                {item.meta}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function KanbanVisual({ visual }: { visual: Of<'kanban'> }) {
  return (
    <div className='grid auto-cols-[minmax(7.5rem,1fr)] grid-flow-col gap-2.5 overflow-hidden'>
      {visual.columns.map((column) => (
        <div
          key={column.title}
          className='min-w-0 space-y-2 rounded-lg bg-muted/60 p-2'
        >
          <p className='flex items-center gap-1.5 px-1 font-medium text-foreground'>
            <ToneDot tone={column.tone} />
            <span className='truncate'>{column.title}</span>
            <span className='ml-auto text-muted-foreground'>
              {column.cards.length}
            </span>
          </p>
          {column.cards.map((card) => (
            <div
              key={card.title}
              className='space-y-1 rounded-md border border-border bg-background p-2 shadow-xs'
            >
              <p className='line-clamp-2 text-foreground'>{card.title}</p>
              {card.meta && (
                <p className='truncate text-[11px] text-muted-foreground'>
                  {card.meta}
                </p>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

const CHAT_LABEL = {
  user: 'Você',
  contact: 'Cliente',
  agent: 'Atendente',
  ai: 'Steel AI',
} as const

function ChatVisual({ visual }: { visual: Of<'chat'> }) {
  return (
    <div className='space-y-2.5'>
      {visual.messages.map((message) => {
        const mine = message.from === 'user' || message.from === 'agent'
        return (
          <div
            key={message.text}
            className={cn('flex flex-col gap-1', mine && 'items-end')}
          >
            <span className='px-1 text-[10px] text-muted-foreground'>
              {CHAT_LABEL[message.from]}
            </span>
            <p
              className={cn(
                'max-w-[88%] rounded-xl px-3 py-2 leading-relaxed',
                mine
                  ? 'bg-primary text-primary-foreground'
                  : message.from === 'ai'
                    ? 'border border-brand/30 bg-brand/5 text-foreground'
                    : 'bg-muted text-foreground',
              )}
            >
              {message.text}
            </p>
          </div>
        )
      })}
      {visual.action && (
        <div className={cn(panel, 'space-y-2 p-3')}>
          <p className='font-medium text-foreground'>{visual.action.title}</p>
          <p className='text-muted-foreground'>{visual.action.preview}</p>
          <div className='flex gap-2'>
            <span className='rounded-md bg-primary px-2.5 py-1 font-medium text-primary-foreground'>
              {visual.action.confirm}
            </span>
            <span className='rounded-md border border-border px-2.5 py-1 text-muted-foreground'>
              Cancelar
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function MetersVisual({ visual }: { visual: Of<'meters'> }) {
  return (
    <div className={cn(panel, 'space-y-3 p-4')}>
      <p className='font-medium text-foreground'>{visual.title}</p>
      {visual.items.map((item) => (
        <div key={item.label} className='space-y-1.5'>
          <div className='flex items-center justify-between gap-2'>
            <span className='truncate text-muted-foreground'>{item.label}</span>
            <span
              className={cn(
                'shrink-0 font-medium',
                PRODUCT_TONE_TEXT[item.tone],
              )}
            >
              {item.meta ?? `${item.value}%`}
            </span>
          </div>
          <div className='h-1.5 overflow-hidden rounded-full bg-muted'>
            <div
              className={cn('h-full rounded-full', PRODUCT_TONE_DOT[item.tone])}
              style={{ width: `${item.value}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function TogglesVisual({ visual }: { visual: Of<'toggles'> }) {
  return (
    <div className={panel}>
      <p className='border-b border-border px-4 py-2.5 font-medium text-foreground'>
        {visual.title}
      </p>
      <ul className='divide-y divide-border'>
        {visual.items.map((item) => (
          <li
            key={item.label}
            className='flex items-center justify-between gap-3 px-4 py-2.5'
          >
            <span className='truncate text-foreground'>{item.label}</span>
            <span
              data-on={item.on}
              className={cn(
                'flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors',
                item.on ? 'justify-end bg-brand' : 'justify-start bg-muted',
              )}
            >
              <span className='size-3 rounded-full bg-background shadow-sm' />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FlowVisual({ visual }: { visual: Of<'flow'> }) {
  return (
    <ol className='mx-auto flex max-w-xs flex-col items-stretch'>
      {visual.steps.map((step, index) => (
        <li key={step.label} className='flex flex-col items-center'>
          {index > 0 && <span className='h-4 w-px bg-border' />}
          <div className={cn(panel, 'flex w-full items-center gap-2.5 p-2.5')}>
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold',
                PRODUCT_TONE_SOFT[step.tone],
              )}
            >
              {index + 1}
            </span>
            <div className='min-w-0'>
              <p className='truncate font-medium text-foreground'>
                {step.label}
              </p>
              {step.detail && (
                <p className='truncate text-[11px] text-muted-foreground'>
                  {step.detail}
                </p>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

function TableVisual({ visual }: { visual: Of<'table'> }) {
  return (
    <div className={panel}>
      <table className='w-full table-fixed text-left'>
        <thead className='bg-muted/50 text-muted-foreground'>
          <tr>
            {visual.columns.map((column) => (
              <th key={column} className='truncate px-3 py-2 font-medium'>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className='divide-y divide-border'>
          {visual.rows.map((row) => (
            <tr key={row.join('|')}>
              {row.map((cell, index) => (
                <td key={index} className='truncate px-3 py-2 text-foreground'>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatsVisual({ visual }: { visual: Of<'stats'> }) {
  return (
    <div className='grid grid-cols-2 gap-2.5'>
      {visual.items.map((item) => (
        <div key={item.label} className={cn(panel, 'space-y-1 p-3')}>
          <p className='truncate text-muted-foreground'>{item.label}</p>
          <p className='text-xl font-semibold tracking-tight text-foreground'>
            {item.value}
          </p>
          {item.delta && (
            <p className={cn('font-medium', PRODUCT_TONE_TEXT[item.tone])}>
              {item.delta}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

function ArticleVisual({ visual }: { visual: Of<'article'> }) {
  return (
    <div className={cn(panel, 'space-y-3 p-4')}>
      {visual.tag && <ToneChip label={visual.tag} tone='brand' />}
      <p className='text-sm font-semibold text-foreground'>{visual.title}</p>
      {visual.lines.map((line) => (
        <div key={line} className='space-y-1.5'>
          <p className='font-medium text-foreground'>{line}</p>
          <span className='block h-1.5 w-11/12 rounded-full bg-muted' />
          <span className='block h-1.5 w-2/3 rounded-full bg-muted' />
        </div>
      ))}
      {visual.checklist && (
        <ul className='space-y-1.5'>
          {visual.checklist.map((item) => (
            <li key={item.label} className='flex items-center gap-2'>
              <span
                className={cn(
                  'flex size-3.5 shrink-0 items-center justify-center rounded-sm border',
                  item.done
                    ? 'border-brand bg-brand'
                    : 'border-border bg-background',
                )}
              />
              <span
                className={cn(
                  'text-foreground',
                  item.done && 'text-muted-foreground line-through',
                )}
              >
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormVisual({ visual }: { visual: Of<'form'> }) {
  return (
    <div className={cn(panel, 'space-y-3 p-4')}>
      <p className='text-sm font-semibold text-foreground'>{visual.title}</p>
      {visual.fields.map((field) => (
        <div key={field.label} className='space-y-1'>
          <p className='text-muted-foreground'>{field.label}</p>
          <p className='truncate rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-foreground'>
            {field.value}
          </p>
        </div>
      ))}
      <span className='inline-flex rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground'>
        {visual.button}
      </span>
    </div>
  )
}
