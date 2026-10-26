import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { productEventNames, safeProductEventParameters } from './analytics';

const trackSearch = readFileSync(new URL('../views/TrackSearch.vue', import.meta.url), 'utf8');
const trackDetail = readFileSync(new URL('../views/TrackDetail.vue', import.meta.url), 'utf8');

describe('product analytics contract', () => {
  it('uses stable GA4-compatible event names', () => {
    expect(new Set(productEventNames).size).toBe(productEventNames.length);
    for (const name of productEventNames) expect(name).toMatch(/^[a-z][a-z0-9_]{0,39}$/);
  });

  it('never sends precise locations or free-form search text', () => {
    expect(safeProductEventParameters({
      track_id: 'oda-field', selected_date: '2026-08-25', locale: 'ja',
      latitude: 35.1, longitude: 139.1, lat: '35.1', lng: '139.1',
      comment: 'private text', clientId: 'anonymous-id', client_id: 'anonymous-id', report_id: 'report', ip: '192.0.2.1', address: 'example', query: 'home address', search_query: 'station name', empty: null,
    })).toEqual({ track_id: 'oda-field', selected_date: '2026-08-25', locale: 'ja' });
  });

  it('instruments the search funnel and facility confirmation actions', () => {
    for (const event of ['date_select', 'facility_select', 'search_origin_select', 'search_origin_clear', 'no_results', 'prefecture_toggle']) {
      expect(trackSearch).toContain(`'${event}'`);
    }
    for (const event of ['facility_detail_view', 'view_on_map_click', 'availability_source_click', 'official_site_click', 'directions_click']) {
      expect(trackDetail).toContain(`'${event}'`);
    }
  });
});


describe('analytics command queue', () => {
  let queue: unknown[];
  let scripts: { src?: string; dataset: Record<string, string> }[];

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_DEPLOY_TARGET', 'production');
    queue = [];
    scripts = [];
    vi.stubGlobal('window', { location: { origin: 'https://itsrun.info' }, dataLayer: queue });
    vi.stubGlobal('location', { origin: 'https://itsrun.info' });
    vi.stubGlobal('document', {
      cookie: '',
      createElement: () => ({ dataset: {} }),
      head: { appendChild: (script: typeof scripts[number]) => scripts.push(script) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('queues real Arguments commands and processes page views only after consent', async () => {
    const { updateAnalyticsConsent, trackPageView, trackProductEvent } = await import('./analytics');
    trackPageView('/', 'Home');
    updateAnalyticsConsent(false);
    expect(queue).toHaveLength(0);
    expect(scripts).toHaveLength(0);

    updateAnalyticsConsent(true);
    trackPageView('/', 'Home');
    trackPageView('/', 'Home');
    trackPageView('/about', 'About');
    trackProductEvent('facility_select', { track_id: 'test', lat: 35, comment: 'private' });
    expect(scripts.map(script => script.src)).toEqual(['https://www.googletagmanager.com/gtag/js?id=G-YNLS7KQXYW']);
    for (const command of queue) {
      expect(Array.isArray(command)).toBe(false);
      expect(Object.prototype.toString.call(command)).toBe('[object Arguments]');
    }
    const commands = queue.map(command => Array.from(command as IArguments));
    expect(commands[0]).toEqual(['consent', 'default', {
      analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    }]);
    expect(commands[1]).toEqual(['js', expect.any(Date)]);
    expect(commands[2]).toEqual(['config', 'G-YNLS7KQXYW', { send_page_view: false }]);
    expect(commands[3]).toEqual(['consent', 'update', { analytics_storage: 'granted' }]);
    expect(commands.slice(4)).toEqual([
      ['event', 'page_view', { page_location: 'https://itsrun.info/', page_path: '/', page_title: 'Home' }],
      ['event', 'page_view', { page_location: 'https://itsrun.info/about', page_path: '/about', page_title: 'About' }],
      ['event', 'facility_select', { track_id: 'test' }],
    ]);
    updateAnalyticsConsent(false);
    const count = queue.length;
    trackPageView('/privacy', 'Privacy');
    trackProductEvent('facility_select');
    expect(queue).toHaveLength(count);
  });

  it.each(['http://localhost:4173', 'https://example.cloudfront.net'])('does not enable analytics on %s', async origin => {
    vi.stubGlobal('window', { location: { origin }, dataLayer: queue });
    const { updateAnalyticsConsent, trackPageView } = await import('./analytics');
    updateAnalyticsConsent(true);
    trackPageView('/', 'Home');
    expect(queue).toHaveLength(0);
    expect(scripts).toHaveLength(0);
  });

  it('does not enable analytics in a preview build even on the canonical host', async () => {
    vi.stubEnv('VITE_DEPLOY_TARGET', 'preview');
    const { updateAnalyticsConsent, trackPageView } = await import('./analytics');
    updateAnalyticsConsent(true);
    trackPageView('/', 'Home');
    expect(queue).toHaveLength(0);
    expect(scripts).toHaveLength(0);
  });
});
