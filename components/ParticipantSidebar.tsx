"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  Crown,
  Mic,
  MicOff,
  Video,
  VideoOff,
  MoreVertical,
  UserX,
  X,
  Search,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useHostControls } from "@/hooks/useHostControls";

interface Participant {
  id: string;
  name: string;
  imageUrl?: string | null;
  isAudioMuted: boolean;
  isVideoPaused: boolean;
  isHost: boolean;
}

interface ParticipantSidebarProps {
  participants: Participant[];
  socket: any;
  roomId: string;
  open: boolean;
  onClose: () => void;
}

const ParticipantSidebar = ({
  participants,
  socket,
  roomId,
  open,
  onClose,
}: ParticipantSidebarProps) => {
  const { user } = useUser();
  const [search, setSearch] = useState("");
  const [showHostControls, setShowHostControls] = useState(false);

  const { toggleRemoteAudio, toggleRemoteVideo, removeParticipant } =
    useHostControls(socket, roomId);

  // Find current user in participant list
  const currentUser = participants.find((p) => p.id === user?.id);
  const isHost = currentUser?.isHost || false;

  // Filter participants by search
  const filtered = participants.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside
      className={cn(
        `fixed top-0 h-full w-[360px]
         bg-[#0d1117] border-l border-gray-700 shadow-xl
         transition-transform duration-300 z-50 overflow-y-auto right-0`,
        open ? "translate-x-0" : "translate-x-full"
      )}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">
            Participants ({participants.length})
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Host Controls Button */}
        {isHost && (
          <button
            onClick={() => setShowHostControls(!showHostControls)}
            className={cn(
              "w-full mb-4 px-4 py-2 rounded-lg border transition flex items-center justify-center gap-2",
              showHostControls
                ? "bg-blue-600 border-blue-400 text-white"
                : "bg-[#1f212a] border-gray-700 text-gray-300 hover:bg-[#2a2c36]"
            )}
          >
            <Crown size={16} />
            Host Controls
          </button>
        )}

        {/* Search Box */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search participants..."
            className="w-full bg-[#1f212a] border border-gray-700 rounded-lg py-2 pl-9 pr-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Participant List */}
        <div className="space-y-2">
          {filtered.map((participant) => {
            const isMe = participant.id === user?.id;

            return (
              <div
                key={participant.id}
                className="flex items-center justify-between px-3 py-3 bg-[#1b1d25] rounded-lg hover:bg-[#21232c] transition"
              >
                {/* Left side: Avatar + Info */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Avatar */}
                  {participant.imageUrl ? (
                    <img
                      src={participant.imageUrl}
                      alt={participant.name}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                      {participant.name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* Name + Status */}
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">
                        {participant.name}
                        {isMe && (
                          <span className="text-gray-400 ml-1">(You)</span>
                        )}
                      </span>
                    </div>

                    {/* Host/Participant Badge */}
                    <div className="flex items-center gap-2 mt-1">
                      {participant.isHost ? (
                        <span className="text-xs text-yellow-400 font-medium flex items-center gap-1">
                          <Crown size={12} />
                          Host
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">
                          Participant
                        </span>
                      )}

                      {/* Audio/Video Status Icons */}
                      <div className="flex items-center gap-1.5">
                        {participant.isAudioMuted ? (
                          <MicOff className="w-3.5 h-3.5 text-red-500" />
                        ) : (
                          <Mic className="w-3.5 h-3.5 text-gray-400" />
                        )}

                        {participant.isVideoPaused ? (
                          <VideoOff className="w-3.5 h-3.5 text-red-500" />
                        ) : (
                          <Video className="w-3.5 h-3.5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right side: Host Controls Menu */}
                {isHost && !isMe && showHostControls && (
                  <DropdownMenu>
                    <DropdownMenuTrigger className="p-2 hover:bg-[#2a2c36] rounded transition">
                      <MoreVertical className="w-4 h-4 text-gray-400" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-[#1f212a] text-white border border-gray-700 w-[200px]">
                      <DropdownMenuItem
                        onClick={() =>
                          toggleRemoteAudio(
                            participant.id,
                            participant.isAudioMuted
                          )
                        }
                        className="hover:bg-[#2a2c36] cursor-pointer"
                      >
                        {participant.isAudioMuted ? (
                          <Mic className="w-4 h-4 mr-2" />
                        ) : (
                          <MicOff className="w-4 h-4 mr-2" />
                        )}
                        {participant.isAudioMuted
                          ? "Unmute Participant"
                          : "Mute Participant"}
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() =>
                          toggleRemoteVideo(
                            participant.id,
                            participant.isVideoPaused
                          )
                        }
                        className="hover:bg-[#2a2c36] cursor-pointer"
                      >
                        {participant.isVideoPaused ? (
                          <Video className="w-4 h-4 mr-2" />
                        ) : (
                          <VideoOff className="w-4 h-4 mr-2" />
                        )}
                        {participant.isVideoPaused
                          ? "Enable Camera"
                          : "Disable Camera"}
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() =>
                          removeParticipant(participant.id, participant.name)
                        }
                        className="text-red-400 hover:bg-red-500/20 cursor-pointer"
                      >
                        <UserX className="w-4 h-4 mr-2" />
                        Remove from Room
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            No participants found
          </div>
        )}
      </div>
    </aside>
  );
};

export default ParticipantSidebar;
