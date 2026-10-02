import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export function HeaderBreadcrumbCrumb({
  children,
  title,
}: {
  children: React.ReactNode
  title: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <li className='gap-1.5 inline-flex min-w-0 items-center font-semibold text-xs'>
            {children} <span className='truncate'>{title}</span>
          </li>
        }
      />
      <TooltipContent
        side={'bottom'}
        className='cursor-pointer! hover:cursor-pointer!'
      >
        {title}
      </TooltipContent>
    </Tooltip>
  )
}
