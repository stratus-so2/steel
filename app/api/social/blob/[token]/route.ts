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
export async function GET(request: NextRequest, { params }: Params) {
  const { token } = await params
  const entry = await readBlob(token)
  if (!entry) {
    return new NextResponse('Blob não encontrado ou expirado', { status: 404 })
  }

  const total = entry.bytes.byteLength
  const range = request.headers.get('range')
  if (!range) {
    return new NextResponse(new Uint8Array(entry.bytes), {
      status: 200,
      headers: {
        'Content-Type': entry.contentType,
        'Content-Length': String(total),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=600',
      },
    })
  }

  const match = /bytes=(\d*)-(\d*)/.exec(range)
  const start = match?.[1] ? Number(match[1]) : 0
  const end = match?.[2] ? Number(match[2]) : total - 1
  const chunk = entry.bytes.slice(start, end + 1)

  return new NextResponse(new Uint8Array(chunk), {
    status: 206,
    headers: {
      'Content-Type': entry.contentType,
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Content-Length': String(chunk.byteLength),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=600',
    },
  })
}

export async function HEAD(_request: NextRequest, { params }: Params) {
  const { token } = await params
  const entry = await readBlob(token)
  if (!entry) return new NextResponse(null, { status: 404 })

  return new NextResponse(null, {
    status: 200,
    headers: {
      'Content-Type': entry.contentType,
      'Content-Length': String(entry.bytes.byteLength),
      'Accept-Ranges': 'bytes',
    },
  })
}
