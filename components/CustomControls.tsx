"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  CircleDot,
  PhoneOff,
  MoreVertical,
  Banknote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMediasoupContext } from "@/contexts/MediasoupContext";
import PaymentModal from "./PaymentModal";

const CustomCallControls = () => {
  const router = useRouter();
  const { user } = useUser();
  const {
    isAudioMuted,
    isVideoEnabled,
    toggleAudio,
    toggleVideo,
    enableScreenShare,
    disableScreenShare,
    isScreenSharing,
  } = useMediasoupContext();

  // Additional States
  const [isRecording, setIsRecording] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // ✅ Admin Check (Could be enhanced later)
  const isAdmin = true;

  // Handlers
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      disableScreenShare();
    } else {
      await enableScreenShare();
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    setIsMenuOpen(false);
  };

  const handleLeave = () => {
    // Disconnect and navigate away
    router.push("/");
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4 bg-dark-2/50 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl backdrop-blur-md border border-white/10">
      {/* AUDIO BUTTON */}
      <button
        onClick={toggleAudio}
        className={cn(
          "p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl transition-all duration-200 touch-manipulation active:scale-95",
          isAudioMuted
            ? "bg-red-500 text-white"
            : "bg-dark-3 text-gray-300 hover:bg-dark-4"
        )}
        aria-label={isAudioMuted ? "Unmute microphone" : "Mute microphone"}
      >
        {isAudioMuted ? (
          <MicOff className="w-4 h-4 sm:w-5 sm:h-5" />
        ) : (
          <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
        )}
      </button>

      {/* VIDEO BUTTON */}
      <button
        onClick={toggleVideo}
        className={cn(
          "p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl transition-all duration-200 touch-manipulation active:scale-95",
          !isVideoEnabled
            ? "bg-red-500 text-white"
            : "bg-dark-3 text-gray-300 hover:bg-dark-4"
        )}
        aria-label={!isVideoEnabled ? "Turn on camera" : "Turn off camera"}
      >
        {!isVideoEnabled ? (
          <VideoOff className="w-4 h-4 sm:w-5 sm:h-5" />
        ) : (
          <Video className="w-4 h-4 sm:w-5 sm:h-5" />
        )}
      </button>

      {/* SCREEN SHARE - Hidden on mobile, visible on tablet+ */}
      <button
        onClick={toggleScreenShare}
        className={cn(
          "hidden sm:flex p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl transition-all duration-200 touch-manipulation active:scale-95",
          isScreenSharing
            ? "bg-blue-500 text-white"
            : "bg-dark-3 text-gray-300 hover:bg-dark-4"
        )}
        aria-label={isScreenSharing ? "Stop sharing screen" : "Share screen"}
      >
        <MonitorUp className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>

      {/* RECORDING (Admin Only) - Hidden on mobile, visible on tablet+ */}
      {isAdmin && (
        <button
          onClick={toggleRecording}
          className={cn(
            "hidden sm:flex p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl transition-all duration-200 touch-manipulation active:scale-95",
            isRecording
              ? "bg-red-500 animate-pulse text-white"
              : "bg-dark-3 text-gray-300 hover:bg-dark-4"
          )}
          aria-label={isRecording ? "Stop recording" : "Start recording"}
        >
          <CircleDot className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      )}

      {/* M-PESA PAYMENT - Hidden on mobile, visible on tablet+ */}
      <button
        onClick={() => setShowPayment(true)}
        className="hidden sm:flex p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl transition-all duration-200 touch-manipulation active:scale-95 bg-dark-3 text-gray-300 hover:bg-dark-4"
        aria-label="Pay with M-Pesa"
      >
        <Banknote className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>

      {/* MORE OPTIONS MENU - Visible only on mobile */}
      <div className="relative sm:hidden" ref={menuRef}>
        <button
          ref={buttonRef}
          onClick={() => {
            if (!isMenuOpen && buttonRef.current) {
              setButtonRect(buttonRef.current.getBoundingClientRect());
            }
            setIsMenuOpen(!isMenuOpen);
          }}
          className={cn(
            "p-2 rounded-lg transition-all duration-200 touch-manipulation active:scale-95",
            isMenuOpen
              ? "bg-blue-500 text-white"
              : "bg-dark-3 text-gray-300 hover:bg-dark-4"
          )}
          aria-label="More options"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      {/* Dropdown Menu - Rendered via Portal */}
      {isMenuOpen &&
        buttonRect &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              bottom: `${window.innerHeight - buttonRect.top + 8}px`,
              right: `${window.innerWidth - buttonRect.right}px`,
            }}
            className="z-[9999]"
          >
            <div className="bg-dark-2 border border-white/10 rounded-xl shadow-xl overflow-hidden min-w-[200px] backdrop-blur-md">
              {/* Screen Share Option */}
              <button
                onClick={() => {
                  toggleScreenShare();
                  setIsMenuOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 transition-all touch-manipulation active:bg-dark-4",
                  isScreenSharing
                    ? "bg-blue-500/20 text-blue-400"
                    : "text-gray-300 hover:bg-dark-3"
                )}
              >
                <MonitorUp className="w-5 h-5" />
                <span className="text-sm font-medium">
                  {isScreenSharing ? "Stop Sharing" : "Share Screen"}
                </span>
              </button>

              {/* Pay with M-Pesa Option */}
              <button
                onClick={() => {
                  setShowPayment(true);
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 transition-all touch-manipulation active:bg-dark-4 text-gray-300 hover:bg-dark-3"
              >
                <Banknote className="w-5 h-5" />
                <span className="text-sm font-medium">Pay with M-Pesa</span>
              </button>

              {/* Recording Option (Admin Only) */}
              {isAdmin && (
                <button
                  onClick={toggleRecording}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 transition-all touch-manipulation active:bg-dark-4",
                    isRecording
                      ? "bg-red-500/20 text-red-400"
                      : "text-gray-300 hover:bg-dark-3"
                  )}
                >
                  <CircleDot className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    {isRecording ? "Stop Recording" : "Start Recording"}
                  </span>
                </button>
              )}
            </div>
          </div>,
          document.body
        )}

      <div className="w-[1px] h-6 sm:h-8 bg-white/10 mx-0.5 sm:mx-1" />

      {/* HANG UP */}
      <button
        onClick={handleLeave}
        className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl bg-red-600 hover:bg-red-700 text-white transition-all shadow-lg shadow-red-900/20 touch-manipulation active:scale-95"
        aria-label="Leave call"
      >
        <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>

      {/* Payment Modal - Rendered via Portal */}
      {showPayment &&
        typeof window !== "undefined" &&
        createPortal(
          <PaymentModal
            userId={user?.id || "anonymous"}
            userName={user?.fullName || user?.firstName || undefined}
            isOpen={showPayment}
            onClose={() => setShowPayment(false)}
            onSuccess={() => {
              console.log("Payment completed successfully!");
            }}
          />,
          document.body
        )}
    </div>
  );
};

export default CustomCallControls;
