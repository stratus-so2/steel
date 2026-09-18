import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { decryptConnectionSecret } from '@/src/lib/crypto'

/**
 * Decifra um arquivo de backup baixado pelo painel admin (/admin/backups),
 * que vem cifrado exatamente como está no MinIO. Precisa do mesmo
 * `CONNECTION_SECRETS` do `.env` que cifrou o backup.
 *
 *   pnpm backup:decrypt <arquivo.enc> <saida>
 *
 * Saída: `.dump` (FULL, formato custom do pg_dump) ou `.json` (WORKSPACE).
 * Trate o arquivo decifrado como dado pessoal (LGPD): apague depois do uso.
 */
async function main() {
  const [input, output] = process.argv.slice(2)
  if (!input || !output) {
    console.error('Uso: pnpm backup:decrypt <arquivo.enc> <saida>')
    process.exitCode = 1
    return
  }

  const envelope = await readFile(input, 'utf-8')
  const buffer = Buffer.from(await decryptConnectionSecret(envelope), 'base64')
  await writeFile(output, buffer, { mode: 0o600 })

  const sha = createHash('sha256').update(buffer).digest('hex')
  console.log(
    `Decifrado em ${output} (${buffer.length} bytes, SHA-256 ${sha}). ` +
      'Compare com o checksum da tabela `backups`.',
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
