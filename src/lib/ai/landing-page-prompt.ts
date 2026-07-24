import 'server-only'
import type { ToolDef } from '@/src/lib/ai/client'

/**
 * Prompt do construtor de landing pages com IA (estilo Lovable/v0).
 *
 * O modelo SEMPRE devolve um documento HTML completo e autocontido — nunca um
 * diff nem um fragmento. Tailwind entra via CDN, então não há etapa de build.
 * Botões/links de conversão são marcados com `data-cta` para que a página
 * pública consiga contabilizar cliques de CTA nas métricas.
 *
 * A entrega é feita via tool-calling: o modelo chama `render_landing_page` com
 * o documento final e um resumo curto. Isso separa de forma confiável o HTML
 * (no argumento `html`) de qualquer texto conversacional.
 */

/**
 * Background/design system — o "DNA visual" que prime o modelo a produzir
 * páginas modernas e bonitas, não genéricas. É a maior alavanca de qualidade.
 */
const DESIGN_SYSTEM = `PADRÃO DE QUALIDADE VISUAL (siga rigorosamente — o objetivo é uma página que pareça feita por um estúdio de design premium, não um template genérico):

Direção de arte
- Estética moderna, limpa e com personalidade. Inspire-se em Linear, Stripe, Vercel, Framer e Apple. Nada de cara de "template Bootstrap 2015".
- Defina uma identidade: escolha UMA cor de marca vibrante (+ uma de apoio) coerente com o segmento e use-a com intenção. O resto é uma escala de neutros bem calibrada.
- Crie profundidade com gradientes sutis, glows suaves, bordas de baixo contraste (border-white/10 em dark, border-black/5 em light) e sombras suaves em camadas — nunca sombras pesadas e duras.

Layout e ritmo
- Mobile-first e impecável em todos os breakpoints. Use container central com max-w-6xl/7xl e padding lateral generoso.
- Respiro é luxo: seções com py-20 a py-32, espaçamento vertical consistente, agrupamento claro. Não aperte os elementos.
- Hierarquia tipográfica forte: títulos grandes e com peso (text-5xl/6xl, font-bold, tracking-tight), subtítulos em text-lg text-balance, corpo legível (text-base/lg, leading-relaxed). Use text-balance/pretty nos títulos e parágrafos.
- Hero impactante: headline clara de valor, subheadline, 1–2 CTAs, e um elemento visual (mockup com gradiente, grid de cards, ou composição de SVG) — nunca um hero "vazio" só com texto centralizado.

Componentes e acabamento
- Cards com cantos arredondados generosos (rounded-2xl/3xl), padding interno confortável, hover states e transições suaves (transition, duration-300).
- Botões com peso visual: primário preenchido com a cor de marca, secundário outline/ghost; estados :hover e :focus-visible visíveis; nada de azul padrão de browser.
- Use ícones SVG inline (traçado consistente, ~20–24px) para reforçar features — nunca emojis como ícones de UI.
- Detalhes que elevam: badges/eyebrow acima do título de seção, divisores sutis, números/estatísticas de destaque, faixas de logos ("confiado por"), depoimentos com avatar (use placehold.co), FAQ em accordion estático.

Cor e contraste
- Escolha modo claro OU escuro com intenção (dark elegante costuma impressionar para tech/SaaS). Garanta contraste AA.
- Gradientes de marca em backgrounds de seção, textos de destaque (bg-clip-text text-transparent) e bordas — com parcimônia e bom gosto.

PROIBIDO (sinais de página feia):
- Tudo centralizado e sem hierarquia; paredes de texto; seções sem respiro.
- Azul-padrão de link, cinza sem graça em tudo, sombras pretas duras.
- Emojis substituindo ícones; placeholders cinza enormes; Lorem ipsum (escreva copy real e persuasiva em pt-BR).`

const RULES = `Você é um designer e engenheiro front-end de elite, especialista em landing pages de alta conversão e visualmente impressionantes. Gere a página como UM ÚNICO documento HTML completo e autocontido, em português do Brasil (salvo pedido contrário).

${DESIGN_SYSTEM}

REGRAS TÉCNICAS OBRIGATÓRIAS:
- Documento começa em \`<!DOCTYPE html>\` e termina em \`</html>\`, com <head> completo (charset, viewport, <title>).
- Inclua Tailwind via CDN no <head>: <script src="https://cdn.tailwindcss.com"></script>. Você pode configurar o tema com <script>tailwind.config = {...}</script> logo em seguida, para definir a paleta de marca e as fontes.
- Importe uma fonte do Google Fonts adequada (ex.: Inter, Geist, Plus Jakarta Sans, Sora) e aplique-a no body.
- Estruture com seções semânticas (header/nav fixa, hero, prova social/logos, features, como funciona, depoimentos, planos, FAQ, CTA final, footer) conforme o contexto.
- TODO botão ou link de conversão (comprar, assinar, falar com vendas, cadastrar, baixar, teste grátis) DEVE ter o atributo data-cta — ex.: <a href="#" data-cta>Começar agora</a>. Essencial para as métricas.
- Sem imagens externas que quebrem: prefira gradientes, SVG inline e cores sólidas. Para fotos/avatares use https://placehold.co.
- Pode usar pequenas animações CSS (keyframes, transitions) e micro-interações em hover. NÃO inclua JavaScript de rastreio — a plataforma injeta o dela.
- O documento deve ser válido, acessível (labels, alt, contraste, foco visível) e pronto para publicar.

Entregue chamando a tool render_landing_page com o documento HTML completo e um resumo curto (1–2 frases) do que você criou ou alterou.`

/** System prompt para gerar uma página do zero. */
export function buildCreateSystemPrompt(): string {
  return `${RULES}\n\nO usuário vai descrever a página que deseja. Capriche: entregue a melhor versão possível, rica em seções e acabamento — não um rascunho mínimo.`
}

/** System prompt para editar uma página existente a partir do HTML atual. */
export function buildEditSystemPrompt(currentHtml: string): string {
  return `${RULES}

Você está EDITANDO uma página existente. Aplique a alteração pedida preservando o restante do documento (conteúdo, estilo e estrutura não mencionados) e mantendo o mesmo nível de acabamento visual. Devolva o documento HTML completo atualizado via render_landing_page.

HTML ATUAL DA PÁGINA:
${currentHtml}`
}

/**
 * Tool de entrega: o modelo a chama UMA vez com o documento final. Forçar a
 * tool (tool_choice "required") garante que o HTML venha num campo estruturado,
 * eliminando o parsing frágil de texto livre.
 */
export const RENDER_LANDING_PAGE_TOOL: ToolDef = {
  type: 'function',
  function: {
    name: 'render_landing_page',
    description:
      'Renderiza a landing page final. Chame exatamente UMA vez com o documento HTML completo, autocontido e pronto para publicar.',
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description:
            'Resumo curto (1–2 frases, em pt-BR) do que foi criado ou alterado, para exibir no chat. NÃO inclua HTML aqui.',
        },
        html: {
          type: 'string',
          description:
            'Documento HTML completo, de <!DOCTYPE html> a </html>, autocontido, com Tailwind via CDN e todas as seções.',
        },
      },
      required: ['summary', 'html'],
      additionalProperties: false,
    },
  },
}

/**
 * Lê os argumentos (JSON) da tool render_landing_page. Tolerante a HTML com
 * cercas de código residuais. Em falha de parse, devolve campos vazios.
 */
export function parseRenderArgs(args: string): {
  html: string
  summary: string
} {
  try {
    const obj = JSON.parse(args) as { html?: unknown; summary?: unknown }
    const html = typeof obj.html === 'string' ? extractHtml(obj.html) : ''
    const summary = typeof obj.summary === 'string' ? obj.summary.trim() : ''
    return { html, summary }
  } catch {
    return { html: '', summary: '' }
  }
}

/**
 * Extrai o documento HTML de um texto: remove cercas de código
 * (```html ... ```) e texto antes do <!DOCTYPE/<html>. Usado como
 * fallback caso o modelo responda em texto livre em vez de chamar a tool.
 */
export function extractHtml(raw: string): string {
  let text = raw.trim()

  // Remove cercas de código, se houver.
  const fence = text.match(/```(?:html)?\s*([\s\S]*?)```/i)
  if (fence?.[1]) text = fence[1].trim()

  // Recorta a partir do <!DOCTYPE ...> ou <html ...>, se presente.
  const start = text.search(/<!DOCTYPE html|<html[\s>]/i)
  if (start > 0) text = text.slice(start)

  return text.trim()
}
