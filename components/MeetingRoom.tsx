"use client";

import { useState, useEffect } from "react";
import {
  CallParticipantsList,
  CallingState,
  useCall,
  CallStatsButton,
  useCallStateHooks,
  StreamVideoEvent,
} from "@stream-io/video-react-sdk";
import { useRouter, useSearchParams } from "next/navigation";
import { Users } from "lucide-react";
import Loader from "./Loader";
import EndCallButton from "./EndCallButton";
import { cn } from "@/lib/utils";
import GridLayout from "./GridLayout";
import CustomHostControls from "./CustomHostControls";
import ReactionButton from "./ReactionButton";
import CustomCallControls from "./CustomControls";
import FloatingReactions from "./FloatingReactions";
import ChatSidebar from "./ChatSidebar";
import ChatButton from "./ChatButton";
import { ensureCallChatChannel, addMemberToChatChannel } from "@/actions/stream.actions";

const MeetingRoom = () => {
  const searchParams = useSearchParams();
  const router = useRouter();

  const call = useCall();
  const { useCallCallingState, useLocalParticipant } = useCallStateHooks();

  // --------------------------
  // 1️⃣ ALL HOOKS MUST ALWAYS RUN HERE
  // --------------------------

  const callingState = useCallCallingState();
  const localParticipant = useLocalParticipant();

  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const [, forceUpdate] = useState({});

  const isPersonalRoom = !!searchParams.get("personal");

useEffect(() => {
  if (!call || callingState !== CallingState.JOINED) return;

  const setupChatChannel = async () => {
    try {
      // Get all participant IDs from the call
      const participantIds = call.state.participants.map(p => p.userId).filter(Boolean) as string[];
      
      await ensureCallChatChannel(call.id, participantIds);
    } catch (error) {
      console.error("Failed to create chat channel:", error);
    }
  };

  setupChatChannel();
}, [call, callingState]);


useEffect(() => {
  if (!call) return;

  const handleParticipantJoined = async (event: StreamVideoEvent) => {
    if (event.type !== "call.session_participant_joined") return;
    if (!event.participant?.user?.id) return;
    
    try {
      await addMemberToChatChannel(call.id, event.participant.user.id);
    } catch (error) {
      console.error("Failed to add member to chat:", error);
    }
  };

  call.on("call.session_participant_joined", handleParticipantJoined);
  return () => call.off("call.session_participant_joined", handleParticipantJoined);
}, [call]);

  // 🔄 Refresh UI when user's role changes
  useEffect(() => {
    if (!call) return;

    const handleMemberUpdate = (event: StreamVideoEvent) => {
      if ("user" in event && event.user?.id === localParticipant?.userId) {
        forceUpdate({});
      }
    };

    call.on("call.member_updated", handleMemberUpdate);
    return () => call.off("call.member_updated", handleMemberUpdate);
  }, [call, localParticipant?.userId]);

  const isHostOrCoHost =
    localParticipant?.roles?.includes("admin") ||
    localParticipant?.roles?.includes("host") ||
    localParticipant?.roles?.includes("co_host") ||
    localParticipant?.roles?.includes("moderator");

  // 📡 RECEIVE reactions
  useEffect(() => {
    if (!call) return;

    const handler = (event: any) => {
      if (event.type !== "custom") return;
      if (event.custom?.type !== "reaction") return;

      const { emoji, sessionId } = event.custom;

      // ⛔ Ignore events *we* sent (we already animated locally)
      const localId = call.state.localParticipant?.sessionId;
      if (sessionId === localId) return;

      window.dispatchEvent(
        new CustomEvent("spawn-reaction", {
          detail: { emoji, sessionId },
        })
      );
    };

    call.on("custom", handler);
    return () => call.off("custom", handler);
  }, [call]);

  // --------------------------
  // 2️⃣ NOW WE ARE ALLOWED TO RETURN CONDITIONALLY
  // --------------------------

  if (callingState !== CallingState.JOINED) {
    return <Loader />;
  }

  // --------------------------
  // 3️⃣ RENDER SAFE
  // --------------------------

  return (
    <section className="relative h-screen w-full bg-[#0F1115] text-white overflow-hidden">
      <FloatingReactions />

      <div
        className={cn(
          "h-full w-full flex overflow-hidden overflow-x-hidden relative",
          (showParticipants || showChat) && "mr-[300px]"
        )}
      >
        <div className="flex-1 h-full relative">
          <div className="absolute inset-0 overflow-auto scroll-smooth pb-32">
            <GridLayout />
          </div>
        </div>

        {/* CHAT SIDEBAR */}
        <aside
          className={cn(
            `fixed top-0 h-full w-[300px]
     bg-[#0d1117] border-l border-gray-700 shadow-xl
     transition-transform duration-300 z-50 overflow-y-auto`,
            showChat ? "translate-x-0 right-0" : "translate-x-full right-0"
          )}
        >
          <ChatSidebar open={showChat} onClose={() => setShowChat(false)} />
        </aside>

        {/* PARTICIPANTS SIDEBAR */}
        <aside
          className={cn(
            `fixed top-0 h-full w-[300px]
     bg-[#0d1117] border-l border-gray-700 shadow-xl
     transition-transform duration-300 z-50 overflow-y-auto`,
            showParticipants
              ? "translate-x-0 right-0"
              : "translate-x-full right-0"
          )}
        >
          {isHostOrCoHost ? (
            <CustomHostControls onClose={() => setShowParticipants(false)} />
          ) : (
            <CallParticipantsList onClose={() => setShowParticipants(false)} />
          )}
        </aside>
      </div>

      {/* CONTROLS */}
      <div className="fixed bottom-0 left-0 w-full flex justify-center pb-[env(safe-area-inset-bottom)] z-40">
        <div className="flex items-center justify-center gap-3 bg-black/40 px-5 py-3 rounded-xl border border-white/20 backdrop-blur-xl flex-wrap sm:flex-nowrap mb-3">
          <CustomCallControls />
          <CallStatsButton />

          <ReactionButton
            onReact={({ emoji }) => {
              const sessionId = call?.state?.localParticipant?.sessionId;

              // SEND to everyone globally
              call?.sendCustomEvent({
                type: "reaction",
                emoji,
                sessionId,
              });

              // Also show locally instantly
              window.dispatchEvent(
                new CustomEvent("spawn-reaction", {
                  detail: { emoji, sessionId },
                })
              );
            }}
          />

          <button onClick={() => setShowParticipants((p) => !p)}>
            <div className="cursor-pointer rounded-xl bg-[#1c2732] px-4 py-2 border border-white/10 hover:bg-[#2c3641] transition">
              <Users size={20} />
            </div>
          </button>

          <ChatButton onClick={() => setShowChat((prev) => !prev)} />


          {!isPersonalRoom && <EndCallButton />}
        </div>
      </div>
    </section>
  );
};

export default MeetingRoom;
