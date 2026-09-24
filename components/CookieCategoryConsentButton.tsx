'use client';

import { useEffect, useState } from 'react';

export function CookieCategoryConsentButton({ categoryId, required }: { categoryId: string; required?: boolean }) {
  const [choice, setChoice] = useState<'allowed' | 'rejected' | null>(required ? 'allowed' : null);
  const [saving, setSaving] = useState(false);
  const [savingChoice, setSavingChoice] = useState<'allowed' | 'rejected' | null>(null);

  useEffect(() => {
    if (required) return;
    try {
      const stored = localStorage.getItem(`learnova_cookie_consent:cookies:${categoryId}`);
      if (stored === 'allowed' || stored === 'rejected') setChoice(stored);
    } catch {
      // Browser storage can be unavailable in strict privacy modes.
    }
  }, [categoryId, required]);

  function storeBrowserConsent(nextChoice: 'allowed' | 'rejected') {
    try {
      localStorage.setItem(`learnova_cookie_consent:cookies:${categoryId}`, nextChoice);
      if (categoryId === 'analytics') localStorage.setItem('learnova_tracking_consent', nextChoice);
      window.dispatchEvent(new Event('learnova-consent-change'));
    } catch {
      // Browser storage can be unavailable in strict privacy modes; server consent is still recorded.
    }
  }

  async function saveConsent(granted: boolean) {
    if (required || saving) return;
    const nextChoice = granted ? 'allowed' : 'rejected';
    setSaving(true);
    setSavingChoice(nextChoice);
    try {
      const response = await fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ type: `cookies:${categoryId}`, granted }),
      });
      if (response.ok) {
        setChoice(nextChoice);
        storeBrowserConsent(nextChoice);
      }
    } finally {
      setSaving(false);
      setSavingChoice(null);
    }
  }

  if (required) {
    return (
      <span className="moe-control mt-5 inline-flex min-h-10 items-center px-4 text-sm font-black text-slate-200">
        Required
      </span>
    );
  }

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      <button className="moe-primary px-4" type="button" onClick={() => saveConsent(true)} disabled={saving}>
        {savingChoice === 'allowed' ? 'Saving...' : choice === 'allowed' ? 'Allowed' : 'Allow'}
      </button>
      <button className="moe-control px-4 text-sm font-black text-slate-200" type="button" onClick={() => saveConsent(false)} disabled={saving}>
        {savingChoice === 'rejected' ? 'Saving...' : choice === 'rejected' ? 'Rejected' : 'Reject'}
      </button>
    </div>
  );
}
