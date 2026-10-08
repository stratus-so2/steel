import type {
  AiActionKindDTO,
  AiSimulatedActionDTO,
  AiToolPreviewDTO,
} from '@/types/steel-ai'
import type { ToolResultPayload } from './tool-result'

/**
 * Teste mode ("mostra o que faria sem modificar realmente"): every write
 * tool is answered with a simulated success built from its preview. Kept
 * dependency-free so the conversation mapper can read it back from a TOOL
 * row without importing the tool registry.
 */

/** What the model reads after a simulated write. */
export const SIMULATED_NOTE =
  'MODO TESTE: esta escrita foi apenas simulada a partir da prévia — nada foi gravado nem enviado. Continue o plano como se ela tivesse dado certo, mas não invente identificadores de registros novos; ao final, descreva o que faria.'

const KINDS = new Set<string>(['CREATE', 'UPDATE', 'DELETE', 'ACTION'])

/** The TOOL row payload (and model answer) of a simulated write. */
export function simulatedToolResult(
  kind: AiActionKindDTO,
  preview: AiToolPreviewDTO,
): ToolResultPayload {
  return {
    status: 'simulated',
    summary: preview.title,
    data: { simulated: true, kind, preview },
    note: SIMULATED_NOTE,
  }
}

/** The simulated action stored in a `simulated` payload, or null. */
export function readSimulation(
  payload: ToolResultPayload,
): AiSimulatedActionDTO | null {
  if (payload.status !== 'simulated') return null
  const data = payload.data
  if (!data || typeof data !== 'object') return null
  const { kind, preview } = data as { kind?: unknown; preview?: unknown }
  if (typeof kind !== 'string' || !KINDS.has(kind)) return null
  if (
    !preview ||
    typeof preview !== 'object' ||
    typeof (preview as { title?: unknown }).title !== 'string'
  ) {
    return null
  }
  const shaped = preview as AiToolPreviewDTO
  return {
    kind: kind as AiActionKindDTO,
    preview: {
      ...shaped,
      summary: typeof shaped.summary === 'string' ? shaped.summary : '',
    },
  }
}
