"use client";

import { useState, useEffect, useRef } from "react";
import { X, CreditCard, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentModalProps {
  userId: string;
  userName?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type AccountType = "ROOM_PAYMENT" | "SUBSCRIPTION" | "CREDITS" | "DONATION";
type PaymentStatus = "idle" | "loading" | "verifying" | "success" | "error";

export default function PaymentModal({
  userId,
  userName,
  isOpen,
  onClose,
  onSuccess,
}: PaymentModalProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("ROOM_PAYMENT");
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [message, setMessage] = useState("");
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingStartTimeRef = useRef<number>(0);

  // Cleanup polling on unmount or when modal closes
  useEffect(() => {
    if (!isOpen) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }
  }, [isOpen]);

  const checkPaymentStatus = async (txId: string) => {
    try {
      const response = await fetch(
        `http://localhost:8080/api/mpesa/status/${txId}`
      );
      const data = await response.json();

      if (response.ok && data.transaction) {
        const { status: paymentStatus } = data.transaction;

        if (paymentStatus === "SUCCESS") {
          setStatus("success");
          setMessage("Payment completed successfully!");
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          if (onSuccess) {
            onSuccess();
          }
          setTimeout(() => {
            handleClose();
          }, 2000);
        } else if (
          paymentStatus === "FAILED" ||
          paymentStatus === "CANCELLED"
        ) {
          setStatus("error");
          setMessage(
            `Payment ${paymentStatus.toLowerCase()}. Please try again.`
          );
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
        // If PENDING, continue polling
      }
    } catch (error) {
      console.error("Error checking payment status:", error);
    }

    // Check if 60 seconds have passed
    if (Date.now() - pollingStartTimeRef.current > 60000) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setStatus("error");
      setMessage(
        "Payment verification timeout. Please check your M-Pesa messages."
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("Sending payment request...");

    try {
      const response = await fetch("http://localhost:8080/api/mpesa/initiate", {
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

      const data = await response.json();

      if (response.ok && data.transactionId) {
        setTransactionId(data.transactionId);
        setStatus("verifying");
        setMessage(
          "Check your phone and enter M-Pesa PIN to complete payment..."
        );

        // Start polling for payment status
        pollingStartTimeRef.current = Date.now();
        pollingIntervalRef.current = setInterval(() => {
          checkPaymentStatus(data.transactionId);
        }, 5000);
      } else {
        setStatus("error");
        setMessage(data.error || "Failed to initiate payment");
      }
    } catch (error: any) {
      setStatus("error");
      setMessage(error.message || "An error occurred while initiating payment");
    }
  };

  const resetForm = () => {
    setPhoneNumber("");
    setAmount("");
    setAccountType("ROOM_PAYMENT");
    setStatus("idle");
    setMessage("");
    setTransactionId(null);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-dark-1 rounded-2xl shadow-2xl border border-white/10 overflow-hidden z-[10001]">
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
              className="w-full px-4 py-3 bg-dark-2 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
              required
              disabled={status === "loading" || status === "verifying"}
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
              className="w-full px-4 py-3 bg-dark-2 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
              required
              disabled={status === "loading" || status === "verifying"}
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
              className="w-full px-4 py-3 bg-dark-2 border border-white/10 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
              disabled={status === "loading" || status === "verifying"}
            >
              <option value="ROOM_PAYMENT">Room Payment</option>
              <option value="SUBSCRIPTION">Subscription</option>
              <option value="CREDITS">Buy Credits</option>
              <option value="DONATION">Donation</option>
            </select>
          </div>

          {/* Status Message */}
          {message && (
            <div
              className={cn(
                "flex items-center gap-2 p-4 rounded-lg text-sm",
                status === "success" &&
                  "bg-green-500/20 text-green-400 border border-green-500/30",
                status === "error" &&
                  "bg-red-500/20 text-red-400 border border-red-500/30",
                status === "verifying" &&
                  "bg-blue-500/20 text-blue-400 border border-blue-500/30"
              )}
            >
              {status === "success" && (
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              )}
              {status === "error" && (
                <XCircle className="w-5 h-5 flex-shrink-0" />
              )}
              {status === "verifying" && (
                <Loader2 className="w-5 h-5 flex-shrink-0 animate-spin" />
              )}
              <span>{message}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={
              status === "loading" ||
              status === "verifying" ||
              status === "success"
            }
            className={cn(
              "w-full py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2",
              status === "loading" ||
                status === "verifying" ||
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
            ) : status === "verifying" ? (
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

          <p className="text-xs text-center text-gray-500">
            You will receive an M-Pesa prompt on your phone. Enter your PIN to
            complete the payment.
          </p>
        </form>
      </div>
    </div>
  );
}
