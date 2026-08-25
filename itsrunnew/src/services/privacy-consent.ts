import { ref } from 'vue';

export type AnalyticsConsent = 'granted' | 'denied' | null;

const STORAGE_KEY = 'itsrun.analytics-consent.v1';

function storedConsent(): AnalyticsConsent {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

export const analyticsConsent = ref<AnalyticsConsent>(storedConsent());
export const privacySettingsOpen = ref(false);

export function saveAnalyticsConsent(value: Exclude<AnalyticsConsent, null>) {
  analyticsConsent.value = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // A blocked storage API must not prevent the user from using the site.
  }
  privacySettingsOpen.value = false;
}

export function openPrivacySettings() {
  privacySettingsOpen.value = true;
}

export function closePrivacySettings() {
  privacySettingsOpen.value = false;
}
