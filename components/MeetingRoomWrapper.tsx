"use client";

import { useEffect, useRef } from "react";

/**
 * MeetingRoomWrapper:
 * - Prevents screen from automatically turning off (Wake Lock API)
 * - Allows background audio (Android Chrome)
 * - Restores wake lock when user returns to the tab
 */
const MeetingRoomWrapper = ({ children }: { children: React.ReactNode }) => {
  const wakeLockRef = useRef<any>(null);

  // Request screen wake lock
  const requestWakeLock = async () => {
    try {
      if ("wakeLock" in navigator && navigator.wakeLock.request) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        // Re-acquire lock if it is lost
        wakeLockRef.current.addEventListener("release", () => {
          console.log("Wake Lock was released");
        });
        console.log("Wake Lock active");
      }
    } catch (err) {
      console.warn("WakeLock error:", err);
    }
  };

  // Enable audio in background (Android Chrome)
  const enableBackgroundAudio = () => {
    const audio = document.createElement("audio");
    audio.src = "/silent.mp3"; // create blank 1-second audio file
    audio.loop = true;
    audio.play().catch(() => {});
  };

  useEffect(() => {
    requestWakeLock();
    enableBackgroundAudio(); // Optional: comment out if you don't want background audio

    // Re-enable when returning to the tab
    const onVisibilityChange = () => {
      if (!document.hidden) {
        requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, []);

  return <div className="w-full h-full">{children}</div>;
};

export default MeetingRoomWrapper;
