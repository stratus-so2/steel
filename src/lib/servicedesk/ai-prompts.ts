/**
 * Prompts e contexto do agente de IA do ServiceDesk (puro, sem I/O).
 *
 * LGPD: só vai para o provedor o que a tarefa precisa — texto do chamado,
 * mensagens e artigos da base —, com e-mails, telefones e CPF/CNPJ
 * mascarados (`redactSdPii`). Nunca vão documentos/e-mail/telefone de
 * cliente ou contato, nem nomes de pessoas (os autores viram papéis).
 */

export const SD_AI_LOW_CONFIDENCE = 0.4

/** Palavras que sempre pedem humano, além das configuradas no workspace. */
export const SD_AI_DEFAULT_HANDOFF_KEYWORDS = [
  'atendente',
  'humano',
  'abrir chamado',
  'falar com alguém',
]

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g
const CNPJ = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g
const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g
const PHONE = /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2}\)?[\s-]?)?\d{4,5}[\s-]?\d{4}\b/g

/** Mascara dados pessoais diretos (e-mail, CNPJ, CPF, telefone). */
export function redactSdPii(text: string): string {
  return text
    .replace(EMAIL, '[e-mail]')
    .replace(CNPJ, '[documento]')
    .replace(CPF, '[documento]')
    .replace(PHONE, '[telefone]')
}

export function clipSdText(text: string, max: number): string {
  const clean = text.trim()
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/** O solicitante usou uma palavra de transbordo para humano? */
export function sdHandoffRequested(text: string, keywords: string[]): boolean {
  const haystack = normalize(text)
  return [...SD_AI_DEFAULT_HANDOFF_KEYWORDS, ...keywords]
    .map((k) => normalize(k.trim()))
    .filter((k) => k.length > 0)
    .some((k) => haystack.includes(k))
}

export interface SdAiPersonaSettings {
  aiPersona: string | null
  aiInstructions: string | null
}

function personaBlock(settings: SdAiPersonaSettings): string {
  const parts: string[] = []
  if (settings.aiPersona?.trim()) {
    parts.push(`Persona: ${clipSdText(settings.aiPersona, 2000)}`)
  }
  if (settings.aiInstructions?.trim()) {
    parts.push(
      `Instruções do time (siga, sem contrariar as regras acima):\n${clipSdText(settings.aiInstructions, 6000)}`,
    )
  }
  return parts.length > 0 ? `\n\n${parts.join('\n\n')}` : ''
}

const BASE_RULES =
  'Você é o agente de IA do ServiceDesk (central de atendimento de TI, práticas ITIL 4). Responda sempre em português do Brasil, de forma objetiva e cordial. Nunca invente procedimentos, prazos ou políticas: use apenas o contexto fornecido. Dados pessoais aparecem mascarados ([e-mail], [telefone], [documento]); não peça nem repita dados sensíveis.'

/* ------------------------------------------------------------------ */
/* Contexto do chamado                                                  */
/* ------------------------------------------------------------------ */

export type SdAiAuthorRole =
  | 'agente'
  | 'solicitante'
  | 'contato'
  | 'ia'
  | 'sistema'

export interface SdAiTicketContext {
  code: string
  type: string
  title: string
  /** Texto (sem HTML) da descrição. */
  description: string
  phase: string
  priority: string | null
  category: string | null
  department: string | null
  solution: string | null
  messages: {
    role: SdAiAuthorRole
    internal: boolean
    body: string
    at: string
  }[]
}

const TICKET_CHAR_BUDGET = 12_000

export function formatSdTicketContext(ctx: SdAiTicketContext): string {
  const header = [
    `Chamado ${ctx.code} (${ctx.type}) — fase: ${ctx.phase}`,
    `Título: ${redactSdPii(ctx.title)}`,
    ctx.priority ? `Prioridade: ${ctx.priority}` : null,
    ctx.category ? `Catálogo: ${ctx.category}` : null,
    ctx.department ? `Departamento: ${ctx.department}` : null,
    `Descrição:\n${redactSdPii(clipSdText(ctx.description || '(sem descrição)', 4000))}`,
    ctx.solution ? `Solução registrada:\n${redactSdPii(ctx.solution)}` : null,
  ].filter((line): line is string => line !== null)

  let remaining = TICKET_CHAR_BUDGET
  const lines: string[] = []
  // Mais recentes primeiro até o orçamento; depois volta à ordem cronológica.
  for (const m of [...ctx.messages].reverse()) {
    const line = `[${m.at.slice(0, 16).replace('T', ' ')}] ${m.role}${m.internal ? ' (nota interna)' : ''}: ${redactSdPii(clipSdText(m.body, 1500))}`
    if (line.length > remaining) break
    lines.unshift(line)
    remaining -= line.length
  }
  const history =
    lines.length > 0 ? `Histórico:\n${lines.join('\n')}` : 'Histórico: (vazio)'
  return `${header.join('\n')}\n\n${history}`
}

/* ------------------------------------------------------------------ */
/* Base de conhecimento                                                 */
/* ------------------------------------------------------------------ */

export interface SdAiKbArticle {
  id: string
  title: string
  plainText: string
}

const KB_CHAR_BUDGET = 10_000

export function formatSdKbContext(articles: SdAiKbArticle[]): string {
  if (articles.length === 0)
    return 'Base de conhecimento: nenhum artigo relevante encontrado.'
  let remaining = KB_CHAR_BUDGET
  const blocks: string[] = []
  for (const a of articles) {
    if (remaining <= 0) break
    const text = clipSdText(a.plainText, Math.min(remaining, 3000))
    blocks.push(`### [${a.id}] ${a.title}\n${redactSdPii(text)}`)
    remaining -= text.length
  }
  return `Base de conhecimento (artigos publicados; cite pelo id entre colchetes):\n${blocks.join('\n\n')}`
}

/* ------------------------------------------------------------------ */
/* Catálogo (triagem)                                                   */
/* ------------------------------------------------------------------ */

export interface SdAiCatalog {
  categories: {
    id: string
    name: string
    level: 'CATEGORY' | 'SUBCATEGORY' | 'SERVICE'
    parentId: string | null
  }[]
  impacts: { id: string; name: string; level: number }[]
  urgencies: { id: string; name: string; level: number }[]
  priorities: { id: string; name: string; level: number }[]
  departments: { id: string; name: string }[]
}

export function formatSdCatalog(catalog: SdAiCatalog): string {
  const list = (title: string, rows: string[]) =>
    `${title}:\n${rows.length > 0 ? rows.join('\n') : '(nenhum)'}`
  return [
    list(
      'Catálogo (id | nível | pai | nome)',
      catalog.categories.map(
        (c) => `${c.id} | ${c.level} | ${c.parentId ?? '-'} | ${c.name}`,
      ),
    ),
    list(
      'Impactos (id | nível | nome)',
      catalog.impacts.map((i) => `${i.id} | ${i.level} | ${i.name}`),
    ),
    list(
      'Urgências (id | nível | nome)',
      catalog.urgencies.map((u) => `${u.id} | ${u.level} | ${u.name}`),
    ),
    list(
      'Prioridades (id | peso | nome)',
      catalog.priorities.map((p) => `${p.id} | ${p.level} | ${p.name}`),
    ),
    list(
      'Departamentos (id | nome)',
      catalog.departments.map((d) => `${d.id} | ${d.name}`),
    ),
  ].join('\n\n')
}

/* ------------------------------------------------------------------ */
/* System prompts                                                       */
/* ------------------------------------------------------------------ */

export type SdCopilotTask = 'summary' | 'reply' | 'solution' | 'chat'

const COPILOT_TASKS: Record<SdCopilotTask, string> = {
  summary:
    'Tarefa: resuma o chamado para um agente que vai assumi-lo — problema, impacto, o que já foi feito e o próximo passo. Até 6 linhas, em tópicos curtos. Responda só com o resumo.',
  reply:
    'Tarefa: escreva a próxima resposta PÚBLICA do agente ao solicitante, pronta para enviar (sem saudação genérica longa, sem assinatura, sem citar notas internas). Use a base de conhecimento quando ajudar. Responda só com o texto da mensagem.',
  solution:
    'Tarefa: redija o registro da solução do chamado (causa, o que foi feito, como validar), em texto corrido curto, para o campo "Solução". Responda só com o texto.',
  chat: 'Tarefa: ajude o agente com perguntas sobre este chamado. Seja direto; quando sugerir passos técnicos, numere-os.',
}

export function buildSdCopilotSystem(
  task: SdCopilotTask,
  settings: SdAiPersonaSettings,
  context: { ticket: string; kb: string },
): string {
  return `${BASE_RULES}\nVocê está auxiliando um AGENTE (copiloto).${personaBlock(settings)}\n\n${COPILOT_TASKS[task]}\n\n${context.ticket}\n\n${context.kb}`
}

export function buildSdTriageSystem(catalog: SdAiCatalog): string {
  return `${BASE_RULES}\nTarefa: faça a triagem do chamado. Escolha SOMENTE ids que existem nas listas abaixo (ou null quando nenhum servir): categoria > subcategoria > serviço devem formar um caminho (o pai da subcategoria é a categoria; o do serviço, a subcategoria). Estime impacto e urgência pelos níveis (maior = mais), a prioridade correspondente, o departamento que deve atender e até 5 tags curtas em minúsculas. "confidence" de 0 a 1. "reasoning": uma frase.\n\n${formatSdCatalog(catalog)}`
}

export interface SdPreServicePromptInput extends SdAiPersonaSettings {
  channel: 'portal' | 'whatsapp'
  /** Tipos que o solicitante pode abrir. */
  ticketTypes: string[]
  catalog: Pick<SdAiCatalog, 'categories' | 'urgencies'>
  kb: string
  /** Resposta automática num chamado já aberto (não abre outro). */
  ticketOpen?: { code: string; title: string } | null
}

export function buildSdPreServiceSystem(
  input: SdPreServicePromptInput,
): string {
  const channel =
    input.channel === 'whatsapp'
      ? 'Canal: WhatsApp — mensagens curtas, sem markdown (use *negrito* do WhatsApp com moderação), no máximo 3 parágrafos.'
      : 'Canal: portal do solicitante — mensagens curtas em markdown simples.'
  const goal = input.ticketOpen
    ? `O solicitante já tem o chamado ${input.ticketOpen.code} ("${redactSdPii(input.ticketOpen.title)}") aberto e ainda sem atendente. Ajude com a base de conhecimento enquanto aguarda; não prometa prazos. Use action "open_ticket" apenas se ele pedir para falar com uma pessoa (o time será avisado) e "resolved" se ele disser que resolveu.`
    : `Objetivo: resolver com a base de conhecimento. Faça no máximo uma pergunta por vez para entender o problema. Quando um artigo resolver, explique os passos e cite-o em "articleIds" (action "answer"). Se o solicitante confirmar que resolveu, use "resolved". Se faltar informação, "collect_info". Use "open_ticket" quando: ele pedir um atendente/abrir chamado, não houver artigo que resolva, for algo que exige ação do time (acesso, compra, instalação, falha geral) ou você não tiver certeza. Sempre preencha "ticket" com o melhor rascunho até agora (título curto e objetivo; descrição com o que foi relatado e já tentado; tipo entre ${input.ticketTypes.join(', ')}; categoria/subcategoria/serviço/urgência só com ids das listas abaixo ou null).`
  const catalog = input.ticketOpen
    ? ''
    : `\n\nCatálogo (id | nível | pai | nome):\n${input.catalog.categories.map((c) => `${c.id} | ${c.level} | ${c.parentId ?? '-'} | ${c.name}`).join('\n') || '(nenhum)'}\n\nUrgências (id | nível | nome):\n${input.catalog.urgencies.map((u) => `${u.id} | ${u.level} | ${u.name}`).join('\n') || '(nenhuma)'}`
  return `${BASE_RULES}\nVocê está atendendo um SOLICITANTE (pré-atendimento).${personaBlock(input)}\n${channel}\n${goal}\n"confidence" (0 a 1) = quão certo você está de que a resposta resolve.${catalog}\n\n${input.kb}`
}

/** Transcrição do pré-atendimento (1ª mensagem do chamado aberto). */
export function sdAiTranscript(
  messages: { role: 'user' | 'assistant'; content: string }[],
): string {
  return messages
    .map(
      (m) =>
        `${m.role === 'user' ? 'Solicitante' : 'Assistente'}: ${m.content.trim()}`,
    )
    .join('\n\n')
}

/** Termos de busca na base a partir do que o solicitante escreveu. */
export function sdAiSearchTerms(texts: string[], max = 8): string[] {
  const stop = new Set([
    'para',
    'com',
    'que',
    'não',
    'nao',
    'uma',
    'meu',
    'minha',
    'está',
    'esta',
    'estou',
    'como',
    'por',
    'favor',
    'olá',
    'ola',
    'bom',
    'boa',
    'dia',
    'tarde',
    'noite',
    'preciso',
    'ajuda',
  ])
  const words = texts
    .join(' ')
    .toLowerCase()
    .match(/[\p{L}\p{N}]{3,}/gu)
  if (!words) return []
  const seen = new Set<string>()
  const out: string[] = []
  // Mais recentes primeiro: o último relato costuma ser o mais específico.
  for (const word of words.reverse()) {
    if (stop.has(word) || seen.has(word)) continue
    seen.add(word)
    out.push(word)
    if (out.length >= max) break
  }
  return out
}
