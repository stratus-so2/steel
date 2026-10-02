'use client'

import {
  CheckmarkCircle02Icon,
  FileImportIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { notify } from '@/lib/notify'
import { csvToRecords, type SdCsvRecords } from '@/src/lib/servicedesk/csv'
import type { SdImportResultDTO } from '@/types/sd-directory'
import { SD_STATE_TONE } from './sd-directory-labels'

const MAX_ROWS = 1000

/**
 * Importação de planilha CSV (`,` ou `;`): lê o arquivo no navegador,
 * mostra uma prévia e envia as linhas para a API, que devolve as recusadas.
 */
export function SdImportDialog({
  open,
  onOpenChange,
  title,
  columnsHelp,
  onImport,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** Colunas reconhecidas (texto de ajuda). */
  columnsHelp: string
  onImport: (rows: Record<string, string>[]) => Promise<SdImportResultDTO>
}) {
  const [parsed, setParsed] = useState<SdCsvRecords | null>(null)
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SdImportResultDTO | null>(null)

  function reset() {
    setParsed(null)
    setFileName('')
    setResult(null)
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    setResult(null)
    setFileName(file.name)
    const text = await file.text()
    const records = csvToRecords(text)
    if (records.records.length === 0) {
      notify.error('A planilha não tem linhas de dados.')
      setParsed(null)
      return
    }
    setParsed(records)
  }

  async function submit() {
    if (!parsed) return
    if (parsed.records.length > MAX_ROWS) {
      notify.error(`Importe no máximo ${MAX_ROWS} linhas por vez.`)
      return
    }
    setBusy(true)
    try {
      const outcome = await onImport(parsed.records)
      setResult(outcome)
      notify.success(
        `${outcome.created} cadastro${outcome.created === 1 ? '' : 's'} importado${outcome.created === 1 ? '' : 's'}.`,
      )
    } catch (error) {
      notify.error(error, 'Não foi possível importar.')
    } finally {
      setBusy(false)
    }
  }

  const preview = parsed?.records.slice(0, 5) ?? []
  const headers = (parsed?.headers ?? []).filter(Boolean).slice(0, 6)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Envie um arquivo CSV (separado por vírgula ou ponto e vírgula) com
            cabeçalho na primeira linha. {columnsHelp}
          </DialogDescription>
        </DialogHeader>

        {/* biome-ignore lint/a11y/noLabelWithoutControl: o input de arquivo é o controle envolvido */}
        <label className='flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center text-sm hover:bg-muted/40'>
          <SteelIcon
            icon={FileImportIcon}
            strokeWidth={1.8}
            className='size-6 text-muted-foreground'
          />
          <span className='font-medium'>
            {fileName || 'Escolher arquivo .csv'}
          </span>
          <span className='text-muted-foreground text-xs'>
            Até {MAX_ROWS} linhas por importação
          </span>
          <Input
            type='file'
            accept='.csv,text/csv'
            className='sr-only'
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>

        {parsed && !result ? (
          <div className='flex flex-col gap-2'>
            <p className='text-sm'>
              <span className='font-medium tabular-nums'>
                {parsed.records.length}
              </span>{' '}
              linha(s) encontradas. Prévia:
            </p>
            <div className='overflow-x-auto rounded-lg border'>
              <table className='w-full text-xs'>
                <thead className='bg-muted/50 text-muted-foreground'>
                  <tr>
                    {headers.map((h) => (
                      <th key={h} className='px-2 py-1.5 text-left font-medium'>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr
                      key={`${i}-${row[headers[0]] ?? ''}`}
                      className='border-t'
                    >
                      {headers.map((h) => (
                        <td key={h} className='max-w-40 truncate px-2 py-1.5'>
                          {row[h]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {result ? (
          <div className='flex flex-col gap-2 text-sm'>
            <p className={`flex items-center gap-2 ${SD_STATE_TONE.okText}`}>
              <SteelIcon
                icon={CheckmarkCircle02Icon}
                strokeWidth={2}
                className='size-4'
              />
              {result.created} criado(s) · {result.rejected.length} recusado(s)
            </p>
            {result.rejected.length > 0 ? (
              <ul className='max-h-48 divide-y overflow-y-auto rounded-lg border text-xs'>
                {result.rejected.map((r) => (
                  <li key={r.line} className='flex gap-2 px-2 py-1.5'>
                    <span className='w-16 shrink-0 text-muted-foreground'>
                      Linha {r.line}
                    </span>
                    <span>{r.message}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {result ? 'Fechar' : 'Cancelar'}
          </Button>
          {result ? null : (
            <Button onClick={submit} disabled={!parsed || busy}>
              {busy
                ? 'Importando…'
                : parsed
                  ? `Importar ${parsed.records.length} linha(s)`
                  : 'Importar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
