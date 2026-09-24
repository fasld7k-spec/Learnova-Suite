/**
 * lib/payment-gateways/hyperpay.ts
 *
 * HyperPay payment gateway adapter implementing the GatewayAdapter interface.
 *
 * HyperPay uses an "inline" checkout model: the server creates a checkout
 * session and returns a `checkoutId`, which the frontend uses to render the
 * HyperPay payment widget via their JavaScript SDK. Both the server-side
 * checkout creation AND the client-side widget rendering must succeed for a
 * payment to be initiated (Requirement 1.9).
 *
 * Environment variables:
 *   HYPERPAY_ACCESS_TOKEN  — Bearer token for API authentication
 *   HYPERPAY_ENTITY_ID     — The entity (channel) ID for the payment brand
 *   HYPERPAY_BASE_URL      — Optional override; defaults to the test endpoint
 *
 * References:
 *   https://wordpresshyperpay.docs.oppwa.com/reference/parameters
 *   https://wordpresshyperpay.docs.oppwa.com/tutorials/server-to-server
 */

import { createHmac, timingSafeEqual } from 'crypto';
import type {
  GatewayAdapter,
  GatewayError,
  Order,
  SessionOptions,
  PaymentSession,
  CaptureResult,
  RefundResult,
} from './base';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** HyperPay test environment base URL (default). */
const DEFAULT_BASE_URL = 'https://eu-test.oppwa.com';

/** HyperPay production base URL. */
const PROD_BASE_URL = 'https://oppwa.com';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the HyperPay API base URL.
 * Uses HYPERPAY_BASE_URL if set, otherwise falls back to the test endpoint.
 * Set HYPERPAY_BASE_URL=https://oppwa.com for production.
 */
function resolveBaseUrl(): string {
  return (
    process.env.HYPERPAY_BASE_URL?.trim() ||
    (process.env.NODE_ENV === 'production' ? PROD_BASE_URL : DEFAULT_BASE_URL)
  );
}

/** Read and validate a required environment variable. */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Build a structured GatewayError and log it with full context.
 * Requirement 1.15: log with full context, return GatewayError (never throw).
 */
function buildError(
  code: string,
  message: string,
  context: Record<string, unknown>,
  httpStatus?: number,
  rawResponse?: Record<string, unknown>,
): GatewayError {
  console.error('[HyperPay] Gateway error', {
    code,
    message,
    httpStatus,
    rawResponse,
    ...context,
  });
  return {
    success: false,
    code,
    message,
    httpStatus,
    rawResponse,
  };
}

/**
 * Perform a URL-encoded form POST to the HyperPay API.
 * HyperPay's REST API accepts `application/x-www-form-urlencoded` bodies.
 */
async function hyperPayPost(
  path: string,
  params: Record<string, string>,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const accessToken = requireEnv('HYPERPAY_ACCESS_TOKEN');
  const baseUrl = resolveBaseUrl();
  const url = `${baseUrl}${path}`;

  const body = new URLSearchParams(params).toString();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  let data: Record<string, unknown> = {};
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    // Non-JSON response body — leave data empty
  }

  return { ok: response.ok, status: response.status, data };
}

/**
 * Perform a GET request to the HyperPay API.
 */
async function hyperPayGet(
  path: string,
  queryParams?: Record<string, string>,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const accessToken = requireEnv('HYPERPAY_ACCESS_TOKEN');
  const baseUrl = resolveBaseUrl();

  const url = new URL(`${baseUrl}${path}`);
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  let data: Record<string, unknown> = {};
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    // Non-JSON response body — leave data empty
  }

  return { ok: response.ok, status: response.status, data };
}

/**
 * Determine whether a HyperPay result code indicates success.
 * HyperPay uses result codes in the format "000.000.000" for success.
 * Pending codes start with "000.200" (async processing).
 */
function isSuccessCode(resultCode: string): boolean {
  // Successful transaction
  if (/^(000\.000\.|000\.100\.1|000\.[36])/.test(resultCode)) return true;
  // Pending / needs review (treat as success for capture queries)
  if (/^(000\.200)/.test(resultCode)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// HyperPayAdapter
// ---------------------------------------------------------------------------

/**
 * HyperPay gateway adapter.
 *
 * Implements the GatewayAdapter interface for HyperPay's REST API.
 * Uses the "inline" checkout mode: the frontend renders the HyperPay widget
 * using the `checkoutId` returned in the PaymentSession payload.
 */
export class HyperPayAdapter implements GatewayAdapter {
  // -------------------------------------------------------------------------
  // createSession
  // -------------------------------------------------------------------------

  /**
   * Create a HyperPay checkout session.
   *
   * Calls `POST /v1/checkouts` to obtain a `checkoutId`. The frontend uses
   * this ID to render the HyperPay payment widget via their JS SDK.
   *
   * Returns a PaymentSession with:
   *   - mode: 'inline'
   *   - providerSessionId: the checkoutId
   *   - payload.checkoutId: the checkoutId (for the frontend widget)
   *   - payload.scriptUrl: the HyperPay JS SDK URL for widget rendering
   *
   * Requirement 1.9: both checkout creation (server) and widget rendering
   * (client) must succeed.
   */
  async createSession(
    order: Order,
    options: SessionOptions,
  ): Promise<PaymentSession | GatewayError> {
    let entityId: string;
    try {
      entityId = requireEnv('HYPERPAY_ENTITY_ID');
    } catch (err) {
      return buildError(
        'CONFIG_ERROR',
        (err as Error).message,
        { orderId: order.id },
      );
    }

    // HyperPay expects the amount as a string with exactly 2 decimal places
    const amount = order.total.toFixed(2);

    const params: Record<string, string> = {
      entityId,
      amount,
      currency: order.currency.toUpperCase(),
      paymentType: 'DB', // Debit (immediate capture)
      merchantTransactionId: options.reference,
      'customParameters[orderId]': order.id,
      'customParameters[invoiceNumber]': order.invoiceNumber,
    };

    // Add success/cancel URLs as custom parameters (HyperPay does not have
    // native redirect URL fields for the inline widget flow; the frontend
    // handles post-payment navigation using these values).
    if (options.successUrl) {
      params['shopperResultUrl'] = options.successUrl;
    }
    if (options.cancelUrl) {
      params['customParameters[cancelUrl]'] = options.cancelUrl;
    }

    // Forward optional locale
    if (options.locale) {
      params['customParameters[locale]'] = options.locale;
    }

    // Forward any extra metadata
    if (options.metadata) {
      for (const [key, value] of Object.entries(options.metadata)) {
        params[`customParameters[${key}]`] = String(value);
      }
    }

    let result: { ok: boolean; status: number; data: Record<string, unknown> };
    try {
      result = await hyperPayPost('/v1/checkouts', params);
    } catch (err) {
      return buildError(
        'NETWORK_ERROR',
        `HyperPay checkout creation failed: ${(err as Error).message}`,
        { orderId: order.id, reference: options.reference },
      );
    }

    if (!result.ok) {
      return buildError(
        'API_ERROR',
        'HyperPay returned a non-2xx response during checkout creation',
        { orderId: order.id, reference: options.reference },
        result.status,
        result.data,
      );
    }

    const checkoutId = result.data.id as string | undefined;
    if (!checkoutId) {
      return buildError(
        'INVALID_RESPONSE',
        'HyperPay checkout response did not include a checkout ID',
        { orderId: order.id, reference: options.reference },
        result.status,
        result.data,
      );
    }

    // Build the HyperPay JS SDK URL so the frontend can load the widget.
    // The script URL varies between test and production environments.
    const baseUrl = resolveBaseUrl();
    const scriptUrl = `${baseUrl}/v1/paymentWidgets.js?checkoutId=${checkoutId}`;

    return {
      gateway: 'hyperpay',
      orderId: order.id,
      reference: options.reference,
      mode: 'inline',
      providerSessionId: checkoutId,
      instructions:
        'Render the HyperPay payment widget using the checkoutId in the payload.',
      payload: {
        checkoutId,
        scriptUrl,
      },
    };
  }

  // -------------------------------------------------------------------------
  // verifyWebhook
  // -------------------------------------------------------------------------

  /**
   * Verify a HyperPay webhook notification.
   *
   * HyperPay signs webhook notifications using HMAC-SHA256 of the raw
   * request body with the access token as the secret key. The signature is
   * sent in the `X-Initialization-Vector` + `X-Authentication-Tag` headers,
   * or alternatively as a query parameter `signature` on the notification URL.
   *
   * For simplicity and broad compatibility this implementation supports the
   * common pattern where HyperPay sends the HMAC-SHA256 hex digest of the
   * raw body (using the access token as the key) in the `signature` header
   * or query parameter.
   *
   * @param payload   - Raw request body string (before JSON parsing).
   * @param signature - The signature value from the webhook request.
   * @returns `true` if the signature is valid, `false` otherwise.
   */
  verifyWebhook(payload: string, signature: string): boolean {
    if (!payload || !signature) {
      console.warn('[HyperPay] verifyWebhook called with empty payload or signature');
      return false;
    }

    let accessToken: string;
    try {
      accessToken = requireEnv('HYPERPAY_ACCESS_TOKEN');
    } catch {
      console.error('[HyperPay] verifyWebhook: HYPERPAY_ACCESS_TOKEN is not set');
      return false;
    }

    try {
      const expected = createHmac('sha256', accessToken)
        .update(payload, 'utf8')
        .digest('hex');

      // Use timing-safe comparison to prevent timing attacks
      const expectedBuf = Buffer.from(expected, 'hex');
      const receivedBuf = Buffer.from(signature.toLowerCase(), 'hex');

      if (expectedBuf.length !== receivedBuf.length) {
        return false;
      }

      return timingSafeEqual(expectedBuf, receivedBuf);
    } catch (err) {
      console.error('[HyperPay] verifyWebhook: signature comparison failed', {
        error: (err as Error).message,
      });
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // capturePayment
  // -------------------------------------------------------------------------

  /**
   * Query the payment status from HyperPay.
   *
   * HyperPay uses a "server-to-server" model where the payment status is
   * queried via `GET /v1/checkouts/{checkoutId}/payment` after the widget
   * completes. This method fetches the payment result and returns a
   * CaptureResult.
   *
   * @param sessionId - The `checkoutId` (providerSessionId) from createSession.
   */
  async capturePayment(
    sessionId: string,
  ): Promise<CaptureResult | GatewayError> {
    let entityId: string;
    try {
      entityId = requireEnv('HYPERPAY_ENTITY_ID');
    } catch (err) {
      return buildError(
        'CONFIG_ERROR',
        (err as Error).message,
        { sessionId },
      );
    }

    let result: { ok: boolean; status: number; data: Record<string, unknown> };
    try {
      result = await hyperPayGet(
        `/v1/checkouts/${encodeURIComponent(sessionId)}/payment`,
        { entityId },
      );
    } catch (err) {
      return buildError(
        'NETWORK_ERROR',
        `HyperPay payment status query failed: ${(err as Error).message}`,
        { sessionId },
      );
    }

    if (!result.ok) {
      return buildError(
        'API_ERROR',
        'HyperPay returned a non-2xx response during payment status query',
        { sessionId },
        result.status,
        result.data,
      );
    }

    const resultCode = (result.data.result as Record<string, unknown> | undefined)
      ?.code as string | undefined;

    if (!resultCode) {
      return buildError(
        'INVALID_RESPONSE',
        'HyperPay payment status response did not include a result code',
        { sessionId },
        result.status,
        result.data,
      );
    }

    if (!isSuccessCode(resultCode)) {
      return buildError(
        'PAYMENT_FAILED',
        `HyperPay payment was not successful (result code: ${resultCode})`,
        { sessionId, resultCode },
        result.status,
        result.data,
      );
    }

    const transactionId = (result.data.id as string | undefined) ?? sessionId;
    const amount = parseFloat((result.data.amount as string | undefined) ?? '0');
    const currency = (result.data.currency as string | undefined) ?? '';

    return {
      success: true,
      transactionId,
      amount,
      currency,
      rawResponse: result.data,
    };
  }

  // -------------------------------------------------------------------------
  // refundPayment
  // -------------------------------------------------------------------------

  /**
   * Issue a refund via the HyperPay API.
   *
   * HyperPay refunds are created by posting a refund (payment type `RF`)
   * against the original transaction ID via `POST /v1/payments/{transactionId}`.
   *
   * @param transactionId - The HyperPay transaction ID to refund.
   * @param amount        - Amount to refund in the order's currency.
   */
  async refundPayment(
    transactionId: string,
    amount: number,
  ): Promise<RefundResult | GatewayError> {
    let entityId: string;
    try {
      entityId = requireEnv('HYPERPAY_ENTITY_ID');
    } catch (err) {
      return buildError(
        'CONFIG_ERROR',
        (err as Error).message,
        { transactionId, amount },
      );
    }

    const params: Record<string, string> = {
      entityId,
      amount: amount.toFixed(2),
      paymentType: 'RF', // Refund
    };

    let result: { ok: boolean; status: number; data: Record<string, unknown> };
    try {
      result = await hyperPayPost(
        `/v1/payments/${encodeURIComponent(transactionId)}`,
        params,
      );
    } catch (err) {
      return buildError(
        'NETWORK_ERROR',
        `HyperPay refund request failed: ${(err as Error).message}`,
        { transactionId, amount },
      );
    }

    if (!result.ok) {
      return buildError(
        'API_ERROR',
        'HyperPay returned a non-2xx response during refund',
        { transactionId, amount },
        result.status,
        result.data,
      );
    }

    const resultCode = (result.data.result as Record<string, unknown> | undefined)
      ?.code as string | undefined;

    if (!resultCode) {
      return buildError(
        'INVALID_RESPONSE',
        'HyperPay refund response did not include a result code',
        { transactionId, amount },
        result.status,
        result.data,
      );
    }

    if (!isSuccessCode(resultCode)) {
      return buildError(
        'REFUND_FAILED',
        `HyperPay refund was not successful (result code: ${resultCode})`,
        { transactionId, amount, resultCode },
        result.status,
        result.data,
      );
    }

    const refundId = (result.data.id as string | undefined) ?? transactionId;
    const refundedAmount = parseFloat(
      (result.data.amount as string | undefined) ?? amount.toFixed(2),
    );
    const currency = (result.data.currency as string | undefined) ?? '';

    return {
      success: true,
      refundId,
      amount: refundedAmount,
      currency,
      rawResponse: result.data,
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

/**
 * Pre-instantiated HyperPay adapter.
 * Import this in the gateway registry or webhook router.
 */
export const hyperpayAdapter = new HyperPayAdapter();
