import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { SchedulePath } from '@itsrun/core'
import type { ScheduleStore } from './types.js'

const MAX_BYTES = 32 * 1024
const bucket = () => process.env.DATA_BUCKET_NAME ?? ''

export class S3ScheduleStore implements ScheduleStore {
  constructor(private readonly client = new S3Client({}), private readonly bucketName = bucket()) {}
  async get(key: SchedulePath) {
    const output = await this.client.send(new GetObjectCommand({ Bucket: this.bucketName, Key: key }))
    if (output.ContentLength !== undefined && output.ContentLength > MAX_BYTES) throw new Error('stored_data_too_large')
    const body = output.Body ? await output.Body.transformToString() : ''
    if (new TextEncoder().encode(body).byteLength > MAX_BYTES) throw new Error('stored_data_too_large')
    return { body, etag: output.ETag }
  }
  async put(key: SchedulePath, body: string, condition: { ifMatch?: string; ifNoneMatch?: '*' }) {
    const output = await this.client.send(new PutObjectCommand({
      Bucket: this.bucketName, Key: key, Body: body, ContentType: 'application/json',
      ...condition,
    }))
    return { etag: output.ETag, versionId: output.VersionId }
  }
}
