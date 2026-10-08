import { cn } from '@/lib/utils'

/**
 * Workspace logo (Ajustes > Geral) or, without one, its initial. `className`
 * sets the size/shape for both; `fallbackClassName` styles the initial.
 */
export function WorkspaceAvatar({
  name,
  logoUrl,
  className,
  fallbackClassName = 'bg-primary text-primary-foreground',
}: {
  name: string
  logoUrl: string | null | undefined
  className?: string
  fallbackClassName?: string
}) {
  if (logoUrl) {
    // Plain <img>: public MinIO URL, no next/image loader configured for it.
    return (
      <img
        src={logoUrl}
        alt={`Logo de ${name}`}
        className={cn('shrink-0 object-cover', className)}
      />
    )
  }
  return (
    <div
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center font-semibold',
        fallbackClassName,
        className,
      )}
    >
      {(name.trim().charAt(0) || '?').toUpperCase()}
    </div>
  )
}
