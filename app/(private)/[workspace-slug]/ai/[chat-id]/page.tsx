import type { Metadata } from 'next'
import { SteelAiChat } from '@/app/_components/steel-ai/steel-ai-chat'

export const metadata: Metadata = {
  title: 'Conversa | Steel AI | Steel',
  description: 'Conversa com o Steel AI.',
}

export default async function AiChatPage({
  params,
}: {
  params: Promise<{ 'chat-id': string }>
}) {
  const { 'chat-id': chatId } = await params
  // Keyed so switching conversations resets the stream and the handoff.
  return <SteelAiChat key={chatId} conversationId={chatId} />
}
