import { SteelIcon } from '@/components/icon/icon'
import { findHugeicon } from './hugeicons-list'

type SectionIconProps = {
  /** Formato composto `"<hugeicon-name>:<hex-color>"`, salvo pelo picker. */
  value?: string
  fallback?: React.ReactNode
  size?: number
}

/**
 * Renderiza de volta um ícone salvo pelo `HugeiconPicker` — espelha
 * `ProjectEmoji` (mesmo formato `nome:cor`, mesma lógica de split).
 */
export function SectionIcon({
  value,
  fallback = null,
  size = 20,
}: SectionIconProps) {
  if (!value) return fallback

  const [name, color] = value.includes(':') ? value.split(':', 2) : [value]
  const entry = name ? findHugeicon(name) : undefined
  if (!entry) return fallback

  return (
    <SteelIcon icon={entry.icon} size={size} color={color} strokeWidth={2} />
  )
}
