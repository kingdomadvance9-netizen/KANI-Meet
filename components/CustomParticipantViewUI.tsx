"use client";

import { useEffect, useState, RefObject } from "react";

interface CustomParticipantViewUIProps {
  // ✅ Instead of context, we pass the ref to the specific video element
  videoRef: RefObject<HTMLVideoElement | null>;
}

const CustomParticipantViewUI = ({ videoRef }: CustomParticipantViewUIProps) => {
  const [isPipActive, setIsPipActive] = useState(false);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleEnterPiP = () => setIsPipActive(true);
    const handleLeavePiP = () => setIsPipActive(false);

    videoElement.addEventListener("enterpictureinpicture", handleEnterPiP);
    videoElement.addEventListener("leavepictureinpicture", handleLeavePiP);

    return () => {
      videoElement.removeEventListener("enterpictureinpicture", handleEnterPiP);
      videoElement.removeEventListener("leavepictureinpicture", handleLeavePiP);
    };
  }, [videoRef]);

  const togglePictureInPicture = async () => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    try {
      if (document.pictureInPictureElement !== videoElement) {
        await videoElement.requestPictureInPicture();
      } else {
        await document.exitPictureInPicture();
      }
    } catch (error) {
      console.error("PiP Error:", error);
    }
  };

  // Only show the button if the browser supports PiP
  if (typeof document !== "undefined" && !document.pictureInPictureEnabled) {
    return null;
  }

  return (
    <button
      className="absolute top-2 right-2 z-50 bg-black/60 hover:bg-black/80 text-white px-3 py-1.5 rounded-lg text-xs transition-colors backdrop-blur-sm border border-white/10"
      onClick={(e) => {
        e.stopPropagation(); // Prevent clicking the video tile itself
        togglePictureInPicture();
      }}
    >
      {isPipActive ? "Exit PiP" : "PiP"}
    </button>
  );
};

export default CustomParticipantViewUI;