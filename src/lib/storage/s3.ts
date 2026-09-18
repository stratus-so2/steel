import {
  CreateBucketCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  type DeleteObjectsCommandOutput,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { MINIO_ENDPOINT, MINIO_PASSWORD, MINIO_USER } from '@/lib/env/server'

let client: S3Client | null = null

export function getS3Client(): S3Client {
  if (!client) {
    client = new S3Client({
      endpoint: MINIO_ENDPOINT,
      region: 'us-east-1',
      credentials: {
        accessKeyId: MINIO_USER,
        secretAccessKey: MINIO_PASSWORD,
      },
      forcePathStyle: true,
    })
  }
  return client
}

export async function ensureBucket(bucket: string): Promise<void> {
  const s3 = getS3Client()
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }))
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }))
  }
}

export async function ensurePublicBucket(bucket: string): Promise<void> {
  const s3 = getS3Client()
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }))
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }))
  }
  await s3.send(
    new PutBucketPolicyCommand({
      Bucket: bucket,
      Policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${bucket}/*`],
          },
        ],
      }),
    }),
  )
}

export interface PutObjectInput {
  bucket: string
  key: string
  body: string | Uint8Array | Buffer
  contentType: string
}

export async function putObject(input: PutObjectInput): Promise<void> {
  const s3 = getS3Client()
  await s3.send(
    new PutObjectCommand({
      Bucket: input.bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
    }),
  )
}

export interface GetObjectInput {
  bucket: string
  key: string
}

export async function getObject(input: GetObjectInput): Promise<Buffer> {
  const s3 = getS3Client()
  const result = await s3.send(
    new GetObjectCommand({ Bucket: input.bucket, Key: input.key }),
  )
  const stream = result.Body as AsyncIterable<Uint8Array>
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

export interface DeleteObjectInput {
  bucket: string
  key: string
}

export async function deleteObject(input: DeleteObjectInput): Promise<void> {
  const s3 = getS3Client()
  await s3.send(
    new DeleteObjectCommand({ Bucket: input.bucket, Key: input.key }),
  )
}

export interface PresignedDownloadInput {
  bucket: string
  key: string
  expiresInSeconds: number
}

export async function getPresignedDownloadUrl(
  input: PresignedDownloadInput,
): Promise<string> {
  const s3 = getS3Client()
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: input.bucket, Key: input.key }),
    { expiresIn: input.expiresInSeconds },
  )
}

/**
 * Stream de um objeto (download de backups pelo painel admin): evita
 * carregar um dump inteiro na memória do app.
 */
export async function getObjectStream(input: GetObjectInput): Promise<{
  body: ReadableStream<Uint8Array>
  contentLength: number | undefined
}> {
  const s3 = getS3Client()
  const result = await s3.send(
    new GetObjectCommand({ Bucket: input.bucket, Key: input.key }),
  )
  if (!result.Body) throw new Error(`Objeto vazio: ${input.key}`)
  return {
    body: result.Body.transformToWebStream() as ReadableStream<Uint8Array>,
    contentLength: result.ContentLength,
  }
}

function isMissingBucket(error: unknown): boolean {
  const name = (error as { name?: string; Code?: string } | null)?.name
  return name === 'NoSuchBucket' || name === 'NotFound'
}

/** Todas as chaves sob um prefixo (paginado). Bucket inexistente → `[]`. */
export async function listObjectKeys(
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const s3 = getS3Client()
  const keys: string[] = []
  let token: string | undefined
  try {
    do {
      const page = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: token,
        }),
      )
      for (const object of page.Contents ?? []) {
        if (object.Key) keys.push(object.Key)
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined
    } while (token)
  } catch (error) {
    if (isMissingBucket(error)) return []
    throw error
  }
  return keys
}

/** Apaga em lotes de 1000 (limite do S3). Devolve quantos foram apagados. */
export async function deleteObjects(
  bucket: string,
  keys: string[],
): Promise<number> {
  const s3 = getS3Client()
  let deleted = 0
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000)
    let result: DeleteObjectsCommandOutput
    try {
      result = await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
        }),
      )
    } catch (error) {
      if (isMissingBucket(error)) return deleted
      throw error
    }
    if (result.Errors && result.Errors.length > 0) {
      throw new Error(
        `Falha ao apagar ${result.Errors.length} objeto(s) em ${bucket}: ${result.Errors[0]?.Message ?? ''}`,
      )
    }
    deleted += batch.length
  }
  return deleted
}
