'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';

const trackingConsentKey = 'learnova_tracking_consent';
const analyticsConsentKey = 'learnova_cookie_consent:cookies:analytics';
const bannerSeenKey = 'learnova_cookie_banner_seen';
const privatePrefixes = ['/admin', '/instructor', '/student', '/dashboard', '/learn', '/account', '/cart', '/checkout', '/messages', '/notifications', '/profile', '/invoice'];
const copy = {
  en: {
    title: 'Cookie preferences',
    body: 'Required cookies keep the platform secure. Analytics cookies help improve courses and checkout only if you allow them.',
    allow: 'Allow analytics',
    reject: 'Reject optional',
    manage: 'Manage',
    close: 'Close cookie banner',
  },
  ar: {
    title: 'تفضيلات ملفات الكوكيز',
    body: 'ملفات الكوكيز الأساسية تحافظ على أمان المنصة. ملفات التحليلات لا تعمل إلا إذا وافقت عليها.',
    allow: 'السماح بالتحليلات',
    reject: 'رفض الاختياري',
    manage: 'إدارة',
    close: 'إغلاق شريط الكوكيز',
  },
};

function isPrivatePath(pathname: string) {
  return privatePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function saveLocalConsent(choice: 'allowed' | 'rejected') {
  localStorage.setItem(trackingConsentKey, choice);
  localStorage.setItem(analyticsConsentKey, choice);
  localStorage.setItem(bannerSeenKey, '1');
  window.dispatchEvent(new Event('learnova-consent-change'));
}

async function recordConsent(granted: boolean) {
  await fetch('/api/consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ type: 'cookies:analytics', granted }),
  }).catch(() => null);
}

export function CookieConsentBanner({ locale = 'en' }: { locale?: string }) {
  const pathname = usePathname() || '/';
  const [visible, setVisible] = useState(false);
  const text = locale.toLowerCase().startsWith('ar') ? copy.ar : copy.en;

  useEffect(() => {
    if (isPrivatePath(pathname)) {
      setVisible(false);
      return;
    }

    try {
      setVisible(localStorage.getItem(bannerSeenKey) !== '1' && localStorage.getItem(analyticsConsentKey) === null);
    } catch {
      setVisible(false);
    }
  }, [pathname]);

  async function choose(granted: boolean) {
    const choice = granted ? 'allowed' : 'rejected';
    try {
      saveLocalConsent(choice);
    } catch {
      // If local storage is blocked, still record the server-side preference.
    }
    setVisible(false);
    await recordConsent(granted);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 border border-[#2F3336] bg-black p-4 text-white shadow-none md:left-auto md:max-w-xl">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#2F3336] text-[#1D9BF0]">
          <ShieldCheck size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">{text.title}</p>
          <p className="mt-1 text-sm leading-6 text-[#8A949E]">
            {text.body}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="moe-primary h-10 px-4 text-sm" type="button" onClick={() => choose(true)}>
              {text.allow}
            </button>
            <button className="moe-control h-10 px-4 text-sm font-black text-white" type="button" onClick={() => choose(false)}>
              {text.reject}
            </button>
            <Link className="inline-flex h-10 items-center rounded-full px-3 text-sm font-black text-[#1D9BF0]" href="/cookies">
              {text.manage}
            </Link>
          </div>
        </div>
        <button className="rounded-full p-2 text-[#8A949E] hover:bg-[#16181C] hover:text-white" type="button" onClick={() => choose(false)} aria-label={text.close}>
          <X size={17} />
        </button>
      </div>
    </div>
  );
}
