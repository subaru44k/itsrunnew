import { ref } from 'vue';

const ADSENSE_CLIENT = 'ca-pub-7941378059940304';

type GoogleFc = {
  callbackQueue: Array<() => void>;
  showRevocationMessage?: () => void;
};

type AdvertisingWindow = Window & {
  googlefc?: GoogleFc;
};

export const adsenseEnabled = import.meta.env.VITE_ADSENSE_ENABLED === 'true';
export const advertisingReady = ref(false);

export function initializeAdvertising() {
  if (!adsenseEnabled || advertisingReady.value) return;

  if (!document.querySelector('script[data-itsrun-adsense]')) {
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
    script.dataset.itsrunAdsense = 'true';
    document.head.appendChild(script);
  }

  advertisingReady.value = true;
}

export function openGooglePrivacySettings() {
  const target = window as AdvertisingWindow;
  if (!adsenseEnabled) return false;
  const googlefc = target.googlefc ??= { callbackQueue: [] };
  googlefc.callbackQueue.push(() => googlefc.showRevocationMessage?.());
  return true;
}
