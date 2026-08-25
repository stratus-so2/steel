import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { crmSocialVideoInvalid } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import type { CrmInstagramPostType } from '@/src/schemas/crm-social-instagram.schema'

/**
 * Vídeos vindos de celular/WhatsApp quase sempre trazem uma `edit list`
 * (caixa `edts/elst`) usada para sincronismo A/V — a Meta rejeita isso
 * explicitamente para Reels/Stories ("no edit lists"), o que causa o erro
 * "Media upload has failed" (2207077) mesmo com um MP4 H.264/AAC válido.
 * Reencodar com `-use_editlist 0` remove essa caixa; `+faststart` garante
 * o `moov` no início — o mesmo tipo de arquivo pode disparar rejeições
 * equivalentes em outras plataformas, então o reencode é genérico e cada
 * plataforma só adiciona suas próprias regras (ex.: limite de duração).
 */
const STORIES_MAX_DURATION_S = 60
const REELS_MAX_DURATION_S = 15 * 60

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) return resolve()
      reject(
        new Error(`ffmpeg saiu com código ${code}: ${stderr.slice(-2000)}`),
      )
    })
  })
}

function probeDurationSeconds(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath,
    ])
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      const duration = Number.parseFloat(stdout.trim())
      if (code !== 0 || Number.isNaN(duration)) {
        reject(new Error(`ffprobe falhou: ${stderr.slice(-2000)}`))
        return
      }
      resolve(duration)
    })
  })
}

function maxDurationFor(postType: CrmInstagramPostType): number | null {
  if (postType === 'STORIES') return STORIES_MAX_DURATION_S
  if (postType === 'REELS') return REELS_MAX_DURATION_S
  return null
}

/** Reencoda para H.264/AAC, sem edit list e com moov no início. */
async function reencode(bytes: ArrayBuffer): Promise<ArrayBuffer> {
  const dir = await mkdtemp(join(tmpdir(), 'social-video-'))
  const input = join(dir, `${randomBytes(8).toString('hex')}-in.mp4`)
  const output = join(dir, `${randomBytes(8).toString('hex')}-out.mp4`)

  try {
    await writeFile(input, Buffer.from(bytes))
    await runFfmpeg([
      '-y',
      '-i',
      input,
      '-map',
      '0:v:0',
      '-map',
      '0:a:0',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '20',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-use_editlist',
      '0',
      '-movflags',
      '+faststart',
      output,
    ])
    const normalized = await readFile(output)
    return new Uint8Array(normalized).buffer
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/**
 * Reencoda o vídeo (H.264/AAC, sem edit list, moov no início) e valida a
 * duração contra o limite da Meta para o `postType`. Só se aplica a vídeo —
 * imagem passa direto sem nenhum processamento.
 */
export async function normalizeInstagramVideo(
  bytes: ArrayBuffer,
  postType: CrmInstagramPostType,
): Promise<Result<ArrayBuffer>> {
  const dir = await mkdtemp(join(tmpdir(), 'ig-video-probe-'))
  const input = join(dir, `${randomBytes(8).toString('hex')}-in.mp4`)

  try {
    await writeFile(input, Buffer.from(bytes))
    const duration = await probeDurationSeconds(input)
    const maxDuration = maxDurationFor(postType)
    if (maxDuration !== null && duration > maxDuration) {
      return err(
        crmSocialVideoInvalid(
          `O vídeo tem ${Math.round(duration)}s, acima do limite de ${maxDuration}s para ${postType === 'STORIES' ? 'Stories' : 'Reels'} no Instagram`,
        ),
      )
    }
  } catch (error) {
    return err(
      crmSocialVideoInvalid(
        error instanceof Error
          ? `Não foi possível processar o vídeo: ${error.message}`
          : 'Não foi possível processar o vídeo',
      ),
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }

  try {
    return ok(await reencode(bytes))
  } catch (error) {
    return err(
      crmSocialVideoInvalid(
        error instanceof Error
          ? `Não foi possível processar o vídeo: ${error.message}`
          : 'Não foi possível processar o vídeo',
      ),
    )
  }
}

/**
 * Mesmo reencode acima, sem limite de duração — a Página do Facebook aceita
 * vídeos bem mais longos que Reels/Stories do Instagram.
 */
export async function normalizeFacebookVideo(
  bytes: ArrayBuffer,
): Promise<Result<ArrayBuffer>> {
  try {
    return ok(await reencode(bytes))
  } catch (error) {
    return err(
      crmSocialVideoInvalid(
        error instanceof Error
          ? `Não foi possível processar o vídeo: ${error.message}`
          : 'Não foi possível processar o vídeo',
      ),
    )
  }
}
