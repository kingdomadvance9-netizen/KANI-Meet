/**
 * M-Pesa API Integration Library
 * Handles authentication and STK Push requests
 */

interface MpesaAuthResponse {
  access_token: string;
  expires_in: string;
}

interface StkPushRequest {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
}

interface StkPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

/**
 * Get M-Pesa OAuth token
 */
export async function getMpesaToken(): Promise<string> {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  const environment = process.env.MPESA_ENVIRONMENT || "sandbox";

  if (!consumerKey || !consumerSecret) {
    throw new Error("M-Pesa credentials not configured");
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString(
    "base64"
  );

  const url =
    environment === "production"
      ? "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
      : "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get M-Pesa token: ${response.statusText}`);
    }

    const data: MpesaAuthResponse = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("Error getting M-Pesa token:", error);
    throw error;
  }
}

/**
 * Generate M-Pesa password for STK Push
 */
export function generateMpesaPassword(): {
  password: string;
  timestamp: string;
} {
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;

  if (!shortcode || !passkey) {
    throw new Error("M-Pesa shortcode or passkey not configured");
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14);
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString(
    "base64"
  );

  return { password, timestamp };
}

/**
 * Format phone number to M-Pesa format (254...)
 */
export function formatPhoneNumber(phone: string): string {
  // Remove any spaces, dashes, or plus signs
  let cleaned = phone.replace(/[\s\-+]/g, "");

  // If starts with 0, replace with 254
  if (cleaned.startsWith("0")) {
    cleaned = "254" + cleaned.slice(1);
  }

  // If doesn't start with 254, add it
  if (!cleaned.startsWith("254")) {
    cleaned = "254" + cleaned;
  }

  return cleaned;
}

/**
 * Initiate STK Push payment
 */
export async function initiateStkPush(
  request: StkPushRequest
): Promise<StkPushResponse> {
  const token = await getMpesaToken();
  const { password, timestamp } = generateMpesaPassword();
  const environment = process.env.MPESA_ENVIRONMENT || "sandbox";
  const shortcode = process.env.MPESA_SHORTCODE;
  const callbackUrl = process.env.MPESA_CALLBACK_URL;

  if (!shortcode || !callbackUrl) {
    throw new Error("M-Pesa configuration incomplete");
  }

  const formattedPhone = formatPhoneNumber(request.phoneNumber);

  const url =
    environment === "production"
      ? "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
      : "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest";

  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: Math.floor(request.amount), // Must be integer
    PartyA: formattedPhone,
    PartyB: shortcode,
    PhoneNumber: formattedPhone,
    CallBackURL: callbackUrl,
    AccountReference: request.accountReference,
    TransactionDesc: request.transactionDesc,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `STK Push failed: ${errorData.errorMessage || response.statusText}`
      );
    }

    const data: StkPushResponse = await response.json();
    return data;
  } catch (error) {
    console.error("Error initiating STK Push:", error);
    throw error;
  }
}

/**
 * Query STK Push transaction status
 */
export async function queryStkPushStatus(checkoutRequestID: string) {
  const token = await getMpesaToken();
  const { password, timestamp } = generateMpesaPassword();
  const environment = process.env.MPESA_ENVIRONMENT || "sandbox";
  const shortcode = process.env.MPESA_SHORTCODE;

  const url =
    environment === "production"
      ? "https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query"
      : "https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query";

  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    CheckoutRequestID: checkoutRequestID,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Query failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error querying transaction:", error);
    throw error;
  }
}
