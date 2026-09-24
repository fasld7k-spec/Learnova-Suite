/**
 * lib/payment-gateways/paystack.ts
 *
 * Paystack payment gateway adapter implementing the GatewayAdapter interface.
 *
 * Requirements: 1.1, 1.3, 1.15
 *
 * - createSession  : POST /transaction/initialize → authorization_url, mode: redirect
 * - verifyWebhook  : HMAC-SHA256 of raw body with PAYSTACK_SECRET_KEY vs x-paystack-signature
 * - capturePayment : GET /transaction/verify/:reference
 * - refundPayment  : POST /refund
 *
 * Uses Node.js built-in `crypto` for HMAC. No external SDK — fetch only.
 * Errors are logged with full context and returned as GatewayError (never thrown).
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

const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const GATEWAY_SLUG = 'paystack';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns the Paystack secret key from the environment.
 * Throws a configuration error (logged + returned as GatewayError) if absent.
 */
function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error('PAYSTACK_SECRET_KEY environment variable is not set');
  }
  return key;
}

/**
 * Builds a GatewayError from any caught value.
 * Requirement 1.15: log with full context, return structured error.
 */
function buildGatewayError(
  code: string,
  message: string,
  context: Record<string, unknown>,
  httpStatus?: number,
  rawResponse?: Record<string, unknown>,
): GatewayError {
  console.error('[Paystack] Gateway error', {
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
 * Executes a Paystack API request and returns the parsed JSON body.
 * On non-2xx responses or network errors, returns a GatewayError.
 */
async function paystackRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>,
  context?: Record<string, unknown>,
): Promise<T | GatewayError> {
  const secretKey = getSecretKey();
  const url = `${PAYSTACK_BASE_URL}${path}`;

  let response: Response;
  let rawBody: string | undefined;

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
  } catch (err) {
    return buildGatewayError(
      'NETWORK_ERROR',
      `Network error calling Paystack ${method} ${path}: ${String(err)}`,
      { url, method, ...context },
    );
  }

  try {
    rawBody = await response.text();
  } catch (err) {
    return buildGatewayError(
      'RESPONSE_READ_ERROR',
      `Failed to read Paystack response body: ${String(err)}`,
      { url, method, httpStatus: response.status, ...context },
      response.status,
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return buildGatewayError(
      'INVALID_JSON',
      `Paystack returned non-JSON response (HTTP ${response.status})`,
      { url, method, rawBody, ...context },
      response.status,
    );
  }

  if (!response.ok) {
    return buildGatewayError(
      'API_ERROR',
      (parsed['message'] as string | undefined) ??
        `Paystack API error (HTTP ${response.status})`,
      { url, method, ...context },
      response.status,
      parsed,
    );
  }

  return parsed as T;
}

// ---------------------------------------------------------------------------
// Paystack API response shapes (minimal — only fields we use)
// ---------------------------------------------------------------------------

interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    reference: string;
    status: string; // 'success' | 'failed' | 'abandoned' | ...
    amount: number; // in kobo (smallest currency unit)
    currency: string;
    gateway_response: string;
  };
}

interface PaystackRefundResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    transaction: {
      id: number;
      reference: string;
    };
    amount: number;
    currency: string;
    status: string;
  };
}

// ---------------------------------------------------------------------------
// PaystackAdapter
// ---------------------------------------------------------------------------

export class PaystackAdapter implements GatewayAdapter {
  // -------------------------------------------------------------------------
  // createSession
  // -------------------------------------------------------------------------

  /**
   * Initialises a Paystack transaction and returns a redirect PaymentSession.
   *
   * Calls POST /transaction/initialize with the order amount (converted to the
   * smallest currency unit — kobo for NGN, pesewas for GHS, etc.) and the
   * customer email derived from the order metadata or a placeholder.
   *
   * Requirement 1.3: obtain authorization_url and redirect the student.
   */
  async createSession(
    order: Order,
    options: SessionOptions,
  ): Promise<PaymentSession | GatewayError> {
    // Paystack amounts are in the smallest currency unit (e.g. kobo = 1/100 NGN).
    const amountInSmallestUnit = Math.round(order.total * 100);

    const requestBody: Record<string, unknown> = {
      email:
        (options.metadata?.['customerEmail'] as string | undefined) ??
        `order-${order.id}@learnova.internal`,
      amount: amountInSmallestUnit,
      currency: order.currency.toUpperCase(),
      reference: options.reference,
      callback_url: options.successUrl,
      metadata: {
        orderId: order.id,
        userId: order.userId,
        invoiceNumber: order.invoiceNumber,
        cancelUrl: options.cancelUrl,
        ...options.metadata,
      },
    };

    const result = await paystackRequest<PaystackInitializeResponse>(
      'POST',
      '/transaction/initialize',
      requestBody,
      { orderId: order.id, reference: options.reference },
    );

    if ('success' in result && result.success === false) {
      // Already a GatewayError
      return result as GatewayError;
    }

    const data = (result as PaystackInitializeResponse).data;

    return {
      gateway: GATEWAY_SLUG,
      orderId: order.id,
      reference: options.reference,
      mode: 'redirect',
      providerSessionId: data.access_code,
      redirectUrl: data.authorization_url,
    };
  }

  // -------------------------------------------------------------------------
  // verifyWebhook
  // -------------------------------------------------------------------------

  /**
   * Verifies the authenticity of a Paystack webhook request.
   *
   * Requirement 2.5: HMAC-SHA256 of the raw body with the Paystack secret key,
   * compared against the `x-paystack-signature` header using a timing-safe
   * comparison to prevent timing attacks.
   *
   * @param payload   - Raw request body string (before JSON parsing).
   * @param signature - Value of the `x-paystack-signature` header.
   * @returns `true` if the signature is valid, `false` otherwise.
   */
  verifyWebhook(payload: string, signature: string): boolean {
    if (!signature) {
      console.warn('[Paystack] verifyWebhook: missing signature header');
      return false;
    }

    let secretKey: string;
    try {
      secretKey = getSecretKey();
    } catch (err) {
      console.error('[Paystack] verifyWebhook: cannot retrieve secret key', {
        error: String(err),
      });
      return false;
    }

    const expectedHmac = createHmac('sha256', secretKey)
      .update(payload)
      .digest('hex');

    // Timing-safe comparison to prevent timing-based attacks
    try {
      const expectedBuf = Buffer.from(expectedHmac, 'hex');
      const receivedBuf = Buffer.from(signature, 'hex');

      if (expectedBuf.length !== receivedBuf.length) {
        return false;
      }

      return timingSafeEqual(expectedBuf, receivedBuf);
    } catch {
      // If the signature is not valid hex, timingSafeEqual will throw
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // capturePayment
  // -------------------------------------------------------------------------

  /**
   * Verifies/confirms a Paystack transaction by reference.
   *
   * Paystack uses a verify-then-confirm model: after the customer completes
   * payment, the platform calls GET /transaction/verify/:reference to confirm
   * the transaction status.
   *
   * @param sessionId - The Paystack transaction reference (stored as
   *                    `providerSessionId` on the PaymentSession, but for
   *                    Paystack this is the `reference` string used at
   *                    initialization time).
   */
  async capturePayment(
    sessionId: string,
  ): Promise<CaptureResult | GatewayError> {
    const result = await paystackRequest<PaystackVerifyResponse>(
      'GET',
      `/transaction/verify/${encodeURIComponent(sessionId)}`,
      undefined,
      { reference: sessionId },
    );

    if ('success' in result && result.success === false) {
      return result as GatewayError;
    }

    const data = (result as PaystackVerifyResponse).data;

    if (data.status !== 'success') {
      return buildGatewayError(
        'PAYMENT_NOT_SUCCESSFUL',
        `Paystack transaction status is "${data.status}", expected "success"`,
        { reference: sessionId, gatewayResponse: data.gateway_response },
        undefined,
        { status: data.status, gateway_response: data.gateway_response },
      );
    }

    // Convert from smallest currency unit back to major unit
    const amount = data.amount / 100;

    return {
      success: true,
      transactionId: String(data.id),
      amount,
      currency: data.currency,
      rawResponse: data as unknown as Record<string, unknown>,
    };
  }

  // -------------------------------------------------------------------------
  // refundPayment
  // -------------------------------------------------------------------------

  /**
   * Issues a refund for a completed Paystack transaction.
   *
   * Calls POST /refund with the transaction reference and the amount to refund
   * (converted to the smallest currency unit).
   *
   * Requirement 1.14: on success the caller MUST update the Order status to
   * `REFUNDED`.
   *
   * @param transactionId - The Paystack transaction ID (numeric string) or
   *                        reference returned by capturePayment.
   * @param amount        - Amount to refund in the order's major currency unit.
   */
  async refundPayment(
    transactionId: string,
    amount: number,
  ): Promise<RefundResult | GatewayError> {
    const amountInSmallestUnit = Math.round(amount * 100);

    const requestBody: Record<string, unknown> = {
      transaction: transactionId,
      amount: amountInSmallestUnit,
    };

    const result = await paystackRequest<PaystackRefundResponse>(
      'POST',
      '/refund',
      requestBody,
      { transactionId, amount },
    );

    if ('success' in result && result.success === false) {
      return result as GatewayError;
    }

    const data = (result as PaystackRefundResponse).data;

    // Convert from smallest currency unit back to major unit
    const refundedAmount = data.amount / 100;

    return {
      success: true,
      refundId: String(data.id),
      amount: refundedAmount,
      currency: data.currency,
      rawResponse: data as unknown as Record<string, unknown>,
    };
  }
}

// ---------------------------------------------------------------------------
// Default export — a singleton instance ready for use
// ---------------------------------------------------------------------------

export const paystackAdapter = new PaystackAdapter();
