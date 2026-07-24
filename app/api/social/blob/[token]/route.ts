import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { readBlob } from '@/src/lib/social/blob-store'

type Params = { params: Promise<{ token: string }> }

/**
 * Serve bytes mantidos no `blob-store` como URL pública temporária. É o que
 * permite o publish do Instagram (o Graph API exige `image_url`/`video_url`
 * acessível, sem upload direto). Sem auth — o `token` é o próprio "segredo"
 * (24 bytes random URL-safe), curto-vivo (~10min) e descartável após o publish.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const { token } = await params
  const entry = readBlob(token)
  if (!entry) {
    return new NextResponse('Blob não encontrado ou expirado', { status: 404 })
  }

  return new NextResponse(new Uint8Array(entry.bytes), {
    status: 200,
    headers: {
      'Content-Type': entry.contentType,
      'Cache-Control': 'private, max-age=600',
      'Content-Length': String(entry.bytes.byteLength),
    },
  })
}
