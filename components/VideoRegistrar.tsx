"use client";

import { useEffect, useRef } from "react";

interface MediasoupVideoProps {
  track: MediaStreamTrack;
  isLocal?: boolean;
  className?: string;
}

const MediasoupVideo = ({ track, isLocal = false, className }: MediasoupVideoProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !track) return;

    // ✅ Create a new MediaStream from the Mediasoup track
    const stream = new MediaStream([track]);
    videoElement.srcObject = stream;

    // Handle play-out
    videoElement.onloadedmetadata = () => {
      videoElement.play().catch((err) => console.error("Video play error:", err));
    };

    return () => {
      // Clean up resources when track changes or component unmounts
      videoElement.srcObject = null;
    };
  }, [track]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={isLocal} // Always mute local video to prevent feedback
      className={className}
    />
  );
};

export default MediasoupVideo;