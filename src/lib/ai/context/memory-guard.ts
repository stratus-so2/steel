/**
 * What Steel AI may keep in memory. Memories are short facts that go into
 * every system prompt, so they must never carry credentials or personal
 * data the LGPD treats as sensitive (art. 5º, II). The guard runs for both
 * the model's `memory_save` and the manual "Adicionar" in the Memória tab.
 * It is a heuristic: it errs on the side of refusing.
 */

/** A memory is a short fact, not a document. */
export const MEMORY_MAX_CHARS = 500

/** Jaccard similarity from which two facts count as the same one. */
export const MEMORY_DUPLICATE_THRESHOLD = 0.85

export const MEMORY_GUARD_MESSAGES = {
  credential:
    'Não guardo senhas, tokens, chaves de API ou outras credenciais na memória.',
  document:
    'Não guardo números de cartão nem documentos pessoais (como CPF) na memória.',
  sensitive:
    'Não guardo dados pessoais sensíveis (saúde, religião, orientação sexual, origem racial ou étnica, opinião política, filiação sindical, biometria ou dados genéticos) na memória.',
} as const

/** Lowercase, no accents, punctuation as spaces, single spaces. */
export function normalizeMemoryText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokens(text: string): Set<string> {
  return new Set(normalizeMemoryText(text).split(' ').filter(Boolean))
}

/** Jaccard similarity of the word sets (1 = same words). */
export function memorySimilarity(a: string, b: string): number {
  const left = tokens(a)
  const right = tokens(b)
  if (left.size === 0 && right.size === 0) return 1
  let shared = 0
  for (const word of left) if (right.has(word)) shared++
  return shared / (left.size + right.size - shared)
}

export function isNearDuplicateMemory(a: string, b: string): boolean {
  return (
    normalizeMemoryText(a) === normalizeMemoryText(b) ||
    memorySimilarity(a, b) >= MEMORY_DUPLICATE_THRESHOLD
  )
}

const CREDENTIAL_WORDS =
  /\b(senhas?|password|passwd|api ?key|chaves? (de )?(api|acesso)|secret|segredo|client secret|access token|token de acesso|refresh token|bearer|private key|chave privada|pin do cartao|codigo de seguranca|cvv)\b/

const SECRET_SHAPES: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(sk|pk|rk)[-_](live|test|proj)?[-_]?[A-Za-z0-9_-]{16,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/,
  /\beyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}/,
]

/** A long run of letters and digits mixed together looks like a key. */
function hasOpaqueToken(text: string): boolean {
  for (const word of text.split(/[\s"'`,;()<>[\]{}]+/)) {
    if (
      word.length >= 32 &&
      /^[A-Za-z0-9+/=_.-]+$/.test(word) &&
      /[0-9]/.test(word) &&
      /[A-Za-z]/.test(word) &&
      !/^https?:/i.test(word)
    ) {
      return true
    }
  }
  return false
}

function passesLuhn(digits: string): boolean {
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i])
    if (double) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    double = !double
  }
  return sum % 10 === 0
}

function hasCardNumber(text: string): boolean {
  for (const match of text.matchAll(/\b\d(?:[ -]?\d){12,18}\b/g)) {
    // The pattern already bounds it to 13–19 digits.
    if (passesLuhn(match[0].replace(/\D/g, ''))) return true
  }
  return false
}

const CPF = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\bcpf\b[^0-9]{0,12}\d{11}\b/

const SENSITIVE_WORDS =
  /\b(doencas?|diagnostic\w*|cid ?\d+|hiv|cancer|gravid\w*|pessoa com deficiencia|tratamento medico|laudo medico|psiquiatr\w*|depressao|religi\w*|orientacao sexual|homossexual|bissexual|transgener\w*|vida sexual|origem racial|origem etnica|raca|etnia|sindicalizad\w*|filiacao (partidaria|sindical)|filiad\w* ao? (partido|sindicato)|partido politico|opiniao politica|biometri\w*|dados? geneticos?|teste genetico)\b/

/**
 * Why `content` cannot be stored (pt-BR, shown to the user and returned to
 * the model), or null when it may be.
 */
export function memoryGuardProblem(content: string): string | null {
  const normalized = normalizeMemoryText(content)
  if (
    CREDENTIAL_WORDS.test(normalized) ||
    SECRET_SHAPES.some((shape) => shape.test(content)) ||
    hasOpaqueToken(content)
  ) {
    return MEMORY_GUARD_MESSAGES.credential
  }
  if (hasCardNumber(content) || CPF.test(content.toLowerCase())) {
    return MEMORY_GUARD_MESSAGES.document
  }
  if (SENSITIVE_WORDS.test(normalized)) return MEMORY_GUARD_MESSAGES.sensitive
  return null
}
