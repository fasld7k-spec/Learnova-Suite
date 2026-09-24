/**
 * lib/payment-gateways/flutterwave.ts
 *
 * Flutterwave payment gateway adapter implementing the GatewayAdapter interface.
 *
 * Environment variables required:
 *   FLUTTERWAVE_SECRET_KEY   — Flutterwave secret key (used in API calls)
 *   FLUTTERWAVE_SECRET_HASH  — Flutterwave secret hash (used for webhook verification)
 *
 * Requirements: 1.1, 1.4
 *
 * Error handling (Requirement 1.15):
 *   All gateway API failures are logged with full context and returned as
 *   GatewayError objects. Exceptions are never thrown to the caller.
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

const FLUTTERWAVE_BASE_URL = 'https://api.flutterwave.com';
const GATEWAY_SLUG = 'flutterwave';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Retrieve and validate required environment variables at call time. */
function getConfig(): { secretKey: string; secretHash: string } {
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  const secretHash = process.env.FLUTTERWAVE_SECRET_HASH;

  if (!secretKey) {
    throw new Error('FLUTTERWAVE_SECRET_KEY environment variable is not set');
  }
  if (!secretHash) {
    throw new Error('FLUTTERWAVE_SECRET_HASH environment variable is not set');
  }

  return { secretKey, secretHash };
}

/** Build a GatewayError from a caught value. */
function buildGatewayError(
  code: string,
  message: string,
  httpStatus?: number,
  rawResponse?: Record<string, unknown>,
): GatewayError {
  return {
    success: false,
    code,
    message,
    ...(httpStatus !== undefined ? { httpStatus } : {}),
    ...(rawResponse !== undefined ? { rawResponse } : {}),
  };
}

/**
 * Perform a JSON fetch against the Flutterwave API.
 * Returns the parsed response body or throws on network errors.
 */
async function flutterwaveFetch<T>(
  path: string,
  secretKey: string,
  options: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: T }> {
  const url = `${FLUTTERWAVE_BASE_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secretKey}`,
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  const data = (await response.json()) as T;
  return { ok: response.ok, status: response.status, data };
}

// ---------------------------------------------------------------------------
// Flutterwave API response shapes
// ---------------------------------------------------------------------------

interface FlutterwavePaymentLinkResponse {
  status: string;
  message: string;
  data?: {
    link: string;
  };
}

interface FlutterwaveTransactionVerifyResponse {
  status: string;
  message: string;
  data?: {
    id: number;
    tx_ref: string;
    flw_ref: string;
    amount: number;
    currency: string;
    status: string;
    payment_type: string;
  };
}

interface FlutterwaveRefundResponse {
  status: string;
  message: string;
  data?: {
    id: number;
    amount_refunded: number;
    currency: string;
    status: string;
  };
}

// ---------------------------------------------------------------------------
// FlutterwaveAdapter
// ---------------------------------------------------------------------------

/**
 * Flutterwave implementation of GatewayAdapter.
 *
 * Requirement 1.4: WHEN a student initiates checkout with Flutterwave,
 * THE Payment_Gateway SHALL obtain a payment link via `POST /v3/payments`
 * and redirect the student to Flutterwave.
 */
export class FlutterwaveAdapter implements GatewayAdapter {
  // -------------------------------------------------------------------------
  // createSession
  // -------------------------------------------------------------------------

  /**
   * Create a Flutterwave payment session.
   *
   * Calls `POST /v3/payments` to obtain a hosted payment link, then returns
   * a PaymentSession with mode `redirect`.
   *
   * @param order   - The internal order to be paid.
   * @param options - URLs, reference string, and optional metadata.
   */
  async createSession(
    order: Order,
    options: SessionOptions,
  ): Promise<PaymentSession | GatewayError> {
    let config: ReturnType<typeof getConfig>;
    try {
      config = getConfig();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Flutterwave] createSession — configuration error', {
        orderId: order.id,
        error: message,
      });
      return buildGatewayError('CONFIG_ERROR', message);
    }

    const body = {
      tx_ref: options.reference,
      amount: order.total,
      currency: order.currency,
      redirect_url: options.successUrl,
      meta: {
        orderId: order.id,
        userId: order.userId,
        cancelUrl: options.cancelUrl,
        ...(options.metadata ?? {}),
      },
      customer: {
        email: `order-${order.id}@learnova.internal`,
      },
      customizations: {
        title: 'Learnova Suite',
        description: order.items.map((i) => i.title).join(', '),
      },
    };

    let result: { ok: boolean; status: number; data: FlutterwavePaymentLinkResponse };
    try {
      result = await flutterwaveFetch<FlutterwavePaymentLinkResponse>(
        '/v3/payments',
        config.secretKey,
        { method: 'POST', body: JSON.stringify(body) },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Flutterwave] createSession — network error', {
        orderId: order.id,
        reference: options.reference,
        error: message,
      });
      return buildGatewayError('NETWORK_ERROR', `Network error calling Flutterwave: ${message}`);
    }

    if (!result.ok || result.data.status !== 'success' || !result.data.data?.link) {
      console.error('[Flutterwave] createSession — API error', {
        orderId: order.id,
        reference: options.reference,
        httpStatus: result.status,
        response: result.data,
      });
      return buildGatewayError(
        'API_ERROR',
        result.data.message ?? 'Flutterwave payment link creation failed',
        result.status,
        result.data as unknown as Record<string, unknown>,
      );
    }

    const paymentLink = result.data.data.link;

    return {
      gateway: GATEWAY_SLUG,
      orderId: order.id,
      reference: options.reference,
      mode: 'redirect',
      // Flutterwave does not return a separate session ID; use the tx_ref as
      // the providerSessionId for later capture/verification.
      providerSessionId: options.reference,
      redirectUrl: paymentLink,
    };
  }

  // -------------------------------------------------------------------------
  // verifyWebhook
  // -------------------------------------------------------------------------

  /**
   * Verify a Flutterwave webhook request.
   *
   * Requirement 2.6: WHEN a Flutterwave webhook is received, THE
   * Webhook_Processor SHALL verify the `verif-hash` header by direct
   * comparison with the configured Flutterwave secret hash.
   *
   * No HMAC is used — this is a plain string equality check.
   *
   * @param _payload  - Raw request body (unused for Flutterwave verification).
   * @param signature - The value of the `verif-hash` header.
   * @returns `true` if the header matches the configured secret hash.
   */
  verifyWebhook(_payload: string, signature: string): boolean {
    let config: ReturnType<typeof getConfig>;
    try {
      config = getConfig();
    } catch (err) {
      console.error('[Flutterwave] verifyWebhook — configuration error', {
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }

    return signature === config.secretHash;
  }

  // -------------------------------------------------------------------------
  // capturePayment
  // -------------------------------------------------------------------------

  /**
   * Verify and capture a Flutterwave transaction.
   *
   * Flutterwave uses a verify-by-transaction-ID model. The `sessionId` here
   * is the Flutterwave transaction ID returned in the redirect callback
   * (`transaction_id` query parameter).
   *
   * Calls `GET /v3/transactions/{transactionId}/verify`.
   *
   * @param sessionId - The Flutterwave transaction ID.
   */
  async capturePayment(sessionId: string): Promise<CaptureResult | GatewayError> {
    let config: ReturnType<typeof getConfig>;
    try {
      config = getConfig();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Flutterwave] capturePayment — configuration error', {
        sessionId,
        error: message,
      });
      return buildGatewayError('CONFIG_ERROR', message);
    }

    let result: { ok: boolean; status: number; data: FlutterwaveTransactionVerifyResponse };
    try {
      result = await flutterwaveFetch<FlutterwaveTransactionVerifyResponse>(
        `/v3/transactions/${encodeURIComponent(sessionId)}/verify`,
        config.secretKey,
        { method: 'GET' },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Flutterwave] capturePayment — network error', {
        sessionId,
        error: message,
      });
      return buildGatewayError('NETWORK_ERROR', `Network error verifying Flutterwave transaction: ${message}`);
    }

    if (!result.ok || result.data.status !== 'success' || !result.data.data) {
      console.error('[Flutterwave] capturePayment — API error', {
        sessionId,
        httpStatus: result.status,
        response: result.data,
      });
      return buildGatewayError(
        'API_ERROR',
        result.data.message ?? 'Flutterwave transaction verification failed',
        result.status,
        result.data as unknown as Record<string, unknown>,
      );
    }

    const tx = result.data.data;

    if (tx.status !== 'successful') {
      console.error('[Flutterwave] capturePayment — transaction not successful', {
        sessionId,
        txStatus: tx.status,
        response: result.data,
      });
      return buildGatewayError(
        'PAYMENT_NOT_SUCCESSFUL',
        `Flutterwave transaction status is "${tx.status}", expected "successful"`,
        result.status,
        result.data as unknown as Record<string, unknown>,
      );
    }

    return {
      success: true,
      transactionId: String(tx.id),
      amount: tx.amount,
      currency: tx.currency,
      rawResponse: result.data as unknown as Record<string, unknown>,
    };
  }

  // -------------------------------------------------------------------------
  // refundPayment
  // -------------------------------------------------------------------------

  /**
   * Issue a refund for a completed Flutterwave transaction.
   *
   * Calls `POST /v3/transactions/{transactionId}/refund`.
   *
   * @param transactionId - The Flutterwave transaction ID to refund.
   * @param amount        - Amount to refund in the order's currency.
   */
  async refundPayment(
    transactionId: string,
    amount: number,
  ): Promise<RefundResult | GatewayError> {
    let config: ReturnType<typeof getConfig>;
    try {
      config = getConfig();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Flutterwave] refundPayment — configuration error', {
        transactionId,
        amount,
        error: message,
      });
      return buildGatewayError('CONFIG_ERROR', message);
    }

    let result: { ok: boolean; status: number; data: FlutterwaveRefundResponse };
    try {
      result = await flutterwaveFetch<FlutterwaveRefundResponse>(
        `/v3/transactions/${encodeURIComponent(transactionId)}/refund`,
        config.secretKey,
        { method: 'POST', body: JSON.stringify({ amount }) },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Flutterwave] refundPayment — network error', {
        transactionId,
        amount,
        error: message,
      });
      return buildGatewayError('NETWORK_ERROR', `Network error issuing Flutterwave refund: ${message}`);
    }

    if (!result.ok || result.data.status !== 'success' || !result.data.data) {
      console.error('[Flutterwave] refundPayment — API error', {
        transactionId,
        amount,
        httpStatus: result.status,
        response: result.data,
      });
      return buildGatewayError(
        'API_ERROR',
        result.data.message ?? 'Flutterwave refund failed',
        result.status,
        result.data as unknown as Record<string, unknown>,
      );
    }

    const refund = result.data.data;

    return {
      success: true,
      refundId: String(refund.id),
      amount: refund.amount_refunded,
      currency: refund.currency,
      rawResponse: result.data as unknown as Record<string, unknown>,
    };
  }
}
