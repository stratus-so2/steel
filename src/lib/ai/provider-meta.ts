/**
 * Rótulos curtos dos provedores de IA para o seletor no chat. Client-safe: não
 * importa nada do servidor (sem `process.env`), então pode ir num componente
 * client. A lista de provedores *disponíveis* vem do servidor por props.
 */

export type AiProviderId = 'openai' | 'anthropic'

export const AI_PROVIDER_META: Record<
  AiProviderId,
  { label: string; short: string }
> = {
  openai: { label: 'ChatGPT', short: 'GPT' },
  anthropic: { label: 'Claude', short: 'Claude' },
}
