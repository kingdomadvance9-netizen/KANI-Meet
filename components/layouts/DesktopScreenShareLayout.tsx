"use client";

import { useEffect, useRef } from "react";

// ✅ Match the interface we created for the Normal Layout
interface MediasoupParticipant {
  sessionId: string;
  name?: string;
  videoTrack?: MediaStreamTrack | null;
  screenShareTrack?: MediaStreamTrack | null; // Added for screen sharing
  isLocal?: boolean;
}

interface DesktopScreenShareLayoutProps {
  participants: MediasoupParticipant[];
  screenSharer: MediasoupParticipant;
  activeSpeakerId: string | null;
}

const DesktopScreenShareLayout = ({
  participants,
  screenSharer,
  activeSpeakerId,
}: DesktopScreenShareLayoutProps) => {
  
  return (
    <div className="w-full h-full flex gap-4 overflow-hidden p-4">
      {/* 🖥️ Shared Screen - 3/4 width */}
      <div className="flex-[3] h-full">
        <div className="w-full h-full bg-dark-3 rounded-xl overflow-hidden shadow-xl border border-white/10">
          <RawVideoView 
            track={screenSharer.screenShareTrack || screenSharer.videoTrack} 
            isScreenShare={!!screenSharer.screenShareTrack}
          />
        </div>
      </div>

      {/* 📱 Right thumbnails */}
      <div className="flex-[1] h-full overflow-y-auto flex flex-col gap-4 pr-1 scrollbar-hide">
        {participants
          .filter((p) => p.sessionId !== screenSharer.sessionId)
          .map((p) => (
            <div
              key={p.sessionId}
              className={`
                w-full bg-dark-3 rounded-xl overflow-hidden shadow-md flex-shrink-0 transition-all duration-300
                ${p.sessionId === activeSpeakerId ? "ring-4 ring-red-2 scale-[0.98]" : "border border-white/5"}
              `}
              style={{ height: "180px", minHeight: "180px" }}
            >
              <RawVideoView track={p.videoTrack} isLocal={p.isLocal} />
              
              <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[10px] text-white">
                {p.name || "User"}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

// ✅ Helper Component for raw HTML5 Video
const RawVideoView = ({ 
  track, 
  isLocal, 
  isScreenShare 
}: { 
  track?: MediaStreamTrack | null, 
  isLocal?: boolean,
  isScreenShare?: boolean
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && track) {
      videoRef.current.srcObject = new MediaStream([track]);
    }
  }, [track]);

  if (!track) return (
    <div className="w-full h-full flex items-center justify-center bg-dark-1 text-gray-500">
      Camera Off
    </div>
  );

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={isLocal} // Don't hear yourself
      className={`w-full h-full ${isScreenShare ? 'object-contain' : 'object-cover'} ${isLocal && !isScreenShare ? 'mirror' : ''}`}
    />
  );
};

export default DesktopScreenShareLayout;