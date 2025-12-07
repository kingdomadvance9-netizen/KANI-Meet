"use client";

import {
  useCallStateHooks,
  hasScreenShare,
  ParticipantView,
} from "@stream-io/video-react-sdk";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAutoPictureInPicture } from "../hooks/useAutoPictureInPicture";

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

  const {
    togglePiP,
    isPiPActive,
    isPiPSupported,
    pipWindow,
    currentTargetParticipant,
    isDocumentPiP,
  } = useAutoPictureInPicture();

  const [screenWidth, setScreenWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const screenSharer = useMemo(
    () => participants.find((p) => hasScreenShare(p)),
    [participants]
  );

  const activeSpeaker = useMemo(() => {
    if (dominantSpeaker) return dominantSpeaker;
    return (
      [...participants].sort(
        (a: any, b: any) => (b.audioLevel ?? 0) - (a.audioLevel ?? 0)
      )[0] ?? null
    );
  }, [participants, dominantSpeaker]);

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
      {/* Unified PiP Toggle Button */}
      {isPiPSupported && (
        <button
          onClick={togglePiP}
          className={`
      fixed top-4 right-4 z-50
      w-10 h-10 flex items-center justify-center
      rounded-full shadow-xl transition-all
      backdrop-blur-md
      ${
        isPiPActive
          ? "bg-red-600/90 hover:bg-red-700"
          : "bg-blue-600/90 hover:bg-blue-700"
      }
    `}
          title={
            isPiPActive ? "Exit Picture-in-Picture" : "Enter Picture-in-Picture"
          }
        >
          {isPiPActive ? (
            // Exit PiP Icon (⬆️ out of box style)
            <span className="text-white text-lg">⤴️</span>
          ) : (
            // Enter PiP Icon (little screen in screen)
            <span className="text-white text-lg">🗔</span>
          )}
        </button>
      )}

      {/* Document PiP Portal */}
      {pipWindow &&
        currentTargetParticipant &&
        createPortal(
          <div className="w-full h-full bg-gray-900 flex flex-col">
            <div className="flex-1 relative">
              <ParticipantView
                participant={currentTargetParticipant}
                trackType={
                  isScreenSharing &&
                  screenSharer?.sessionId === currentTargetParticipant.sessionId
                    ? "screenShareTrack"
                    : "videoTrack"
                }
              />
            </div>
            <div className="p-2 bg-gray-800 text-white text-sm text-center">
              {currentTargetParticipant.name || "Participant"}
              {isScreenSharing &&
                screenSharer?.sessionId ===
                  currentTargetParticipant.sessionId &&
                " (Screen)"}
            </div>
          </div>,
          pipWindow.document.body
        )}

      {/* Main Layout - Hidden when Document PiP is active */}
      {!isDocumentPiP && (
        <>
          {isMobile && !isScreenMode && (
            <MobileNormalLayout
              sorted={sorted}
              screenWidth={screenWidth}
              activeSpeaker={activeSpeaker}
            />
          )}

          {isMobile && isScreenMode && (
            <MobileScreenShareLayout
              participants={participants}
              screenSharer={screenSharer}
              activeSpeaker={activeSpeaker}
            />
          )}

          {!isMobile && !isScreenMode && (
            <DesktopNormalLayout
              sorted={sorted}
              screenWidth={screenWidth}
              activeSpeaker={activeSpeaker}
            />
          )}

          {!isMobile && isScreenMode && (
            <DesktopScreenShareLayout
              participants={participants}
              screenSharer={screenSharer}
              activeSpeaker={activeSpeaker}
            />
          )}
        </>
      )}
    </div>
  );
};

export default GridLayout;
