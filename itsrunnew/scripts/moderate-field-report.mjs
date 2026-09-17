// Operator only: AWS credentials must have UpdateItem on the chosen reports table.
import { DynamoDBClient } from '../backend/field-reports/node_modules/@aws-sdk/client-dynamodb/dist-cjs/index.js';
import { DynamoDBDocumentClient, UpdateCommand } from '../backend/field-reports/node_modules/@aws-sdk/lib-dynamodb/dist-cjs/index.js';
const [table, trackId, date, createdAt, id, status] = process.argv.slice(2);
if (!table || !trackId || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !createdAt || !id || !['hidden','visible'].includes(status)) {
  throw new Error('Usage: node scripts/moderate-field-report.mjs TABLE TRACK_ID DATE CREATED_AT REPORT_ID hidden|visible');
}
await DynamoDBDocumentClient.from(new DynamoDBClient({region:'ap-northeast-1'})).send(new UpdateCommand({
  TableName:table,Key:{pk:`REPORT#${trackId}#${date}`,sk:`${createdAt}#${id}`},
  UpdateExpression:'SET #status = :status, moderatedAt = :now',ConditionExpression:'attribute_exists(pk)',
  ExpressionAttributeNames:{'#status':'status'},ExpressionAttributeValues:{':status':status,':now':new Date().toISOString()},
}));
console.log(`Report ${id}: ${status}`);
