"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { PictureInPicture2 } from "lucide-react";
import MediasoupTile from "./MediasoupTile";
import { useMediasoupContext } from "@/contexts/MediasoupContext";

interface Participant {
  id: string;
  name: string;
  imageUrl?: string;
  isHost?: boolean;
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
  // ✅ Extract screen share tracking and local screen share from context
  const { screenShareStreams, localScreenStream, isScreenSharing } =
    useMediasoupContext();
  const { user } = useUser();

  const [screenWidth, setScreenWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = screenWidth < 1024;
  const [localVideoEl, setLocalVideoEl] = useState<HTMLVideoElement | null>(
    null
  );

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
    <div className="w-full h-full overflow-hidden">
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
                  participantName={`${participant?.name || "Unknown"}'s Screen`}
                  participantImage={participant?.imageUrl}
                  isHost={participant?.isHost}
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
                participantName={user?.fullName || user?.firstName || "You"}
                participantImage={user?.imageUrl}
                isLocal
                onVideoElement={setLocalVideoEl}
              />

              {/* 2. REMOTE PARTICIPANTS (Camera streams) */}
              {participants
                .filter((p) => p.id !== user?.id)
                .map((participant) => {
                  const stream = remoteStreams.get(participant.id);

                  if (!stream) {
                    console.log(
                      "⚠️ No stream found for participant:",
                      participant.id,
                      participant.name
                    );
                    console.log(
                      "📋 Available stream keys:",
                      Array.from(remoteStreams.keys())
                    );
                  } else {
                    console.log(
                      "✅ Stream found for participant:",
                      participant.id,
                      "tracks:",
                      stream.getTracks().length
                    );
                  }

                  return (
                    <MediasoupTile
                      key={participant.id}
                      stream={stream}
                      participantName={participant.name}
                      participantImage={participant.imageUrl}
                      isHost={participant.isHost}
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
              participantName={user?.fullName || user?.firstName || "You"}
              participantImage={user?.imageUrl}
              isLocal
            />

            {/* 2. REMOTE PARTICIPANTS (Camera streams) */}
            {participants
              .filter((p) => p.id !== user?.id)
              .map((participant) => {
                const stream = remoteStreams.get(participant.id);

                if (!stream) {
                  console.log(
                    "⚠️ No stream found for participant:",
                    participant.id,
                    participant.name
                  );
                  console.log(
                    "📋 Available stream keys:",
                    Array.from(remoteStreams.keys())
                  );
                } else {
                  console.log(
                    "✅ Stream found for participant:",
                    participant.id,
                    "tracks:",
                    stream.getTracks().length
                  );
                }

                return (
                  <MediasoupTile
                    key={participant.id}
                    stream={stream}
                    participantName={participant.name}
                    participantImage={participant.imageUrl}
                    isHost={participant.isHost}
                  />
                );
              })}
          </div>
        </div>
      )}

      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={async () => {
            try {
              if (!localVideoEl) return;
              // If already in PiP, exit. Use feature-checks instead of any-casts where possible.
              const pipElement = (
                document as Document & { pictureInPictureElement?: Element }
              ).pictureInPictureElement;
              if (pipElement === localVideoEl) {
                // Some browsers expose exitPictureInPicture on document
                // Use a runtime check to call it when available
                const exitPiP = (document as any).exitPictureInPicture;
                if (typeof exitPiP === "function") {
                  await exitPiP();
                }
                return;
              }

              // Request PiP on the video element if supported
              const requestPiP = (
                localVideoEl as HTMLVideoElement & {
                  requestPictureInPicture?: () => Promise<PictureInPictureWindow | void>;
                }
              ).requestPictureInPicture;
              if (typeof requestPiP === "function") {
                await localVideoEl.play().catch(() => {});
                await requestPiP.call(localVideoEl);
              } else {
                console.warn(
                  "Picture-in-Picture not supported on this browser"
                );
              }
            } catch (err) {
              console.error("PiP error", err);
            }
          }}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-600/90 hover:bg-blue-700 transition-all shadow-xl"
          title={localVideoEl ? "Toggle Picture-in-Picture" : "No local video"}
        >
          <PictureInPicture2 className="text-white w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default GridLayout;
