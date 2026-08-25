import { isPublicProductionRuntime } from './deployment';

const MEASUREMENT_ID = 'G-YNLS7KQXYW';

export const productEventNames = [
  'date_select',
  'facility_select',
  'facility_detail_view',
  'view_on_map_click',
  'use_location',
  'use_location_result',
  'search_origin_select',
  'search_origin_clear',
  'show_unavailable_change',
  'prefecture_toggle',
  'no_results',
  'availability_source_click',
  'official_site_click',
  'directions_click',
] as const;

export type ProductEventName = typeof productEventNames[number];
export type ProductEventParameters = Record<string, string | number | boolean | null | undefined>;

type Gtag = (...args: unknown[]) => void;
type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: Gtag;
};

let analyticsLoaded = false;
let analyticsAllowed = false;
let lastPageView = '';

function analyticsWindow() {
  return window as AnalyticsWindow;
}

function ensureGtag() {
  const target = analyticsWindow();
  target.dataLayer ??= [];
  target.gtag ??= (...args: unknown[]) => target.dataLayer?.push(args);
  return target.gtag;
}

function loadAnalytics() {
  const gtag = ensureGtag();
  gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  if (!analyticsLoaded) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    script.dataset.itsrunAnalytics = 'true';
    document.head.appendChild(script);
    gtag('js', new Date());
    gtag('config', MEASUREMENT_ID, { send_page_view: false });
    analyticsLoaded = true;
  }
}

function clearAnalyticsCookies() {
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0]?.trim();
    if (!name?.startsWith('_ga')) continue;
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
    document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.itsrun.info; SameSite=Lax`;
  }
}

export function updateAnalyticsConsent(granted: boolean) {
  const analyticsEnabled = isPublicProductionRuntime();
  analyticsAllowed = granted && analyticsEnabled;
  if (!analyticsEnabled) return;
  if (granted) {
    loadAnalytics();
    ensureGtag()('consent', 'update', { analytics_storage: 'granted' });
    return;
  }
  if (analyticsLoaded) ensureGtag()('consent', 'update', { analytics_storage: 'denied' });
  clearAnalyticsCookies();
}

export function trackPageView(path: string, title: string) {
  if (!analyticsAllowed) return;
  const normalizedPath = path === '/tracks' ? '/' : path === '/en/tracks' ? '/en/' : path;
  const pageKey = `${normalizedPath}|${title}`;
  if (pageKey === lastPageView) return;
  lastPageView = pageKey;
  ensureGtag()('event', 'page_view', {
    page_location: `${location.origin}${normalizedPath}`,
    page_path: normalizedPath,
    page_title: title,
  });
}

const privateParameterNames = /^(?:lat|lng|latitude|longitude|address|query|search_query)$/i;

export function safeProductEventParameters(parameters: ProductEventParameters) {
  return Object.fromEntries(Object.entries(parameters).filter(([name, value]) => !privateParameterNames.test(name) && value != null));
}

export function trackProductEvent(name: ProductEventName, parameters: ProductEventParameters = {}) {
  if (!analyticsAllowed) return;
  ensureGtag()('event', name, safeProductEventParameters(parameters));
}
