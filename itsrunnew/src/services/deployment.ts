export const PUBLIC_SITE_ORIGIN = 'https://itsrun.info';

export function isCanonicalProductionHost() {
  return typeof window !== 'undefined' && window.location.origin === PUBLIC_SITE_ORIGIN;
}

export function isPublicProductionRuntime() {
  return import.meta.env.VITE_DEPLOY_TARGET !== 'preview' && isCanonicalProductionHost();
}
