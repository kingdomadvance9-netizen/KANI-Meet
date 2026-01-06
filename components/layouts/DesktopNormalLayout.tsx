"use client";

import { useEffect, useRef } from "react";

// ✅ NEW: Simple interface to replace Stream's types
interface MediasoupParticipant {
  sessionId: string;
  name?: string;
  videoTrack?: MediaStreamTrack | null;
  isLocal?: boolean;
}

interface DesktopNormalLayoutProps {
  participants: MediasoupParticipant[]; // Changed from 'sorted'
  screenWidth: number;
  activeSpeakerId: string | null; // Changed from participant object
}

const DesktopNormalLayout = ({
  participants,
  screenWidth,
  activeSpeakerId,
}: DesktopNormalLayoutProps) => {
  const count = participants.length;

  // SMART SCALING LOGIC (Kept your original logic)
  let tileSize = 280;
  if (count === 1) {
    tileSize = Math.min(screenWidth * 0.5, 600);
  } else if (count <= 4) {
    tileSize = 350;
  }

  const cols = screenWidth < 1536 ? 4 : screenWidth < 1800 ? 5 : 6;

  return (
    <div
      className="w-full h-full overflow-y-auto grid gap-4 place-items-center p-4"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {participants.map((p) => (
        <VideoTile 
          key={p.sessionId} 
          participant={p} 
          tileSize={tileSize} 
          isActive={p.sessionId === activeSpeakerId}
        />
      ))}
    </div>
  );
};

// ✅ NEW: Internal VideoTile component using raw <video>
const VideoTile = ({ participant, tileSize, isActive }: { 
  participant: MediasoupParticipant, 
  tileSize: number, 
  isActive: boolean 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && participant.videoTrack) {
      const stream = new MediaStream([participant.videoTrack]);
      videoRef.current.srcObject = stream;
    }
  }, [participant.videoTrack]);

  return (
    <div
      className={`
        rounded-xl shadow-lg overflow-hidden bg-dark-3 transition-all duration-300 relative
        ${isActive ? "ring-4 ring-red-2 shadow-red-2/20 scale-[1.03]" : "border border-white/10"}
      `}
      style={{ width: `${tileSize}px`, height: `${tileSize}px` }}
    >
      {participant.videoTrack ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={participant.isLocal} // Don't hear yourself
          className={`w-full h-full object-cover ${participant.isLocal ? 'mirror' : ''}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-dark-1">
          <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-xl">
            {participant.name?.charAt(0) || "U"}
          </div>
        </div>
      )}
      
      <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-xs text-white">
        {participant.name || "User"} {participant.isLocal && "(You)"}
      </div>
    </div>
  );
};

export default DesktopNormalLayout;