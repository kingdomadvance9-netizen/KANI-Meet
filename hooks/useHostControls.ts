import { useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";

export function useHostControls(socket: any, roomId: string) {
  const { user } = useUser();

  const toggleRemoteAudio = useCallback(
    (targetUserId: string, currentlyMuted: boolean) => {
      if (!socket || !user) return;

      socket.emit("toggle-remote-audio", {
        roomId,
        userId: user.id,
        targetUserId,
        force: currentlyMuted ? "unmute" : "mute",
      });

      toast.success(
        `${currentlyMuted ? "Unmuted" : "Muted"} participant's microphone`
      );
    },
    [socket, user, roomId]
  );

  const toggleRemoteVideo = useCallback(
    (targetUserId: string, currentlyPaused: boolean) => {
      if (!socket || !user) return;

      socket.emit("toggle-remote-video", {
        roomId,
        userId: user.id,
        targetUserId,
        force: currentlyPaused ? "unpause" : "pause",
      });

      toast.success(
        `${currentlyPaused ? "Enabled" : "Disabled"} participant's camera`
      );
    },
    [socket, user, roomId]
  );

  const removeParticipant = useCallback(
    (targetUserId: string, targetName: string) => {
      if (!socket || !user) return;

      const confirmed = confirm(
        `Are you sure you want to remove ${targetName} from this meeting?`
      );
      if (!confirmed) return;

      socket.emit("remove-participant", {
        roomId,
        userId: user.id,
        targetUserId,
      });

      toast.success(`Removed ${targetName} from the meeting`);
    },
    [socket, user, roomId]
  );

  return {
    toggleRemoteAudio,
    toggleRemoteVideo,
    removeParticipant,
  };
}
