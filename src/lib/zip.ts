import { crc32, deflateRawSync } from 'node:zlib'

/**
 * Minimal ZIP writer (PKWARE APPNOTE 6.3, deflate, no ZIP64) — enough for
 * the workspace exports, without a new dependency. Every entry is
 * compressed in memory; callers keep archives well under the 4 GB / 65 535
 * entries limits of the classic format (enforced here).
 */

export interface ZipEntry {
  /** Path inside the archive (`/` separated, no leading slash). */
  name: string
  data: string | Buffer
}

const LOCAL_HEADER = 0x04034b50
const CENTRAL_HEADER = 0x02014b50
const END_OF_CENTRAL = 0x06054b50
const VERSION = 20
/** Bit 11: file names are UTF-8. */
const UTF8_FLAG = 0x0800
const DEFLATE = 8
const MAX_ENTRIES = 0xffff
const MAX_BYTES = 0xffffffff

/** MS-DOS date/time of `date` (local fields read in UTC for determinism). */
export function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(date.getUTCFullYear(), 1980)
  return {
    time:
      (date.getUTCHours() << 11) |
      (date.getUTCMinutes() << 5) |
      Math.floor(date.getUTCSeconds() / 2),
    date:
      ((year - 1980) << 9) |
      ((date.getUTCMonth() + 1) << 5) |
      date.getUTCDate(),
  }
}

export function createZip(
  entries: ZipEntry[],
  modifiedAt = new Date(),
): Buffer {
  if (entries.length > MAX_ENTRIES) {
    throw new Error(`ZIP supports at most ${MAX_ENTRIES} entries`)
  }
  const stamp = dosDateTime(modifiedAt)
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf-8')
    const raw =
      typeof entry.data === 'string'
        ? Buffer.from(entry.data, 'utf-8')
        : entry.data
    const compressed = deflateRawSync(raw)
    const checksum = crc32(raw)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(LOCAL_HEADER, 0)
    local.writeUInt16LE(VERSION, 4)
    local.writeUInt16LE(UTF8_FLAG, 6)
    local.writeUInt16LE(DEFLATE, 8)
    local.writeUInt16LE(stamp.time, 10)
    local.writeUInt16LE(stamp.date, 12)
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(CENTRAL_HEADER, 0)
    central.writeUInt16LE(VERSION, 4)
    central.writeUInt16LE(VERSION, 6)
    central.writeUInt16LE(UTF8_FLAG, 8)
    central.writeUInt16LE(DEFLATE, 10)
    central.writeUInt16LE(stamp.time, 12)
    central.writeUInt16LE(stamp.date, 14)
    central.writeUInt32LE(checksum, 16)
    central.writeUInt32LE(compressed.length, 20)
    central.writeUInt32LE(raw.length, 24)
    central.writeUInt16LE(name.length, 28)
    // extra (30), comment (32), disk (34), internal attrs (36) stay 0
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(offset, 42)

    locals.push(local, name, compressed)
    centrals.push(central, name)
    offset += local.length + name.length + compressed.length
    if (offset > MAX_BYTES) throw new Error('ZIP archive exceeds 4 GB')
  }

  const directory = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(END_OF_CENTRAL, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)

  return Buffer.concat([...locals, directory, end])
}
