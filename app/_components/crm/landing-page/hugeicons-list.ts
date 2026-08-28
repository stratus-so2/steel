import type { IconSvgElement } from '@hugeicons/react'
import * as HugeIcons from '@hugeicons-pro/core-stroke-rounded'

function toKebabCase(exportName: string): string {
  return exportName
    .replace(/Icon$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
}

/**
 * Catálogo completo do pacote `@hugeicons-pro/core-stroke-rounded` — cada
 * ícone tem vários aliases exportados (ex. `PlayIcon`/`PlayStrokeRounded`)
 * apontando pro mesmo array de dados; deduplicamos por referência e ficamos
 * com o primeiro nome declarado. Importado sob demanda (só quando o picker
 * abre) pra não inflar o bundle do builder com milhares de ícones.
 */
const seen = new Set<IconSvgElement>()

export const HUGEICONS_ICONS: { name: string; icon: IconSvgElement }[] = []

for (const [exportName, value] of Object.entries(HugeIcons)) {
  const icon = value as IconSvgElement
  if (!Array.isArray(icon) || seen.has(icon)) continue
  seen.add(icon)
  HUGEICONS_ICONS.push({ name: toKebabCase(exportName), icon })
}

export function findHugeicon(name: string) {
  return HUGEICONS_ICONS.find((entry) => entry.name === name)
}
