"use client";

import { useEffect, useRef, useState } from "react";
import { useCallStateHooks } from "@stream-io/video-react-sdk";

// --- HELPER FUNCTION: WEB NOTIFICATIONS ---
const notifyUser = () => {
  if ("Notification" in window && Notification.permission === "granted") {
    const notification = new Notification("Meeting Active!", {
      body: "Click to return to your Custom Meet stream.",
      icon: "/icons/Gm-White-logo.png",
      tag: "meet-return-notification",
    }); // Auto-focus the tab when the user clicks the notification (works reliably on desktop)
    notification.onclick = function () {
      window.focus();
    };
  }
};
// ------------------------------------------

const MeetingRoomWrapper = ({ children }: { children: React.ReactNode }) => {
  const wakeLockRef = useRef<any>(null);
  const miniRef = useRef<HTMLDivElement>(null);

  const [showOverlay, setShowOverlay] = useState(false);
  const [drag, setDrag] = useState({ x: 20, y: 80 });
  const [isDragging, setIsDragging] = useState(false);

  const { useDominantSpeaker } = useCallStateHooks();
  const dominantSpeaker = useDominantSpeaker(); // WakeLock

  const requestWakeLock = async () => {
    try {
      if ("wakeLock" in navigator) {
        if (wakeLockRef.current) {
          await wakeLockRef.current.release();
        }
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        wakeLockRef.current.addEventListener("release", () => {
          if (!document.hidden) requestWakeLock();
        });
      }
    } catch (e) {
      console.error("Wake Lock failed to acquire:", e);
    }
  }; // Improved Background Audio with Media Session Actions

  const enableBackgroundAudio = () => {
    // 1. Setup Media Session for proper system controls and longevity
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: "Active Meeting",
        artist: "Custom Meet",
      });
      navigator.mediaSession.playbackState = "playing";

      // Add action handlers
      navigator.mediaSession.setActionHandler("play", () => {
        const audio = document.getElementById(
          "background-audio-trick"
        ) as HTMLAudioElement;
        audio?.play().catch(() => {});
        navigator.mediaSession.playbackState = "playing";
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        const audio = document.getElementById(
          "background-audio-trick"
        ) as HTMLAudioElement;
        audio?.pause();
        navigator.mediaSession.playbackState = "paused";
      });
    } // 2. Fallback: Use silent audio track
    let audio = document.getElementById(
      "background-audio-trick"
    ) as HTMLAudioElement;
    if (!audio) {
      audio = document.createElement("audio");
      audio.id = "background-audio-trick";
      audio.src = "/silent.mp3";
      audio.loop = true;
      audio.volume = 0.01;
      document.body.appendChild(audio);
    }

    audio.play().catch((error) => {
      console.warn(
        "Autoplay blocked, background audio may be restricted.",
        error
      );
    });
  }; // --- Core Effects (Mount & Cleanup) ---

  useEffect(() => {
    // A. Request Notification permission early
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    } // B. Activate Screen Wake Lock and Background Audio on mount

    requestWakeLock();
    enableBackgroundAudio(); // C. Visibility Change Handler (The core logic)

    const handleVis = () => {
      const isHidden = document.hidden;
      setShowOverlay(isHidden);

      if (isHidden) {
        // 1. Notify the user via OS notification (The true "pop-up")
        notifyUser();
        // Add PiP logic here if you want a visual element over other apps
      } else {
        // 2. Re-acquire WakeLock when returning to the tab
        requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVis); // D. Cleanup function runs on unmount

    return () => {
      document.removeEventListener("visibilitychange", handleVis);
      wakeLockRef.current?.release?.();
      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "paused";
      }
    };
  }, []); // Dragging logic (No changes needed, but added centering fix from previous suggestion)

  const onDragStart = () => setIsDragging(true);
  const onDragEnd = () => setIsDragging(false);

  const onDrag = (e: any) => {
    if (!isDragging) return;
    const miniSize = 65;
    const halfSize = miniSize / 2;

    setDrag({
      x: Math.max(10, e.clientX - halfSize),
      y: Math.max(10, e.clientY - halfSize),
    });
  };

  return (
    <div onMouseMove={onDrag} className="w-full h-full relative">
            {/* FULL MEETING UI */}      {children}     {" "}
      {/* FLOATING MINI OVERLAY (Will only appear if the browser window is visible) */}
           {" "}
      {showOverlay && (
        <div
          ref={miniRef}
          onMouseDown={onDragStart}
          onMouseUp={onDragEnd}
          onClick={() => {
            // This ensures clicking the in-browser overlay brings the tab into focus
            if (!isDragging) window.focus();
          }}
          className={`
            fixed z-[99999] cursor-pointer rounded-full 
            shadow-lg overflow-hidden transition-all duration-300
            ${dominantSpeaker ? "ring-4 ring-blue-400" : ""}
          `}
          style={{
            width: 65,
            height: 65,
            left: drag.x,
            top: drag.y,
          }}
        >
                   {" "}
          <div className="w-full h-full bg-black/60 flex items-center justify-center text-white text-sm">
                        Live          {" "}
          </div>
                 {" "}
        </div>
      )}
         {" "}
    </div>
  );
};

export default MeetingRoomWrapper;
