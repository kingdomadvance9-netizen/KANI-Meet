"use client";

import { useState, useEffect } from "react";
import {
  CallControls,
  CallParticipantsList,
  CallStatsButton,
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

const MeetingRoom = () => {
  const searchParams = useSearchParams();
  const isPersonalRoom = !!searchParams.get("personal");
  const router = useRouter();

  const [showParticipants, setShowParticipants] = useState(false);
  const [, forceUpdate] = useState({});

  const call = useCall();
  const { useCallCallingState, useLocalParticipant } = useCallStateHooks();
  const callingState = useCallCallingState();
  const localParticipant = useLocalParticipant();

  // Listen for member updates that affect the local user
  useEffect(() => {
    if (!call) return;  

    const handleMemberUpdate = (event: StreamVideoEvent) => {  
      console.log('Member updated event:', event);
      
      // Type guard: check if event has user property before accessing it
      if ('user' in event && event.user && event.user.id === localParticipant?.userId) {
        console.log('Local participant role updated:', event);
        forceUpdate({});
      }
    };

    call.on('call.member_updated', handleMemberUpdate);

    return () => {
      call.off('call.member_updated', handleMemberUpdate);
    };
  }, [call, localParticipant?.userId]);

  if (callingState !== CallingState.JOINED) return <Loader />;

  // Check if local user is host or co-host
  const isHostOrCoHost =
    localParticipant?.roles?.includes("admin") ||
    localParticipant?.roles?.includes("host") ||
    localParticipant?.roles?.includes("co_host") ||
    localParticipant?.roles?.includes("moderator");

  // Debug logging
  console.log('Local participant roles:', localParticipant?.roles);
  console.log('Is host or co-host:', isHostOrCoHost);

  return (
    <section className="relative h-screen w-full bg-[#0F1115] text-white">
      {/* MAIN AREA */}
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

        {/* PARTICIPANT DRAWER */}
        <aside
          className={cn(
            `fixed right-0 top-0 h-full w-[300px]
             bg-[#0d1117] border-l border-gray-700 shadow-xl
             transition-transform duration-300 z-50 overflow-y-auto`,
            showParticipants ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div>
            {/* Hosts/Co-hosts see CustomHostControls */}
            {isHostOrCoHost ? (
              <CustomHostControls onClose={() => setShowParticipants(false)} />
            ) : (
              /* Regular participants see CallParticipantsList */
              <CallParticipantsList
                onClose={() => setShowParticipants(false)}
              />
            )}
          </div>
        </aside>
      </div>

      {/* CONTROLS – fixed bottom on every screen */}
      <div className="fixed bottom-0 left-0 w-full flex justify-center pb-[env(safe-area-inset-bottom)] z-40">
        <div className="flex items-center justify-center gap-3 bg-black/40 px-5 py-3 rounded-xl border border-white/20 backdrop-blur-xl flex-wrap sm:flex-nowrap mb-3">
          <CallControls onLeave={() => router.push("/")} />
          <CallStatsButton />
          
          {/* PARTICIPANT BUTTON */}
          <button onClick={() => setShowParticipants((prev) => !prev)}>
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