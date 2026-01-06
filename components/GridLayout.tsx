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
  // ✅ Extract socket and user info from context
  const { socket } = useMediasoupContext();
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

  return (
    <div className="w-full h-full p-4 overflow-y-auto">
      <div
        className={`
        grid gap-4 w-full auto-rows-fr
        ${isMobile ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-3"}
      `}
      >
        {/* 1. LOCAL PREVIEW (YOU) */}
        <MediasoupTile
          stream={localStream || undefined}
          participantName={user?.fullName || user?.firstName || "You"}
          participantImage={user?.imageUrl}
          isLocal
        />

        {/* 2. REMOTE PARTICIPANTS */}
        {participants
          // ✅ Filter out the local user so you don't see yourself twice
          .filter((p) => p.id !== user?.id)
          .map((participant) => {
            const stream = remoteStreams.get(participant.id);

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

      <div className="fixed top-4 right-4 z-50">
        <button className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-600/90 hover:bg-blue-700 transition-all shadow-xl">
          <PictureInPicture2 className="text-white w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default GridLayout;
