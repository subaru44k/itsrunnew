import { describe, expect, it } from 'vitest'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { createS3Client, readBodyBounded, S3ScheduleStore } from '../src/s3-store'

const body = async function* (chunks: Array<string | Uint8Array>) { for (const chunk of chunks) yield chunk }

function fakeStream(chunks: Array<string | Uint8Array>) {
  const stream = {
    destroyed: 0,
    receiverCorrect: true,
    async *[Symbol.asyncIterator]() { for (const chunk of chunks) yield chunk },
    destroy(this: unknown) {
      if (this !== stream) stream.receiverCorrect = false
      stream.destroyed += 1
    },
  }
  return stream
}

describe('S3 schedule adapter', () => {
  it('maps discriminated conditions to exact SDK input names', async () => {
    const inputs: unknown[] = []
    const client = { async send(command: GetObjectCommand | PutObjectCommand) { inputs.push(command.input); return { ETag: '"new"', VersionId: 'v1' } } }
    const store = new S3ScheduleStore(client as never, 'bucket')
    await store.put('data/v1/stadiums/oda/availability/2026-01.json', '{}', { kind: 'match', etag: '"old"' })
    await store.put('data/v1/stadiums/oda/availability/2026-02.json', '{}', { kind: 'create' })
    expect(inputs[0]).toMatchObject({ Bucket: 'bucket', IfMatch: '"old"' })
    expect(inputs[0]).not.toHaveProperty('ifMatch')
    expect(inputs[1]).toMatchObject({ Bucket: 'bucket', IfNoneMatch: '*' })
    expect(inputs[1]).not.toHaveProperty('ifNoneMatch')
  })
  it('bounds streamed bodies even without ContentLength', async () => {
    const exact = fakeStream([new Uint8Array(32 * 1024)])
    await expect(readBodyBounded(exact)).resolves.toHaveLength(32 * 1024)
    expect(exact.destroyed).toBe(0)
    const chunks = fakeStream([new Uint8Array(20 * 1024), new Uint8Array(12 * 1024 + 1)])
    await expect(readBodyBounded(chunks)).rejects.toThrow('stored_data_too_large')
    expect(chunks.destroyed).toBe(1)
    expect(chunks.receiverCorrect).toBe(true)
    await expect(readBodyBounded(body(['日本語']))).resolves.toBe('日本語')
  })
  it('resolves the production client retry budget to one attempt', async () => {
    const client = createS3Client()
    await expect(client.config.maxAttempts()).resolves.toBe(1)
  })
  it('rejects oversized metadata before reading and bounds a body with no metadata', async () => {
    const oversized = new S3ScheduleStore({ async send() { return { ContentLength: 32 * 1024 + 1 } } } as never, 'bucket')
    await expect(oversized.get('data/v1/stadiums/oda/availability/2026-01.json')).rejects.toThrow('stored_data_too_large')
    const streamed = new S3ScheduleStore({ async send() { return { Body: body([new Uint8Array(31 * 1024), new Uint8Array(2 * 1024)]) } } } as never, 'bucket')
    await expect(streamed.get('data/v1/stadiums/oda/availability/2026-01.json')).rejects.toThrow('stored_data_too_large')
  })
})
