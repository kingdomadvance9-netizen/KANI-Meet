"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import MediasoupTile from "./MediasoupTile";
import DraggablePiPButton from "./DraggablePiPButton";
import { useMediasoupContext } from "@/contexts/MediasoupContext";
import { useAutoPictureInPicture } from "@/hooks/useAutoPictureInPicture";
import { useDominantSpeaker } from "@/hooks/useDominantSpeaker";

interface Participant {
  id: string;
  name: string;
  imageUrl?: string;
  isHost?: boolean;
  isVideoPaused?: boolean;
}

interface GridLayoutProps {
  participants: Participant[];
  remoteStreams: Map<string, MediaStream>;
  localStream?: MediaStream | null;
}

const GridLayout = ({
  participants,
  remoteStreams,
  localStream,
}: GridLayoutProps) => {
  const { screenShareStreams, localScreenStream, isScreenSharing } =
    useMediasoupContext();
  const { user } = useUser();

  const [screenWidth, setScreenWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024,
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = screenWidth < 1024;

  // Local participant info
  const localParticipant = {
    id: user?.id || "local",
    name: user?.fullName || user?.firstName || "You",
    imageUrl: user?.imageUrl,
  };

  // Dominant speaker detection
  const { dominantSpeakerId } = useDominantSpeaker({
    participants,
    remoteStreams,
    localStream,
    localParticipantId: user?.id,
  });

  // Screen share participant ID
  const screenShareParticipantId =
    screenShareStreams.size > 0 ? Array.from(screenShareStreams)[0] : null;

  // PiP hook with Google Meet behavior
  const {
    enterPiP,
    exitPiP,
    isPiPActive,
    isPiPSupported,
    canActivate,
    canActivateReason,
    isAutoActivateEnabled,
  } = useAutoPictureInPicture({
    participants,
    localParticipant,
    dominantSpeakerId,
    screenShareParticipantId,
    remoteStreams,
    localStream,
    enabled: true,
  });

  // Toggle PiP handler for the draggable button
  const handleTogglePiP = useCallback(async () => {
    if (isPiPActive) {
      await exitPiP();
    } else {
      await enterPiP();
    }
  }, [isPiPActive, enterPiP, exitPiP]);

  // Get all screen share streams for prominent display (including local)
  const screenShares = Array.from(screenShareStreams)
    .map((userId) => {
      const participant = participants.find((p) => p.id === userId);
      const stream = remoteStreams.get(`${userId}-screen`);
      return { userId, participant, stream };
    })
    .filter((ss) => ss.stream);

  // Add local screen share if active
  if (isScreenSharing && localScreenStream) {
    screenShares.unshift({
      userId: user?.id || "local",
      participant: {
        id: user?.id || "local",
        name: user?.fullName || user?.firstName || "You",
        imageUrl: user?.imageUrl,
      },
      stream: localScreenStream,
    });
  }

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden">
      {screenShares.length > 0 ? (
        // Layout when screen share is active
        <div className={isMobile ? "flex flex-col" : "flex h-full"}>
          {/* SCREEN SHARE - Left side (75% width on PC) */}
          <div
            className={isMobile ? "w-full" : "p-4"}
            style={isMobile ? {} : { width: "75%" }}
          >
            {screenShares.map(({ userId, participant, stream }) => (
              <div
                key={`${userId}-screen`}
                className={
                  isMobile ? "w-full aspect-video p-4" : "w-full h-full"
                }
              >
                <MediasoupTile
                  stream={stream}
                  participantId={`${userId}-screen`}
                  participantName={`${participant?.name || "Unknown"}'s Screen`}
                  participantImage={participant?.imageUrl}
                  isHost={participant?.isHost}
                  isMobile={isMobile}
                />
              </div>
            ))}
          </div>

          {/* PARTICIPANT TILES - Right side and below (25% width on PC) */}
          <div
            className={isMobile ? "w-full p-2" : "overflow-y-auto p-4"}
            style={isMobile ? {} : { width: "25%" }}
          >
            <div
              className={`
            grid w-full auto-rows-fr
            ${isMobile ? "grid-cols-2 gap-1" : "grid-cols-1 gap-4"}
          `}
            >
              {/* 1. LOCAL PREVIEW (YOU) */}
              <MediasoupTile
                stream={localStream || undefined}
                participantId={user?.id || "local"}
                participantName={user?.fullName || user?.firstName || "You"}
                participantImage={user?.imageUrl}
                isLocal
                isMobile={isMobile}
              />

              {/* 2. REMOTE PARTICIPANTS (Camera streams) */}
              {participants
                .filter((p) => p.id !== user?.id)
                .map((participant) => {
                  const stream = remoteStreams.get(participant.id);
                  return (
                    <MediasoupTile
                      key={participant.id}
                      stream={stream}
                      participantId={participant.id}
                      participantName={participant.name}
                      participantImage={participant.imageUrl}
                      isHost={participant.isHost}
                      isMobile={isMobile}
                    />
                  );
                })}
            </div>
          </div>
        </div>
      ) : (
        // Default grid layout when no screen share
        <div className="w-full h-full overflow-y-auto p-4">
          <div
            className={`
        grid gap-4 w-full auto-rows-fr
        ${isMobile ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-3"}
      `}
          >
            {/* 1. LOCAL PREVIEW (YOU) */}
            <MediasoupTile
              stream={localStream || undefined}
              participantId={user?.id || "local"}
              participantName={user?.fullName || user?.firstName || "You"}
              participantImage={user?.imageUrl}
              isLocal
              isMobile={isMobile}
            />

            {/* 2. REMOTE PARTICIPANTS (Camera streams) */}
            {participants
              .filter((p) => p.id !== user?.id)
              .map((participant) => {
                const stream = remoteStreams.get(participant.id);
                return (
                  <MediasoupTile
                    key={participant.id}
                    stream={stream}
                    participantId={participant.id}
                    participantName={participant.name}
                    participantImage={participant.imageUrl}
                    isHost={participant.isHost}
                    isMobile={isMobile}
                  />
                );
              })}
          </div>
        </div>
      )}

      {/* Draggable PiP Button on the video stage */}
      <DraggablePiPButton
        onTogglePiP={handleTogglePiP}
        isPiPActive={isPiPActive}
        isPiPSupported={isPiPSupported}
        canActivate={canActivate}
        canActivateReason={canActivateReason}
        isAutoActivateEnabled={isAutoActivateEnabled}
        containerRef={containerRef as React.RefObject<HTMLElement>}
      />
    </div>
  );
};

export default GridLayout;
