"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MicOff,
  VideoOff,
  Video,
  ScreenShareOff,
  ScreenShare,
  MoreVertical,
  Shield,
  Mic,
  Search,
  X,
  Crown,
} from "lucide-react";
import { toast } from "sonner";
import { useMediasoupContext } from "@/contexts/MediasoupContext";

// ✅ Replaced Stream's OwnCapability with a simple Enum/Type
type MediaPermission = "audio" | "video" | "screenshare";

interface CustomHostControlsProps {
  onClose?: () => void;
}

const CustomHostControls = ({ onClose }: CustomHostControlsProps) => {
  const [search, setSearch] = useState("");
  const {
    participants,
    isHost: isLocalHost,
    makeHost,
    removeHost,
    socket,
  } = useMediasoupContext();

  // ✅ Only show if user is host
  if (!isLocalHost) return null;

  // ✅ Handle promoting to host
  const handleMakeHost = (participantId: string, participantName: string) => {
    makeHost(participantId);
    toast.success(`Made ${participantName} a host`);
  };

  // ✅ Handle removing host status
  const handleRemoveHost = (participantId: string, participantName: string) => {
    removeHost(participantId);
    toast.success(`Removed host status from ${participantName}`);
  };

  // ✅ ACTION: Mute/Disable for Everyone
  const updateAll = async (type: MediaPermission, grant: boolean) => {
    try {
      if (!socket) {
        toast.error("Not connected to server");
        return;
      }

      socket.emit("host-bulk-action", { type, grant });

      const actionText =
        type === "screenshare"
          ? "screen shares"
          : type === "audio"
          ? "mics"
          : "cameras";
      toast.success(`${grant ? "Enabled" : "Stopped"} all ${actionText}`);
    } catch (error) {
      toast.error("Failed to update participants");
    }
  };

  // ✅ ACTION: Toggle Single Participant
  const togglePermission = async (
    userId: string,
    type: MediaPermission,
    currentState: boolean
  ) => {
    try {
      if (!socket) {
        toast.error("Not connected to server");
        return;
      }

      socket.emit("host-control-participant", {
        userId,
        type,
        disable: currentState,
      });

      const actionText =
        type === "screenshare"
          ? "screen share"
          : type === "audio"
          ? "microphone"
          : "camera";
      toast.success(
        `${currentState ? "Disabled" : "Enabled"} ${actionText} for participant`
      );
    } catch (error) {
      toast.error(`Failed to update ${userId}`);
    }
  };

  const filtered = participants.filter((p) =>
    (p.name || p.id).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 border-b bg-[#12141B] text-white h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-gray-300">
          Participants [{participants.length}]
        </h4>
        <button
          onClick={onClose}
          className="p-2 rounded hover:bg-[#2A2C36] transition"
        >
          <X className="w-4 h-4 text-gray-300" />
        </button>
      </div>

      <div className="w-full mb-4">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full text-center px-4 py-2 bg-[#1F212A] rounded-md border border-white/5 hover:bg-[#2A2C36] transition">
            Global Host Controls
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-[#1F212A] text-white border border-[#2C2E38] w-[240px]">
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                updateAll("audio", false);
              }}
              className="hover:bg-red-500/20 cursor-pointer"
            >
              <MicOff className="w-4 h-4 mr-2" /> Disable All Mics
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                updateAll("video", false);
              }}
              className="hover:bg-red-500/20 cursor-pointer"
            >
              <VideoOff className="w-4 h-4 mr-2" /> Disable All Cameras
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                updateAll("screenshare", false);
              }}
              className="hover:bg-red-500/20 cursor-pointer"
            >
              <ScreenShareOff className="w-4 h-4 mr-2" /> Stop All Screen Shares
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search participants..."
          className="w-full bg-[#1F212A] border border-[#2C2E38] rounded-md py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="space-y-2">
        {filtered.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between px-3 py-2 bg-[#1B1D25] rounded-lg"
          >
            <div className="flex items-center gap-3 min-w-0">
              {p.imageUrl ? (
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs">
                  {p.name?.charAt(0).toUpperCase() || "U"}
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-sm truncate">{p.name || "User"}</span>
                <span className="text-[10px] text-gray-500 flex items-center gap-1">
                  {p.isHost && <span className="text-yellow-400">👑</span>}
                  {p.isHost ? "Host" : "Guest"}
                  {p.id === socket?.id && " (You)"}
                </span>
              </div>
            </div>

            {/* Don't show dropdown for yourself */}
            {p.id !== socket?.id && (
              <DropdownMenu>
                <DropdownMenuTrigger className="p-1 hover:bg-[#2A2C36] rounded">
                  <MoreVertical className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-[#1F212A] text-white border border-[#2C2E38]">
                  {p.isHost ? (
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        handleRemoveHost(p.id, p.name);
                      }}
                      className="cursor-pointer hover:bg-orange-500/20"
                    >
                      <Crown className="w-4 h-4 mr-2" /> Remove Host Status
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        handleMakeHost(p.id, p.name);
                      }}
                      className="cursor-pointer hover:bg-blue-500/20"
                    >
                      <Crown className="w-4 h-4 mr-2" /> Make Host
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      togglePermission(p.id, "audio", true);
                    }}
                    className="cursor-pointer hover:bg-red-500/20"
                  >
                    <MicOff className="w-4 h-4 mr-2" /> Mute Participant
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      togglePermission(p.id, "video", true);
                    }}
                    className="cursor-pointer hover:bg-red-500/20"
                  >
                    <VideoOff className="w-4 h-4 mr-2" /> Disable Camera
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      togglePermission(p.id, "screenshare", true);
                    }}
                    className="cursor-pointer hover:bg-red-500/20"
                  >
                    <ScreenShareOff className="w-4 h-4 mr-2" /> Stop Screen
                    Share
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-red-400 cursor-pointer hover:bg-red-500/20">
                    <Shield className="w-4 h-4 mr-2" /> Remove from Call
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CustomHostControls;
