import type { SdMeDTO } from '@/types/sd-config'
import type { SdTicketDTO } from '@/types/sd-ticket'

/**
 * Contrato das abas da tela do chamado. Cada aba é um componente
 * `(props: SdTicketTabProps) => ReactNode` em `./<nome>-tab.tsx`; a casca
 * (fatia ticket-ui) monta o registro e o portal do solicitante reusa as abas
 * com `mode: 'requester'` (sem notas internas nem ações de agente).
 */
export interface SdTicketTabProps {
  workspaceId: string
  slug: string
  ticket: SdTicketDTO
  me: SdMeDTO
  mode: 'agent' | 'requester'
}
