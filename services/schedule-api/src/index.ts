import { S3Client } from '@aws-sdk/client-s3'
import { S3ScheduleStore } from './s3-store.js'
import { createHandler } from './handler.js'

export const handler = createHandler({ store: new S3ScheduleStore(new S3Client({})) })
export { createHandler } from './handler.js'
export { S3ScheduleStore } from './s3-store.js'
