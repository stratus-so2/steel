import { randomBytes } from 'node:crypto'

/**
 * Storage in-process para servir bytes temporariamente como URL pública. É o
 * que permite o upload de imagem no Instagram (o Graph API exige
 * `image_url` HTTP, não aceita upload direto): o service grava aqui, o
 * Graph baixa, expira-se.
 *
 * Limitação (herdada do original, documentada lá também): vive na memória
 * do processo. Em ambiente multi-instância (várias réplicas), a réplica que
 * recebe o GET pode não ter o blob — para produção multi-réplica seria
 * preciso trocar por um bucket com TTL (o Steel já tem MinIO para outros
 * fluxos). Para single-process (dev/local) basta.
 */

type Entry = {
  bytes: Uint8Array
  contentType: string
  expiresAt: number
}

const STORE_KEY = '__crmSocialBlobStore' as const

type StoreContainer = { entries: Map<string, Entry> }

function getStore(): Map<string, Entry> {
  const globalAny = globalThis as unknown as Record<string, StoreContainer>
  if (!globalAny[STORE_KEY]) {
    globalAny[STORE_KEY] = { entries: new Map() }
  }
  return globalAny[STORE_KEY].entries
}

/** Remove entradas vencidas. Chamado em cada put/take. */
function purgeExpired(): void {
  const store = getStore()
  const now = Date.now()
  for (const [token, entry] of store) {
    if (entry.expiresAt <= now) store.delete(token)
  }
}

/** TTL padrão — janela larga o suficiente para o Graph baixar e publicar. */
const DEFAULT_TTL_MS = 10 * 60_000

/** Grava bytes e devolve um token URL-safe. */
export function putBlob(
  bytes: ArrayBuffer | Uint8Array,
  contentType: string,
  ttlMs: number = DEFAULT_TTL_MS,
): string {
  purgeExpired()
  const token = randomBytes(24).toString('base64url')
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  getStore().set(token, {
    bytes: buf,
    contentType,
    expiresAt: Date.now() + ttlMs,
  })
  return token
}

/** Lê um blob (sem remover — o provedor pode tentar baixar mais de uma vez). */
export function readBlob(token: string): Entry | null {
  purgeExpired()
  return getStore().get(token) ?? null
}

/** Remove explicitamente — útil ao final do publish para liberar memória. */
export function removeBlob(token: string): void {
  getStore().delete(token)
}
