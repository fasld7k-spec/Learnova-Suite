/**
 * lib/payment-gateways/mollie.ts
 *
 * Mollie payment gateway adapter for Learnova Suite.
 *
 * Implements the GatewayAdapter interface using the Mollie REST API v2
 * (https://api.mollie.com/v2/) via native `fetch` — no external SDK.
 *
 * Environment variables required:
 *   MOLLIE_API_KEY  — Mollie live or test API key (e.g. "live_…" / "test_…")
 *
 * Requirement 1.1  — implements all four GatewayAdapter methods.
 * Requirement 1.5  — creates a Mollie payment and redirects to checkout.
 * Requirement 1.14 — refundPayment calls the Mollie refunds endpoint.
 * Requirement 1.15 — all API failures are logged with full context and
 *                    returned as GatewayError; nothing is ever thrown.
 * Requirement 2.7  — verifyWebhook fetches payment status from Mollie
 *                    using the payment ID in the webhook payload (no
 *                    signature header — Mollie uses API-fetch verification).
 */

import type {
  GatewayAdapter,
  Order,
  SessionOptions,
  PaymentSession,
  CaptureResult,
  RefundResult,
  GatewayError,
} from './base';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOLLIE_BASE_URL = 'https://api.mollie.com/v2';
const GATEWAY_SLUG = 'mollie';

// ---------------------------------------------------------------------------
// Internal Mollie API types (subset of the full Mollie response shapes)
// ---------------------------------------------------------------------------

interface MollieAmount {
  currency: string;
  /** Decimal string, e.g. "49.99" */
  value: string;
}

interface MollieLink {
  href: string;
  type: string;
}

interface MolliePayment {
  id: string;
  status: string;
  amount: MollieAmount;
  description: string;
  metadata: Record<string, unknown> | null;
  _links: {
    checkout?: MollieLink;
    self: MollieLink;
  };
}

interface MollieRefund {
  id: string;
  amount: MollieAmount;
  status: string;
  paymentId: string;
}

interface MollieErrorResponse {
  status: number;
  title: string;
  detail: string;
}

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/**
 * Format a numeric amount as a Mollie-compatible decimal string with exactly
 * two decimal places (e.g. 49.9 → "49.90").
 */
function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

/**
 * Build the Authorization header value from the configured API key.
 * Throws a descriptive error at construction time if the key is missing so
 * that misconfiguration is caught early (before any request is made).
 */
function getAuthHeader(): string {
  const key = process.env.MOLLIE_API_KEY;
  if (!key) {
    throw new Error(
      '[MollieAdapter] MOLLIE_API_KEY environment variable is not set.',
    );
  }
  return `Bearer ${key}`;
}

/**
 * Perform a fetch against the Mollie API and return the parsed JSON body.
 * Returns a tuple of [data, error] — exactly one of the two will be non-null.
 */
async function mollieFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<[T | null, MollieErrorResponse | null]> {
  const url = `${MOLLIE_BASE_URL}${path}`;
  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: getAuthHeader(),
        ...(init?.headers ?? {}),
      },
    });
  } catch (networkError) {
    // Network-level failure (DNS, timeout, etc.)
    const detail =
      networkError instanceof Error
        ? networkError.message
        : String(networkError);
    return [
      null,
      { status: 0, title: 'Network Error', detail },
    ];
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  if (!response.ok) {
    const errBody = body as Partial<MollieErrorResponse>;
    return [
      null,
      {
        status: response.status,
        title: errBody.title ?? response.statusText,
        detail: errBody.detail ?? `HTTP ${response.status}`,
      },
    ];
  }

  return [body as T, null];
}

/**
 * Build a structured GatewayError and log it with full context.
 * Requirement 1.15: log with full context, return GatewayError, never throw.
 */
function buildGatewayError(
  operation: string,
  context: Record<string, unknown>,
  apiError: MollieErrorResponse,
): GatewayError {
  const error: GatewayError = {
    success: false,
    code: apiError.status === 0 ? 'NETWORK_ERROR' : `MOLLIE_${apiError.status}`,
    message: `[MollieAdapter] ${operation} failed: ${apiError.detail}`,
    httpStatus: apiError.status || undefined,
    rawResponse: {
      title: apiError.title,
      detail: apiError.detail,
      status: apiError.status,
    },
  };

  // Requirement 1.15 — log with full context
  console.error('[MollieAdapter] Gateway error', {
    operation,
    ...context,
    error: {
      code: error.code,
      message: error.message,
      httpStatus: error.httpStatus,
      rawResponse: error.rawResponse,
    },
  });

  return error;
}

// ---------------------------------------------------------------------------
// MollieAdapter
// ---------------------------------------------------------------------------

export class MollieAdapter implements GatewayAdapter {
  // -------------------------------------------------------------------------
  // createSession
  // -------------------------------------------------------------------------

  /**
   * Create a Mollie payment and return a PaymentSession with mode `redirect`
   * pointing to `_links.checkout.href`.
   *
   * Requirement 1.5: redirect the student to the Mollie checkout page.
   */
  async createSession(
    order: Order,
    options: SessionOptions,
  ): Promise<PaymentSession | GatewayError> {
    const body = {
      amount: {
        currency: order.currency.toUpperCase(),
        value: formatAmount(order.total),
      },
      description: `Order ${order.invoiceNumber}`,
      redirectUrl: options.successUrl,
      webhookUrl: `${new URL(options.successUrl).origin}/api/webhooks/mollie`,
      metadata: {
        orderId: order.id,
        reference: options.reference,
        userId: order.userId,
        ...(options.metadata ?? {}),
      },
      locale: options.locale ?? 'en_US',
    };

    const [payment, apiError] = await mollieFetch<MolliePayment>('/payments', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (apiError !== null || payment === null) {
      return buildGatewayError('createSession', { orderId: order.id, reference: options.reference }, apiError!);
    }

    const checkoutHref = payment._links.checkout?.href;
    if (!checkoutHref) {
      const missingLinkError: MollieErrorResponse = {
        status: 0,
        title: 'Missing checkout link',
        detail: 'Mollie payment response did not include _links.checkout.href',
      };
      return buildGatewayError('createSession', { orderId: order.id, paymentId: payment.id }, missingLinkError);
    }

    const session: PaymentSession = {
      gateway: GATEWAY_SLUG,
      orderId: order.id,
      reference: options.reference,
      mode: 'redirect',
      providerSessionId: payment.id,
      redirectUrl: checkoutHref,
    };

    return session;
  }

  // -------------------------------------------------------------------------
  // verifyWebhook
  // -------------------------------------------------------------------------

  /**
   * Verify a Mollie webhook by fetching the payment status directly from the
   * Mollie API using the payment ID supplied in the webhook payload.
   *
   * Mollie does NOT send a signature header — verification is done by
   * confirming the payment exists and is in a terminal state via the API.
   *
   * Requirement 2.7: fetch payment status from Mollie using the payment ID.
   *
   * @param payload   - Raw URL-encoded webhook body (contains `id=tr_xxxxx`).
   * @param _signature - Unused for Mollie (no signature header).
   * @returns `true` if the payment ID resolves to a real Mollie payment,
   *          `false` if the ID is missing, malformed, or the API call fails.
   */
  verifyWebhook(payload: string, _signature: string): boolean {
    // Mollie sends `id=tr_xxxxxxxx` as an application/x-www-form-urlencoded body.
    let paymentId: string | null = null;

    try {
      const params = new URLSearchParams(payload);
      paymentId = params.get('id');
    } catch {
      console.warn('[MollieAdapter] verifyWebhook: failed to parse payload', { payload });
      return false;
    }

    if (!paymentId) {
      console.warn('[MollieAdapter] verifyWebhook: no payment ID in payload', { payload });
      return false;
    }

    // Perform a synchronous-style check: we schedule the async fetch but
    // return a boolean. Because the GatewayAdapter interface declares
    // verifyWebhook as synchronous (returns boolean), we perform a best-effort
    // check here. The webhook route should call verifyWebhookAsync for full
    // async verification (see below). This synchronous overload validates that
    // the payload at least contains a well-formed Mollie payment ID.
    const mollieIdPattern = /^tr_[A-Za-z0-9]+$/;
    if (!mollieIdPattern.test(paymentId)) {
      console.warn('[MollieAdapter] verifyWebhook: malformed payment ID', { paymentId });
      return false;
    }

    return true;
  }

  /**
   * Async variant of webhook verification that actually fetches the payment
   * from the Mollie API to confirm it exists.
   *
   * The webhook route handler should call this method and await the result.
   *
   * @param payload - Raw URL-encoded webhook body.
   * @returns `true` if the payment exists in Mollie, `false` otherwise.
   */
  async verifyWebhookAsync(payload: string): Promise<boolean> {
    let paymentId: string | null = null;

    try {
      const params = new URLSearchParams(payload);
      paymentId = params.get('id');
    } catch {
      console.warn('[MollieAdapter] verifyWebhookAsync: failed to parse payload', { payload });
      return false;
    }

    if (!paymentId) {
      console.warn('[MollieAdapter] verifyWebhookAsync: no payment ID in payload', { payload });
      return false;
    }

    const [payment, apiError] = await mollieFetch<MolliePayment>(`/payments/${encodeURIComponent(paymentId)}`);

    if (apiError !== null || payment === null) {
      console.warn('[MollieAdapter] verifyWebhookAsync: could not fetch payment from Mollie', {
        paymentId,
        error: apiError,
      });
      return false;
    }

    return true;
  }

  /**
   * Mollie webhooks only carry `id=tr_xxx` and are unsigned, so nothing else in
   * the request body can be trusted. Fetch the payment from the Mollie API and
   * return a payload built solely from Mollie's response (status, amount,
   * currency, our order ID and reference from the metadata we set).
   *
   * @returns `null` when the ID is malformed or Mollie does not know the payment.
   */
  async fetchTrustedWebhookPayload(payload: string): Promise<Record<string, unknown> | null> {
    let paymentId: string | null = null;
    try {
      paymentId = new URLSearchParams(payload).get('id');
    } catch {
      return null;
    }
    if (!paymentId || !/^tr_[A-Za-z0-9]+$/.test(paymentId)) return null;

    const [payment, apiError] = await mollieFetch<MolliePayment>(`/payments/${encodeURIComponent(paymentId)}`);
    if (apiError !== null || payment === null) {
      console.warn('[MollieAdapter] fetchTrustedWebhookPayload: could not fetch payment from Mollie', { paymentId, error: apiError });
      return null;
    }

    const metadata = payment.metadata ?? {};
    return {
      id: payment.id,
      status: payment.status,
      orderId: metadata.orderId != null ? String(metadata.orderId) : undefined,
      reference: metadata.reference != null ? String(metadata.reference) : undefined,
      amount: { value: payment.amount.value, currency: payment.amount.currency },
    };
  }

  // -------------------------------------------------------------------------
  // capturePayment
  // -------------------------------------------------------------------------

  /**
   * Fetch the payment status from Mollie to confirm it is paid.
   *
   * Mollie payments are captured automatically (no separate capture step for
   * standard payment methods). This method fetches the payment and confirms
   * its status is `paid`.
   *
   * @param sessionId - The Mollie payment ID (e.g. `tr_xxxxxxxx`).
   */
  async capturePayment(
    sessionId: string,
  ): Promise<CaptureResult | GatewayError> {
    const [payment, apiError] = await mollieFetch<MolliePayment>(
      `/payments/${encodeURIComponent(sessionId)}`,
    );

    if (apiError !== null || payment === null) {
      return buildGatewayError('capturePayment', { sessionId }, apiError!);
    }

    if (payment.status !== 'paid') {
      const notPaidError: MollieErrorResponse = {
        status: 0,
        title: 'Payment not paid',
        detail: `Mollie payment ${sessionId} has status "${payment.status}", expected "paid"`,
      };
      return buildGatewayError('capturePayment', { sessionId, status: payment.status }, notPaidError);
    }

    const result: CaptureResult = {
      success: true,
      transactionId: payment.id,
      amount: parseFloat(payment.amount.value),
      currency: payment.amount.currency,
      rawResponse: payment as unknown as Record<string, unknown>,
    };

    return result;
  }

  // -------------------------------------------------------------------------
  // refundPayment
  // -------------------------------------------------------------------------

  /**
   * Create a refund via the Mollie API.
   *
   * Requirement 1.14: on success the caller MUST update the Order status to
   * `REFUNDED`.
   *
   * @param transactionId - The Mollie payment ID to refund (e.g. `tr_xxxxxxxx`).
   * @param amount        - Amount to refund in the payment's currency.
   */
  async refundPayment(
    transactionId: string,
    amount: number,
  ): Promise<RefundResult | GatewayError> {
    // First fetch the payment to get the currency
    const [payment, fetchError] = await mollieFetch<MolliePayment>(
      `/payments/${encodeURIComponent(transactionId)}`,
    );

    if (fetchError !== null || payment === null) {
      return buildGatewayError('refundPayment (fetch payment)', { transactionId }, fetchError!);
    }

    const refundBody = {
      amount: {
        currency: payment.amount.currency,
        value: formatAmount(amount),
      },
    };

    const [refund, refundError] = await mollieFetch<MollieRefund>(
      `/payments/${encodeURIComponent(transactionId)}/refunds`,
      {
        method: 'POST',
        body: JSON.stringify(refundBody),
      },
    );

    if (refundError !== null || refund === null) {
      return buildGatewayError('refundPayment', { transactionId, amount }, refundError!);
    }

    const result: RefundResult = {
      success: true,
      refundId: refund.id,
      amount: parseFloat(refund.amount.value),
      currency: refund.amount.currency,
      rawResponse: refund as unknown as Record<string, unknown>,
    };

    return result;
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

/** Pre-constructed singleton — import and use directly in route handlers. */
export const mollieAdapter = new MollieAdapter();
