/**
 * lib/payment-gateways/paymob.ts
 *
 * Paymob payment gateway adapter for Learnova Suite.
 *
 * Implements the GatewayAdapter interface using the Paymob Accept API.
 * The checkout flow is a 3-step process:
 *   1. Authenticate → obtain an auth token
 *   2. Create an order → obtain an order ID
 *   3. Request a payment key → obtain a payment token
 *
 * The student is then redirected to the Paymob iframe:
 *   https://accept.paymob.com/api/acceptance/iframes/{PAYMOB_IFRAME_ID}?payment_token={paymentKey}
 *
 * Environment variables required:
 *   PAYMOB_API_KEY        – Paymob API key (from the Paymob dashboard)
 *   PAYMOB_INTEGRATION_ID – The integration ID for the payment channel
 *   PAYMOB_IFRAME_ID      – The iframe ID for the hosted payment page
 *   PAYMOB_HMAC_SECRET    – HMAC secret for webhook signature verification
 *
 * Requirements: 1.1, 1.7, 1.15
 * Error handling: Requirement 1.15 — log with full context, return GatewayError (never throw).
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

const PAYMOB_BASE_URL = "https://accept.paymob.com/api";
const GATEWAY_SLUG = "paymob";

// ---------------------------------------------------------------------------
// Internal Paymob API response shapes
// ---------------------------------------------------------------------------

interface PaymobAuthResponse {
  token: string;
}

interface PaymobOrderResponse {
  id: number;
}

interface PaymobPaymentKeyResponse {
  token: string;
}

interface PaymobTransactionResponse {
  id: number;
  success: boolean;
  amount_cents: number;
  currency: string;
  order: { id: number };
  error_occured?: boolean;
  data?: { message?: string };
}

interface PaymobRefundResponse {
  id: number;
  success: boolean;
  amount_cents: number;
  currency: string;
}

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/**
 * Reads a required environment variable. Returns the value or throws a
 * descriptive error during adapter construction (not at request time).
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[paymob] Missing required environment variable: ${name}`
    );
  }
  return value;
}

/**
 * Builds a structured GatewayError and logs it with full context.
 * Requirement 1.15: log with full context, return GatewayError (never throw).
 */
function buildError(
  code: string,
  message: string,
  context: Record<string, unknown>,
  httpStatus?: number,
  rawResponse?: Record<string, unknown>
): GatewayError {
  console.error(`[paymob] ${code}: ${message}`, {
    ...context,
    httpStatus,
    rawResponse,
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
 * Performs a JSON POST request to the Paymob API.
 * Returns the parsed response body or a GatewayError.
 */
async function paymobPost<T>(
  path: string,
  body: Record<string, unknown>,
  context: Record<string, unknown>
): Promise<T | GatewayError> {
  const url = `${PAYMOB_BASE_URL}${path}`;
  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (networkError) {
    return buildError(
      "NETWORK_ERROR",
      `Network request to Paymob failed: ${String(networkError)}`,
      { ...context, url }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await response.json();
  } catch {
    return buildError(
      "PARSE_ERROR",
      "Failed to parse Paymob API response as JSON",
      { ...context, url, httpStatus: response.status }
    );
  }

  if (!response.ok) {
    return buildError(
      "API_ERROR",
      `Paymob API returned non-2xx status ${response.status}`,
      { ...context, url },
      response.status,
      rawBody as Record<string, unknown>
    );
  }

  return rawBody as T;
}

/**
 * Performs a JSON GET request to the Paymob API.
 * Returns the parsed response body or a GatewayError.
 */
async function paymobGet<T>(
  path: string,
  authToken: string,
  context: Record<string, unknown>
): Promise<T | GatewayError> {
  const url = `${PAYMOB_BASE_URL}${path}`;
  let response: Response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    });
  } catch (networkError) {
    return buildError(
      "NETWORK_ERROR",
      `Network request to Paymob failed: ${String(networkError)}`,
      { ...context, url }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await response.json();
  } catch {
    return buildError(
      "PARSE_ERROR",
      "Failed to parse Paymob API response as JSON",
      { ...context, url, httpStatus: response.status }
    );
  }

  if (!response.ok) {
    return buildError(
      "API_ERROR",
      `Paymob API returned non-2xx status ${response.status}`,
      { ...context, url },
      response.status,
      rawBody as Record<string, unknown>
    );
  }

  return rawBody as T;
}

/** Returns true if the value is a GatewayError. */
function isError(value: unknown): value is GatewayError {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as GatewayError).success === false
  );
}

// ---------------------------------------------------------------------------
// PaymobAdapter
// ---------------------------------------------------------------------------

export class PaymobAdapter implements GatewayAdapter {
  private readonly apiKey: string;
  private readonly integrationId: string;
  private readonly iframeId: string;
  private readonly hmacSecret: string;

  constructor() {
    this.apiKey = requireEnv("PAYMOB_API_KEY");
    this.integrationId = requireEnv("PAYMOB_INTEGRATION_ID");
    this.iframeId = requireEnv("PAYMOB_IFRAME_ID");
    this.hmacSecret = requireEnv("PAYMOB_HMAC_SECRET");
  }

  // -------------------------------------------------------------------------
  // Step 1: Authenticate — obtain an auth token
  // -------------------------------------------------------------------------

  private async authenticate(
    context: Record<string, unknown>
  ): Promise<string | GatewayError> {
    const result = await paymobPost<PaymobAuthResponse>(
      "/auth/tokens",
      { api_key: this.apiKey },
      context
    );

    if (isError(result)) return result;

    if (!result.token) {
      return buildError(
        "AUTH_ERROR",
        "Paymob authentication response missing token",
        context,
        undefined,
        result as unknown as Record<string, unknown>
      );
    }

    return result.token;
  }

  // -------------------------------------------------------------------------
  // Step 2: Create order — obtain a Paymob order ID
  // -------------------------------------------------------------------------

  private async createPaymobOrder(
    authToken: string,
    order: Order,
    context: Record<string, unknown>
  ): Promise<number | GatewayError> {
    // Paymob expects amounts in the smallest currency unit (cents/piastres).
    const amountCents = Math.round(order.total * 100);

    const items = order.items.map((item) => ({
      name: item.title,
      amount_cents: Math.round(item.price * 100),
      description: `Course: ${item.courseId}`,
      quantity: 1,
    }));

    const result = await paymobPost<PaymobOrderResponse>(
      "/ecommerce/orders",
      {
        auth_token: authToken,
        delivery_needed: false,
        amount_cents: amountCents,
        currency: order.currency,
        merchant_order_id: order.id,
        items,
      },
      context
    );

    if (isError(result)) return result;

    if (typeof result.id !== "number") {
      return buildError(
        "ORDER_ERROR",
        "Paymob order creation response missing id",
        context,
        undefined,
        result as unknown as Record<string, unknown>
      );
    }

    return result.id;
  }

  // -------------------------------------------------------------------------
  // Step 3: Request payment key — obtain a payment token
  // -------------------------------------------------------------------------

  private async requestPaymentKey(
    authToken: string,
    paymobOrderId: number,
    order: Order,
    options: SessionOptions,
    context: Record<string, unknown>
  ): Promise<string | GatewayError> {
    const amountCents = Math.round(order.total * 100);

    // Billing data is required by Paymob. Use real account/profile fields when
    // present; unavailable address fields are sent as NA instead of fake people.
    const billingData = {
      apartment: options.metadata?.["apartment"] ?? "NA",
      email: options.metadata?.["email"] ?? options.metadata?.["customerEmail"] ?? `order-${order.id}@unavailable.invalid`,
      floor: options.metadata?.["floor"] ?? "NA",
      first_name: options.metadata?.["firstName"] ?? "Customer",
      street: options.metadata?.["address"] ?? options.metadata?.["street"] ?? "NA",
      building: options.metadata?.["building"] ?? "NA",
      phone_number: options.metadata?.["phone"] ?? options.metadata?.["customerEmail"] ?? "NA",
      shipping_method: "NA",
      postal_code: options.metadata?.["postalCode"] ?? "NA",
      city: options.metadata?.["city"] ?? "NA",
      country: options.metadata?.["country"] ?? "NA",
      last_name: options.metadata?.["lastName"] ?? "User",
      state: options.metadata?.["state"] ?? "NA",
    };

    const result = await paymobPost<PaymobPaymentKeyResponse>(
      "/acceptance/payment_keys",
      {
        auth_token: authToken,
        amount_cents: amountCents,
        expiration: 3600,
        order_id: paymobOrderId,
        billing_data: billingData,
        currency: order.currency,
        integration_id: Number(this.integrationId),
        lock_order_when_paid: false,
      },
      context
    );

    if (isError(result)) return result;

    if (!result.token) {
      return buildError(
        "PAYMENT_KEY_ERROR",
        "Paymob payment key response missing token",
        context,
        undefined,
        result as unknown as Record<string, unknown>
      );
    }

    return result.token;
  }

  // -------------------------------------------------------------------------
  // GatewayAdapter.createSession
  // -------------------------------------------------------------------------

  /**
   * Implements the 3-step Paymob checkout flow:
   *   1. Authenticate → auth token
   *   2. Create order → Paymob order ID
   *   3. Request payment key → payment token
   *
   * Returns a PaymentSession with mode `redirect` pointing to the Paymob
   * iframe URL.
   *
   * Requirement 1.7: redirect the student to the Paymob iframe.
   */
  async createSession(
    order: Order,
    options: SessionOptions
  ): Promise<PaymentSession | GatewayError> {
    const context: Record<string, unknown> = {
      orderId: order.id,
      reference: options.reference,
      gateway: GATEWAY_SLUG,
    };

    // Step 1: Authenticate
    const authToken = await this.authenticate(context);
    if (isError(authToken)) return authToken;

    // Step 2: Create Paymob order
    const paymobOrderId = await this.createPaymobOrder(
      authToken,
      order,
      context
    );
    if (isError(paymobOrderId)) return paymobOrderId;

    // Step 3: Request payment key
    const paymentKey = await this.requestPaymentKey(
      authToken,
      paymobOrderId,
      order,
      options,
      context
    );
    if (isError(paymentKey)) return paymentKey;

    // Build the iframe redirect URL
    const redirectUrl = `https://accept.paymob.com/api/acceptance/iframes/${this.iframeId}?payment_token=${paymentKey}`;

    return {
      gateway: GATEWAY_SLUG,
      orderId: order.id,
      reference: options.reference,
      mode: "redirect",
      providerSessionId: String(paymobOrderId),
      redirectUrl,
    };
  }

  // -------------------------------------------------------------------------
  // GatewayAdapter.verifyWebhook
  // -------------------------------------------------------------------------

  /**
   * Verifies the HMAC-SHA256 signature of an incoming Paymob webhook.
   *
   * Paymob sends a `hmac` query parameter (or header) computed over a
   * concatenated string of specific transaction fields. This implementation
   * verifies the `hmac` value present in the raw payload string by computing
   * HMAC-SHA256 of the payload with the PAYMOB_HMAC_SECRET.
   *
   * The `signature` parameter should be the value of the `hmac` field
   * extracted from the webhook request (query param or header).
   *
   * Requirement 2.8: returns false → caller MUST respond with HTTP 401.
   */
  verifyWebhook(payload: string, signature: string): boolean {
    if (!signature) {
      console.warn("[paymob] verifyWebhook: missing signature");
      return false;
    }

    try {
      const expected = createHmac("sha256", this.hmacSecret)
        .update(payload)
        .digest("hex");

      // Constant-time comparison to prevent timing attacks
      const expectedBuf = Buffer.from(expected, "hex");
      const receivedBuf = Buffer.from(signature, "hex");

      if (expectedBuf.length !== receivedBuf.length) {
        console.warn("[paymob] verifyWebhook: signature length mismatch");
        return false;
      }

      // timingSafeEqual requires same-length buffers
      return timingSafeEqual(expectedBuf, receivedBuf);
    } catch (err) {
      console.error("[paymob] verifyWebhook: error during verification", {
        error: String(err),
      });
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // GatewayAdapter.capturePayment
  // -------------------------------------------------------------------------

  /**
   * Confirms (captures) a Paymob transaction.
   *
   * For Paymob, the transaction is typically auto-captured when the student
   * completes the iframe payment. This method fetches the transaction details
   * to confirm the capture status.
   *
   * @param sessionId – The Paymob transaction ID (from the webhook or callback).
   */
  async capturePayment(
    sessionId: string
  ): Promise<CaptureResult | GatewayError> {
    const context: Record<string, unknown> = {
      sessionId,
      gateway: GATEWAY_SLUG,
    };

    // Authenticate first to get a token for the API call
    const authToken = await this.authenticate(context);
    if (isError(authToken)) return authToken;

    const result = await paymobGet<PaymobTransactionResponse>(
      `/acceptance/transactions/${sessionId}`,
      authToken,
      context
    );

    if (isError(result)) return result;

    if (!result.success || result.error_occured) {
      return buildError(
        "CAPTURE_FAILED",
        `Paymob transaction ${sessionId} was not successful`,
        context,
        undefined,
        result as unknown as Record<string, unknown>
      );
    }

    return {
      success: true,
      transactionId: String(result.id),
      amount: result.amount_cents / 100,
      currency: result.currency,
      rawResponse: result as unknown as Record<string, unknown>,
    };
  }

  // -------------------------------------------------------------------------
  // GatewayAdapter.refundPayment
  // -------------------------------------------------------------------------

  /**
   * Issues a refund for a completed Paymob transaction.
   *
   * Requirement 1.14: on success the caller MUST update the Order status
   * to `REFUNDED`.
   *
   * @param transactionId – The Paymob transaction ID to refund.
   * @param amount        – Amount to refund in the order's currency.
   */
  async refundPayment(
    transactionId: string,
    amount: number
  ): Promise<RefundResult | GatewayError> {
    const context: Record<string, unknown> = {
      transactionId,
      amount,
      gateway: GATEWAY_SLUG,
    };

    // Authenticate first
    const authToken = await this.authenticate(context);
    if (isError(authToken)) return authToken;

    const amountCents = Math.round(amount * 100);

    const result = await paymobPost<PaymobRefundResponse>(
      "/acceptance/void_refund/refund",
      {
        auth_token: authToken,
        transaction_id: transactionId,
        amount_cents: amountCents,
      },
      context
    );

    if (isError(result)) return result;

    if (!result.success) {
      return buildError(
        "REFUND_FAILED",
        `Paymob refund for transaction ${transactionId} was not successful`,
        context,
        undefined,
        result as unknown as Record<string, unknown>
      );
    }

    return {
      success: true,
      refundId: String(result.id),
      amount: result.amount_cents / 100,
      currency: result.currency,
      rawResponse: result as unknown as Record<string, unknown>,
    };
  }
}
