// hooks/useAutoPictureInPicture.tsx
import { useEffect, useRef } from "react";
import { useCallStateHooks } from "@stream-io/video-react-sdk";

export const useAutoPictureInPicture = () => {
  const { useDominantSpeaker } = useCallStateHooks();
  const dominantSpeaker = useDominantSpeaker();
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    // Find the dominant speaker's video element
    const findDominantSpeakerVideo = () => {
      if (!dominantSpeaker) return null;
      
      // Find all video elements
      const videos = document.querySelectorAll('video');
      
      // Try to find the video that matches the dominant speaker
      // This is a heuristic - you may need to adjust based on your DOM structure
      for (const video of videos) {
        if (video.srcObject && !video.paused) {
          return video;
        }
      }
      return videos[0] || null;
    };

    const handleVisibilityChange = async () => {
      if (document.hidden) {
        // User left the page - trigger PiP automatically
        const video = findDominantSpeakerVideo();
        if (video && document.pictureInPictureEnabled && !document.pictureInPictureElement) {
          try {
            await video.requestPictureInPicture();
            videoElementRef.current = video;
          } catch (error) {
            console.error('Auto PiP failed:', error);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [dominantSpeaker]);

  const manualTogglePiP = async () => {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else {
      const video = document.querySelector('video');
      if (video && document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      }
    }
  };

  return { manualTogglePiP };
};