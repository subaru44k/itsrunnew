import { readFileSync } from 'node:fs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { createHandler } from './core.mjs';
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TableName = process.env.TABLE_NAME;
const storage = {
  async list(pk) {
    const rows = []; let cursor;
    do {
      const result = await client.send(new QueryCommand({TableName,KeyConditionExpression:'pk = :pk',ExpressionAttributeValues:{':pk':pk},ScanIndexForward:false,ConsistentRead:true,ExclusiveStartKey:cursor}));
      rows.push(...(result.Items ?? [])); cursor = result.LastEvaluatedKey;
    } while (cursor);
    return rows;
  },
  async save(report,rules,seconds) {
    await client.send(new TransactWriteCommand({TransactItems:[
      {Put:{TableName,Item:{...report,pk:`REPORT#${report.trackId}#${report.date}`,sk:`${report.createdAt}#${report.id}`},ConditionExpression:'attribute_not_exists(pk)'}},
      ...rules.map(rule => ({Update:{TableName,Key:{pk:`LIMIT#${rule.key}`,sk:'LIMIT'},UpdateExpression:'SET expiresAt = :ttl, lastAt = :now ADD #count :one',ConditionExpression:`(attribute_not_exists(#count) OR #count < :limit)${rule.cooldown ? ' AND (attribute_not_exists(lastAt) OR lastAt <= :before)' : ''}`,ExpressionAttributeNames:{'#count':'count'},ExpressionAttributeValues:{':ttl':seconds+2*86400,':now':seconds,':one':1,':limit':rule.limit,...(rule.cooldown ? {':before':seconds-rule.cooldown} : {})}}}))
    ]}));
  }
};
export const handler = createHandler({storage,trackIds:new Set(JSON.parse(readFileSync(new URL('./track-ids.json',import.meta.url),'utf8'))),origins:JSON.parse(process.env.ALLOWED_ORIGINS ?? '[]'),secret:process.env.ABUSE_SECRET});
