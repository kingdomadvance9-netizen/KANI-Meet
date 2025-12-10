"use client";

import {
  useCallStateHooks,
  hasScreenShare,
  ParticipantView,
  useCall,
  combineComparators,
  dominantSpeaker,
  speaking,
  publishingVideo,
  publishingAudio,
} from "@stream-io/video-react-sdk";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAutoPictureInPicture } from "../hooks/useAutoPictureInPicture";

// COMPONENTS
import DesktopNormalLayout from "./layouts/DesktopNormalLayout";
import DesktopScreenShareLayout from "./layouts/DesktopScreenShareLayout";
import MobileNormalLayout from "./layouts/MobileNormalLayout";
import MobileScreenShareLayout from "./layouts/MobileScreenShareLayout";
import { PictureInPicture2, X } from "lucide-react";
import FloatingReactions from "./FloatingReactions"; 


const GridLayout = () => {
  const call = useCall();
  const { useParticipants, useDominantSpeaker, useHasOngoingScreenShare } =
    useCallStateHooks();

  const participants = useParticipants();
  const dominantSpeakerParticipant = useDominantSpeaker();
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

  // Apply custom sorting that prioritizes dominant speaker
  useEffect(() => {
    if (!call) return;

    const customSorting = combineComparators(
      dominantSpeaker,
      speaking,
      publishingVideo,
      publishingAudio
    );

    call.setSortParticipantsBy(customSorting);
  }, [call]);

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const screenSharer = useMemo(
    () => participants.find((p) => hasScreenShare(p)),
    [participants]
  );

  // Active speaker is now the first participant (already sorted by Stream)
  const activeSpeaker = useMemo(() => {
    return participants[0] || null;
  }, [participants]);

  const isScreenMode = isScreenSharing && screenSharer;
  const isMobile = screenWidth < 1024;

  return (
    <div className="w-full h-full p-2 overflow-y-auto overscroll-contain">
    {/*<FloatingReactions />*/}
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
            <X className="text-white w-5 h-5" />
          ) : (
            <PictureInPicture2 className="text-white w-5 h-5" />
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
                VideoPlaceholder={({ style }) => (
                  <div
                    style={{ 
                      ...style, 
                      width: "100%", 
                      height: "100%",
                      background: "#1f1f1f",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "column"
                    }}
                  >
                    {currentTargetParticipant.image && (
                      <img
                        style={{ width: 100, height: 100, borderRadius: "50%" }}
                        src={currentTargetParticipant.image}
                        alt={currentTargetParticipant.userId}
                      />
                    )}
                    {!currentTargetParticipant.image && (
                      <span style={{ color: "white", fontSize: "16px" }}>
                        {currentTargetParticipant.name ||
                          currentTargetParticipant.userId}
                      </span>
                    )}
                  </div>
                )}
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
              sorted={participants}
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
              sorted={participants}
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