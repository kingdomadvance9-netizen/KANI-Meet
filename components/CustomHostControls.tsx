import {
  useCall,
  useCallStateHooks,
  OwnCapability,
  hasAudio,
  hasVideo,
  hasScreenShare,
} from "@stream-io/video-react-sdk";

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
} from "lucide-react";
import { useState } from "react";
import { useEffect } from "react";
import { StreamVideoEvent } from "@stream-io/video-react-sdk";
import { toast } from "sonner";

interface CustomHostControlsProps {
  onClose?: () => void;
}

const CustomHostControls = ({ onClose }: CustomHostControlsProps) => {
  const call = useCall();
  const { useHasPermissions, useParticipants } = useCallStateHooks();
  const canUpdatePermissions = useHasPermissions(
    OwnCapability.UPDATE_CALL_PERMISSIONS
  );
  const participants = useParticipants();
  const [search, setSearch] = useState("");



  if (!call || !canUpdatePermissions) return null;

  // Helper function to check if a participant is a host/co-host
  const isHostOrCoHost = (participant: any) => {
    return (
      participant.roles?.includes("admin") ||
      participant.roles?.includes("host") ||
      participant.roles?.includes("co_host") ||
      participant.roles?.includes("moderator")
    );
  };

  // Bulk actions - exclude hosts and co-hosts
  const updateAll = async (permission: OwnCapability, grant: boolean) => {
    try {
      for (const p of participants) {
        // Skip local participant AND skip all hosts/co-hosts
        if (!p.isLocalParticipant && !isHostOrCoHost(p)) {
          await call.updateUserPermissions({
            user_id: p.userId,
            [grant ? "grant_permissions" : "revoke_permissions"]: [permission],
          });
        }
      }

      // Friendly label for toast
      const label =
        permission === OwnCapability.SEND_AUDIO
          ? "microphones"
          : permission === OwnCapability.SEND_VIDEO
          ? "cameras"
          : "screen sharing";

      toast.success(
        `${grant ? "Enabled" : "Disabled"} ${label} for all participants`
      );
    } catch (error) {
      console.error("updateAll error:", error);
      toast.error("Failed to update participants. See console for details.");
    }
  };

  // Single actions - toggle between grant and revoke
  const togglePermission = async (
    userId: string,
    permission: OwnCapability,
    currentlyHasPermission: boolean
  ) => {
    try {
      if (currentlyHasPermission) {
        await call.updateUserPermissions({
          user_id: userId,
          revoke_permissions: [permission],
        });
      } else {
        await call.updateUserPermissions({
          user_id: userId,
          grant_permissions: [permission],
        });
      }

      const label =
        permission === OwnCapability.SEND_AUDIO
          ? "microphone"
          : permission === OwnCapability.SEND_VIDEO
          ? "camera"
          : "screen sharing";

      toast.success(
        `${
          currentlyHasPermission ? "Disabled" : "Enabled"
        } ${label} for ${userId}`
      );
    } catch (error) {
      console.error("togglePermission error:", error);
      toast.error(`Failed to update permission for ${userId}`);
    }
  };

  const handleMakeCoHost = async (userId: string) => {
    try {
      console.log(`Making ${userId} a co-host...`);

      // Step 1: Update the member role to admin
      await call.updateCallMembers({
        update_members: [{ user_id: userId, role: "admin" }],
      });

      // Step 2: Grant all necessary permissions for co-hosts
      await call.updateUserPermissions({
        user_id: userId,
        grant_permissions: [
          OwnCapability.SEND_AUDIO,
          OwnCapability.SEND_VIDEO,
          OwnCapability.SCREENSHARE,
        ],
      });

      console.log(
        `Successfully made ${userId} a co-host with full permissions`
      );

      // Optional: Add toast notification
      toast.success("Co-host role assigned with full permissions");
    } catch (error) {
      console.error("Failed to make co-host:", error);
      toast.error("Failed to assign co-host role");
    }
  };

  // Filter participants by search
  const filtered = participants.filter((p) =>
    (p.name || p.userId).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 border-b bg-[#12141B] text-white">
      {/* PARTICIPANTS TITLE WITH COUNT */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-gray-300">
          Participants [{participants.length}]
        </h4>

        <button
          className="p-2 rounded hover:bg-[#2A2C36] transition"
          onClick={onClose}
        >
          <X className="w-4 h-4 text-gray-300" />
        </button>
      </div>

      {/* HOST CONTROLS BUTTON */}
      <div className="w-full flex justify-center mb-4">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full text-center px-4 py-2 bg-[#1F212A] rounded-md hover:bg-[#2A2C36] transition">
            Host Controls
          </DropdownMenuTrigger>

          <DropdownMenuContent className="bg-[#1F212A] text-white border border-[#2C2E38]">
            <DropdownMenuItem
              className="hover:bg-[#2A2C36]"
              onClick={() => updateAll(OwnCapability.SEND_AUDIO, false)}
            >
              <MicOff className="w-4 h-4 mr-2" />
              Disable All Participant Mics
            </DropdownMenuItem>

            <DropdownMenuItem
              className="hover:bg-[#2A2C36]"
              onClick={() => updateAll(OwnCapability.SEND_AUDIO, true)}
            >
              <Mic className="w-4 h-4 mr-2" />
              Enable All Participant Mics
            </DropdownMenuItem>

            <DropdownMenuItem
              className="hover:bg-[#2A2C36]"
              onClick={() => updateAll(OwnCapability.SEND_VIDEO, false)}
            >
              <VideoOff className="w-4 h-4 mr-2" />
              Disable All Participant Cameras
            </DropdownMenuItem>

            <DropdownMenuItem
              className="hover:bg-[#2A2C36]"
              onClick={() => updateAll(OwnCapability.SEND_VIDEO, true)}
            >
              <Video className="w-4 h-4 mr-2" />
              Enable All Participant Cameras
            </DropdownMenuItem>

            <DropdownMenuItem
              className="hover:bg-[#2A2C36]"
              onClick={() => updateAll(OwnCapability.SCREENSHARE, false)}
            >
              <ScreenShareOff className="w-4 h-4 mr-2" />
              Disable Participant Screen Sharing
            </DropdownMenuItem>

            <DropdownMenuItem
              className="hover:bg-[#2A2C36]"
              onClick={() => updateAll(OwnCapability.SCREENSHARE, true)}
            >
              <ScreenShare className="w-4 h-4 mr-2" />
              Enable Participant Screen Sharing
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* SEARCH BAR */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search participants..."
          className="w-full bg-[#1F212A] border border-[#2C2E38] rounded-md py-2 pl-9 pr-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#3C3E48]"
        />
      </div>

      {/* PARTICIPANTS LIST */}
      <div className="space-y-2">
        {filtered.map((p) => {
          // Determine role badge
          const role =
            p.roles?.includes("admin") || p.roles?.includes("host")
              ? "Host"
              : p.roles?.includes("co_host") || p.roles?.includes("moderator")
              ? "Co-Host"
              : "Participant";

          // Use SDK utility functions to check actual publishing status
          const isAudioOn = hasAudio(p);
          const isVideoOn = hasVideo(p);
          const isScreenShareOn = hasScreenShare(p);

          // Check if user is co-host (has moderation capabilities)
          const isCoHost = isHostOrCoHost(p);

          return (
            <div
              key={p.sessionId}
              className="flex items-center justify-between px-3 py-2 bg-[#1B1D25] hover:bg-[#22242E] rounded-lg transition"
            >
              {/* User Info */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <img
                  src={p.image || "/default-avatar.png"}
                  alt={p.name || p.userId}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />

                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-gray-200 truncate">
                      {p.name || p.userId}
                    </span>

                    {/* Role Badge */}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-md flex-shrink-0 ${
                        role === "Host"
                          ? "bg-blue-500/20 text-blue-400"
                          : role === "Co-Host"
                          ? "bg-purple-500/20 text-purple-400"
                          : "bg-[#2C2E38] text-gray-400"
                      }`}
                    >
                      {role}
                    </span>

                    {p.isLocalParticipant && (
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        (You)
                      </span>
                    )}
                  </div>

                  {/* Status indicators below name */}
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1">
                      {isAudioOn ? (
                        <Mic className="w-3 h-3 text-green-400" />
                      ) : (
                        <MicOff className="w-3 h-3 text-red-400" />
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {isVideoOn ? (
                        <Video className="w-3 h-3 text-green-400" />
                      ) : (
                        <VideoOff className="w-3 h-3 text-red-400" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions Menu - show for non-local OR if local is co-host */}
              {(!p.isLocalParticipant ||
                (p.isLocalParticipant && isCoHost)) && (
                <DropdownMenu>
                  <DropdownMenuTrigger className="p-2 rounded hover:bg-[#2A2C36] flex-shrink-0">
                    <MoreVertical className="w-4 h-4 text-gray-300" />
                  </DropdownMenuTrigger>

                  <DropdownMenuContent className="bg-[#1F212A] text-white border border-[#2C2E38]">
                    {!p.isLocalParticipant && !isCoHost && (
                      <DropdownMenuItem
                        className="hover:bg-[#2A2C36]"
                        onClick={() => handleMakeCoHost(p.userId)}
                      >
                        <Shield className="w-4 h-4 mr-2" /> Make Co-Host
                      </DropdownMenuItem>
                    )}

                    {/* Toggle Mic - show "Disable" if on, "Enable" if off */}
                    <DropdownMenuItem
                      className="hover:bg-[#2A2C36]"
                      onClick={() =>
                        togglePermission(
                          p.userId,
                          OwnCapability.SEND_AUDIO,
                          isAudioOn
                        )
                      }
                    >
                      {isAudioOn ? (
                        <>
                          <MicOff className="w-4 h-4 mr-2" /> Disable Mic
                        </>
                      ) : (
                        <>
                          <Mic className="w-4 h-4 mr-2" /> Enable Mic
                        </>
                      )}
                    </DropdownMenuItem>

                    {/* Toggle Camera - show "Disable" if on, "Enable" if off */}
                    <DropdownMenuItem
                      className="hover:bg-[#2A2C36]"
                      onClick={() =>
                        togglePermission(
                          p.userId,
                          OwnCapability.SEND_VIDEO,
                          isVideoOn
                        )
                      }
                    >
                      {isVideoOn ? (
                        <>
                          <VideoOff className="w-4 h-4 mr-2" /> Disable Camera
                        </>
                      ) : (
                        <>
                          <Video className="w-4 h-4 mr-2" /> Enable Camera
                        </>
                      )}
                    </DropdownMenuItem>

                    {/* Toggle Screen Share */}
                    <DropdownMenuItem
                      className="hover:bg-[#2A2C36]"
                      onClick={() =>
                        togglePermission(
                          p.userId,
                          OwnCapability.SCREENSHARE,
                          isScreenShareOn
                        )
                      }
                    >
                      {isScreenShareOn ? (
                        <>
                          <ScreenShareOff className="w-4 h-4 mr-2" />
                          Block Screen Share
                        </>
                      ) : (
                        <>
                          <ScreenShare className="w-4 h-4 mr-2" />
                          Allow Screen Share
                        </>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            No participants found
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomHostControls;
