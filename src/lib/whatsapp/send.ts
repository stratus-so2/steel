import 'server-only'
import type { WhatsAppConnection } from '@prisma/client'
import { whatsappProviderError } from '@/src/errors'
import { decryptConnectionSecret } from '@/src/lib/crypto'
import { consume, whatsappSendLimiter } from '@/src/lib/rate-limit'
import { err, ok, type Result } from '@/src/lib/result'
import { createMetaClient } from './meta-client'
import type {
  WhatsAppOutboundMedia,
  WhatsAppOutboundTemplate,
  WhatsAppOutboundText,
  WhatsAppProviderClient,
  WhatsAppSendResult,
} from './types'
import { createZapiClient } from './zapi-client'

async function resolveClient(
  connection: WhatsAppConnection,
): Promise<WhatsAppProviderClient> {
  if (connection.provider === 'ZAPI') {
    if (!connection.zapiInstanceId || !connection.encryptedZapiToken) {
      throw new Error('Conexão Z-API sem credenciais configuradas')
    }
    const token = await decryptConnectionSecret(connection.encryptedZapiToken)
    const clientToken = connection.encryptedZapiClientToken
      ? await decryptConnectionSecret(connection.encryptedZapiClientToken)
      : undefined
    return createZapiClient({
      instanceId: connection.zapiInstanceId,
      token,
      clientToken,
    })
  }

  if (
    !connection.metaPhoneNumberId ||
    !connection.metaWabaId ||
    !connection.encryptedMetaAccessToken
  ) {
    throw new Error('Conexão Meta sem credenciais configuradas')
  }
  const accessToken = await decryptConnectionSecret(
    connection.encryptedMetaAccessToken,
  )
  return createMetaClient({
    phoneNumberId: connection.metaPhoneNumberId,
    wabaId: connection.metaWabaId,
    accessToken,
  })
}

async function withProvider<T>(
  connection: WhatsAppConnection,
  op: (client: WhatsAppProviderClient) => Promise<T>,
): Promise<Result<T>> {
  const limit = await consume(whatsappSendLimiter, connection.id)
  if (!limit.ok) return limit

  try {
    const client = await resolveClient(connection)
    const result = await op(client)
    return ok(result)
  } catch (error) {
    return err(
      whatsappProviderError(
        error instanceof Error ? error.message : 'Falha ao enviar mensagem',
      ),
    )
  }
}

export const WhatsAppSend = {
  text(
    connection: WhatsAppConnection,
    input: WhatsAppOutboundText,
  ): Promise<Result<WhatsAppSendResult>> {
    return withProvider(connection, (client) => client.sendText(input))
  },

  media(
    connection: WhatsAppConnection,
    input: WhatsAppOutboundMedia,
  ): Promise<Result<WhatsAppSendResult>> {
    return withProvider(connection, (client) => client.sendMedia(input))
  },

  template(
    connection: WhatsAppConnection,
    input: WhatsAppOutboundTemplate,
  ): Promise<Result<WhatsAppSendResult>> {
    return withProvider(connection, (client) => client.sendTemplate(input))
  },
}
