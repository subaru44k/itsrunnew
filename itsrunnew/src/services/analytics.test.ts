import { describe, expect, it } from 'vitest';
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
      address: 'example', query: 'home address', search_query: 'station name', empty: null,
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
