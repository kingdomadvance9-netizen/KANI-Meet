/**
 * useCanPerformAction Hook
 *
 * Provides client-side permission checking for role-based actions.
 * This is a UX optimization - the backend still validates all permissions.
 */

import { useMediasoupContext } from "@/contexts/MediasoupContext";
import { useUser } from "@clerk/nextjs";

export type ControlAction =
  | "MAKE_HOST"
  | "REMOVE_HOST"
  | "MAKE_COHOST"
  | "REMOVE_COHOST"
  | "MUTE_INDIVIDUAL"
  | "UNMUTE_INDIVIDUAL"
  | "DISABLE_CAMERA"
  | "ENABLE_CAMERA"
  | "STOP_SCREENSHARE"
  | "REMOVE_FROM_ROOM"
  | "GLOBAL_MUTE"
  | "GLOBAL_UNMUTE"
  | "GLOBAL_CAMERA_DISABLE"
  | "GLOBAL_CAMERA_ENABLE"
  | "GLOBAL_SCREENSHARE_DISABLE"
  | "GLOBAL_SCREENSHARE_ENABLE";

export interface Participant {
  id: string;
  name: string;
  imageUrl?: string;
  isAudioMuted: boolean;
  isVideoPaused: boolean;
  isHost: boolean;
  isCoHost?: boolean;
}

/**
 * Check if current user can perform an action on a target participant
 */
export function useCanPerformAction(
  action: ControlAction,
  targetParticipant?: Participant
): boolean {
  const { isHost, isCoHost, participants } = useMediasoupContext();
  const { user } = useUser();

  // Self-check - can't control yourself (except for own media controls)
  if (targetParticipant && targetParticipant.id === user?.id) {
    return false;
  }

  // Define global actions
  const globalActions: ControlAction[] = [
    "GLOBAL_MUTE",
    "GLOBAL_UNMUTE",
    "GLOBAL_CAMERA_DISABLE",
    "GLOBAL_CAMERA_ENABLE",
    "GLOBAL_SCREENSHARE_DISABLE",
    "GLOBAL_SCREENSHARE_ENABLE",
  ];

  // Global actions - HOST or COHOST
  if (globalActions.includes(action)) {
    return isHost || isCoHost;
  }

  // Host-only actions
  const hostOnlyActions: ControlAction[] = [
    "MAKE_HOST",
    "REMOVE_HOST",
    "MAKE_COHOST",
    "REMOVE_COHOST",
  ];

  if (hostOnlyActions.includes(action)) {
    return isHost;
  }

  // Individual control actions (require target)
  if (targetParticipant) {
    // Co-host cannot control host
    if (isCoHost && targetParticipant.isHost) {
      return false;
    }

    // Co-host can control participants and other co-hosts (except remove)
    if (isCoHost) {
      // Co-host cannot remove other co-hosts or hosts
      if (action === "REMOVE_FROM_ROOM") {
        return !targetParticipant.isHost && !targetParticipant.isCoHost;
      }
      return true; // Can perform other individual actions
    }

    // Host can control everyone
    if (isHost) {
      return true;
    }
  }

  return false;
}

/**
 * Get permission info with reason for denial (useful for tooltips)
 */
export function usePermissionInfo(
  action: ControlAction,
  targetParticipant?: Participant
): { allowed: boolean; reason?: string } {
  const { isHost, isCoHost } = useMediasoupContext();
  const { user } = useUser();

  const allowed = useCanPerformAction(action, targetParticipant);

  if (allowed) {
    return { allowed: true };
  }

  // Provide helpful denial reasons
  if (!isHost && !isCoHost) {
    return { allowed: false, reason: "You need host or co-host privileges" };
  }

  if (targetParticipant) {
    if (targetParticipant.id === user?.id) {
      return { allowed: false, reason: "Cannot target yourself" };
    }

    if (isCoHost && targetParticipant.isHost) {
      return { allowed: false, reason: "Co-hosts cannot control hosts" };
    }

    if (isCoHost && action === "REMOVE_FROM_ROOM") {
      if (targetParticipant.isCoHost) {
        return { allowed: false, reason: "Co-hosts cannot remove other co-hosts" };
      }
      if (targetParticipant.isHost) {
        return { allowed: false, reason: "Co-hosts cannot remove hosts" };
      }
    }

    const hostOnlyActions: ControlAction[] = [
      "MAKE_HOST",
      "REMOVE_HOST",
      "MAKE_COHOST",
      "REMOVE_COHOST",
    ];

    if (isCoHost && hostOnlyActions.includes(action)) {
      return { allowed: false, reason: "Only hosts can manage roles" };
    }
  }

  return { allowed: false, reason: "Permission denied" };
}

/**
 * Hook to check if current user has admin privileges (host or co-host)
 */
export function useHasAdminPrivileges(): boolean {
  const { isHost, isCoHost } = useMediasoupContext();
  return isHost || isCoHost;
}

/**
 * Hook to get current user's role as a string
 */
export function useCurrentRole(): "HOST" | "COHOST" | "PARTICIPANT" {
  const { isHost, isCoHost } = useMediasoupContext();

  if (isHost) return "HOST";
  if (isCoHost) return "COHOST";
  return "PARTICIPANT";
}
