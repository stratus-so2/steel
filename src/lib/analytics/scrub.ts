/**
 * Limpa uma mensagem de erro antes de ir para o log/painel (LGPD): tira
 * e-mails, IPs, CPFs/telefones e sequências longas de dígitos, colapsa
 * espaços e trunca. Não é garantia de anonimização — é uma rede de proteção
 * para mensagens que citem dados de entrada.
 */
export const MESSAGE_MAX_LENGTH = 200

export function scrubMessage(
  message: string | null | undefined,
  max: number = MESSAGE_MAX_LENGTH,
): string | null {
  if (!message) return null
  const cleaned = message
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[ip]')
    .replace(/\b(?:[0-9a-f]{1,4})?(?::{1,2}[0-9a-f]{1,4}){3,7}\b/gi, '[ip]')
    .replace(/\d[\d.\-/() ]{5,}\d/g, '[n]')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return null
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned
}
