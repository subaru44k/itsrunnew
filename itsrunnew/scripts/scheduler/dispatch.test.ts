import { generateKeyPairSync, verify } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { dispatchScheduledEvent } from './dispatch.mjs';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const key = privateKey.export({ type: 'pkcs8', format: 'pem' });
const event = { eventType: 'availability-refresh', scheduledTime: '2026-11-06T23:15:00Z', clientId: 'test-client', privateKey: key, now: Date.parse('2026-11-06T23:15:01Z') };

describe('narrowly scoped scheduled dispatch', () => {
  it('signs a short JWT and requests only this repository contents permission', async () => {
    const requests: Array<{ path: string; options: any }> = [];
    const fetchImpl = vi.fn(async (path, options) => {
      requests.push({ path, options });
      return { ok: true, status: requests.length === 3 ? 204 : 200, json: async () => requests.length === 1 ? { id: 123 } : { token: 'temporary-installation-token' } };
    });
    expect(await dispatchScheduledEvent({ ...event, fetchImpl })).toEqual({ ok: true, eventType: event.eventType, scheduledTime: event.scheduledTime });
    const jwt = requests[0].options.headers.Authorization.slice(7).split('.');
    expect(verify('RSA-SHA256', Buffer.from(`${jwt[0]}.${jwt[1]}`), publicKey, Buffer.from(jwt[2], 'base64url'))).toBe(true);
    const claims = JSON.parse(Buffer.from(jwt[1], 'base64url').toString());
    expect(claims.iss).toBe('test-client');
    expect(claims.exp - claims.iat).toBe(600);
    expect(JSON.parse(requests[1].options.body)).toEqual({ repositories: ['itsrunnew'], permissions: { contents: 'write' } });
    expect(requests[2].path).toBe('https://api.github.com/repos/subaru44k/itsrunnew/dispatches');
    expect(JSON.parse(requests[2].options.body).event_type).toBe('availability-refresh');
  });
  it('rejects unknown events before requesting credentials and never echoes error bodies', async () => {
    const fetchImpl = vi.fn();
    await expect(dispatchScheduledEvent({ ...event, eventType: 'arbitrary-workflow', fetchImpl })).rejects.toThrow('Invalid');
    expect(fetchImpl).not.toHaveBeenCalled();
    fetchImpl.mockResolvedValue({ ok: false, status: 403, json: async () => ({ message: 'sensitive response must not reach logs' }) });
    await expect(dispatchScheduledEvent({ ...event, fetchImpl })).rejects.toThrow('GitHub scheduler HTTP 403: /repos/subaru44k/itsrunnew/installation');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
