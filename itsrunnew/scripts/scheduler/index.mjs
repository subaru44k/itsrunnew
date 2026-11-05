import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { dispatchScheduledEvent } from './dispatch.mjs';
const secrets = new SecretsManagerClient({});
export async function handler(event) {
  const response = await secrets.send(new GetSecretValueCommand({ SecretId: process.env.GITHUB_APP_SECRET_ARN }));
  if (!response.SecretString) throw new Error('Scheduler GitHub App secret is not configured');
  const { clientId, privateKey } = JSON.parse(response.SecretString);
  const result = await dispatchScheduledEvent({ eventType: event.eventType, scheduledTime: event.scheduledTime, clientId, privateKey });
  console.log(JSON.stringify(result));
  return result;
}
