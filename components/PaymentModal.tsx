"use client";

import { useState, useEffect, useRef } from "react";
import { X, CreditCard, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PaymentModalProps {
  userId: string;
  userName?: string;
  isOpen: boolean;
  onClose?: () => void;
  onSuccess?: (transactionId: string) => void;
  onError?: (error: string) => void;
}

type AccountType = "OFFERING" | "TITHE" | "PARTNERSHIP" | "MISSIONS";
type PaymentStatus =
  | "idle"
  | "loading"
  | "checkingStatus"
  | "success"
  | "error";

export default function PaymentModal({
  userId,
  userName,
  isOpen,
  onClose,
  onSuccess,
  onError,
}: PaymentModalProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("OFFERING");
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(
    null
  );
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingCountRef = useRef<number>(0);
  const hasShownSuccessRef = useRef<boolean>(false);
  const maxPollingAttempts = 12; // 12 attempts × 5 seconds = 60 seconds

  // Cleanup polling on unmount or when modal closes
  useEffect(() => {
    if (!isOpen) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      pollingCountRef.current = 0;
      hasShownSuccessRef.current = false;
    }
  }, [isOpen]);

  const checkPaymentStatus = async (requestId: string) => {
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_SOCKET_URL?.replace(/\/$/, "") || "";
      const response = await fetch(`${baseUrl}/api/mpesa/status/${requestId}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      console.log("💰 Payment status check:", {
        requestId,
        attempt: pollingCountRef.current + 1,
        response: data,
      });

      pollingCountRef.current += 1;

      if (data.status === "SUCCESS" && data.data) {
        // Payment successful
        setStatus("success");
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }

        // Prevent showing multiple success messages
        if (hasShownSuccessRef.current) {
          return;
        }
        hasShownSuccessRef.current = true;

        // Format amount with currency
        const formattedAmount = new Intl.NumberFormat("en-KE", {
          style: "currency",
          currency: "KES",
        }).format(data.data.amount);

        // Handle empty id - use mpesaReceiptNumber as fallback
        const transactionId =
          data.data.id || data.data.mpesaReceiptNumber || "N/A";

        console.log("✅ Payment successful:", {
          transactionId,
          receipt: data.data.mpesaReceiptNumber,
          amount: data.data.amount,
        });

        // Beautiful church-appropriate thank you message with custom styling
        toast.custom(
          (t) => (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-400 rounded-xl shadow-2xl p-6 max-w-md mx-auto relative animate-in slide-in-from-top-5">
              {/* Close button */}
              <button
                onClick={() => toast.dismiss(t)}
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header with icon */}
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-green-500 rounded-full p-3">
                  <CheckCircle2 className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-green-800">
                    Payment Successful!
                  </h3>
                  <p className="text-sm text-green-600">
                    Transaction completed
                  </p>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-green-200 my-4"></div>

              {/* Thank you message */}
              <div className="space-y-3">
                <p className="text-lg text-gray-700 leading-relaxed">
                  🙏 <span className="font-semibold">Thank you</span> for your
                  generous giving of{" "}
                  <span className="font-bold text-green-700">
                    {formattedAmount}
                  </span>
                  !
                </p>

                <p className="text-base text-gray-600 italic">
                  God bless you abundantly. Your support helps further the
                  Kingdom.
                </p>

                {/* Receipt info */}
                <div className="bg-white rounded-lg p-3 border border-green-200 mt-4">
                  <p className="text-sm text-gray-500">M-Pesa Receipt</p>
                  <p className="text-lg font-mono font-bold text-gray-800">
                    {data.data.mpesaReceiptNumber || "Processing..."}
                  </p>
                  {!data.data.mpesaReceiptNumber && (
                    <p className="text-xs text-gray-400 mt-1">
                      Receipt will be available shortly
                    </p>
                  )}
                </div>

                {/* Blessing */}
                <p className="text-center text-sm text-green-600 font-medium mt-4">
                  ✨ May the Lord bless you and keep you ✨
                </p>
              </div>
            </div>
          ),
          {
            duration: Infinity, // Won't auto-dismiss - user must click X
            position: "top-center", // Prominent position
          }
        );

        if (onSuccess) {
          onSuccess(transactionId);
        }
        setTimeout(() => {
          handleClose();
        }, 2000);
      } else if (data.status === "NOT_FOUND" || data.status === "FAILED") {
        // Transaction not found or failed - error
        setStatus("error");
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        const errorMsg = data.message || "Transaction failed";
        toast.error(errorMsg);
        if (onError) {
          onError(errorMsg);
        }
      } else if (data.status === "PENDING") {
        // Still pending - continue polling
        if (pollingCountRef.current >= maxPollingAttempts) {
          // Timeout reached
          setStatus("idle");
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          toast.warning(
            "Payment verification timeout. Please check your transaction history."
          );
        }
        // Otherwise continue polling
      }
    } catch (error) {
      console.error("❌ Error checking payment status:", error);
      pollingCountRef.current += 1;

      if (pollingCountRef.current >= maxPollingAttempts) {
        setStatus("error");
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        const errorMsg = "Failed to verify payment status";
        toast.error(errorMsg);
        if (onError) {
          onError(errorMsg);
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");

    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_SOCKET_URL?.replace(/\/$/, "") || "";
      const apiUrl = `${baseUrl}/api/mpesa/initiate`;
      console.log("🔗 Calling M-Pesa API:", apiUrl);

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          userName: userName || "Anonymous",
          phoneNumber,
          amount: parseFloat(amount),
          accountReference: accountType,
        }),
      });

      console.log("📡 M-Pesa API Response Status:", response.status);

      // Check if response is JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("❌ Expected JSON but got:", text.substring(0, 200));
        throw new Error(
          `API returned HTML instead of JSON. Check that NEXT_PUBLIC_SOCKET_URL (${process.env.NEXT_PUBLIC_SOCKET_URL}) is correct and the endpoint exists.`
        );
      }

      const result = await response.json();
      console.log("📦 M-Pesa API Result:", result);

      if (response.ok && result.success && result.data) {
        const { checkoutRequestId: reqId } = result.data;
        setCheckoutRequestId(reqId);
        setStatus("checkingStatus");

        // Show toast
        toast.info("Check your phone for M-Pesa PIN prompt", {
          duration: 5000,
        });

        // Start polling after 5 seconds
        pollingCountRef.current = 0;
        setTimeout(() => {
          pollingIntervalRef.current = setInterval(() => {
            checkPaymentStatus(reqId);
          }, 5000);
        }, 5000);
      } else {
        setStatus("error");
        const errorMsg = result.message || "Failed to initiate payment";
        toast.error(errorMsg);
        if (onError) {
          onError(errorMsg);
        }
      }
    } catch (error: any) {
      setStatus("error");
      const errorMsg =
        error.message || "An error occurred while initiating payment";
      toast.error(errorMsg);
      if (onError) {
        onError(errorMsg);
      }
    }
  };

  const resetForm = () => {
    setPhoneNumber("");
    setAmount("");
    setAccountType("OFFERING");
    setStatus("idle");
    setCheckoutRequestId(null);
    pollingCountRef.current = 0;
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const handleClose = () => {
    resetForm();
    if (onClose) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-md bg-dark-1 rounded-2xl shadow-2xl border border-white/10 my-auto max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <CreditCard className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">
                Lipa na M-Pesa
              </h2>
              <p className="text-sm text-gray-400">Make a payment</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/10 rounded-lg transition"
            disabled={status === "loading" || status === "checkingStatus"}
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Phone Number */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="0712345678 or 254712345678"
              className="w-full px-4 py-3 bg-dark-2 border border-gray-300 rounded-lg text-white placeholder-gray-500 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition"
              required
              disabled={status === "loading" || status === "checkingStatus"}
            />
            <p className="mt-1 text-xs text-gray-500">
              Enter your M-Pesa number
            </p>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Amount (KES)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100"
              min="1"
              step="1"
              className="w-full px-4 py-3 bg-dark-2 border border-gray-300 rounded-lg text-white placeholder-gray-500 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition"
              required
              disabled={status === "loading" || status === "checkingStatus"}
            />
          </div>

          {/* Account Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Account Type
            </label>
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as AccountType)}
              className="w-full px-4 py-3 bg-dark-2 border border-gray-300 rounded-lg text-white focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition"
              disabled={status === "loading" || status === "checkingStatus"}
            >
              <option value="OFFERING">Offering</option>
              <option value="TITHE">Tithe</option>
              <option value="PARTNERSHIP">Partnership</option>
              <option value="MISSIONS">Missions</option>
            </select>
          </div>

          {/* Info Message */}
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
            <p className="text-xs text-green-400">
              You will receive an STK Push prompt. Enter your M-Pesa PIN to
              complete payment.
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={
              status === "loading" ||
              status === "checkingStatus" ||
              status === "success"
            }
            className={cn(
              "w-full py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2",
              status === "loading" ||
                status === "checkingStatus" ||
                status === "success"
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700 active:scale-95"
            )}
          >
            {status === "loading" ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Sending Request...
              </>
            ) : status === "checkingStatus" ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Verifying Payment...
              </>
            ) : status === "success" ? (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Payment Successful!
              </>
            ) : (
              "Send Payment Request"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
