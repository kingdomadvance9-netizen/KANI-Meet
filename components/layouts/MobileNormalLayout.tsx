"use client";

import { useEffect, useRef } from "react";

// ✅ Consistent interface for Mediasoup
interface MediasoupParticipant {
  sessionId: string;
  name?: string;
  videoTrack?: MediaStreamTrack | null;
  isLocal?: boolean;
}

interface MobileNormalLayoutProps {
  participants: MediasoupParticipant[]; // Changed from 'sorted'
  activeSpeakerId: string | null; // Changed from object
  screenWidth: number;
}

const MobileNormalLayout = ({
  participants,
  activeSpeakerId,
  screenWidth,
}: MobileNormalLayoutProps) => {
  
  return (
    <div className="h-[calc(100vh-100px)] overflow-y-auto p-4 pb-24 scrollbar-hide">
      <div
        className="
          grid 
          grid-cols-2 
          gap-4
        "
      >
        {participants.map((p) => (
          <div
            key={p.sessionId}
            className={`
              bg-dark-3
              rounded-xl 
              overflow-hidden 
              shadow-lg 
              w-full 
              aspect-square
              transition-all
              relative
              ${p.sessionId === activeSpeakerId 
                ? "ring-4 ring-red-2 scale-[1.02] z-10" 
                : "border border-white/5"}
            `}
          >
            <MobileVideoView track={p.videoTrack} isLocal={p.isLocal} />
            
            <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[10px] text-white backdrop-blur-sm">
              {p.name || "User"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ✅ Helper for Mobile Video Rendering
const MobileVideoView = ({ track, isLocal }: { track?: MediaStreamTrack | null, isLocal?: boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && track) {
      videoRef.current.srcObject = new MediaStream([track]);
    }
  }, [track]);

  if (!track) return (
    <div className="w-full h-full flex items-center justify-center bg-dark-1">
       <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-xs">
          OFF
       </div>
    </div>
  );

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={isLocal}
      className={`w-full h-full object-cover ${isLocal ? 'mirror' : ''}`}
    />
  );
};

export default MobileNormalLayout;