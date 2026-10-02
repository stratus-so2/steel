import {
  NextResponse,
  type NextRequest,
  type NextFetchEvent,
} from 'next/server'
import { logger } from '@/lib/axiom/server'
import { logRequest } from '@/lib/axiom/request-log'
import { NODE_ENV } from '@/lib/env/env'
import { geolocateRequest } from '@/src/lib/analytics/geoip'

const PUBLIC_ROUTES = [
  '/', '/sign-in', '/sign-up', '/forget-password',
  '/reset-password', '/api/auth', '/api/status',
  '/api/payment/webhook', '/docs', '/legals',
  '/status', '/pricing', '/talk-to-sales',
  '/marketplace', '/invite', '/api/talk-to-sales',
  '/api/whatsapp/webhook', '/api/crm/proposals', '/api/crm/forms',
  '/api/crm/integrations', '/api/crm/workflows', '/api/crm/landing-pages',
  '/f', '/p', '/l', '/api/social/blob',
  // Descadastro LGPD de campanhas de e-mail: link sem sessão (token HMAC)
  '/unsubscribe', '/api/crm/unsubscribe',
  // Aprovação de chamado do ServiceDesk por e-mail: link sem sessão (token)
  '/servicedesk/approval', '/api/servicedesk/approvals',
  // Abertura de chamado por monitoramento: webhook sem sessão (token na URL)
  '/api/servicedesk/monitoring',
  // Integrações do ServiceDesk: webhooks sem sessão, verificados por
  // assinatura (Slack: X-Slack-Signature; GitHub: X-Hub-Signature-256). O
  // callback OAuth (`/oauth/slack`) fica de fora de propósito: ele exige a
  // sessão do admin que autorizou.
  '/api/servicedesk/integrations/slack',
  '/api/servicedesk/integrations/github',
  // Portal do contato externo do ServiceDesk: link mágico + sessão própria
  // no cookie `sd.portal_session` (sem Better Auth; escopo no service)
  '/suporte', '/api/servicedesk/portal'
]

/**
 * CSP da aplicação. **Sem `'strict-dynamic'`**: com Cache Components (PPR) a
 * casca do HTML é pré-renderizada no build, então os `<script src>` dos
 * chunks nascem sem nonce; `'strict-dynamic'` faz o navegador ignorar o
 * `'self'` e bloquear todos eles — a página renderiza, nunca hidrata e nada
 * fica clicável. Os bundles são arquivos nossos, de mesma origem, cobertos
 * por `'self'`; o nonce segue valendo para os scripts inline que o Next gera
 * nas partes dinâmicas.
 */
function buildCspHeader(nonce: string): string {
  return `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}'${NODE_ENV === 'development' ? " 'unsafe-eval'" : ''};
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https:;
    font-src 'self';
    connect-src 'self' https://*.axiom.co https://va.vercel-scripts.com https://cdn.jsdelivr.net${NODE_ENV === 'development' ? ' ws://localhost:4444' : ''};
    frame-ancestors 'none';
    form-action 'self';
    base-uri 'self';
    object-src 'none';
    upgrade-insecure-requests;
  `
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function withSecurityHeaders(
  response: NextResponse,
  nonce: string,
): NextResponse {
  response.headers.set('Content-Security-Policy', buildCspHeader(nonce))
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload',
  )
  return response
}

/**
 * Page view/requisição vista pelo proxy (fonte `middleware` no Axiom): rota
 * normalizada, país/cidade (GeoLite2, a partir do X-Forwarded-For) e família
 * do navegador. O IP e o User-Agent cru não vão para o log (LGPD). Fora do
 * caminho da resposta (`waitUntil`).
 */
async function logProxyRequest(request: NextRequest): Promise<void> {
  logRequest(
    logger,
    {
      method: request.method,
      url: request.url,
      headers: request.headers,
      geo: await geolocateRequest(request.headers),
    },
    'middleware',
  )
  await logger.flush()
}

export function proxy(request: NextRequest, event: NextFetchEvent) {
  event.waitUntil(logProxyRequest(request))

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  // O Next lê a CSP **da requisição** para carimbar o nonce nos `<script>`
  // que ele mesmo emite. Sem isto, com `strict-dynamic` o navegador ignora
  // `'self'`, bloqueia os chunks, a página não hidrata e nada é clicável.
  requestHeaders.set('Content-Security-Policy', buildCspHeader(nonce))

  const { pathname } = request.nextUrl

  if (
    NODE_ENV === 'development' &&
    (pathname === '/reference' || pathname === '/openapi.json' || pathname === '/contact' || pathname === '/testes')
  ) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  )

  if (isPublic) {
    return withSecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
      nonce,
    )
  }

  const sessionToken =
    request.cookies.get('better-auth.session_token')?.value ||
    request.cookies.get('__Secure-better-auth.session_token')?.value

  if (!sessionToken) {
    // API routes should return 401, not redirect to the sign-in page.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, statusCode: 401, error: { code: 'UNAUTHORIZED' } },
        { status: 401 },
      )
    }
    // Preserva o destino (path + query) para voltar após o login.
    const redirectTo = encodeURIComponent(pathname + request.nextUrl.search)
    return NextResponse.redirect(
      new URL(`/sign-in?redirect=${redirectTo}`, request.url),
    )
  }

  return withSecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    nonce,
  )
}

export const config = {
  // Fora do proxy: assets do Next, ícones/imagens e `theme-init.js` (roda
  // antes da primeira pintura e precisa responder mesmo sem sessão). Nada de
  // excluir extensões em bloco: `/openapi.json`, por exemplo, continua
  // passando pelo gate de autenticação.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|theme-init.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)',
  ],
}
