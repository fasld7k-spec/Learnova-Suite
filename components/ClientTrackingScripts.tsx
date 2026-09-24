'use client';

import { useEffect } from 'react';

type ClientTrackingScriptsProps = {
  googleAnalyticsId?: string | null;
  metaPixelId?: string | null;
};

const trackingConsentKey = 'learnova_tracking_consent';
const analyticsConsentKey = 'learnova_cookie_consent:cookies:analytics';

function hasAnalyticsConsent() {
  try {
    return localStorage.getItem(trackingConsentKey) === 'allowed' || localStorage.getItem(analyticsConsentKey) === 'allowed';
  } catch {
    return false;
  }
}

function loadExternalScript(id: string, src: string) {
  if (document.getElementById(id)) return;
  const script = document.createElement('script');
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

function loadGoogleAnalytics(measurementId: string) {
  loadExternalScript('learnova-google-analytics-src', `https://www.googletagmanager.com/gtag/js?id=${measurementId}`);
  if (document.getElementById('learnova-google-analytics-inline')) return;
  const script = document.createElement('script');
  script.id = 'learnova-google-analytics-inline';
  script.text = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${measurementId}');
  `;
  document.head.appendChild(script);
}

function loadMetaPixel(pixelId: string) {
  if (document.getElementById('learnova-meta-pixel-inline')) return;
  const script = document.createElement('script');
  script.id = 'learnova-meta-pixel-inline';
  script.text = `
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${pixelId}');
    fbq('track', 'PageView');
  `;
  document.head.appendChild(script);
}

function loadTracking(args: ClientTrackingScriptsProps) {
  if (!hasAnalyticsConsent()) return;
  if (args.googleAnalyticsId) loadGoogleAnalytics(args.googleAnalyticsId);
  if (args.metaPixelId) loadMetaPixel(args.metaPixelId);
}

export function ClientTrackingScripts(props: ClientTrackingScriptsProps) {
  const { googleAnalyticsId, metaPixelId } = props;

  useEffect(() => {
    loadTracking({ googleAnalyticsId, metaPixelId });

    function handleConsentChange() {
      loadTracking({ googleAnalyticsId, metaPixelId });
    }

    window.addEventListener('learnova-consent-change', handleConsentChange);
    window.addEventListener('storage', handleConsentChange);
    return () => {
      window.removeEventListener('learnova-consent-change', handleConsentChange);
      window.removeEventListener('storage', handleConsentChange);
    };
  }, [googleAnalyticsId, metaPixelId]);

  return null;
}
