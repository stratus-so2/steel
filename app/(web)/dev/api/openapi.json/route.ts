import fs from 'node:fs/promises'
import path from 'node:path'
import { toPublicOpenApi } from '@/src/lib/docs/public-openapi'
import { SITE_URL } from '@/src/lib/seo/site'

let cached: string | null = null

// The generated spec without the admin-only routes (see toPublicOpenApi).
// Read once per process: the file only changes with a deploy.
export async function GET() {
  if (!cached) {
    const raw = await fs.readFile(
      path.join(process.cwd(), 'public', 'openapi.json'),
      'utf-8',
    )
    cached = JSON.stringify(toPublicOpenApi(JSON.parse(raw), SITE_URL))
  }
  return new Response(cached, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
