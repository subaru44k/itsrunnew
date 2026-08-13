import { S3Client } from '@aws-sdk/client-s3'
import { S3ScheduleStore } from './aws/s3-store.js'
import { createHandler } from './handler.js'

export const handler = createHandler({ store: new S3ScheduleStore(new S3Client({ maxAttempts: 1 })) })
export { createHandler } from './handler.js'
export { S3ScheduleStore } from './aws/s3-store.js'
