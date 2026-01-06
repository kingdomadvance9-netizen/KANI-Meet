"use client";

import { useEffect, useRef } from "react";

// ✅ Standardized Mediasoup Interface
interface MediasoupParticipant {
  sessionId: string;
  name?: string;
  videoTrack?: MediaStreamTrack | null;
  screenShareTrack?: MediaStreamTrack | null;
  isLocal?: boolean;
}

interface MobileScreenShareLayoutProps {
  participants: MediasoupParticipant[];
  screenSharer: MediasoupParticipant;
  activeSpeakerId: string | null;
}

const MobileScreenShareLayout = ({
  participants,
  screenSharer,
  activeSpeakerId,
}: MobileScreenShareLayoutProps) => {
  
  return (
    <div className="w-full h-full flex flex-col gap-3 overflow-hidden p-2">
      {/* 📱 Sticky shared screen - Main Focus */}
      <div
        className="
          sticky top-0 z-20 w-full 
          bg-dark-3 rounded-xl shadow-xl overflow-hidden
          h-[35vh] min-h-[220px] border border-white/10
        "
      >
        <RawVideoView 
          track={screenSharer.screenShareTrack || screenSharer.videoTrack} 
          isScreenShare={true} 
        />
        <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[10px] text-white">
          {screenSharer.name || "User"}'s Screen
        </div>
      </div>

      {/* 👥 Thumbnails - Scrolling Grid */}
      <div className="grid grid-cols-2 gap-3 pt-2 overflow-y-auto pb-32 scrollbar-hide">
        {participants
          .filter((p) => p.sessionId !== screenSharer.sessionId)
          .map((p) => (
            <div
              key={p.sessionId}
              className={`
                bg-dark-3 h-[130px] rounded-xl overflow-hidden shadow-md relative transition-all
                ${p.sessionId === activeSpeakerId ? "ring-2 ring-red-2" : "border border-white/5"}
              `}
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

// ✅ Reusable Raw Video Component (Native HTML5)
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
    <div className="w-full h-full flex items-center justify-center bg-dark-1 text-xs text-gray-500">
      Camera Off
    </div>
  );

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={isLocal}
      className={`w-full h-full ${isScreenShare ? 'object-contain' : 'object-cover'} ${isLocal && !isScreenShare ? 'mirror' : ''}`}
    />
  );
};

export default MobileScreenShareLayout;