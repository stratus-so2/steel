import { crc32, inflateRawSync } from 'node:zlib'

/**
 * Reads a ZIP built by `src/lib/zip.ts` back (central directory + deflate),
 * checking every CRC — enough to assert on export archives in tests.
 */
export function readZip(buffer: Buffer): Map<string, string> {
  const endOffset = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (endOffset < 0) throw new Error('not a zip: no end of central directory')
  const count = buffer.readUInt16LE(endOffset + 10)
  let cursor = buffer.readUInt32LE(endOffset + 16)
  const files = new Map<string, string>()
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error('bad central directory header')
    }
    const checksum = buffer.readUInt32LE(cursor + 16)
    const compressedSize = buffer.readUInt32LE(cursor + 20)
    const nameLength = buffer.readUInt16LE(cursor + 28)
    const localOffset = buffer.readUInt32LE(cursor + 42)
    const name = buffer.toString('utf-8', cursor + 46, cursor + 46 + nameLength)
    const localNameLength = buffer.readUInt16LE(localOffset + 26)
    const dataStart = localOffset + 30 + localNameLength
    const data = inflateRawSync(
      buffer.subarray(dataStart, dataStart + compressedSize),
    )
    if (crc32(data) !== checksum) throw new Error(`bad crc for ${name}`)
    files.set(name, data.toString('utf-8'))
    cursor += 46 + nameLength
  }
  return files
}
