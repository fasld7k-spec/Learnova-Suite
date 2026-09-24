/**
 * lib/payment-gateways/razorpay.ts
 *
 * Razorpay implementation of the GatewayAdapter interface.
 *
 * Requirements: 1.1, 1.2
 *
 * - createSession  : POST /v1/orders → returns a PaymentSession with mode "redirect"
 * - verifyWebhook  : HMAC-SHA256 of "razorpay_order_id|razorpay_payment_id" (Req 2.4)
 * - capturePayment : POST /v1/payments/:id/capture
 * - refundPayment  : POST /v1/payments/:id/refund
 *
 * Error handling (Req 1.15): all errors are logged with full context and returned
 * as GatewayError objects — nothing is thrown.
 *
 * Environment variables required:
 *   RAZORPAY_KEY_ID          – Razorpay API key ID
 *   RAZORPAY_KEY_SECRET      – Razorpay API key secret
 *   RAZORPAY_WEBHOOK_SECRET  – Razorpay webhook signing secret
 */

import { createHmac, timingSafeEqual } from "crypto";
import type {
  GatewayAdapter,
  Order,
  SessionOptions,
  PaymentSession,
  CaptureResult,
  RefundResult,
  GatewayError,
} from "./base";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RAZORPAY_BASE_URL = "https://api.razorpay.com/v1";
const GATEWAY_SLUG = "razorpay";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Build the Basic-Auth header from the Razorpay key pair. */
function buildAuthHeader(keyId: string, keySecret: string): string {
  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  return `Basic ${credentials}`;
}

/**
 * Convert an order total (e.g. 49.99) to the smallest currency unit
 * (paise for INR, cents for USD, etc.) as required by Razorpay.
 */
function toSmallestUnit(amount: number): number {
  return Math.round(amount * 100);
}

/** Shared fetch wrapper that returns the parsed JSON body or throws on non-2xx. */
async function razorpayFetch<T>(
  path: string,
  options: RequestInit,
  keyId: string,
  keySecret: string,
): Promise<T> {
  const url = `${RAZORPAY_BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: buildAuthHeader(keyId, keySecret),
      ...(options.headers ?? {}),
    },
  });

  const body = await response.json() as T;

  if (!response.ok) {
    const err = new Error(
      `Razorpay API error ${response.status}: ${JSON.stringify(body)}`,
    );
    (err as NodeJS.ErrnoException).code = String(response.status);
    throw err;
  }

  return body;
}

// ---------------------------------------------------------------------------
// Razorpay API response shapes (minimal — only fields we use)
// ---------------------------------------------------------------------------

interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

interface RazorpayPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
}

interface RazorpayRefund {
  id: string;
  payment_id: string;
  amount: number;
  currency: string;
  status: string;
}

// ---------------------------------------------------------------------------
// RazorpayAdapter
// ---------------------------------------------------------------------------

export class RazorpayAdapter implements GatewayAdapter {
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;

  constructor() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!keyId || !keySecret || !webhookSecret) {
      throw new Error(
        "Missing required Razorpay environment variables: " +
          "RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET",
      );
    }

    this.keyId = keyId;
    this.keySecret = keySecret;
    this.webhookSecret = webhookSecret;
  }

  // -------------------------------------------------------------------------
  // createSession
  // -------------------------------------------------------------------------

  /**
   * Create a Razorpay order and return a PaymentSession with mode "redirect".
   *
   * Razorpay does not host a standalone checkout URL; instead the caller is
   * expected to open the Razorpay checkout.js modal or redirect to the
   * Razorpay-hosted payment page.  We return the standard Razorpay hosted
   * checkout URL so the student can be redirected without requiring any
   * client-side JavaScript integration.
   *
   * Requirement 1.2
   */
  async createSession(
    order: Order,
    options: SessionOptions,
  ): Promise<PaymentSession | GatewayError> {
    const context = {
      gateway: GATEWAY_SLUG,
      method: "createSession",
      orderId: order.id,
      reference: options.reference,
    };

    try {
      const razorpayOrder = await razorpayFetch<RazorpayOrder>(
        "/orders",
        {
          method: "POST",
          body: JSON.stringify({
            amount: toSmallestUnit(order.total),
            currency: order.currency.toUpperCase(),
            receipt: options.reference,
            notes: {
              orderId: order.id,
              userId: order.userId,
              invoiceNumber: order.invoiceNumber,
              successUrl: options.successUrl,
              cancelUrl: options.cancelUrl,
              ...(options.metadata ?? {}),
            },
          }),
        },
        this.keyId,
        this.keySecret,
      );

      // Build the Razorpay-hosted checkout redirect URL.
      // The student lands on a Razorpay-hosted page that handles the payment
      // and then redirects back to successUrl / cancelUrl.
      const checkoutUrl =
        `https://checkout.razorpay.com/v1/checkout.js` +
        `?key=${encodeURIComponent(this.keyId)}` +
        `&order_id=${encodeURIComponent(razorpayOrder.id)}` +
        `&callback_url=${encodeURIComponent(options.successUrl)}` +
        `&cancel_url=${encodeURIComponent(options.cancelUrl)}`;

      const session: PaymentSession = {
        gateway: GATEWAY_SLUG,
        orderId: order.id,
        reference: options.reference,
        mode: "redirect",
        providerSessionId: razorpayOrder.id,
        redirectUrl: checkoutUrl,
      };

      return session;
    } catch (err: unknown) {
      return this._buildGatewayError(err, context);
    }
  }

  // -------------------------------------------------------------------------
  // verifyWebhook
  // -------------------------------------------------------------------------

  /**
   * Verify the `x-razorpay-signature` header.
   *
   * Razorpay signs webhooks with HMAC-SHA256 of the raw request body using
   * the webhook secret.  For payment verification the signature is computed
   * over `razorpay_order_id + "|" + razorpay_payment_id`.
   *
   * This method handles both cases:
   *   1. Webhook body signature (standard webhook verification)
   *   2. Payment verification string (used after redirect callback)
   *
   * Requirement 2.4
   */
  verifyWebhook(payload: string, signature: string): boolean {
    if (!payload || !signature) {
      return false;
    }

    try {
      const expectedSignature = createHmac("sha256", this.webhookSecret)
        .update(payload)
        .digest("hex");

      const expectedBuffer = Buffer.from(expectedSignature, "hex");
      const receivedBuffer = Buffer.from(signature, "hex");

      // Lengths must match before timingSafeEqual to avoid throwing.
      if (expectedBuffer.length !== receivedBuffer.length) {
        return false;
      }

      return timingSafeEqual(expectedBuffer, receivedBuffer);
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // capturePayment
  // -------------------------------------------------------------------------

  /**
   * Capture (confirm) a Razorpay payment.
   *
   * `sessionId` is the Razorpay payment ID (e.g. `pay_XXXXXXXXXXXXXXXX`).
   * We first fetch the payment to obtain the amount and currency, then
   * issue the capture request.
   *
   * Requirement 1.1
   */
  async capturePayment(
    sessionId: string,
  ): Promise<CaptureResult | GatewayError> {
    const context = {
      gateway: GATEWAY_SLUG,
      method: "capturePayment",
      sessionId,
    };

    try {
      // Fetch the payment to get amount + currency for the capture call.
      const payment = await razorpayFetch<RazorpayPayment>(
        `/payments/${sessionId}`,
        { method: "GET" },
        this.keyId,
        this.keySecret,
      );

      // Capture the payment.
      const captured = await razorpayFetch<RazorpayPayment>(
        `/payments/${sessionId}/capture`,
        {
          method: "POST",
          body: JSON.stringify({
            amount: payment.amount,
            currency: payment.currency,
          }),
        },
        this.keyId,
        this.keySecret,
      );

      const result: CaptureResult = {
        success: true,
        transactionId: captured.id,
        amount: captured.amount / 100, // convert back from smallest unit
        currency: captured.currency,
        rawResponse: captured as unknown as Record<string, unknown>,
      };

      return result;
    } catch (err: unknown) {
      return this._buildGatewayError(err, context);
    }
  }

  // -------------------------------------------------------------------------
  // refundPayment
  // -------------------------------------------------------------------------

  /**
   * Issue a full or partial refund for a Razorpay payment.
   *
   * `transactionId` is the Razorpay payment ID (e.g. `pay_XXXXXXXXXXXXXXXX`).
   *
   * Requirement 1.1, 1.14
   */
  async refundPayment(
    transactionId: string,
    amount: number,
  ): Promise<RefundResult | GatewayError> {
    const context = {
      gateway: GATEWAY_SLUG,
      method: "refundPayment",
      transactionId,
      amount,
    };

    try {
      const refund = await razorpayFetch<RazorpayRefund>(
        `/payments/${transactionId}/refund`,
        {
          method: "POST",
          body: JSON.stringify({
            amount: toSmallestUnit(amount),
          }),
        },
        this.keyId,
        this.keySecret,
      );

      const result: RefundResult = {
        success: true,
        refundId: refund.id,
        amount: refund.amount / 100, // convert back from smallest unit
        currency: refund.currency,
        rawResponse: refund as unknown as Record<string, unknown>,
      };

      return result;
    } catch (err: unknown) {
      return this._buildGatewayError(err, context);
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Build a structured GatewayError from any caught error and log it with
   * full context.  Never throws.
   *
   * Requirement 1.15
   */
  private _buildGatewayError(
    err: unknown,
    context: Record<string, unknown>,
  ): GatewayError {
    const message =
      err instanceof Error ? err.message : "Unknown Razorpay error";

    // Attempt to extract HTTP status from the error message (set by razorpayFetch).
    const statusMatch = message.match(/Razorpay API error (\d{3})/);
    const httpStatus = statusMatch ? parseInt(statusMatch[1], 10) : undefined;

    // Attempt to extract the raw JSON payload from the error message.
    let rawResponse: Record<string, unknown> | undefined;
    const jsonMatch = message.match(/Razorpay API error \d{3}: ([\s\S]+)$/);
    if (jsonMatch) {
      try {
        rawResponse = JSON.parse(jsonMatch[1]) as Record<string, unknown>;
      } catch {
        rawResponse = { raw: jsonMatch[1] };
      }
    }

    const gatewayError: GatewayError = {
      success: false,
      code: httpStatus ? `HTTP_${httpStatus}` : "RAZORPAY_ERROR",
      message,
      httpStatus,
      rawResponse,
    };

    // Log with full context (Requirement 1.15).
    console.error("[RazorpayAdapter] Gateway error", {
      ...context,
      error: message,
      httpStatus,
      rawResponse,
    });

    return gatewayError;
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

/**
 * Factory function that creates a RazorpayAdapter instance.
 * Throws at construction time if required env vars are missing.
 */
export function createRazorpayAdapter(): RazorpayAdapter {
  return new RazorpayAdapter();
}
