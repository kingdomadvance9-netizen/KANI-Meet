"use client";

import { useState, useEffect } from "react";
import {
  CallParticipantsList,
  CallingState,
  useCall,
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
  const [, forceUpdate] = useState({});

  const isPersonalRoom = !!searchParams.get("personal");

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
    <section className="relative h-screen w-full bg-[#0F1115] text-white">
      <FloatingReactions />

      <div
        className={cn(
          "h-full w-full flex overflow-hidden relative",
          showParticipants && "mr-[300px]"
        )}
      >
        <div className="flex-1 h-full relative">
          <div className="absolute inset-0 overflow-auto scroll-smooth pb-32">
            <GridLayout />
          </div>
        </div>

        {/* PARTICIPANTS SIDEBAR */}
        <aside
          className={cn(
            `fixed right-0 top-0 h-full w-[300px]
             bg-[#0d1117] border-l border-gray-700 shadow-xl
             transition-transform duration-300 z-50 overflow-y-auto`,
            showParticipants ? "translate-x-0" : "translate-x-full"
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

          {!isPersonalRoom && <EndCallButton />}
        </div>
      </div>
    </section>
  );
};

export default MeetingRoom;
