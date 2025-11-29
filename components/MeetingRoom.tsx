"use client";

import { useState } from "react";
import {
  CallControls,
  CallParticipantsList,
  CallStatsButton,
  CallingState,
  PaginatedGridLayout,
  SpeakerLayout,
  useCallStateHooks,
} from "@stream-io/video-react-sdk";
import { useRouter, useSearchParams } from "next/navigation";
import { Users, LayoutList } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import Loader from "./Loader";
import EndCallButton from "./EndCallButton";
import { cn } from "@/lib/utils";

type CallLayoutType = "grid" | "speaker-left" | "speaker-right";

const MeetingRoom = () => {
  const searchParams = useSearchParams();
  const isPersonalRoom = !!searchParams.get("personal");
  const router = useRouter();

  const [layout, setLayout] = useState<CallLayoutType>("speaker-left");
  const [showParticipants, setShowParticipants] = useState(false);

  const { useCallCallingState } = useCallStateHooks();
  const callingState = useCallCallingState();

  if (callingState !== CallingState.JOINED) return <Loader />;

  const CallLayout = () => {
    return (
      <div className="w-full h-full">
        {layout === "grid" ? (
          <PaginatedGridLayout
            pageArrowsVisible
            groupParticipants
            className="w-full h-full"
          />
        ) : (
          <SpeakerLayout
            participantsBarPosition={layout === "speaker-left" ? "right" : "left"}
            mainParticipantStyle={{
              objectFit: "cover",
            }}
            participantsBarStyle={{
              width: "260px",
              maxWidth: "30%",
            }}
          />
        )}
      </div>
    );
  };

  return (
    <section className="relative h-screen w-full bg-[#0F1115] text-white">
      {/* MAIN VIDEO AREA */}
      <div
        className={cn(
          "h-full w-full flex overflow-hidden relative",
          showParticipants && "mr-[300px]"
        )}
      >
        <div className="flex-1 h-full relative">
          <div className="absolute inset-0 overflow-auto">
            <CallLayout />
          </div>
        </div>

        {/* PARTICIPANT DRAWER */}
        <aside
          className={cn(
            "fixed right-0 top-0 h-full w-[300px] bg-[#0d1117] border-l border-gray-700 shadow-xl transition-transform duration-300 z-50 overflow-y-auto",
            showParticipants ? "translate-x-0" : "translate-x-full"
          )}
        >
          <CallParticipantsList
            onClose={() => setShowParticipants(false)}
            className="h-full"
          />
        </aside>
      </div>

      {/* CONTROLS */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-40">
        <div className="flex items-center justify-center gap-3 bg-black/40 px-5 py-3 rounded-xl border border-white/20 backdrop-blur-xl flex-wrap sm:flex-nowrap">

          <CallControls onLeave={() => router.push("/")} />

          {/* LAYOUT DROPDOWN */}
          <DropdownMenu>
            <DropdownMenuTrigger className="cursor-pointer rounded-xl bg-[#1c2732] px-4 py-2 border border-white/10 hover:bg-[#2c3641] transition">
              <LayoutList size={20} />
            </DropdownMenuTrigger>

            <DropdownMenuContent className="bg-[#1c2732] text-white border border-white/10">
              {["Grid", "Speaker-Left", "Speaker-Right"].map((item) => (
                <DropdownMenuItem
                  key={item}
                  onClick={() => setLayout(item.toLowerCase() as CallLayoutType)}
                >
                  {item}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </DropdownMenuContent>
          </DropdownMenu>

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
