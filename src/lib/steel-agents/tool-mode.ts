import type { AiToolKind } from '@/src/lib/ai/tools/types'

export type SteelAgentToolMode = 'AUTO' | 'APPROVAL'

/**
 * How a configured tool really runs. Owner decision (2026-10-06): DELETE
 * tools always require approval, whatever was saved; READ tools never need
 * one (the mode only matters for writes).
 */
export function effectiveToolMode(
  kind: AiToolKind | undefined,
  mode: SteelAgentToolMode,
): SteelAgentToolMode {
  if (kind === 'DELETE') return 'APPROVAL'
  return mode
}
