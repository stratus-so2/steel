import { getAllEntries } from '@/src/lib/changelog/entries'
import { buildLlmsFullTxt } from '@/src/lib/seo/llms'

export async function GET() {
  const entries = await getAllEntries()
  return new Response(buildLlmsFullTxt(entries), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  })
}
