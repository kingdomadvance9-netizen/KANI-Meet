import { NextRequest, NextResponse } from "next/server";

interface CallbackMetadata {
  Item: Array<{
    Name: string;
    Value: string | number;
  }>;
}

interface StkCallback {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: number;
  ResultDesc: string;
  CallbackMetadata?: CallbackMetadata;
}

interface MpesaCallbackBody {
  Body: {
    stkCallback: StkCallback;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body: MpesaCallbackBody = await req.json();
    const { stkCallback } = body.Body;

    console.log("📞 M-Pesa Callback received:", JSON.stringify(body, null, 2));

    const {
      MerchantRequestID,
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
      CallbackMetadata,
    } = stkCallback;

    // Extract payment details if successful
    let transactionDetails: any = {
      merchantRequestId: MerchantRequestID,
      checkoutRequestId: CheckoutRequestID,
      resultCode: ResultCode,
      resultDesc: ResultDesc,
      status: ResultCode === 0 ? "completed" : "failed",
      updatedAt: new Date().toISOString(),
    };

    if (ResultCode === 0 && CallbackMetadata) {
      // Payment successful - extract metadata
      const metadata = CallbackMetadata.Item;
      transactionDetails = {
        ...transactionDetails,
        amount: metadata.find((item) => item.Name === "Amount")?.Value,
        mpesaReceiptNumber: metadata.find(
          (item) => item.Name === "MpesaReceiptNumber"
        )?.Value,
        transactionDate: metadata.find(
          (item) => item.Name === "TransactionDate"
        )?.Value,
        phoneNumber: metadata.find((item) => item.Name === "PhoneNumber")
          ?.Value,
      };

      console.log("✅ Payment successful:", transactionDetails);
    } else {
      // Payment failed or cancelled
      console.log("❌ Payment failed:", ResultDesc);
    }

    // TODO: Send this data to your backend API to save in database
    // await fetch('YOUR_BACKEND_URL/api/transactions/update', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(transactionDetails)
    // });

    // Always return 200 to acknowledge receipt
    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: "Callback received successfully",
    });
  } catch (error: any) {
    console.error("❌ Callback processing error:", error);

    // Still return 200 to prevent M-Pesa from retrying
    return NextResponse.json({
      ResultCode: 1,
      ResultDesc: "Callback processing error",
    });
  }
}

// M-Pesa also sends GET requests to verify the callback URL
export async function GET() {
  return NextResponse.json({
    message: "M-Pesa callback endpoint is active",
  });
}
