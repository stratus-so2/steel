import { createId } from '@paralleldrive/cuid2'
import type { SdAiConversation } from '@prisma/client'
import type { SdAiCatalog } from '@/src/lib/servicedesk/ai-prompts'
import type { SdKbSearchRow } from '@/src/repositories/sd-kb-article.repository'

/**
 * Fakes do agente de IA do ServiceDesk para os testes unitários (sem banco):
 * conversas (`SdAiConversation`), linhas de busca da base e o catálogo que a
 * IA pode escolher na triagem/pré-atendimento.
 */

const FIXED = new Date('2026-09-21T12:00:00.000Z')

export function createFakeSdAiConversation(
  overrides?: Partial<SdAiConversation>,
): SdAiConversation {
  return {
    id: createId(),
    workspaceId: 'ws1',
    userId: null,
    mode: 'PRE_SERVICE',
    ticketId: null,
    outcome: null,
    messages: [],
    whatsappConversationId: null,
    createdAt: FIXED,
    updatedAt: FIXED,
    ...overrides,
  }
}

export function createFakeSdKbSearchRow(
  overrides?: Partial<SdKbSearchRow>,
): SdKbSearchRow {
  return {
    id: createId(),
    workspaceId: 'ws1',
    parentId: null,
    title: 'Como redefinir a senha da VPN',
    icon: null,
    coverImage: null,
    status: 'PUBLISHED',
    visibility: 'PORTAL',
    categoryId: null,
    tags: [],
    position: 0,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
    publishedAt: FIXED,
    archivedAt: null,
    createdAt: FIXED,
    updatedAt: FIXED,
    plainText: 'Abra o portal, clique em "esqueci a senha" e siga os passos.',
    rank: 1,
    ...overrides,
  }
}

/**
 * Catálogo com um caminho válido `cat > sub > svc`, mais um nó órfão para
 * exercitar a validação do caminho.
 */
export function createFakeSdAiCatalog(
  overrides?: Partial<SdAiCatalog>,
): SdAiCatalog {
  return {
    categories: [
      { id: 'cat', name: 'Acesso', level: 'CATEGORY', parentId: null },
      { id: 'sub', name: 'VPN', level: 'SUBCATEGORY', parentId: 'cat' },
      { id: 'svc', name: 'Reset de senha', level: 'SERVICE', parentId: 'sub' },
      { id: 'orfa', name: 'Órfã', level: 'SUBCATEGORY', parentId: 'outra' },
    ],
    impacts: [{ id: 'imp', name: 'Alto', level: 3 }],
    urgencies: [{ id: 'urg', name: 'Alta', level: 3 }],
    priorities: [{ id: 'pri', name: 'P1', level: 1 }],
    departments: [{ id: 'dep', name: 'Suporte N1' }],
    ...overrides,
  }
}
