/**
 * Pré-atendimento por IA no portal do solicitante: conversa, sugere artigos
 * e abre o chamado já triado. Provisório — substituído pela fatia
 * whatsapp-ai; renderiza nada enquanto isso.
 */
export function SdPreServiceChat(_props: {
  workspaceId: string
  slug: string
  onTicketCreated?: (ticket: {
    id: string
    number: number
    code: string
  }) => void
}) {
  return null
}
