'use client';

import { useEffect } from 'react';
import Link from 'next/link';

type InlineGatewayCheckoutProps = {
  gateway: string;
  payload: Record<string, any>;
  successUrl: string;
  cancelUrl: string;
};

export function InlineGatewayCheckout({ gateway, payload, successUrl, cancelUrl }: InlineGatewayCheckoutProps) {
  useEffect(() => {
    if (gateway !== 'hyperpay' || !payload.scriptUrl) return;
    const script = document.createElement('script');
    script.src = String(payload.scriptUrl);
    script.async = true;
    script.dataset.gateway = 'hyperpay';
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  }, [gateway, payload.scriptUrl]);

  if (gateway === 'iyzico') {
    const html = String(payload.checkoutFormContent || '');
    return html ? (
      <div className="grid gap-4">
        <div id="iyzipay-checkout-form" className="responsive" dangerouslySetInnerHTML={{ __html: html }} />
        <Link className="btn-secondary w-fit" href={cancelUrl}>
          Cancel payment
        </Link>
      </div>
    ) : (
      <div className="border border-[#2F3336] bg-black p-5">
        <p className="font-bold text-white">Iyzico returned a checkout token but no embedded form content.</p>
        <p className="mt-2 text-sm text-[#71767B]">Check your Iyzico account mode and callback settings, then create the payment session again.</p>
      </div>
    );
  }

  if (gateway === 'hyperpay') {
    return (
      <div className="grid gap-4">
        <form action={successUrl} className="paymentWidgets" data-brands={String(payload.brands || 'VISA MASTER AMEX MADA')} />
        <Link className="btn-secondary w-fit" href={cancelUrl}>
          Cancel payment
        </Link>
      </div>
    );
  }

  return (
    <div className="border border-[#2F3336] bg-black p-5">
      <p className="font-bold text-white">This gateway does not expose an inline checkout widget.</p>
      <Link className="mt-4 inline-flex btn-secondary" href={cancelUrl}>
        Back to checkout
      </Link>
    </div>
  );
}
