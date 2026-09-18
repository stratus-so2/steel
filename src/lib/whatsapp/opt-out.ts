/**
 * Descadastro LGPD de transmissões do WhatsApp por palavra-chave.
 *
 * Só a mensagem inteira conta (ignorando caixa, acentos, espaços e pontuação
 * nas pontas): "Sair", " parar! ", "STOP" descadastram; "quero sair do grupo"
 * não — evita descadastrar alguém que só usou a palavra numa frase.
 */
export const WHATSAPP_OPT_OUT_KEYWORDS = [
  'SAIR',
  'PARAR',
  'STOP',
  'CANCELAR',
  'DESCADASTRAR',
] as const

export const WHATSAPP_OPT_OUT_CONFIRMATION =
  'Pronto! Você não receberá mais nossas mensagens de transmissão. ' +
  'Se mudar de ideia, é só nos pedir por aqui para voltar a receber.'

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gu, '')
}

export function isWhatsAppOptOutKeyword(text: string | null | undefined) {
  if (!text) return false
  const normalized = normalize(text)
  return (WHATSAPP_OPT_OUT_KEYWORDS as readonly string[]).includes(normalized)
}
