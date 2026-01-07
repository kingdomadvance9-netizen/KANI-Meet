import { NextRequest, NextResponse } from "next/server";
import { initiateStkPush } from "@/lib/mpesa";
import { auth } from "@clerk/nextjs/server";

interface PaymentRequest {
  phoneNumber: string;
  amount: number;
  accountType: "meeting" | "subscription" | "other";
  accountReference?: string;
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body: PaymentRequest = await req.json();
    const { phoneNumber, amount, accountType, accountReference } = body;

    // Validate input
    if (!phoneNumber || !amount) {
      return NextResponse.json(
        { error: "Phone number and amount are required" },
        { status: 400 }
      );
    }

    if (amount < 1) {
      return NextResponse.json(
        { error: "Amount must be at least 1 KES" },
        { status: 400 }
      );
    }

    // Generate account reference based on type
    const reference =
      accountReference ||
      `${accountType.toUpperCase()}-${Date.now()}-${userId.slice(0, 8)}`;

    // Initiate STK Push
    const stkResponse = await initiateStkPush({
      phoneNumber,
      amount,
      accountReference: reference,
      transactionDesc: `Payment for ${accountType}`,
    });

    // Log transaction data - Your backend will save this via webhook/callback
    console.log("💰 Payment initiated:", {
      userId,
      phoneNumber,
      amount,
      accountType,
      accountReference: reference,
      merchantRequestId: stkResponse.MerchantRequestID,
      checkoutRequestId: stkResponse.CheckoutRequestID,
    });

    return NextResponse.json({
      success: true,
      message: stkResponse.CustomerMessage,
      checkoutRequestId: stkResponse.CheckoutRequestID,
      merchantRequestId: stkResponse.MerchantRequestID,
    });
  } catch (error: any) {
    console.error("❌ Payment initiation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to initiate payment" },
      { status: 500 }
    );
  }
}
