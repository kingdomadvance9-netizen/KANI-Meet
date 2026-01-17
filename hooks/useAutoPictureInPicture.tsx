"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";

// ============================================================================
// TYPES
// ============================================================================

interface Participant {
  id: string;
  name: string;
  imageUrl?: string;
  isVideoPaused?: boolean;
}

interface PiPProps {
  participants: Participant[];
  localParticipant?: Participant | null;
  dominantSpeakerId?: string | null;
  screenShareParticipantId?: string | null;
  remoteStreams: Map<string, MediaStream>;
  localStream?: MediaStream | null;
  enabled?: boolean;
}

interface PiPState {
  enterPiP: () => Promise<void>;
  exitPiP: () => Promise<void>;
  isPiPActive: boolean;
  isPiPSupported: boolean;
  canActivate: boolean;
  canActivateReason: string | null;
  currentSpeaker: Participant | null;
  /** True after user has manually activated PiP once - enables auto-activation */
  isAutoActivateEnabled: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AVATAR_COLORS = [
  "#FF6B6B", "#4ECDC4", "#556270", "#C44DFF",
  "#45B7D1", "#FFA931", "#6BCB77", "#F7B801"
];

const PIP_WIDTH = 400;
const PIP_HEIGHT = 225; // 16:9 aspect ratio
const LOCAL_OVERLAY_SIZE = 80;
const LOCAL_OVERLAY_MARGIN = 12;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const getColorForUser = (userId: string): string => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map(n => n.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

// ============================================================================
// MAIN HOOK
// ============================================================================

export const useAutoPictureInPicture = ({
  participants,
  localParticipant,
  dominantSpeakerId,
  screenShareParticipantId,
  remoteStreams,
  localStream,
  enabled = true,
}: PiPProps): PiPState => {
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [hasUserActivatedOnce, setHasUserActivatedOnce] = useState(false);
  const pathname = usePathname();

  // Refs for canvas-based PiP
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isActivatingRef = useRef(false);
  const autoActivateEnabledRef = useRef(false);

  // ✅ Check if we're in a meeting room (not on setup screen)
  const isInMeetingRoom = useMemo(() => {
    // Support both /room/ and /meeting/ paths
    const inRoom = pathname?.includes("/room/") || pathname?.includes("/meeting/");
    const notSetup = !pathname?.includes("/setup");
    return inRoom && notSetup;
  }, [pathname]);

  // ✅ Check browser PiP support safely
  const isPiPSupported = useMemo(() => {
    if (typeof window === "undefined") return false;
    return !!document.pictureInPictureEnabled;
  }, []);

  // ============================================================================
  // PARTICIPANT SELECTION (GOOGLE MEET LOGIC)
  // ============================================================================

  // Find dominant speaker participant
  const dominantSpeaker = useMemo(() => {
    if (!dominantSpeakerId) return null;
    return participants.find(p => p.id === dominantSpeakerId) || null;
  }, [participants, dominantSpeakerId]);

  // Find screen share participant
  const screenShareParticipant = useMemo(() => {
    if (!screenShareParticipantId) return null;
    return participants.find(p => p.id === screenShareParticipantId) || null;
  }, [participants, screenShareParticipantId]);

  // Select target participant for PiP (Google Meet priority)
  const targetParticipant = useMemo(() => {
    // Priority 1: Screen share takes highest priority
    if (screenShareParticipant) {
      return screenShareParticipant;
    }

    // Priority 2: Dominant speaker
    if (dominantSpeaker) {
      return dominantSpeaker;
    }

    // Priority 3: Any remote participant with activity
    const remoteParticipant = participants.find(
      p => p.id !== localParticipant?.id
    );
    if (remoteParticipant) {
      return remoteParticipant;
    }

    // Priority 4: Local participant as fallback
    if (localParticipant) {
      return localParticipant;
    }

    // No valid participant
    return participants[0] || null;
  }, [screenShareParticipant, dominantSpeaker, participants, localParticipant]);

  // ============================================================================
  // VIDEO STREAM HELPERS
  // ============================================================================

  // Get video element for a participant
  const getVideoElement = useCallback((participantId: string): HTMLVideoElement | null => {
    const videoEls = Array.from(document.querySelectorAll("video")) as HTMLVideoElement[];
    return videoEls.find(v => {
      const peerId = v.dataset.peerId;
      return peerId === participantId && !peerId?.includes("-screen");
    }) || null;
  }, []);

  // Get screen share video element for a participant
  const getScreenShareVideoElement = useCallback((participantId: string): HTMLVideoElement | null => {
    const videoEls = Array.from(document.querySelectorAll("video")) as HTMLVideoElement[];
    return videoEls.find(v => {
      const peerId = v.dataset.peerId;
      return peerId === `${participantId}-screen`;
    }) || null;
  }, []);

  // Check if participant has valid video
  const hasValidVideo = useCallback((participantId: string): boolean => {
    // Check DOM video element
    const videoEl = getVideoElement(participantId);
    if (!videoEl) return false;

    const stream = videoEl.srcObject as MediaStream | null;
    if (!stream) return false;

    const videoTracks = stream.getVideoTracks();
    return videoTracks.length > 0 && videoTracks[0].readyState === "live";
  }, [getVideoElement]);

  // Get stream for participant
  const getStream = useCallback((participantId: string): MediaStream | null => {
    if (participantId === localParticipant?.id) {
      return localStream || null;
    }
    return remoteStreams.get(participantId) || null;
  }, [localParticipant?.id, localStream, remoteStreams]);

  // ============================================================================
  // CANVAS RENDERING (GOOGLE MEET LAYOUT)
  // ============================================================================

  // Draw avatar on canvas
  const drawAvatar = useCallback((
    ctx: CanvasRenderingContext2D,
    participant: Participant,
    x: number,
    y: number,
    width: number,
    height: number,
    isSmall = false
  ) => {
    // Background
    ctx.fillStyle = "#1f1f1f";
    ctx.fillRect(x, y, width, height);

    // Avatar circle
    const circleRadius = isSmall ? 25 : Math.min(width, height) * 0.25;
    const centerX = x + width / 2;
    const centerY = y + height / 2 - (isSmall ? 0 : 20);

    ctx.beginPath();
    ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = getColorForUser(participant.id);
    ctx.fill();

    // Initials
    ctx.fillStyle = "white";
    ctx.font = `${isSmall ? 16 : 32}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(getInitials(participant.name), centerX, centerY);

    // Name label (only for main content)
    if (!isSmall) {
      ctx.font = "14px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(participant.name, centerX, centerY + circleRadius + 25);
    }
  }, []);

  // Draw video frame on canvas
  const drawVideoFrame = useCallback((
    ctx: CanvasRenderingContext2D,
    videoEl: HTMLVideoElement,
    x: number,
    y: number,
    width: number,
    height: number,
    mirror = false
  ) => {
    ctx.save();

    if (mirror) {
      ctx.translate(x + width, y);
      ctx.scale(-1, 1);
      ctx.drawImage(videoEl, 0, 0, width, height);
    } else {
      ctx.drawImage(videoEl, x, y, width, height);
    }

    ctx.restore();
  }, []);

  // Render PiP frame
  const renderPiPFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isPiPActive) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = "#1f1f1f";
    ctx.fillRect(0, 0, PIP_WIDTH, PIP_HEIGHT);

    // Draw main content - screen share takes priority
    if (screenShareParticipantId) {
      // Screen share is active - show it as main content
      const screenShareVideoEl = getScreenShareVideoElement(screenShareParticipantId);
      if (screenShareVideoEl) {
        // Draw screen share (use object-contain style by fitting to canvas)
        const videoWidth = screenShareVideoEl.videoWidth || PIP_WIDTH;
        const videoHeight = screenShareVideoEl.videoHeight || PIP_HEIGHT;
        const scale = Math.min(PIP_WIDTH / videoWidth, PIP_HEIGHT / videoHeight);
        const scaledWidth = videoWidth * scale;
        const scaledHeight = videoHeight * scale;
        const offsetX = (PIP_WIDTH - scaledWidth) / 2;
        const offsetY = (PIP_HEIGHT - scaledHeight) / 2;

        // Fill background for letterboxing
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, PIP_WIDTH, PIP_HEIGHT);

        drawVideoFrame(ctx, screenShareVideoEl, offsetX, offsetY, scaledWidth, scaledHeight, false);
      } else if (targetParticipant) {
        // Screen share not ready yet, show participant avatar
        drawAvatar(ctx, targetParticipant, 0, 0, PIP_WIDTH, PIP_HEIGHT);
      }
    } else if (targetParticipant) {
      // No screen share - show dominant speaker or target participant
      const targetVideoEl = getVideoElement(targetParticipant.id);
      const hasVideo = targetVideoEl && hasValidVideo(targetParticipant.id);

      if (hasVideo && targetVideoEl) {
        // Draw video
        const isLocal = targetParticipant.id === localParticipant?.id;
        drawVideoFrame(ctx, targetVideoEl, 0, 0, PIP_WIDTH, PIP_HEIGHT, isLocal);
      } else {
        // Draw avatar
        drawAvatar(ctx, targetParticipant, 0, 0, PIP_WIDTH, PIP_HEIGHT);
      }
    }

    // Draw local user overlay (bottom-right, only if showing someone else)
    if (localParticipant && targetParticipant?.id !== localParticipant.id) {
      const overlayX = PIP_WIDTH - LOCAL_OVERLAY_SIZE - LOCAL_OVERLAY_MARGIN;
      const overlayY = PIP_HEIGHT - LOCAL_OVERLAY_SIZE - LOCAL_OVERLAY_MARGIN;

      // Draw overlay background with rounded corners effect
      ctx.fillStyle = "#2a2a2a";
      ctx.fillRect(overlayX - 2, overlayY - 2, LOCAL_OVERLAY_SIZE + 4, LOCAL_OVERLAY_SIZE + 4);

      const localVideoEl = getVideoElement(localParticipant.id);
      const localHasVideo = localVideoEl && hasValidVideo(localParticipant.id);

      if (localHasVideo && localVideoEl) {
        drawVideoFrame(ctx, localVideoEl, overlayX, overlayY, LOCAL_OVERLAY_SIZE, LOCAL_OVERLAY_SIZE, true);
      } else {
        drawAvatar(ctx, localParticipant, overlayX, overlayY, LOCAL_OVERLAY_SIZE, LOCAL_OVERLAY_SIZE, true);
      }
    }

    // Continue animation loop
    animationFrameRef.current = requestAnimationFrame(renderPiPFrame);
  }, [
    isPiPActive,
    screenShareParticipantId,
    targetParticipant,
    localParticipant,
    getVideoElement,
    getScreenShareVideoElement,
    hasValidVideo,
    drawVideoFrame,
    drawAvatar
  ]);

  // ============================================================================
  // PiP ACTIVATION / DEACTIVATION
  // ============================================================================

  const enterPiP = useCallback(async (isAutoActivation = false) => {
    if (isActivatingRef.current) return;
    if (!isPiPSupported) return;
    if (!isInMeetingRoom) return;
    if (isPiPActive) return;

    // For auto-activation, only proceed if user has manually activated at least once
    // This is due to browser security requiring user gesture for initial PiP
    if (isAutoActivation && !autoActivateEnabledRef.current) {
      console.log("🎬 Auto-activation blocked - waiting for first manual activation");
      return;
    }

    isActivatingRef.current = true;

    try {
      // Create canvas if not exists
      if (!canvasRef.current) {
        const canvas = document.createElement("canvas");
        canvas.width = PIP_WIDTH;
        canvas.height = PIP_HEIGHT;
        canvas.style.display = "none";
        document.body.appendChild(canvas);
        canvasRef.current = canvas;
      }

      // Create video element for PiP
      if (!pipVideoRef.current) {
        const video = document.createElement("video");
        video.muted = true;
        video.playsInline = true;
        video.style.display = "none";
        document.body.appendChild(video);
        pipVideoRef.current = video;
      }

      // Capture canvas stream and set as video source
      const stream = canvasRef.current.captureStream(30);
      pipVideoRef.current.srcObject = stream;

      // Start canvas rendering loop
      setIsPiPActive(true);

      // Wait for video to be ready
      await pipVideoRef.current.play();

      // Request PiP
      await pipVideoRef.current.requestPictureInPicture();

      // Mark that user has successfully activated PiP - enable auto-activation
      if (!isAutoActivation) {
        setHasUserActivatedOnce(true);
        autoActivateEnabledRef.current = true;
        console.log("🎬 PiP activated manually - auto-activation now enabled");
      }

    } catch (err) {
      console.error("Failed to enter PiP:", err);
      setIsPiPActive(false);
    } finally {
      isActivatingRef.current = false;
    }
  }, [isPiPSupported, isInMeetingRoom, isPiPActive]);

  const exitPiP = useCallback(async () => {
    try {
      // Stop animation loop
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Exit PiP mode
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      }

      setIsPiPActive(false);
    } catch (err) {
      console.error("Failed to exit PiP:", err);
    }
  }, []);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Start/stop canvas rendering when PiP is active
  useEffect(() => {
    if (isPiPActive) {
      renderPiPFrame();
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, [isPiPActive, renderPiPFrame]);

  // Track PiP state from browser events
  useEffect(() => {
    const handleEnter = () => setIsPiPActive(true);
    const handleLeave = () => {
      setIsPiPActive(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };

    document.addEventListener("enterpictureinpicture", handleEnter);
    document.addEventListener("leavepictureinpicture", handleLeave);

    return () => {
      document.removeEventListener("enterpictureinpicture", handleEnter);
      document.removeEventListener("leavepictureinpicture", handleLeave);
    };
  }, []);

  // Auto-activate on tab switch / app switch (Google Meet behavior)
  // Works on both desktop (tab switch) and mobile (app switch)
  useEffect(() => {
    if (!enabled) return;
    if (!isPiPSupported) return;
    if (!isInMeetingRoom) return;

    // Handle visibility change (works for both desktop tab switch and mobile app switch)
    const handleVisibilityChange = () => {
      console.log("🎬 Visibility changed:", document.hidden ? "hidden" : "visible");

      if (document.hidden) {
        // Tab/app is being hidden - activate PiP
        enterPiP(true); // true = auto-activation
      } else {
        // Tab/app is visible again - exit PiP
        exitPiP();
      }
    };

    // Handle window blur (additional support for some mobile browsers)
    const handleBlur = () => {
      console.log("🎬 Window blur detected");
      // Small delay to allow visibility change to fire first
      setTimeout(() => {
        if (document.hidden) {
          enterPiP(true);
        }
      }, 100);
    };

    // Handle window focus (return to app)
    const handleFocus = () => {
      console.log("🎬 Window focus detected");
      if (!document.hidden) {
        exitPiP();
      }
    };

    // Handle page hide (mobile Safari and some Android browsers)
    const handlePageHide = (e: PageTransitionEvent) => {
      console.log("🎬 Page hide detected, persisted:", e.persisted);
      if (e.persisted) {
        // Page is being cached (bfcache) - activate PiP
        enterPiP(true);
      }
    };

    // Handle page show (return from bfcache)
    const handlePageShow = (e: PageTransitionEvent) => {
      console.log("🎬 Page show detected, persisted:", e.persisted);
      if (e.persisted) {
        exitPiP();
      }
    };

    // Add all listeners
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [enabled, isPiPSupported, isInMeetingRoom, enterPiP, exitPiP]);

  // Exit PiP when leaving meeting room
  useEffect(() => {
    if (!isInMeetingRoom && isPiPActive) {
      exitPiP();
    }
  }, [isInMeetingRoom, isPiPActive, exitPiP]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Clean up canvas
      if (canvasRef.current) {
        canvasRef.current.remove();
        canvasRef.current = null;
      }

      // Clean up video
      if (pipVideoRef.current) {
        pipVideoRef.current.srcObject = null;
        pipVideoRef.current.remove();
        pipVideoRef.current = null;
      }

      // Exit PiP if active
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
      }
    };
  }, []);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  // Debug: Log why PiP might not be available
  const canActivateReason = useMemo(() => {
    if (!enabled) return "PiP is disabled";
    if (!isPiPSupported) return "Browser does not support PiP";
    if (!isInMeetingRoom) return "Not in meeting room";
    if (participants.length === 0 && !localParticipant) return "No participants";
    return null;
  }, [enabled, isPiPSupported, isInMeetingRoom, participants.length, localParticipant]);

  const canActivate = useMemo(() => {
    const canUse = !canActivateReason;

    // Debug logging
    if (!canUse) {
      console.log("🎬 PiP canActivate: false -", canActivateReason, {
        enabled,
        isPiPSupported,
        isInMeetingRoom,
        participantsCount: participants.length,
        hasLocalParticipant: !!localParticipant,
        pathname,
      });
    }

    return canUse;
  }, [canActivateReason, enabled, isPiPSupported, isInMeetingRoom, participants.length, localParticipant, pathname]);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    enterPiP: () => enterPiP(false), // Wrapper to hide internal parameter
    exitPiP,
    isPiPActive,
    isPiPSupported,
    canActivate,
    canActivateReason,
    currentSpeaker: targetParticipant,
    isAutoActivateEnabled: hasUserActivatedOnce,
  };
};

export default useAutoPictureInPicture;
