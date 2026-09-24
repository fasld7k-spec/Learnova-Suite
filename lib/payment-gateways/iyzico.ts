/**
 * lib/payment-gateways/iyzico.ts
 *
 * Iyzico payment gateway adapter for Learnova Suite.
 *
 * Implements the GatewayAdapter interface using the Iyzico REST API directly
 * via `fetch` — no external SDK. All requests are signed with HMAC-SHA256.
 *
 * Environment variables:
 *   IYZICO_API_KEY    — Iyzico API key
 *   IYZICO_SECRET_KEY — Iyzico secret key (used for HMAC-SHA256 signing)
 *   IYZICO_BASE_URL   — Base URL (defaults to https://api.iyzipay.com)
 *
 * Requirements: 1.1, 1.6, 1.15
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
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

function getConfig(): { apiKey: string; secretKey: string; baseUrl: string } {
  const apiKey = process.env.IYZICO_API_KEY ?? '';
  const secretKey = process.env.IYZICO_SECRET_KEY ?? '';
  const baseUrl =
    process.env.IYZICO_BASE_URL?.replace(/\/$/, '') ?? 'https://api.iyzipay.com';
  return { apiKey, secretKey, baseUrl };
}

// ---------------------------------------------------------------------------
// Iyzico HMAC-SHA256 request signing
//
// Iyzico uses the following Authorization header format:
//   IYZWSv2 base64(HMAC-SHA256(apiKey + randomString + requestBody, secretKey))
//
// The PKI string is: apiKey + "&" + randomString + "&" + requestBody
// ---------------------------------------------------------------------------

function buildAuthorizationHeader(
  apiKey: string,
  secretKey: string,
  randomString: string,
  body: string,
): string {
  const pki = `${apiKey}&${randomString}&${body}`;
  const hash = createHmac('sha256', secretKey).update(pki).digest('base64');
  const authContent = Buffer.from(`${apiKey}:${randomString}:${hash}`).toString('base64');
  return `IYZWSv2 ${authContent}`;
}

function generateRandomString(): string {
  return randomBytes(12).toString('hex');
}

// ---------------------------------------------------------------------------
// Iyzico webhook signature verification
//
// Iyzico sends an `x-iyzi-signature` header which is:
//   base64(HMAC-SHA256(secretKey + payload, secretKey))
// ---------------------------------------------------------------------------

function computeWebhookSignature(secretKey: string, payload: string): string {
  return createHmac('sha256', secretKey)
    .update(secretKey + payload)
    .digest('base64');
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

interface IyzicoApiResponse {
  status: string;
  errorCode?: string;
  errorMessage?: string;
  errorGroup?: string;
  [key: string]: unknown;
}

async function iyzicoPost(
  path: string,
  body: Record<string, unknown>,
): Promise<{ data: IyzicoApiResponse; httpStatus: number } | GatewayError> {
  const { apiKey, secretKey, baseUrl } = getConfig();
  const randomString = generateRandomString();
  const bodyStr = JSON.stringify(body);

  const authorization = buildAuthorizationHeader(apiKey, secretKey, randomString, bodyStr);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization,
        'x-iyzi-rnd': randomString,
        'x-iyzi-client-version': 'iyzipay-node-2.0.48',
      },
      body: bodyStr,
    });
  } catch (networkErr) {
    const message =
      networkErr instanceof Error ? networkErr.message : String(networkErr);
    console.error('[iyzico] Network error', { path, body, error: message });
    return {
      success: false,
      code: 'NETWORK_ERROR',
      message: `Iyzico network error: ${message}`,
    } satisfies GatewayError;
  }

  let data: IyzicoApiResponse;
  try {
    data = (await response.json()) as IyzicoApiResponse;
  } catch {
    console.error('[iyzico] Failed to parse response JSON', {
      path,
      httpStatus: response.status,
    });
    return {
      success: false,
      code: 'PARSE_ERROR',
      message: 'Failed to parse Iyzico API response',
      httpStatus: response.status,
    } satisfies GatewayError;
  }

  if (!response.ok) {
    console.error('[iyzico] Non-2xx response', {
      path,
      httpStatus: response.status,
      data,
    });
    return {
      success: false,
      code: data.errorCode ?? 'API_ERROR',
      message: data.errorMessage ?? `Iyzico API error (HTTP ${response.status})`,
      httpStatus: response.status,
      rawResponse: data as Record<string, unknown>,
    } satisfies GatewayError;
  }

  if (data.status === 'failure') {
    console.error('[iyzico] API returned failure status', { path, data });
    return {
      success: false,
      code: data.errorCode ?? 'IYZICO_FAILURE',
      message: data.errorMessage ?? 'Iyzico returned a failure status',
      httpStatus: response.status,
      rawResponse: data as Record<string, unknown>,
    } satisfies GatewayError;
  }

  return { data, httpStatus: response.status };
}

// ---------------------------------------------------------------------------
// IyzicoAdapter
// ---------------------------------------------------------------------------

export class IyzicoAdapter implements GatewayAdapter {
  /**
   * Create an Iyzico checkout form token.
   *
   * Calls POST /payment/iyzipos/checkoutform/initialize/auth/ecom
   * Returns a PaymentSession with mode `inline` so the caller can mount the
   * Iyzico payment form in-place without redirecting the student.
   *
   * Requirement 1.6: render the Iyzico payment form in-place.
   */
  async createSession(
    order: Order,
    options: SessionOptions,
  ): Promise<PaymentSession | GatewayError> {
    const { apiKey } = getConfig();
    const metadata = options.metadata || {};
    const customerName = String(metadata.customerName || '').trim();
    const [firstName = 'Customer', ...lastNameParts] = customerName.split(/\s+/).filter(Boolean);
    const buyerName = String(metadata.firstName || firstName || 'Customer');
    const buyerSurname = String(metadata.lastName || lastNameParts.join(' ') || 'Customer');
    const buyerEmail = String(metadata.customerEmail || metadata.email || '').trim();
    const identityNumber = String(metadata.identityNumber || metadata.nationalId || metadata.taxId || '').trim();
    const address = String(metadata.address || metadata.registrationAddress || 'Online course checkout').trim();
    const city = String(metadata.city || 'Online').trim();
    const country = String(metadata.country || 'Online').trim();
    const phone = String(metadata.phone || metadata.billingPhone || '').trim();
    const ip = String(metadata.ip || '').trim();

    if (!buyerEmail || !identityNumber) {
      return {
        success: false,
        code: 'CUSTOMER_METADATA_REQUIRED',
        message: 'Iyzico requires a real buyer email and identity/tax number. Add these customer profile fields before using live Iyzico checkout.',
      } satisfies GatewayError;
    }

    // Build basket items from order line items
    const basketItems = order.items.map((item) => ({
      id: item.courseId,
      name: item.title,
      category1: 'Online Course',
      itemType: 'VIRTUAL',
      price: item.price.toFixed(2),
    }));

    const requestBody: Record<string, unknown> = {
      locale: options.locale ?? 'en',
      conversationId: options.reference,
      price: order.total.toFixed(2),
      paidPrice: order.total.toFixed(2),
      currency: order.currency.toUpperCase(),
      basketId: order.id,
      paymentGroup: 'PRODUCT',
      callbackUrl: options.successUrl,
      enabledInstallments: [1, 2, 3, 6, 9],
      buyer: {
        id: order.userId,
        name: buyerName,
        surname: buyerSurname,
        ...(phone ? { gsmNumber: phone } : {}),
        email: buyerEmail,
        identityNumber,
        registrationAddress: address,
        ...(ip ? { ip } : {}),
        city,
        country,
      },
      shippingAddress: {
        contactName: `${buyerName} ${buyerSurname}`.trim(),
        city,
        country,
        address,
      },
      billingAddress: {
        contactName: `${buyerName} ${buyerSurname}`.trim(),
        city,
        country,
        address,
      },
      basketItems,
    };

    const result = await iyzicoPost(
      '/payment/iyzipos/checkoutform/initialize/auth/ecom',
      requestBody,
    );

    if ('success' in result && result.success === false) {
      // Already a GatewayError — propagate
      return result as GatewayError;
    }

    const { data } = result as { data: IyzicoApiResponse; httpStatus: number };

    const token = (data.token as string | undefined) ?? '';
    const checkoutFormContent =
      (data.checkoutFormContent as string | undefined) ?? '';

    if (!token) {
      console.error('[iyzico] createSession: missing token in response', { data });
      return {
        success: false,
        code: 'MISSING_TOKEN',
        message: 'Iyzico did not return a checkout form token',
        rawResponse: data as Record<string, unknown>,
      } satisfies GatewayError;
    }

    return {
      gateway: 'iyzico',
      orderId: order.id,
      reference: options.reference,
      mode: 'inline',
      providerSessionId: token,
      payload: {
        token,
        checkoutFormContent,
        apiKey,
      },
    } satisfies PaymentSession;
  }

  /**
   * Verify an Iyzico webhook signature.
   *
   * Iyzico sends the `x-iyzi-signature` header as:
   *   base64(HMAC-SHA256(secretKey + rawBody, secretKey))
   *
   * Requirement 2.8: return false → caller responds HTTP 401.
   */
  verifyWebhook(payload: string, signature: string): boolean {
    if (!payload || !signature) {
      return false;
    }

    const { secretKey } = getConfig();

    try {
      const expected = computeWebhookSignature(secretKey, payload);
      // Constant-time comparison to prevent timing attacks
      const expectedBuf = Buffer.from(expected);
      const receivedBuf = Buffer.from(signature);
      if (expectedBuf.length !== receivedBuf.length) {
        return false;
      }
      return timingSafeEqual(expectedBuf, receivedBuf);
    } catch (err) {
      console.error('[iyzico] verifyWebhook error', { error: err });
      return false;
    }
  }

  /**
   * Retrieve the payment result for a completed Iyzico checkout form.
   *
   * Calls POST /payment/iyzipos/checkoutform/auth/ecom/detail
   * The `sessionId` here is the Iyzico checkout form token.
   */
  async capturePayment(sessionId: string): Promise<CaptureResult | GatewayError> {
    const result = await iyzicoPost(
      '/payment/iyzipos/checkoutform/auth/ecom/detail',
      { token: sessionId },
    );

    if ('success' in result && result.success === false) {
      return result as GatewayError;
    }

    const { data } = result as { data: IyzicoApiResponse; httpStatus: number };

    const paymentId = (data.paymentId as string | undefined) ?? '';
    const paidPrice = parseFloat((data.paidPrice as string | number | undefined) as string ?? '0');
    const currency = (data.currency as string | undefined) ?? 'TRY';

    if (!paymentId) {
      console.error('[iyzico] capturePayment: missing paymentId', { data });
      return {
        success: false,
        code: 'MISSING_PAYMENT_ID',
        message: 'Iyzico did not return a paymentId in the capture response',
        rawResponse: data as Record<string, unknown>,
      } satisfies GatewayError;
    }

    return {
      success: true,
      transactionId: paymentId,
      amount: paidPrice,
      currency,
      rawResponse: data as Record<string, unknown>,
    } satisfies CaptureResult;
  }

  /**
   * Issue a refund via the Iyzico API.
   *
   * Calls POST /payment/refund
   * `transactionId` is the Iyzico `paymentTransactionId` (line-item level).
   * If the order has a single item, the paymentTransactionId equals the
   * first item's transaction ID returned in the capture response.
   *
   * Requirement 1.14: caller updates Order status to REFUNDED on success.
   */
  async refundPayment(
    transactionId: string,
    amount: number,
  ): Promise<RefundResult | GatewayError> {
    const randomString = generateRandomString();
    const refundIp = process.env.IYZICO_REFUND_IP || '';
    if (!refundIp) {
      return {
        success: false,
        code: 'REFUND_IP_REQUIRED',
        message: 'Iyzico refund IP is required. Set IYZICO_REFUND_IP to the real server or operator IP allowed by Iyzico.',
      } satisfies GatewayError;
    }

    const result = await iyzicoPost('/payment/refund', {
      locale: 'en',
      conversationId: randomString,
      paymentTransactionId: transactionId,
      price: amount.toFixed(2),
      currency: 'TRY',
      ip: refundIp,
    });

    if ('success' in result && result.success === false) {
      return result as GatewayError;
    }

    const { data } = result as { data: IyzicoApiResponse; httpStatus: number };

    const refundId =
      (data.paymentTransactionId as string | undefined) ??
      (data.refundConversationId as string | undefined) ??
      '';
    const refundedPrice = parseFloat(
      (data.price as string | number | undefined) as string ?? String(amount),
    );
    const currency = (data.currency as string | undefined) ?? 'TRY';

    if (!refundId) {
      console.error('[iyzico] refundPayment: missing refund identifier', { data });
      return {
        success: false,
        code: 'MISSING_REFUND_ID',
        message: 'Iyzico did not return a refund identifier',
        rawResponse: data as Record<string, unknown>,
      } satisfies GatewayError;
    }

    return {
      success: true,
      refundId,
      amount: refundedPrice,
      currency,
      rawResponse: data as Record<string, unknown>,
    } satisfies RefundResult;
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const iyzicoAdapter = new IyzicoAdapter();
