/**
 * lib/payment-gateways/sslcommerz.ts
 *
 * SSLCommerz implementation of the GatewayAdapter interface.
 *
 * Requirements: 1.1, 1.12
 *
 * - createSession  : Initiate an SSLCommerz session via their API and return a
 *                    PaymentSession with mode "redirect" pointing to GatewayPageURL.
 * - verifyWebhook  : Verify SSLCommerz IPN (Instant Payment Notification) by
 *                    validating the `verify_sign` and `verify_key` fields.
 * - capturePayment : Validate the transaction via the SSLCommerz validation API.
 * - refundPayment  : Issue a refund via the SSLCommerz refund API.
 *
 * Error handling (Req 1.15): all errors are logged with full context and returned
 * as GatewayError objects — nothing is thrown.
 *
 * Environment variables required:
 *   SSLCOMMERZ_STORE_ID        – SSLCommerz store ID
 *   SSLCOMMERZ_STORE_PASSWORD  – SSLCommerz store password
 *   SSLCOMMERZ_IS_LIVE         – "true" for production, defaults to sandbox
 */

import { createHash, timingSafeEqual } from "crypto";
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

const GATEWAY_SLUG = "sslcommerz";

const SANDBOX_BASE_URL = "https://sandbox.sslcommerz.com";
const LIVE_BASE_URL = "https://securepay.sslcommerz.com";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Return the correct base URL depending on the live/sandbox flag. */
function getBaseUrl(isLive: boolean): string {
  return isLive ? LIVE_BASE_URL : SANDBOX_BASE_URL;
}

/**
 * Compute the MD5 hash of a string and return the hex digest.
 * SSLCommerz uses MD5 for IPN signature verification.
 */
function md5Hex(input: string): string {
  return createHash("md5").update(input).digest("hex");
}

/**
 * Perform a URL-encoded POST to the SSLCommerz API.
 * SSLCommerz expects `application/x-www-form-urlencoded` for session init.
 */
async function sslcommerzPost<T>(
  url: string,
  params: Record<string, string>,
): Promise<T> {
  const body = new URLSearchParams(params).toString();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = (await response.json()) as T;

  if (!response.ok) {
    const err = new Error(
      `SSLCommerz API error ${response.status}: ${JSON.stringify(data)}`,
    );
    (err as NodeJS.ErrnoException).code = String(response.status);
    throw err;
  }

  return data;
}

/**
 * Perform a GET request to the SSLCommerz API with query parameters.
 * Used for transaction validation and refund APIs.
 */
async function sslcommerzGet<T>(
  url: string,
  params: Record<string, string>,
): Promise<T> {
  const queryString = new URLSearchParams(params).toString();
  const fullUrl = `${url}?${queryString}`;

  const response = await fetch(fullUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const data = (await response.json()) as T;

  if (!response.ok) {
    const err = new Error(
      `SSLCommerz API error ${response.status}: ${JSON.stringify(data)}`,
    );
    (err as NodeJS.ErrnoException).code = String(response.status);
    throw err;
  }

  return data;
}

// ---------------------------------------------------------------------------
// SSLCommerz API response shapes (minimal — only fields we use)
// ---------------------------------------------------------------------------

interface SSLCommerzSessionResponse {
  status: string;
  failedreason?: string;
  sessionkey?: string;
  GatewayPageURL?: string;
  storeBanner?: string;
  storeLogo?: string;
  desc?: unknown[];
  is_direct_pay_enable?: string;
}

interface SSLCommerzValidationResponse {
  status: string;
  tran_id?: string;
  val_id?: string;
  amount?: string;
  store_amount?: string;
  currency?: string;
  bank_tran_id?: string;
  card_type?: string;
  card_no?: string;
  currency_amount?: string;
  currency_type?: string;
  error?: string;
}

interface SSLCommerzRefundResponse {
  APIConnect: string;
  bank_tran_id?: string;
  trans_id?: string;
  refund_ref_id?: string;
  initiated_on?: string;
  refunded_on?: string;
  status?: string;
  reason?: string;
}

// ---------------------------------------------------------------------------
// SSLCommerzAdapter
// ---------------------------------------------------------------------------

export class SSLCommerzAdapter implements GatewayAdapter {
  private readonly storeId: string;
  private readonly storePassword: string;
  private readonly isLive: boolean;
  private readonly baseUrl: string;

  constructor() {
    const storeId = process.env.SSLCOMMERZ_STORE_ID;
    const storePassword = process.env.SSLCOMMERZ_STORE_PASSWORD;
    const isLiveEnv = process.env.SSLCOMMERZ_IS_LIVE;

    if (!storeId || !storePassword) {
      throw new Error(
        "Missing required SSLCommerz environment variables: " +
          "SSLCOMMERZ_STORE_ID, SSLCOMMERZ_STORE_PASSWORD",
      );
    }

    this.storeId = storeId;
    this.storePassword = storePassword;
    this.isLive = isLiveEnv === "true";
    this.baseUrl = getBaseUrl(this.isLive);
  }

  // -------------------------------------------------------------------------
  // createSession
  // -------------------------------------------------------------------------

  /**
   * Initiate an SSLCommerz payment session and return a PaymentSession with
   * mode "redirect" pointing to the SSLCommerz GatewayPageURL.
   *
   * Requirement 1.12
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
      const url = `${this.baseUrl}/gwprocess/v4/api.php`;

      // Build the first item description from order items (or a fallback).
      const productName =
        order.items.length > 0
          ? order.items.map((i) => i.title).join(", ")
          : "Course Purchase";

      const params: Record<string, string> = {
        store_id: this.storeId,
        store_passwd: this.storePassword,
        total_amount: order.total.toFixed(2),
        currency: order.currency.toUpperCase(),
        tran_id: options.reference,
        success_url: options.successUrl,
        fail_url: options.cancelUrl,
        cancel_url: options.cancelUrl,
        ipn_url: options.metadata?.ipnUrl
          ? String(options.metadata.ipnUrl)
          : options.successUrl,
        product_name: productName,
        product_category: "Education",
        product_profile: "non-physical-goods",
        // Customer info — use metadata if provided, otherwise use sensible defaults.
        cus_name: options.metadata?.customerName
          ? String(options.metadata.customerName)
          : "Customer",
        cus_email: options.metadata?.customerEmail
          ? String(options.metadata.customerEmail)
          : "customer@example.com",
        cus_add1: options.metadata?.customerAddress
          ? String(options.metadata.customerAddress)
          : "N/A",
        cus_city: options.metadata?.customerCity
          ? String(options.metadata.customerCity)
          : "N/A",
        cus_country: options.metadata?.customerCountry
          ? String(options.metadata.customerCountry)
          : "BD",
        cus_phone: options.metadata?.customerPhone
          ? String(options.metadata.customerPhone)
          : "N/A",
        // Shipping info (required by SSLCommerz even for digital goods).
        shipping_method: "NO",
        num_of_item: String(order.items.length || 1),
        // Order metadata.
        value_a: order.id,
        value_b: order.userId,
        value_c: order.invoiceNumber,
      };

      const sessionResponse =
        await sslcommerzPost<SSLCommerzSessionResponse>(url, params);

      if (
        sessionResponse.status !== "SUCCESS" ||
        !sessionResponse.GatewayPageURL ||
        !sessionResponse.sessionkey
      ) {
        const reason =
          sessionResponse.failedreason ?? "SSLCommerz session initiation failed";
        const err = new Error(reason);
        return this._buildGatewayError(err, context);
      }

      const session: PaymentSession = {
        gateway: GATEWAY_SLUG,
        orderId: order.id,
        reference: options.reference,
        mode: "redirect",
        providerSessionId: sessionResponse.sessionkey,
        redirectUrl: sessionResponse.GatewayPageURL,
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
   * Verify an SSLCommerz IPN (Instant Payment Notification) request.
   *
   * SSLCommerz IPN verification works as follows:
   *   1. The IPN payload contains `verify_sign` and `verify_key` fields.
   *   2. `verify_key` is a comma-separated list of field names whose values
   *      were used to compute `verify_sign`.
   *   3. To verify: take each field listed in `verify_key`, append the store
   *      password MD5 hash as the last field, sort the key-value pairs by key
   *      name, concatenate as "key1=value1&key2=value2&...", then MD5-hash
   *      the result and compare to `verify_sign`.
   *
   * The `payload` parameter is the raw IPN request body (URL-encoded form data).
   * The `signature` parameter is unused for SSLCommerz (the signature is
   * embedded in the payload itself via `verify_sign`).
   *
   * Requirement 2.8 (returns false on any verification failure)
   */
  verifyWebhook(payload: string, _signature: string): boolean {
    if (!payload) {
      return false;
    }

    try {
      // Parse the URL-encoded IPN payload.
      const params = new URLSearchParams(payload);
      const verifySign = params.get("verify_sign");
      const verifyKey = params.get("verify_key");

      if (!verifySign || !verifyKey) {
        return false;
      }

      // Build the verification string.
      // The verify_key contains comma-separated field names.
      const keyNames = verifyKey.split(",");

      // Collect key=value pairs for the listed fields.
      const pairs: Array<[string, string]> = keyNames.map((key) => [
        key,
        params.get(key) ?? "",
      ]);

      // Append the MD5 hash of the store password as the last entry.
      const storePassMd5 = md5Hex(this.storePassword);
      pairs.push(["store_passwd", storePassMd5]);

      // Sort pairs by key name (ascending).
      pairs.sort(([a], [b]) => a.localeCompare(b));

      // Concatenate as "key1=value1&key2=value2&...".
      const verificationString = pairs
        .map(([k, v]) => `${k}=${v}`)
        .join("&");

      // Compute the expected signature.
      const expectedSign = md5Hex(verificationString);

      // Timing-safe comparison.
      const expectedBuffer = Buffer.from(expectedSign, "hex");
      const receivedBuffer = Buffer.from(verifySign, "hex");

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
   * Validate a completed SSLCommerz transaction via the validation API.
   *
   * `sessionId` is the SSLCommerz `val_id` returned in the IPN or redirect
   * callback after a successful payment.
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
      const url = `${this.baseUrl}/validator/api/validationserverAPI.php`;

      const params: Record<string, string> = {
        val_id: sessionId,
        store_id: this.storeId,
        store_passwd: this.storePassword,
        format: "json",
      };

      const validation =
        await sslcommerzGet<SSLCommerzValidationResponse>(url, params);

      if (
        validation.status !== "VALID" &&
        validation.status !== "VALIDATED"
      ) {
        const reason =
          validation.error ??
          `SSLCommerz validation failed with status: ${validation.status}`;
        const err = new Error(reason);
        return this._buildGatewayError(err, context);
      }

      const amount = parseFloat(validation.store_amount ?? validation.amount ?? "0");
      const currency = validation.currency ?? "BDT";
      const transactionId =
        validation.bank_tran_id ?? validation.tran_id ?? sessionId;

      const result: CaptureResult = {
        success: true,
        transactionId,
        amount,
        currency,
        rawResponse: validation as unknown as Record<string, unknown>,
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
   * Issue a refund via the SSLCommerz refund API.
   *
   * `transactionId` is the SSLCommerz `bank_tran_id` from the original
   * transaction (returned by capturePayment).
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
      const url = `${this.baseUrl}/validator/api/merchantTransIDvalidationAPI.php`;

      const params: Record<string, string> = {
        bank_tran_id: transactionId,
        store_id: this.storeId,
        store_passwd: this.storePassword,
        refund_amount: amount.toFixed(2),
        refund_remarks: "Refund requested",
        format: "json",
      };

      const refundResponse =
        await sslcommerzGet<SSLCommerzRefundResponse>(url, params);

      if (refundResponse.APIConnect !== "DONE") {
        const reason =
          refundResponse.reason ??
          `SSLCommerz refund failed: APIConnect=${refundResponse.APIConnect}`;
        const err = new Error(reason);
        return this._buildGatewayError(err, context);
      }

      const refundId =
        refundResponse.refund_ref_id ??
        refundResponse.bank_tran_id ??
        transactionId;

      const result: RefundResult = {
        success: true,
        refundId,
        amount,
        currency: "BDT", // SSLCommerz refund API does not echo currency
        rawResponse: refundResponse as unknown as Record<string, unknown>,
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
      err instanceof Error ? err.message : "Unknown SSLCommerz error";

    // Attempt to extract HTTP status from the error message.
    const statusMatch = message.match(/SSLCommerz API error (\d{3})/);
    const httpStatus = statusMatch ? parseInt(statusMatch[1], 10) : undefined;

    // Attempt to extract the raw JSON payload from the error message.
    let rawResponse: Record<string, unknown> | undefined;
    const jsonMatch = message.match(/SSLCommerz API error \d{3}: ([\s\S]+)$/);
    if (jsonMatch) {
      try {
        rawResponse = JSON.parse(jsonMatch[1]) as Record<string, unknown>;
      } catch {
        rawResponse = { raw: jsonMatch[1] };
      }
    }

    const gatewayError: GatewayError = {
      success: false,
      code: httpStatus ? `HTTP_${httpStatus}` : "SSLCOMMERZ_ERROR",
      message,
      httpStatus,
      rawResponse,
    };

    // Log with full context (Requirement 1.15).
    console.error("[SSLCommerzAdapter] Gateway error", {
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
 * Factory function that creates an SSLCommerzAdapter instance.
 * Throws at construction time if required env vars are missing.
 */
export function createSSLCommerzAdapter(): SSLCommerzAdapter {
  return new SSLCommerzAdapter();
}
