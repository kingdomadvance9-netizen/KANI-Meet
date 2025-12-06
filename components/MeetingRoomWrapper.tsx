"use client";

import { useEffect, useRef, useState } from "react";
import { useCallStateHooks } from "@stream-io/video-react-sdk";


// --- HELPER FUNCTION: WEB NOTIFICATIONS ---
// Defined outside the component to avoid re-creation on every render.
const notifyUser = () => {
  if ('Notification' in window && Notification.permission === "granted") {
    // Only send the notification if the user hasn't actively denied it
    const notification = new Notification("Meeting Active!", {
      body: "Click to return to your Custom Meet stream.",
      // IMPORTANT: Use the actual path to your application icon
      icon: "/icons/Gm-White-logo.png", 
      tag: "meet-return-notification" // Prevents multiple similar notifications
    });
    
    // Auto-focus the tab when the user clicks the notification
    notification.onclick = function() {
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
  const dominantSpeaker = useDominantSpeaker();

  // WakeLock
const requestWakeLock = async () => {
  try {
    if ("wakeLock" in navigator) {
      // 1. Release any existing lock first
      if (wakeLockRef.current) {
          await wakeLockRef.current.release();
      }
      
      wakeLockRef.current = await navigator.wakeLock.request("screen");
      
      // 2. Add an event listener to re-request if the browser auto-releases it (e.g., error)
      wakeLockRef.current.addEventListener('release', () => {
        console.log('Wake Lock was released by the browser.');
        // If it was released while the tab is visible, re-request it
        if (!document.hidden) requestWakeLock();
      });
    }
  } catch (e) {
      console.error("Wake Lock failed to acquire:", e);
  }
};

  // Background audio (Android Chrome)
  const enableBackgroundAudio = () => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Active Meeting',
        artist: 'Custom Meet',
      });
      navigator.mediaSession.playbackState = "playing";
    }
    
    // Fallback for strict mobile background audio
    const audio = document.createElement("audio");
    audio.src = "/silent.mp3";
    audio.loop = true;
    audio.volume = 0.01; // Ensure volume is not zero, but very low
    
    // Play audio only after user interaction (optional, but safer)
    audio.play().catch((error) => {
        // This is often an Autoplay error. It may start later.
        console.warn("Autoplay blocked, background audio may be restricted.", error);
    });
};

 // --- Core Effects (Mount & Cleanup) ---
    useEffect(() => {
        // A. Request Notification permission early
        if ('Notification' in window && Notification.permission !== 'granted') {
            Notification.requestPermission();
        }

        // B. Activate Screen Wake Lock and Background Audio on mount
        requestWakeLock();
        enableBackgroundAudio();

        // C. Visibility Change Handler (The core logic)
        const handleVis = () => {
            const isHidden = document.hidden;
            setShowOverlay(isHidden); // Show floating UI when tab is hidden

            if (isHidden) {
                // 1. Notify the user via OS notification
                notifyUser(); 
            } else {
                // 2. Re-acquire WakeLock when returning to the tab
                requestWakeLock();
            }
        };

        document.addEventListener("visibilitychange", handleVis);

        // D. Cleanup function runs on unmount
        return () => {
            document.removeEventListener("visibilitychange", handleVis);
            wakeLockRef.current?.release?.(); // Release the lock on unmount
            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = "paused";
            }
        };
    }, []);

  // Dragging logic
  const onDragStart = () => setIsDragging(true);
  const onDragEnd = () => setIsDragging(false);

const onDrag = (e: any) => {
    if (!isDragging) return;
    const miniSize = 65; // Use the size of your mini-overlay
    const halfSize = miniSize / 2;

    setDrag({
        // Set minimum boundary to 10px from edge
        x: Math.max(10, e.clientX - halfSize), 
        y: Math.max(10, e.clientY - halfSize),
    });
};

  return (
    <div onMouseMove={onDrag} className="w-full h-full relative">

      {/* FULL MEETING UI */}
      {children}

      {/* FLOATING MINI OVERLAY (appears only when tab hidden) */}
      {showOverlay && (
        <div
          ref={miniRef}
          onMouseDown={onDragStart}
          onMouseUp={onDragEnd}
          onClick={() => {
            if (!isDragging) window.focus(); // return to tab
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
          <div className="w-full h-full bg-black/60 flex items-center justify-center text-white text-sm">
            Live
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingRoomWrapper;
