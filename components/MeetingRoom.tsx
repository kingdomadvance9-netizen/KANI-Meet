"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Users, Settings } from "lucide-react";

import ChatSidebar from "./ChatSidebar";
import ChatButton from "./ChatButton";
import GridLayout from "./GridLayout";
import CustomControls from "./CustomControls";
import CustomHostControls from "./CustomHostControls";
import { cn } from "@/lib/utils";
import { useMediasoupContext } from "@/contexts/MediasoupContext";

const MeetingRoom = () => {
  const params = useParams();
  const router = useRouter();
  const roomId = (params?.id as string) || "default-room";
  const { user } = useUser();

  // ✅ Get real-time data from Mediasoup Context
  const {
    socket,
    participants,
    remoteStreams,
    localStream,
    isInitialized,
    joinRoom,
  } = useMediasoupContext();

  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);

  // ✅ Join the Mediasoup room on mount with user info
  useEffect(() => {
    if (socket && !isInitialized && user) {
      const userName = user.fullName || user.firstName || "Anonymous";
      const userImageUrl = user.imageUrl;
      console.log("🚀 Joining Mediasoup Room:", roomId, "as", userName);
      joinRoom(roomId, userName, userImageUrl);
    }
  }, [socket, isInitialized, roomId, joinRoom, user]);

  return (
    <section className="relative h-screen w-full bg-[#0F1115] text-white overflow-hidden">
      <div
        className={cn(
          "h-full w-full flex overflow-hidden relative transition-all duration-300",
          showParticipants || showChat ? "pr-0 lg:pr-[300px]" : "pr-0"
        )}
      >
        {/* VIDEO GRID AREA */}
        <div className="flex-1 h-full relative">
          {/* ✅ Pass real streams and participants to the grid */}
          <GridLayout
            participants={participants}
            remoteStreams={remoteStreams}
            localStream={localStream}
          />
        </div>

        {/* CHAT SIDEBAR */}
        <ChatSidebar
          open={showChat}
          onClose={() => setShowChat(false)}
          roomId={roomId}
        />

        {/* PARTICIPANTS SIDEBAR */}
        <aside
          className={cn(
            `fixed top-0 h-full w-[300px]
             bg-[#0d1117] border-l border-gray-700 shadow-xl
             transition-transform duration-300 z-50 overflow-y-auto right-0`,
            showParticipants ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">
                Participants ({participants.length})
              </h2>
              <button
                onClick={() => setShowParticipants(false)}
                className="text-gray-400"
              >
                ✕
              </button>
            </div>

            {/* ✅ Map through real Mediasoup participants */}
            <div className="flex flex-col gap-4">
              {participants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 justify-between"
                >
                  <div className="flex items-center gap-3">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-semibold">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {p.name} {p.id === socket?.id ? "(You)" : ""}
                      </span>
                      {p.isHost && (
                        <span className="text-xs text-yellow-400 flex items-center gap-1">
                          👑 Host
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* CONTROLS BAR */}
      <div className="fixed bottom-0 left-0 w-full flex justify-center pb-6 z-40">
        <div className="flex items-center justify-center gap-3 bg-black/60 px-5 py-3 rounded-2xl border border-white/10 backdrop-blur-2xl shadow-2xl">
          <button
            onClick={() => setShowParticipants((p) => !p)}
            className="relative"
          >
            <div
              className={cn(
                "cursor-pointer rounded-xl px-4 py-2 border transition",
                showParticipants
                  ? "bg-blue-600 border-blue-400"
                  : "bg-[#1c2732] border-white/10 hover:bg-[#2c3641]"
              )}
            >
              <Users size={20} />
              {participants.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-500 text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                  {participants.length}
                </span>
              )}
            </div>
          </button>

          <ChatButton onClick={() => setShowChat((p) => !p)} />

          <div className="w-px h-6 bg-white/10 mx-2" />

          {/* Media Controls */}
          <CustomControls />

          <button
            className="cursor-pointer rounded-xl bg-red-600 px-6 py-2 border border-red-400 hover:bg-red-700 transition font-medium"
            onClick={() => {
              socket?.disconnect();
              router.push("/");
            }}
          >
            Leave
          </button>
        </div>
      </div>
    </section>
  );
};

export default MeetingRoom;
