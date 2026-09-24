/**
 * lib/payment-gateways/tap.ts
 *
 * Tap Payments gateway adapter for Learnova Suite.
 *
 * Implements the GatewayAdapter interface using the Tap Payments v2 REST API
 * (https://api.tap.company/v2/). No external SDK — all calls use `fetch`.
 *
 * Environment variables required:
 *   TAP_SECRET_KEY  — Tap secret key (sk_live_... or sk_test_...)
 *
 * Requirements: 1.1, 1.8, 1.15
 */

import { createHmac, timingSafeEqual } from 'crypto';
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

const TAP_API_BASE = 'https://api.tap.company/v2';
const GATEWAY_SLUG = 'tap';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns the TAP_SECRET_KEY from the environment, or throws a configuration
 * error if it is missing.  We throw here (not return GatewayError) because a
 * missing key is a deployment misconfiguration, not a runtime API failure.
 */
function getSecretKey(): string {
  const key = process.env.TAP_SECRET_KEY;
  if (!key) {
    throw new Error(
      '[tap] TAP_SECRET_KEY environment variable is not set. ' +
        'Configure it before using the Tap gateway.',
    );
  }
  return key;
}

/**
 * Shared fetch wrapper for Tap API calls.
 *
 * Returns the parsed JSON body on success (2xx).
 * Returns a GatewayError on network failure or non-2xx response.
 * Never throws — all errors are caught and converted to GatewayError.
 *
 * Requirement 1.15: log with full context, return GatewayError, never throw.
 */
async function tapFetch<T = Record<string, unknown>>(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>,
  context?: string,
): Promise<T | GatewayError> {
  const secretKey = getSecretKey();
  const url = `${TAP_API_BASE}${path}`;

  let response: Response;
  let rawText: string;

  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    rawText = await response.text();
  } catch (networkErr) {
    const message =
      networkErr instanceof Error ? networkErr.message : String(networkErr);
    console.error('[tap] Network error', {
      context,
      method,
      url,
      error: message,
    });
    return {
      success: false,
      code: 'NETWORK_ERROR',
      message: `Tap API network error: ${message}`,
    } satisfies GatewayError;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    parsed = { raw: rawText };
  }

  if (!response.ok) {
    console.error('[tap] Non-2xx response', {
      context,
      method,
      url,
      status: response.status,
      body: parsed,
    });
    return {
      success: false,
      code: 'API_ERROR',
      message:
        (parsed['message'] as string | undefined) ??
        `Tap API returned HTTP ${response.status}`,
      httpStatus: response.status,
      rawResponse: parsed,
    } satisfies GatewayError;
  }

  return parsed as T;
}

// ---------------------------------------------------------------------------
// Tap-specific response shapes (minimal — only fields we use)
// ---------------------------------------------------------------------------

interface TapChargeResponse {
  id: string;
  status: string; // INITIATED, CAPTURED, VOID, REFUNDED, etc.
  amount: number;
  currency: string;
  transaction?: {
    url?: string;
  };
  reference?: {
    order?: string;
  };
}

interface TapRefundResponse {
  id: string;
  status: string;
  amount: number;
  currency: string;
}

// ---------------------------------------------------------------------------
// TapAdapter
// ---------------------------------------------------------------------------

export class TapAdapter implements GatewayAdapter {
  // -------------------------------------------------------------------------
  // createSession
  // -------------------------------------------------------------------------

  /**
   * Creates a Tap charge via POST /v2/charges and returns a PaymentSession
   * with mode `redirect` pointing to `transaction.url`.
   *
   * Requirement 1.8: redirect the student to the Tap payment page.
   */
  async createSession(
    order: Order,
    options: SessionOptions,
  ): Promise<PaymentSession | GatewayError> {
    const chargeBody: Record<string, unknown> = {
      amount: order.total,
      currency: order.currency,
      customer_initiated: true,
      threeDSecure: true,
      save_card: false,
      description: `Order ${order.invoiceNumber}`,
      metadata: {
        orderId: order.id,
        userId: order.userId,
        reference: options.reference,
        ...(options.metadata ?? {}),
      },
      reference: {
        transaction: options.reference,
        order: order.invoiceNumber,
      },
      receipt: {
        email: true,
        sms: false,
      },
      redirect: {
        url: options.successUrl,
      },
      post: {
        url: options.cancelUrl,
      },
      source: {
        id: 'src_all', // accept all payment methods
      },
    };

    const result = await tapFetch<TapChargeResponse>(
      'POST',
      '/charges',
      chargeBody,
      `createSession(orderId=${order.id})`,
    );

    if ('success' in result && result.success === false) {
      return result as GatewayError;
    }

    const charge = result as TapChargeResponse;
    const redirectUrl = charge.transaction?.url;

    if (!redirectUrl) {
      console.error('[tap] createSession: missing transaction.url in response', {
        orderId: order.id,
        chargeId: charge.id,
        response: charge,
      });
      return {
        success: false,
        code: 'MISSING_REDIRECT_URL',
        message:
          'Tap charge was created but transaction.url is missing in the response.',
        rawResponse: charge as unknown as Record<string, unknown>,
      } satisfies GatewayError;
    }

    return {
      gateway: GATEWAY_SLUG,
      orderId: order.id,
      reference: options.reference,
      mode: 'redirect',
      providerSessionId: charge.id,
      redirectUrl,
    } satisfies PaymentSession;
  }

  // -------------------------------------------------------------------------
  // verifyWebhook
  // -------------------------------------------------------------------------

  /**
   * Verifies the authenticity of a Tap webhook request.
   *
   * Tap sends an HMAC-SHA256 signature in the `hashstring` field of the
   * webhook payload itself (not a header).  The signature is computed over a
   * concatenated string of selected charge fields.
   *
   * Because the GatewayAdapter interface passes the raw body string and a
   * single signature string, callers should pass the value of the
   * `hashstring` field from the parsed payload as the `signature` argument.
   *
   * If `TAP_SECRET_KEY` is unavailable this method returns `false` (safe
   * default — reject the webhook).
   *
   * Requirement 2.8: returning false causes the webhook route to respond
   * with HTTP 401 and skip all event processing.
   */
  verifyWebhook(payload: string, signature: string): boolean {
    if (!signature) {
      console.warn('[tap] verifyWebhook: empty signature provided');
      return false;
    }

    let secretKey: string;
    try {
      secretKey = getSecretKey();
    } catch {
      console.error('[tap] verifyWebhook: TAP_SECRET_KEY not configured');
      return false;
    }

    // Tap's HMAC is computed over the raw payload body.
    const expected = createHmac('sha256', secretKey)
      .update(payload)
      .digest('hex');

    try {
      const expectedBuf = Buffer.from(expected, 'hex');
      const signatureBuf = Buffer.from(signature, 'hex');

      if (expectedBuf.length !== signatureBuf.length) {
        console.warn('[tap] verifyWebhook: signature length mismatch');
        return false;
      }

      const valid = timingSafeEqual(expectedBuf, signatureBuf);
      if (!valid) {
        console.warn('[tap] verifyWebhook: signature mismatch');
      }
      return valid;
    } catch (err) {
      console.error('[tap] verifyWebhook: comparison error', { error: err });
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // capturePayment
  // -------------------------------------------------------------------------

  /**
   * Retrieves the charge status from the Tap API.
   *
   * Tap charges are captured automatically (no separate capture step for
   * card payments).  This method fetches the charge by ID and returns a
   * CaptureResult reflecting the current status.
   *
   * Requirement 1.1: capturePayment must be implemented.
   */
  async capturePayment(
    sessionId: string,
  ): Promise<CaptureResult | GatewayError> {
    const result = await tapFetch<TapChargeResponse>(
      'GET',
      `/charges/${encodeURIComponent(sessionId)}`,
      undefined,
      `capturePayment(chargeId=${sessionId})`,
    );

    if ('success' in result && result.success === false) {
      return result as GatewayError;
    }

    const charge = result as TapChargeResponse;

    // Tap statuses that indicate a successful capture
    const successStatuses = new Set(['CAPTURED', 'AUTHORIZED']);
    const success = successStatuses.has(charge.status?.toUpperCase() ?? '');

    if (!success) {
      console.warn('[tap] capturePayment: charge not in captured state', {
        chargeId: sessionId,
        status: charge.status,
      });
      return {
        success: false,
        code: 'CAPTURE_NOT_COMPLETE',
        message: `Tap charge ${sessionId} has status "${charge.status}", expected CAPTURED.`,
        httpStatus: 200,
        rawResponse: charge as unknown as Record<string, unknown>,
      } satisfies GatewayError;
    }

    return {
      success: true,
      transactionId: charge.id,
      amount: charge.amount,
      currency: charge.currency,
      rawResponse: charge as unknown as Record<string, unknown>,
    } satisfies CaptureResult;
  }

  // -------------------------------------------------------------------------
  // refundPayment
  // -------------------------------------------------------------------------

  /**
   * Issues a refund via POST /v2/refunds.
   *
   * Requirement 1.14: on success the caller must update the Order status to
   * REFUNDED.
   */
  async refundPayment(
    transactionId: string,
    amount: number,
  ): Promise<RefundResult | GatewayError> {
    // First fetch the charge to get the currency
    const chargeResult = await tapFetch<TapChargeResponse>(
      'GET',
      `/charges/${encodeURIComponent(transactionId)}`,
      undefined,
      `refundPayment:fetchCharge(chargeId=${transactionId})`,
    );

    if ('success' in chargeResult && chargeResult.success === false) {
      return chargeResult as GatewayError;
    }

    const charge = chargeResult as TapChargeResponse;

    const refundBody: Record<string, unknown> = {
      charge_id: transactionId,
      amount,
      currency: charge.currency,
      description: `Refund for charge ${transactionId}`,
      reason: 'goods_not_provided',
    };

    const result = await tapFetch<TapRefundResponse>(
      'POST',
      '/refunds',
      refundBody,
      `refundPayment(chargeId=${transactionId}, amount=${amount})`,
    );

    if ('success' in result && result.success === false) {
      return result as GatewayError;
    }

    const refund = result as TapRefundResponse;

    // Tap refund statuses that indicate acceptance
    const acceptedStatuses = new Set(['INITIATED', 'PENDING', 'RETURNED']);
    const success = acceptedStatuses.has(refund.status?.toUpperCase() ?? '');

    if (!success) {
      console.error('[tap] refundPayment: unexpected refund status', {
        chargeId: transactionId,
        refundId: refund.id,
        status: refund.status,
      });
      return {
        success: false,
        code: 'REFUND_FAILED',
        message: `Tap refund ${refund.id} has unexpected status "${refund.status}".`,
        rawResponse: refund as unknown as Record<string, unknown>,
      } satisfies GatewayError;
    }

    return {
      success: true,
      refundId: refund.id,
      amount: refund.amount,
      currency: refund.currency,
      rawResponse: refund as unknown as Record<string, unknown>,
    } satisfies RefundResult;
  }
}

// ---------------------------------------------------------------------------
// Default export — a singleton instance ready for use
// ---------------------------------------------------------------------------

export const tapAdapter: GatewayAdapter = new TapAdapter();
export default tapAdapter;
