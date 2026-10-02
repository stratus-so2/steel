/**
 * KCS (Knowledge-Centered Service) — parte pura: o formato do artigo
 * (Problema / Ambiente / Causa / Solução / Validação), o esqueleto que o
 * agente recebe quando não há IA, o prompt do rascunho e a aritmética da
 * validade da revisão. Sem I/O: tudo aqui é testável sem banco nem provedor.
 */

export interface SdKcsSection {
  key: 'problem' | 'environment' | 'cause' | 'solution' | 'validation'
  heading: string
  /** Texto-guia do esqueleto vazio (vira o parágrafo inicial). */
  hint: string
}

export const SD_KCS_SECTIONS: SdKcsSection[] = [
  {
    key: 'problem',
    heading: 'Problema',
    hint: 'O que o cliente relatou, com a mensagem de erro exata.',
  },
  {
    key: 'environment',
    heading: 'Ambiente',
    hint: 'Onde acontece: sistema, versão, equipamento, rede.',
  },
  {
    key: 'cause',
    heading: 'Causa',
    hint: 'Por que acontece (causa raiz ou provável).',
  },
  {
    key: 'solution',
    heading: 'Solução',
    hint: 'Passo a passo do que resolve, na ordem.',
  },
  {
    key: 'validation',
    heading: 'Validação',
    hint: 'Como confirmar que resolveu.',
  },
]

export type SdKcsSectionKey = SdKcsSection['key']

/** Bloco Plate mínimo (o editor da KB aceita `p`, `h2` e `li`). */
type Block = { type: string; children: { text: string }[] }

function heading(text: string): Block {
  return { type: 'h2', children: [{ text }] }
}

function paragraph(text: string): Block {
  return { type: 'p', children: [{ text }] }
}

/** Esqueleto KCS: um título por seção, com a dica de preenchimento. */
export function sdKcsSkeleton(): Block[] {
  return SD_KCS_SECTIONS.flatMap((section) => [
    heading(section.heading),
    paragraph(section.hint),
  ])
}

export type SdKcsDraftSections = Partial<Record<SdKcsSectionKey, string[]>>

/**
 * Conteúdo do artigo a partir das seções escritas pela IA. Seção sem texto
 * cai na dica do esqueleto — o autor sempre vê as cinco seções e edita
 * antes de publicar.
 */
export function sdKcsContent(sections: SdKcsDraftSections): Block[] {
  return SD_KCS_SECTIONS.flatMap((section) => {
    const lines = (sections[section.key] ?? [])
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
    const body = lines.length > 0 ? lines : [section.hint]
    return [heading(section.heading), ...body.map(paragraph)]
  })
}

/** Título sugerido: o do chamado, limpo do código e do ruído de assunto. */
export function sdKcsTitleFromTicket(title: string): string {
  const clean = title
    .replace(/^\s*(?:re|res|enc|fwd|encaminhando)\s*:\s*/gi, '')
    .replace(/^\s*\[[^\]]{1,30}\]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return clean.slice(0, 255)
}

/* ------------------------------------------------------------------ */
/* Prompt do rascunho                                                   */
/* ------------------------------------------------------------------ */

const SECTION_GUIDE = SD_KCS_SECTIONS.map(
  (s) => `- ${s.key} (${s.heading}): ${s.hint}`,
).join('\n')

/**
 * System prompt do rascunho KCS. ADR 0006: o contexto é só o texto do
 * chamado (o service já mascara e-mail/telefone/documento) e o prompt proíbe
 * explicitamente reproduzir dado pessoal no artigo.
 */
export function buildSdKcsDraftSystem(context: { ticket: string }): string {
  return [
    'Você escreve artigos da base de conhecimento de um ServiceDesk ITIL, em português do Brasil.',
    'Formato KCS: cada seção é uma lista de parágrafos curtos, na voz do atendimento, sem saudação, sem assinatura e sem prometer prazo.',
    SECTION_GUIDE,
    'Regras: escreva só o que o chamado sustenta (nunca invente versão, causa ou comando); a seção "solution" é um passo por item, em ordem; não copie nome de pessoa, e-mail, telefone, documento, endereço nem nome de empresa para o artigo — o artigo é genérico e serve para o próximo chamado parecido.',
    'Responda apenas com o JSON do schema.',
    '',
    context.ticket,
  ].join('\n')
}

/* ------------------------------------------------------------------ */
/* Validade da revisão                                                  */
/* ------------------------------------------------------------------ */

const DAY_MS = 24 * 60 * 60 * 1000

/** Validade efetiva: a do artigo, ou o padrão do workspace. */
export function sdKcsEffectiveInterval(
  articleDays: number | null | undefined,
  workspaceDays: number,
): number {
  return articleDays && articleDays > 0 ? articleDays : workspaceDays
}

/** Quando a próxima revisão cai (`null` quando não há validade). */
export function sdKcsReviewDueAt(
  from: Date,
  days: number | null | undefined,
): Date | null {
  if (!days || days <= 0) return null
  return new Date(from.getTime() + days * DAY_MS)
}

/** Revisão vencida: tem prazo e ele já passou. */
export function sdKcsReviewOverdue(
  dueAt: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!dueAt) return false
  const due = dueAt instanceof Date ? dueAt : new Date(dueAt)
  if (Number.isNaN(due.getTime())) return false
  return due.getTime() <= now.getTime()
}

/** Dias que faltam (negativo quando venceu); `null` sem validade. */
export function sdKcsDaysUntilReview(
  dueAt: Date | string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!dueAt) return null
  const due = dueAt instanceof Date ? dueAt : new Date(dueAt)
  if (Number.isNaN(due.getTime())) return null
  return Math.ceil((due.getTime() - now.getTime()) / DAY_MS)
}

/** Frase do aviso de revisão vencida (in-app e e-mail). */
export function sdKcsReviewDueBody(count: number): string {
  return count === 1
    ? '1 artigo que você mantém está com a revisão vencida.'
    : `${count} artigos que você mantém estão com a revisão vencida.`
}
