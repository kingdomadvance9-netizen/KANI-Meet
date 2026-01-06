"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useParams } from "next/navigation";
import { Loader } from "lucide-react";

import MeetingSetup from "@/components/MeetingSetup";
import MeetingRoom from "@/components/MeetingRoom";
import MeetingRoomWrapper from "@/components/MeetingRoomWrapper";
import { useMediasoupContext } from "@/contexts/MediasoupContext";

const MeetingPage = () => {
  const { id: rawId } = useParams();
  const roomId = typeof rawId === "string" ? rawId : "";
  const { isLoaded, user } = useUser();

  // ✅ Get socket status from context
  const { socket } = useMediasoupContext();
  const [isSetupComplete, setIsSetupComplete] = useState(false);

  // Only wait for Clerk to load and socket to connect
  if (!isLoaded || !socket)
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full bg-dark-2 gap-4">
        <Loader className="animate-spin text-white w-10 h-10" />
        <p className="text-white/70 text-sm">Connecting to server...</p>
      </div>
    );

  return (
    <main className="h-screen w-full bg-dark-2">
      <MeetingRoomWrapper roomId={roomId}>
        {!isSetupComplete ? (
          <MeetingSetup setIsSetupComplete={setIsSetupComplete} />
        ) : (
          <MeetingRoom />
        )}
      </MeetingRoomWrapper>
    </main>
  );
};

export default MeetingPage;
