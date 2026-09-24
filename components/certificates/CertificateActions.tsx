'use client';

import { Check, Copy, Printer, Share2 } from 'lucide-react';
import { useState } from 'react';

type CertificateActionsProps = {
  title: string;
  publicPath: string;
  verifyPath: string;
  printPath?: string;
};

function absoluteUrl(path: string) {
  if (typeof window === 'undefined') return path;
  return new URL(path, window.location.origin).toString();
}

export function CertificateActions({ title, publicPath, verifyPath, printPath }: CertificateActionsProps) {
  const [copied, setCopied] = useState<'public' | 'verify' | null>(null);

  async function copyLink(kind: 'public' | 'verify', path: string) {
    await navigator.clipboard.writeText(absoluteUrl(path));
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1800);
  }

  async function shareCertificate() {
    const url = absoluteUrl(publicPath);
    if (navigator.share) {
      await navigator.share({ title, text: 'Verified course completion certificate', url });
      return;
    }
    await copyLink('public', publicPath);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button className="btn-secondary" type="button" onClick={shareCertificate}>
        <Share2 size={16} />
        Share
      </button>
      <button className="btn-secondary" type="button" onClick={() => copyLink('public', publicPath)}>
        {copied === 'public' ? <Check size={16} /> : <Copy size={16} />}
        Public link
      </button>
      <button className="btn-secondary" type="button" onClick={() => copyLink('verify', verifyPath)}>
        {copied === 'verify' ? <Check size={16} /> : <Copy size={16} />}
        Verify link
      </button>
      {printPath ? (
        <a className="btn-primary" href={printPath} target="_blank" rel="noreferrer">
          <Printer size={16} />
          PDF / Print
        </a>
      ) : null}
    </div>
  );
}
