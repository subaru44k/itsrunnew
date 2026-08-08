import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { SchedulePath } from '@itsrun/core'
import type { ScheduleStore, WriteCondition } from './types.js'

const MAX_BYTES = 32 * 1024
const bucket = () => process.env.DATA_BUCKET_NAME ?? ''

export function createS3Client(): S3Client {
  return new S3Client({ maxAttempts: 1 })
}

export async function readBodyBounded(body: unknown, maxBytes = MAX_BYTES): Promise<string> {
  if (!body || typeof (body as AsyncIterable<unknown>)[Symbol.asyncIterator] !== 'function') throw new Error('missing_body')
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of body as AsyncIterable<Uint8Array | string>) {
    const bytes = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : new Uint8Array(chunk)
    size += bytes.byteLength
    if (size > maxBytes) {
      const stream = body as { destroy?: () => void }
      stream.destroy?.call(stream)
      throw new Error('stored_data_too_large')
    }
    chunks.push(bytes)
  }
  const result = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength }
  return new TextDecoder().decode(result)
}

export class S3ScheduleStore implements ScheduleStore {
  constructor(private readonly client = createS3Client(), private readonly bucketName = bucket()) {}
  async get(key: SchedulePath) {
    const output = await this.client.send(new GetObjectCommand({ Bucket: this.bucketName, Key: key }))
    if (output.ContentLength !== undefined && output.ContentLength > MAX_BYTES) throw new Error('stored_data_too_large')
    const body = await readBodyBounded(output.Body)
    return { body, etag: output.ETag }
  }
  async put(key: SchedulePath, body: string, condition: WriteCondition) {
    const output = await this.client.send(new PutObjectCommand({
      Bucket: this.bucketName, Key: key, Body: body, ContentType: 'application/json',
      ...(condition.kind === 'match' ? { IfMatch: condition.etag } : { IfNoneMatch: '*' }),
    }))
    return { etag: output.ETag, versionId: output.VersionId }
  }
}
