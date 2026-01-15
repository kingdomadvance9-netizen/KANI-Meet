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
import ReactionButton from "./ReactionButton";
import FloatingReactions from "./FloatingReactions";
import ReactionOverlayLayer, {
  ReactionOverlayLayerHandle,
} from "./ReactionOverlayLayer";

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
    isScreenShareGloballyEnabled,
    forceMuted,
    forceVideoPaused,
    globalVideoDisabled,
    screenShareStreams,
    leaveRoom,
    participants,
    isHost,
    isCoHost,
  } = useMediasoupContext();

  // Get current participant's lock states
  const currentParticipant = participants.find((p) => p.id === user?.id);

  // Check if user has admin privileges (Host or Co-Host)
  const hasAdminPrivileges = isHost || isCoHost;

  // Host and Co-Host are NEVER locked, even if backend sends lock state
  const audioLocked = hasAdminPrivileges ? false : (currentParticipant?.audioLocked ?? false);
  const screenShareLocked = hasAdminPrivileges ? false : (currentParticipant?.screenShareLocked ?? false);

  // Additional States
  const [isRecording, setIsRecording] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const portalMenuRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<ReactionOverlayLayerHandle | null>(null);

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
    // Clean up all media and disconnect socket
    leaveRoom();
    // Navigate away after cleanup
    router.push("/");
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      // Click inside the 3-dot button
      if (menuRef.current?.contains(target)) return;

      // Click inside the portal menu
      if (portalMenuRef.current?.contains(target)) return;

      setIsMenuOpen(false);
    };

    if (isMenuOpen) {
      document.addEventListener("pointerdown", handlePointerDown);
    }

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isMenuOpen]);

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4 bg-dark-2/50 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl backdrop-blur-md border border-white/10 relative overflow-visible">
      {/* AUDIO BUTTON */}
      <button
        onClick={toggleAudio}
        disabled={audioLocked}
        className={cn(
          "p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl transition-all duration-200 touch-manipulation active:scale-95",
          isAudioMuted
            ? "bg-red-500 text-white"
            : "bg-dark-3 text-gray-300 hover:bg-dark-4",
          audioLocked && "opacity-50 cursor-not-allowed"
        )}
        aria-label={isAudioMuted ? "Unmute microphone" : "Mute microphone"}
        title={audioLocked ? "Muted by host" : ""}
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
        disabled={forceVideoPaused || globalVideoDisabled}
        className={cn(
          "p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl transition-all duration-200 touch-manipulation active:scale-95",
          !isVideoEnabled
            ? "bg-red-500 text-white"
            : "bg-dark-3 text-gray-300 hover:bg-dark-4",
          (forceVideoPaused || globalVideoDisabled) &&
            "opacity-50 cursor-not-allowed"
        )}
        aria-label={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
        title={
          globalVideoDisabled
            ? "All cameras disabled by host"
            : forceVideoPaused
            ? "Your camera disabled by host"
            : ""
        }
      >
        {isVideoEnabled ? (
          <Video className="w-4 h-4 sm:w-5 sm:h-5" />
        ) : (
          <VideoOff className="w-4 h-4 sm:w-5 sm:h-5" />
        )}
      </button>

      {/* SCREEN SHARE - Hidden on mobile, visible on tablet+ */}
      <button
        onClick={toggleScreenShare}
        disabled={
          screenShareLocked ||
          !isScreenShareGloballyEnabled ||
          (!isScreenSharing && screenShareStreams.size > 0)
        }
        title={
          screenShareLocked || !isScreenShareGloballyEnabled
            ? "Screen sharing disabled by host"
            : !isScreenSharing && screenShareStreams.size > 0
            ? "Someone is already sharing"
            : isScreenSharing
            ? "Stop sharing screen"
            : "Share screen"
        }
        className={cn(
          "hidden sm:flex p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl transition-all duration-200 touch-manipulation active:scale-95",
          isScreenSharing
            ? "bg-blue-500 text-white"
            : "bg-dark-3 text-gray-300 hover:bg-dark-4",
          (screenShareLocked ||
            !isScreenShareGloballyEnabled ||
            (!isScreenSharing && screenShareStreams.size > 0)) &&
            "opacity-50 cursor-not-allowed"
        )}
        aria-label={isScreenSharing ? "Stop sharing screen" : "Share screen"}
      >
        <MonitorUp className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>

      {/* RECORDING (Admin Only) - Hidden on mobile, visible on tablet+ */}
      {hasAdminPrivileges && (
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
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
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
        typeof window !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm p-4"
            onClick={(e) => {
              // Close menu when clicking the backdrop (not the menu itself)
              if (e.target === e.currentTarget) {
                setIsMenuOpen(false);
              }
            }}
          >
            <div
              ref={portalMenuRef}
              className="relative bg-dark-2 border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden w-full max-w-xs sm:max-w-sm backdrop-blur-md animate-in slide-in-from-bottom-4 duration-200"
            >
              {/* Screen Share Option */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleScreenShare();
                  setIsMenuOpen(false);
                }}
                disabled={
                  screenShareLocked ||
                  !isScreenShareGloballyEnabled ||
                  (!isScreenSharing && screenShareStreams.size > 0)
                }
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3.5 transition-all touch-manipulation active:bg-dark-4",
                  isScreenSharing
                    ? "bg-blue-500/20 text-blue-400"
                    : "text-gray-300 hover:bg-dark-3",
                  (screenShareLocked ||
                    !isScreenShareGloballyEnabled ||
                    (!isScreenSharing && screenShareStreams.size > 0)) &&
                    "opacity-50 cursor-not-allowed"
                )}
              >
                <MonitorUp className="w-5 h-5" />
                <span className="text-sm font-medium">
                  {screenShareLocked || !isScreenShareGloballyEnabled
                    ? "Screen Sharing Disabled"
                    : !isScreenSharing && screenShareStreams.size > 0
                    ? "Someone is Sharing"
                    : isScreenSharing
                    ? "Stop Sharing"
                    : "Share Screen"}
                </span>
              </button>

              {/* Pay with M-Pesa Option */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowPayment(true);
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 transition-all touch-manipulation active:bg-dark-4 text-gray-300 hover:bg-dark-3 border-t border-white/5"
              >
                <Banknote className="w-5 h-5" />
                <span className="text-sm font-medium">Pay with M-Pesa</span>
              </button>

              {/* Recording Option (Admin Only) */}
              {hasAdminPrivileges && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleRecording();
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3.5 transition-all touch-manipulation active:bg-dark-4 border-t border-white/5",
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

      {/* Reaction Button */}
      <ReactionButton
        onReact={({ emoji, sessionId }) => {
          console.log("[CustomControls] reaction requested", {
            emoji,
            sessionId,
          });
          // spawn local floating particle
          window.dispatchEvent(
            new CustomEvent("spawn-reaction", {
              detail: { emoji, sessionId },
            })
          );

          // show transient overlay for others
          if (overlayRef.current) {
            console.log("[CustomControls] calling overlayRef.showReaction", {
              emoji,
              sessionId,
            });
            overlayRef.current.showReaction({
              emoji,
              sessionId: sessionId ?? null,
            });
          } else {
            console.warn("[CustomControls] overlayRef not ready");
          }
        }}
      />

      {/* Render floating particles + overlay layer */}
      <FloatingReactions />
      <ReactionOverlayLayer ref={overlayRef} />

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
