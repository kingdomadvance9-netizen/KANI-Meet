"use client";

import { useEffect, useRef, useState } from "react";
import { useCallStateHooks } from "@stream-io/video-react-sdk";

const MeetingRoomWrapper = ({ children }: { children: React.ReactNode }) => {
  const wakeLockRef = useRef<any>(null);
  const miniRef = useRef<HTMLDivElement>(null);

  const [minimized, setMinimized] = useState(false);
  const [drag, setDrag] = useState({ x: 20, y: 80 });
  const [isDragging, setIsDragging] = useState(false);

  // Active speaker glow (Stream hook)
  //   const { useActiveSpeaker } = useCallStateHooks();
  //   const activeSpeaker = useActiveSpeaker();
  // Dominant speaker glow (Stream hook)
  const { useDominantSpeaker } = useCallStateHooks();
  const dominantSpeaker = useDominantSpeaker();

  // WakeLock
  const requestWakeLock = async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch {}
  };

  // Background audio (Android Chrome)
  const enableBackgroundAudio = () => {
    const audio = document.createElement("audio");
    audio.src = "/silent.mp3";
    audio.loop = true;
    audio.play().catch(() => {});
  };

  useEffect(() => {
    requestWakeLock();
    enableBackgroundAudio();

    const handleVis = () => {
      if (!document.hidden) requestWakeLock();
    };
    document.addEventListener("visibilitychange", handleVis);

    return () => {
      document.removeEventListener("visibilitychange", handleVis);
      wakeLockRef.current?.release?.();
    };
  }, []);

  // Dragging logic for mini window
  const onDragStart = () => setIsDragging(true);
  const onDragEnd = () => setIsDragging(false);

  const onDrag = (e: any) => {
    if (!isDragging) return;
    setDrag({
      x: Math.max(10, e.clientX - 50),
      y: Math.max(10, e.clientY - 50),
    });
  };

  return (
    <div onMouseMove={onDrag} className="w-full h-full relative">
      {/* FULL MEETING UI */}
      {!minimized && (
        <div className="w-full h-full">
          {children}

          {/* Minimize Button */}
          <button
            onClick={() => setMinimized(true)}
            className="absolute top-4 right-4 z-50 bg-black/60 text-white px-3 py-1 rounded-full"
          >
            Minimize
          </button>
        </div>
      )}

      {/* MINI FLOATING OVERLAY */}
      {minimized && (
        <div
          ref={miniRef}
          onMouseDown={onDragStart}
          onMouseUp={onDragEnd}
          onClick={() => {
            if (!isDragging) setMinimized(false);
          }}
          className={`
            fixed z-50 cursor-pointer rounded-full
            overflow-hidden shadow-lg transition-all duration-300
            ${dominantSpeaker ? "ring-4 ring-blue-400" : ""}
          `}
          style={{
            width: minimized ? 50 : 180,
            height: minimized ? 50 : 180,
            left: drag.x,
            top: drag.y,
          }}
        >
          <div className="w-full h-full bg-black/50 flex items-center justify-center text-white">
            GM
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingRoomWrapper;
