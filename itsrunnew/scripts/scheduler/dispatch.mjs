import { sign } from 'node:crypto';
const allowed = new Set(['availability-refresh', 'availability-monitor']);
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');

export async function dispatchScheduledEvent({ eventType, scheduledTime, clientId, privateKey, fetchImpl = fetch, now = Date.now() }) {
  if (!allowed.has(eventType) || !Number.isFinite(Date.parse(scheduledTime)) || !clientId || !privateKey) throw new Error('Invalid scheduler configuration or event');
  const seconds = Math.floor(now / 1000);
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iat: seconds - 60, exp: seconds + 540, iss: clientId })}`;
  const jwt = `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url')}`;
  async function request(path, token, body) {
    const response = await fetchImpl(`https://api.github.com${path}`, {
      method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(10000),
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2026-03-10', 'User-Agent': 'ItsRun-availability-scheduler', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(`GitHub scheduler HTTP ${response.status}: ${path}`);
    return response.status === 204 ? null : response.json();
  }
  const installation = await request('/repos/subaru44k/itsrunnew/installation', jwt);
  if (!Number.isSafeInteger(installation.id) || installation.id <= 0) throw new Error('Invalid GitHub installation');
  const access = await request(`/app/installations/${installation.id}/access_tokens`, jwt, { repositories: ['itsrunnew'], permissions: { contents: 'write' } });
  if (typeof access.token !== 'string' || !access.token) throw new Error('Missing GitHub installation token');
  await request('/repos/subaru44k/itsrunnew/dispatches', access.token, { event_type: eventType, client_payload: { scheduled_time: scheduledTime, source: 'eventbridge-scheduler' } });
  return { ok: true, eventType, scheduledTime };
}
