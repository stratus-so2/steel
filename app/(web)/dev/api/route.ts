import { buildApiReferenceHtml } from '@/src/lib/docs/api-reference'
import { SITE_URL } from '@/src/lib/seo/site'

// Scalar renders the reference in the browser. The proxy puts the request's
// CSP nonce on `x-nonce`; both script tags need it to run.
export function GET(request: Request) {
  const html = buildApiReferenceHtml({
    nonce: request.headers.get('x-nonce') ?? '',
    specUrl: '/dev/api/openapi.json',
    canonicalUrl: `${SITE_URL}/dev/api`,
  })
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
