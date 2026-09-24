/**
 * lib/payment-gateways/midtrans.ts
 *
 * Midtrans Snap payment gateway adapter for Learnova Suite.
 *
 * Implements the GatewayAdapter interface using the Midtrans Snap API.
 * No external SDK — uses fetch directly with Basic auth (server key as username).
 *
 * Environment variables required:
 *   MIDTRANS_SERVER_KEY      — Server key from Midtrans dashboard
 *   MIDTRANS_CLIENT_KEY      — Client key from Midtrans dashboard
 *   MIDTRANS_IS_PRODUCTION   — "true" for production, anything else for sandbox
 *
 * Requirements: 1.1, 1.10, 1.14, 1.15
 */

import { createHash } from 'crypto';
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
// Configuration helpers
// ---------------------------------------------------------------------------

function getConfig(): {
  serverKey: string;
  clientKey: string;
  isProduction: boolean;
  snapBaseUrl: string;
  apiBaseUrl: string;
} {
  const serverKey = process.env.MIDTRANS_SERVER_KEY ?? '';
  const clientKey = process.env.MIDTRANS_CLIENT_KEY ?? '';
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';

  const snapBaseUrl = isProduction
    ? 'https://app.midtrans.com/snap/v1'
    : 'https://app.sandbox.midtrans.com/snap/v1';

  const apiBaseUrl = isProduction
    ? 'https://api.midtrans.com/v2'
    : 'https://api.sandbox.midtrans.com/v2';

  return { serverKey, clientKey, isProduction, snapBaseUrl, apiBaseUrl };
}

/** Build the Basic auth header value from the server key. */
function buildAuthHeader(serverKey: string): string {
  // Midtrans Basic auth: server_key as username, empty password
  const credentials = Buffer.from(`${serverKey}:`).toString('base64');
  return `Basic ${credentials}`;
}

// ---------------------------------------------------------------------------
// Internal fetch helper
// ---------------------------------------------------------------------------

interface MidtransApiResponse {
  status_code?: string;
  status_message?: string;
  token?: string;
  redirect_url?: string;
  transaction_id?: string;
  order_id?: string;
  gross_amount?: string;
  transaction_status?: string;
  fraud_status?: string;
  currency?: string;
  refund_chargeback_id?: string;
  refund_amount?: string;
  [key: string]: unknown;
}

async function midtransFetch(
  url: string,
  options: RequestInit,
  serverKey: string,
): Promise<{ data: MidtransApiResponse; httpStatus: number }> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: buildAuthHeader(serverKey),
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  const httpStatus = response.status;
  let data: MidtransApiResponse = {};

  try {
    data = (await response.json()) as MidtransApiResponse;
  } catch {
    // Non-JSON response body — leave data empty
  }

  return { data, httpStatus };
}

// ---------------------------------------------------------------------------
// MidtransAdapter
// ---------------------------------------------------------------------------

export class MidtransAdapter implements GatewayAdapter {
  // -------------------------------------------------------------------------
  // createSession
  // -------------------------------------------------------------------------

  /**
   * Create a Midtrans Snap transaction and return a redirect PaymentSession.
   *
   * Requirement 1.10: creates a transaction via the Midtrans Snap API and
   * redirects the student to the Midtrans payment page.
   */
  async createSession(
    order: Order,
    options: SessionOptions,
  ): Promise<PaymentSession | GatewayError> {
    const { serverKey, snapBaseUrl } = getConfig();

    if (!serverKey) {
      const err: GatewayError = {
        success: false,
        code: 'MISSING_CONFIG',
        message: 'MIDTRANS_SERVER_KEY environment variable is not set.',
      };
      console.error('[Midtrans] createSession error', {
        code: err.code,
        orderId: order.id,
      });
      return err;
    }

    // Build Snap transaction payload
    const grossAmount = Math.round(order.total * 100) / 100; // keep 2 decimal places
    const payload = {
      transaction_details: {
        order_id: options.reference,
        gross_amount: grossAmount,
      },
      item_details: order.items.map((item) => ({
        id: item.courseId,
        price: item.price,
        quantity: 1,
        name: item.title.substring(0, 50), // Midtrans max 50 chars
      })),
      customer_details: {
        // userId is the only guaranteed field on Order
        email: undefined as string | undefined,
      },
      callbacks: {
        finish: options.successUrl,
        error: options.cancelUrl,
        pending: options.cancelUrl,
      },
    };

    // Remove undefined fields to keep payload clean
    if (!payload.customer_details.email) {
      delete (payload as Record<string, unknown>).customer_details;
    }

    let data: MidtransApiResponse;
    let httpStatus: number;

    try {
      ({ data, httpStatus } = await midtransFetch(
        `${snapBaseUrl}/transactions`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
        serverKey,
      ));
    } catch (networkError) {
      const err: GatewayError = {
        success: false,
        code: 'NETWORK_ERROR',
        message:
          networkError instanceof Error
            ? networkError.message
            : 'Network error while contacting Midtrans Snap API.',
      };
      console.error('[Midtrans] createSession network error', {
        orderId: order.id,
        reference: options.reference,
        error: err.message,
      });
      return err;
    }

    if (httpStatus < 200 || httpStatus >= 300 || !data.redirect_url) {
      const err: GatewayError = {
        success: false,
        code: 'API_ERROR',
        message:
          (data.status_message as string | undefined) ??
          `Midtrans Snap API returned HTTP ${httpStatus}.`,
        httpStatus,
        rawResponse: data as Record<string, unknown>,
      };
      console.error('[Midtrans] createSession API error', {
        orderId: order.id,
        reference: options.reference,
        httpStatus,
        statusCode: data.status_code,
        statusMessage: data.status_message,
      });
      return err;
    }

    const session: PaymentSession = {
      gateway: 'midtrans',
      orderId: order.id,
      reference: options.reference,
      mode: 'redirect',
      providerSessionId: data.token ?? options.reference,
      redirectUrl: data.redirect_url,
    };

    return session;
  }

  // -------------------------------------------------------------------------
  // verifyWebhook
  // -------------------------------------------------------------------------

  /**
   * Verify a Midtrans webhook notification using SHA512 signature.
   *
   * Midtrans signs notifications with:
   *   SHA512(order_id + status_code + gross_amount + server_key)
   *
   * The computed hash is compared against the `signature_key` field in the
   * parsed payload. The `signature` parameter passed by the webhook router
   * should be the raw JSON body string; we parse it here to extract the
   * fields needed for verification.
   *
   * Requirement 2.8: returns false for any invalid/missing signature.
   */
  verifyWebhook(payload: string, signature: string): boolean {
    const { serverKey } = getConfig();

    if (!serverKey) {
      console.error('[Midtrans] verifyWebhook: MIDTRANS_SERVER_KEY not set.');
      return false;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(payload) as Record<string, unknown>;
    } catch {
      console.error('[Midtrans] verifyWebhook: failed to parse payload JSON.');
      return false;
    }

    const orderId = parsed['order_id'] as string | undefined;
    const statusCode = parsed['status_code'] as string | undefined;
    const grossAmount = parsed['gross_amount'] as string | undefined;
    // The signature_key is embedded in the payload by Midtrans
    const signatureKey =
      (parsed['signature_key'] as string | undefined) ?? signature;

    if (!orderId || !statusCode || !grossAmount || !signatureKey) {
      console.error('[Midtrans] verifyWebhook: missing required fields.', {
        hasOrderId: Boolean(orderId),
        hasStatusCode: Boolean(statusCode),
        hasGrossAmount: Boolean(grossAmount),
        hasSignatureKey: Boolean(signatureKey),
      });
      return false;
    }

    const expected = createHash('sha512')
      .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
      .digest('hex');

    const isValid = expected === signatureKey;

    if (!isValid) {
      console.warn('[Midtrans] verifyWebhook: signature mismatch.', {
        orderId,
      });
    }

    return isValid;
  }

  // -------------------------------------------------------------------------
  // capturePayment
  // -------------------------------------------------------------------------

  /**
   * Check the transaction status via the Midtrans Core API.
   *
   * `sessionId` is the Midtrans `order_id` (our reference string) or the
   * Snap token stored as `providerSessionId`.
   *
   * Requirement 1.1: implements capturePayment for Midtrans.
   */
  async capturePayment(sessionId: string): Promise<CaptureResult | GatewayError> {
    const { serverKey, apiBaseUrl } = getConfig();

    if (!serverKey) {
      const err: GatewayError = {
        success: false,
        code: 'MISSING_CONFIG',
        message: 'MIDTRANS_SERVER_KEY environment variable is not set.',
      };
      console.error('[Midtrans] capturePayment error', {
        code: err.code,
        sessionId,
      });
      return err;
    }

    let data: MidtransApiResponse;
    let httpStatus: number;

    try {
      ({ data, httpStatus } = await midtransFetch(
        `${apiBaseUrl}/${encodeURIComponent(sessionId)}/status`,
        { method: 'GET' },
        serverKey,
      ));
    } catch (networkError) {
      const err: GatewayError = {
        success: false,
        code: 'NETWORK_ERROR',
        message:
          networkError instanceof Error
            ? networkError.message
            : 'Network error while contacting Midtrans API.',
      };
      console.error('[Midtrans] capturePayment network error', {
        sessionId,
        error: err.message,
      });
      return err;
    }

    if (httpStatus < 200 || httpStatus >= 300) {
      const err: GatewayError = {
        success: false,
        code: 'API_ERROR',
        message:
          (data.status_message as string | undefined) ??
          `Midtrans API returned HTTP ${httpStatus}.`,
        httpStatus,
        rawResponse: data as Record<string, unknown>,
      };
      console.error('[Midtrans] capturePayment API error', {
        sessionId,
        httpStatus,
        statusCode: data.status_code,
        statusMessage: data.status_message,
      });
      return err;
    }

    // Midtrans transaction statuses that indicate a successful capture:
    // "capture" (credit card), "settlement" (bank transfer / e-wallet)
    const successStatuses = new Set(['capture', 'settlement']);
    const transactionStatus = data.transaction_status ?? '';
    const fraudStatus = data.fraud_status ?? 'accept';

    const isSuccess =
      successStatuses.has(transactionStatus) && fraudStatus !== 'deny';

    if (!isSuccess) {
      const err: GatewayError = {
        success: false,
        code: 'PAYMENT_NOT_CAPTURED',
        message: `Transaction status is "${transactionStatus}" (fraud: "${fraudStatus}"). Payment not captured.`,
        httpStatus,
        rawResponse: data as Record<string, unknown>,
      };
      console.warn('[Midtrans] capturePayment: payment not captured.', {
        sessionId,
        transactionStatus,
        fraudStatus,
      });
      return err;
    }

    const grossAmount = parseFloat(data.gross_amount ?? '0');

    const result: CaptureResult = {
      success: true,
      transactionId: data.transaction_id ?? sessionId,
      amount: grossAmount,
      currency: data.currency ?? 'IDR',
      rawResponse: data as Record<string, unknown>,
    };

    return result;
  }

  // -------------------------------------------------------------------------
  // refundPayment
  // -------------------------------------------------------------------------

  /**
   * Issue a refund via the Midtrans Core API.
   *
   * Requirement 1.14: calls the gateway's refund API; the caller is
   * responsible for updating the Order status to REFUNDED on success.
   */
  async refundPayment(
    transactionId: string,
    amount: number,
  ): Promise<RefundResult | GatewayError> {
    const { serverKey, apiBaseUrl } = getConfig();

    if (!serverKey) {
      const err: GatewayError = {
        success: false,
        code: 'MISSING_CONFIG',
        message: 'MIDTRANS_SERVER_KEY environment variable is not set.',
      };
      console.error('[Midtrans] refundPayment error', {
        code: err.code,
        transactionId,
      });
      return err;
    }

    const refundPayload = {
      refund_amount: amount,
      reason: 'Customer refund request',
    };

    let data: MidtransApiResponse;
    let httpStatus: number;

    try {
      ({ data, httpStatus } = await midtransFetch(
        `${apiBaseUrl}/${encodeURIComponent(transactionId)}/refund`,
        {
          method: 'POST',
          body: JSON.stringify(refundPayload),
        },
        serverKey,
      ));
    } catch (networkError) {
      const err: GatewayError = {
        success: false,
        code: 'NETWORK_ERROR',
        message:
          networkError instanceof Error
            ? networkError.message
            : 'Network error while contacting Midtrans refund API.',
      };
      console.error('[Midtrans] refundPayment network error', {
        transactionId,
        amount,
        error: err.message,
      });
      return err;
    }

    if (httpStatus < 200 || httpStatus >= 300) {
      const err: GatewayError = {
        success: false,
        code: 'API_ERROR',
        message:
          (data.status_message as string | undefined) ??
          `Midtrans refund API returned HTTP ${httpStatus}.`,
        httpStatus,
        rawResponse: data as Record<string, unknown>,
      };
      console.error('[Midtrans] refundPayment API error', {
        transactionId,
        amount,
        httpStatus,
        statusCode: data.status_code,
        statusMessage: data.status_message,
      });
      return err;
    }

    // Midtrans refund success: status_code "200" and transaction_status "refund"
    const isSuccess =
      data.status_code === '200' ||
      data.transaction_status === 'refund' ||
      data.transaction_status === 'partial_refund';

    if (!isSuccess) {
      const err: GatewayError = {
        success: false,
        code: 'REFUND_FAILED',
        message:
          (data.status_message as string | undefined) ??
          `Refund not accepted. Transaction status: "${data.transaction_status}".`,
        httpStatus,
        rawResponse: data as Record<string, unknown>,
      };
      console.error('[Midtrans] refundPayment: refund not accepted.', {
        transactionId,
        amount,
        statusCode: data.status_code,
        transactionStatus: data.transaction_status,
      });
      return err;
    }

    const refundedAmount = data.refund_amount
      ? parseFloat(data.refund_amount)
      : amount;

    const result: RefundResult = {
      success: true,
      refundId:
        (data.refund_chargeback_id as string | undefined) ??
        `${transactionId}-refund`,
      amount: refundedAmount,
      currency: data.currency ?? 'IDR',
      rawResponse: data as Record<string, unknown>,
    };

    return result;
  }
}

// ---------------------------------------------------------------------------
// Default export — singleton instance
// ---------------------------------------------------------------------------

export const midtransAdapter = new MidtransAdapter();
export default midtransAdapter;
