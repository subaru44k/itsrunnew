import { describe, expect, it } from 'vitest'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { readBodyBounded, S3ScheduleStore } from '../src/s3-store'

const body = async function* (chunks: Array<string | Uint8Array>) { for (const chunk of chunks) yield chunk }

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
    const chunks = [new Uint8Array(20 * 1024), new Uint8Array(13 * 1024)]
    await expect(readBodyBounded(body(chunks))).rejects.toThrow('stored_data_too_large')
    await expect(readBodyBounded(body(['日本語']))).resolves.toBe('日本語')
  })
})
