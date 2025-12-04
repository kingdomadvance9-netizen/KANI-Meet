"use client";

import {
  useCallStateHooks,
  hasScreenShare,
} from "@stream-io/video-react-sdk";
import { useEffect, useMemo, useState } from "react";

// COMPONENTS
import DesktopNormalLayout from "./layouts/DesktopNormalLayout";
import DesktopScreenShareLayout from "./layouts/DesktopScreenShareLayout";
import MobileNormalLayout from "./layouts/MobileNormalLayout";
import MobileScreenShareLayout from "./layouts/MobileScreenShareLayout";

const GridLayout = () => {
  const { useParticipants, useDominantSpeaker, useHasOngoingScreenShare } =
    useCallStateHooks();

  const participants = useParticipants();
  const dominantSpeaker = useDominantSpeaker();
  const isScreenSharing = useHasOngoingScreenShare();

  const [screenWidth, setScreenWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );

  // Listen for screen width changes
  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Find the user who is screen sharing
  const screenSharer = useMemo(
    () => participants.find((p) => hasScreenShare(p)),
    [participants]
  );

  // Active speaker fallback
  const activeSpeaker = useMemo(() => {
    if (dominantSpeaker) return dominantSpeaker;
    return (
      [...participants].sort(
        (a: any, b: any) => (b.audioLevel ?? 0) - (a.audioLevel ?? 0)
      )[0] ?? null
    );
  }, [participants, dominantSpeaker]);

  // Sorted for normal mode (active speaker first)
  const sorted = useMemo(() => {
    if (!isScreenSharing && activeSpeaker) {
      return [ 
        activeSpeaker,
        ...participants.filter((p) => p.sessionId !== activeSpeaker.sessionId),
      ];
    }
    return participants;
  }, [participants, activeSpeaker, isScreenSharing]);  

  const isScreenMode = isScreenSharing && screenSharer;
  const isMobile = screenWidth < 1024;

  return (
    <div className="w-full h-full p-2 overflow-y-auto overscroll-contain">
      {/** MOBILE */}
      {isMobile && !isScreenMode && (
        <MobileNormalLayout sorted={sorted} screenWidth={screenWidth} activeSpeaker={activeSpeaker} />
      )}

      {isMobile && isScreenMode && (
        <MobileScreenShareLayout
          participants={participants}
          screenSharer={screenSharer}
          activeSpeaker={activeSpeaker}
        />
      )}

      {/** DESKTOP */}
      {!isMobile && !isScreenMode && (
        <DesktopNormalLayout sorted={sorted} screenWidth={screenWidth} activeSpeaker={activeSpeaker} />
      )}

      {!isMobile && isScreenMode && (
        <DesktopScreenShareLayout
          participants={participants}
          screenSharer={screenSharer}
          activeSpeaker={activeSpeaker}
        />
      )}
    </div>
  );
};

export default GridLayout;
