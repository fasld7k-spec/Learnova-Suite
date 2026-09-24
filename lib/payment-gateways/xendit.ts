/**
 * lib/payment-gateways/xendit.ts
 *
 * Xendit payment gateway adapter for Learnova Suite.
 *
 * Implements the GatewayAdapter interface using Xendit's REST API directly
 * via `fetch` — no external SDK.
 *
 * Environment variables required:
 *   XENDIT_SECRET_KEY      — Xendit secret key (used as Basic-auth username)
 *   XENDIT_WEBHOOK_TOKEN   — Xendit callback token for webhook verification
 *
 * Requirements: 1.1, 1.11, 1.15
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
// Internal Xendit API response shapes
// ---------------------------------------------------------------------------

interface XenditInvoice {
  id: string;
  external_id: string;
  invoice_url: string;
  status: string;
  amount: number;
  currency: string;
  paid_amount?: number;
  payment_id?: string;
}

interface XenditRefund {
  id: string;
  payment_id: string;
  amount: number;
  currency: string;
  status: string;
}

interface XenditErrorResponse {
  error_code?: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the Basic-auth header value from the Xendit secret key.
 * Xendit uses the secret key as the username with an empty password.
 */
function buildAuthHeader(secretKey: string): string {
  const credentials = Buffer.from(`${secretKey}:`).toString('base64');
  return `Basic ${credentials}`;
}

/**
 * Perform a fetch call to the Xendit API and return the parsed JSON body
 * together with the HTTP status code.
 */
async function xenditFetch<T>(
  path: string,
  options: RequestInit,
  secretKey: string,
): Promise<{ status: number; body: T }> {
  const url = `https://api.xendit.co${path}`;
  const headers: Record<string, string> = {
    Authorization: buildAuthHeader(secretKey),
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  const response = await fetch(url, { ...options, headers });
  const body = (await response.json()) as T;
  return { status: response.status, body };
}

/**
 * Build a structured GatewayError from a failed Xendit API response.
 */
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
    httpStatus,
    rawResponse,
  };
}

// ---------------------------------------------------------------------------
// XenditAdapter
// ---------------------------------------------------------------------------

export class XenditAdapter implements GatewayAdapter {
  private readonly secretKey: string;
  private readonly webhookToken: string;

  constructor() {
    const secretKey = process.env.XENDIT_SECRET_KEY;
    const webhookToken = process.env.XENDIT_WEBHOOK_TOKEN;

    if (!secretKey) {
      throw new Error('XENDIT_SECRET_KEY environment variable is not set');
    }
    if (!webhookToken) {
      throw new Error('XENDIT_WEBHOOK_TOKEN environment variable is not set');
    }

    this.secretKey = secretKey;
    this.webhookToken = webhookToken;
  }

  // -------------------------------------------------------------------------
  // createSession
  // -------------------------------------------------------------------------

  /**
   * Create a Xendit invoice and return a redirect PaymentSession.
   *
   * Requirement 1.11: create an invoice via POST https://api.xendit.co/v2/invoices
   * and return a PaymentSession with mode `redirect` pointing to `invoice_url`.
   */
  async createSession(
    order: Order,
    options: SessionOptions,
  ): Promise<PaymentSession | GatewayError> {
    const context = {
      gateway: 'xendit',
      method: 'createSession',
      orderId: order.id,
      reference: options.reference,
    };

    try {
      const payload = {
        external_id: options.reference,
        amount: order.total,
        currency: order.currency,
        description: `Order ${order.invoiceNumber} — Learnova Suite`,
        success_redirect_url: options.successUrl,
        failure_redirect_url: options.cancelUrl,
        ...(options.locale ? { locale: options.locale } : {}),
        ...(options.metadata ? { metadata: options.metadata } : {}),
      };

      const { status, body } = await xenditFetch<XenditInvoice | XenditErrorResponse>(
        '/v2/invoices',
        { method: 'POST', body: JSON.stringify(payload) },
        this.secretKey,
      );

      if (status < 200 || status >= 300) {
        const errBody = body as XenditErrorResponse;
        const message = errBody.message ?? 'Xendit invoice creation failed';
        const code = errBody.error_code ?? 'XENDIT_API_ERROR';

        console.error('[xendit] createSession failed', {
          ...context,
          httpStatus: status,
          errorCode: code,
          errorMessage: message,
          rawResponse: body,
        });

        return buildGatewayError(code, message, status, body as Record<string, unknown>);
      }

      const invoice = body as XenditInvoice;

      return {
        gateway: 'xendit',
        orderId: order.id,
        reference: options.reference,
        mode: 'redirect',
        providerSessionId: invoice.id,
        redirectUrl: invoice.invoice_url,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[xendit] createSession network error', { ...context, error: message });
      return buildGatewayError('NETWORK_ERROR', `Network error calling Xendit: ${message}`);
    }
  }

  // -------------------------------------------------------------------------
  // verifyWebhook
  // -------------------------------------------------------------------------

  /**
   * Verify a Xendit webhook by comparing the `x-callback-token` header
   * against the configured XENDIT_WEBHOOK_TOKEN.
   *
   * Requirement 2.8: returns `false` when verification fails so the webhook
   * route can respond with HTTP 401 and skip event processing.
   */
  verifyWebhook(payload: string, signature: string): boolean {
    // `payload` is the raw request body (unused for Xendit token comparison).
    // `signature` is the value of the `x-callback-token` header.
    void payload; // explicitly unused — Xendit uses a static token, not HMAC

    if (!signature) {
      console.warn('[xendit] verifyWebhook: missing x-callback-token header');
      return false;
    }

    const isValid = signature === this.webhookToken;

    if (!isValid) {
      console.warn('[xendit] verifyWebhook: token mismatch', {
        gateway: 'xendit',
        method: 'verifyWebhook',
      });
    }

    return isValid;
  }

  // -------------------------------------------------------------------------
  // capturePayment
  // -------------------------------------------------------------------------

  /**
   * Retrieve the Xendit invoice status to confirm payment capture.
   *
   * Xendit invoices are captured automatically; this method fetches the
   * invoice by its ID and maps the status to a CaptureResult.
   */
  async capturePayment(sessionId: string): Promise<CaptureResult | GatewayError> {
    const context = {
      gateway: 'xendit',
      method: 'capturePayment',
      sessionId,
    };

    try {
      const { status, body } = await xenditFetch<XenditInvoice | XenditErrorResponse>(
        `/v2/invoices/${encodeURIComponent(sessionId)}`,
        { method: 'GET' },
        this.secretKey,
      );

      if (status < 200 || status >= 300) {
        const errBody = body as XenditErrorResponse;
        const message = errBody.message ?? 'Xendit invoice retrieval failed';
        const code = errBody.error_code ?? 'XENDIT_API_ERROR';

        console.error('[xendit] capturePayment failed', {
          ...context,
          httpStatus: status,
          errorCode: code,
          errorMessage: message,
          rawResponse: body,
        });

        return buildGatewayError(code, message, status, body as Record<string, unknown>);
      }

      const invoice = body as XenditInvoice;
      const isPaid = invoice.status === 'PAID' || invoice.status === 'SETTLED';

      return {
        success: isPaid,
        transactionId: invoice.payment_id ?? invoice.id,
        amount: invoice.paid_amount ?? invoice.amount,
        currency: invoice.currency,
        rawResponse: invoice as unknown as Record<string, unknown>,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[xendit] capturePayment network error', { ...context, error: message });
      return buildGatewayError('NETWORK_ERROR', `Network error calling Xendit: ${message}`);
    }
  }

  // -------------------------------------------------------------------------
  // refundPayment
  // -------------------------------------------------------------------------

  /**
   * Issue a refund via the Xendit Refunds API.
   *
   * Requirement 1.14: on success the caller MUST update the Order status
   * to `REFUNDED`.
   */
  async refundPayment(
    transactionId: string,
    amount: number,
  ): Promise<RefundResult | GatewayError> {
    const context = {
      gateway: 'xendit',
      method: 'refundPayment',
      transactionId,
      amount,
    };

    try {
      const payload = {
        payment_id: transactionId,
        amount,
        reason: 'REQUESTED_BY_CUSTOMER',
      };

      const { status, body } = await xenditFetch<XenditRefund | XenditErrorResponse>(
        '/refunds',
        { method: 'POST', body: JSON.stringify(payload) },
        this.secretKey,
      );

      if (status < 200 || status >= 300) {
        const errBody = body as XenditErrorResponse;
        const message = errBody.message ?? 'Xendit refund failed';
        const code = errBody.error_code ?? 'XENDIT_API_ERROR';

        console.error('[xendit] refundPayment failed', {
          ...context,
          httpStatus: status,
          errorCode: code,
          errorMessage: message,
          rawResponse: body,
        });

        return buildGatewayError(code, message, status, body as Record<string, unknown>);
      }

      const refund = body as XenditRefund;

      return {
        success: true,
        refundId: refund.id,
        amount: refund.amount,
        currency: refund.currency,
        rawResponse: refund as unknown as Record<string, unknown>,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[xendit] refundPayment network error', { ...context, error: message });
      return buildGatewayError('NETWORK_ERROR', `Network error calling Xendit: ${message}`);
    }
  }
}
