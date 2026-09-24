'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export function AffiliateTracker() {
  const searchParams = useSearchParams();
  const ref = searchParams.get('ref');

  useEffect(() => {
    if (!ref) return;
    void fetch('/api/affiliate/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ref }),
    }).catch(() => null);
  }, [ref]);

  return null;
}
