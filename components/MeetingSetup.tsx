"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "./ui/button";
import { Video, VideoOff, Mic, MicOff } from "lucide-react";

interface JoinPreference {
  audio: boolean;
  video: boolean;
}

const STORAGE_KEY = "meeting-join-preference";

const MeetingSetup = ({
  setIsSetupComplete,
}: {
  setIsSetupComplete: (value: boolean) => void;
}) => {
  const [joinWithMediaOff, setJoinWithMediaOff] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isMountedRef = useRef(true);

  /**
   * Cleanup function to stop all media tracks
   * Ensures browser mic/camera indicators turn OFF
   */
  const stopAllTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log(`🛑 Stopped ${track.kind} track:`, track.id);
      });
      streamRef.current = null;
    }

    // Clear video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  /**
   * Request media permissions and show preview
   */
  const startMediaPreview = useCallback(async () => {
    // Don't request if joining with media off
    if (joinWithMediaOff) {
      stopAllTracks();
      return;
    }

    setIsLoading(true);
    setPermissionError(null);

    try {
      // Stop any existing stream first
      stopAllTracks();

      // Request both audio and video
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Check if component is still mounted (prevent race condition)
      if (!isMountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;

      // Attach to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      console.log("✅ Media preview started:", {
        video: stream.getVideoTracks().length > 0,
        audio: stream.getAudioTracks().length > 0,
      });
    } catch (error) {
      console.error("❌ Failed to access media devices:", error);

      if (error instanceof Error) {
        if (
          error.name === "NotAllowedError" ||
          error.name === "PermissionDeniedError"
        ) {
          setPermissionError(
            "Camera/microphone access denied. Please allow permissions in your browser settings."
          );
        } else if (error.name === "NotFoundError") {
          setPermissionError(
            "No camera or microphone found. Please connect a device and refresh."
          );
        } else {
          setPermissionError(
            "Failed to access camera/microphone. Please check your device settings."
          );
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [joinWithMediaOff, stopAllTracks]);

  /**
   * Handle checkbox toggle
   * Clean up tracks immediately when enabling "join with media off"
   */
  const handleToggleChange = useCallback(
    (checked: boolean) => {
      setJoinWithMediaOff(checked);

      if (checked) {
        // Immediately stop all tracks when enabling "join with media off"
        stopAllTracks();
        setPermissionError(null);
        console.log("🔇 Join with media OFF enabled - all tracks stopped");
      }
      // If unchecking, the useEffect will handle starting the preview
    },
    [stopAllTracks]
  );

  /**
   * Handle join meeting
   * Save preference to localStorage and clean up tracks
   */
  const handleJoinMeeting = useCallback(() => {
    // Save user preference to localStorage
    const preference: JoinPreference = {
      audio: !joinWithMediaOff,
      video: !joinWithMediaOff,
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
      console.log("💾 Saved join preference:", preference);
    } catch (error) {
      console.error("Failed to save preference to localStorage:", error);
    }

    // Stop all preview tracks before joining
    stopAllTracks();
    console.log("🚀 Joining meeting with preference:", preference);

    // Proceed to meeting room
    setIsSetupComplete(true);
  }, [joinWithMediaOff, stopAllTracks, setIsSetupComplete]);

  /**
   * Effect: Manage media lifecycle based on checkbox state
   */
  useEffect(() => {
    if (!joinWithMediaOff) {
      startMediaPreview();
    }
  }, [joinWithMediaOff, startMediaPreview]);

  /**
   * Effect: Cleanup on unmount
   * CRITICAL: Ensure no tracks remain active
   */
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      stopAllTracks();
      console.log("🧹 MeetingSetup unmounted - all tracks cleaned up");
    };
  }, [stopAllTracks]);

  /**
   * Get current track status for display
   */
  const hasVideoTrack = streamRef.current?.getVideoTracks().length ?? 0 > 0;
  const hasAudioTrack = streamRef.current?.getAudioTracks().length ?? 0 > 0;

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-6 text-white px-4">
      <div className="max-w-2xl w-full space-y-4">
        <h1 className="text-center text-3xl font-bold text-white">Setup</h1>
        <p className="text-center text-gray-400 text-sm">
          Configure your audio and video before joining
        </p>
      </div>

      {/* 🖼️ Video Preview */}
      <div className="relative w-full max-w-[640px] aspect-video bg-dark-1 rounded-xl overflow-hidden border border-white/10 shadow-2xl">
        {!joinWithMediaOff && !permissionError ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-dark-1/80 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-gray-300">Starting preview...</p>
                </div>
              </div>
            )}
            {/* Media Status Indicators */}
            <div className="absolute bottom-4 left-4 flex gap-2">
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${
                  hasVideoTrack
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {hasVideoTrack ? <Video size={16} /> : <VideoOff size={16} />}
                <span className="text-xs font-medium">
                  {hasVideoTrack ? "Video On" : "Video Off"}
                </span>
              </div>
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${
                  hasAudioTrack
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {hasAudioTrack ? <Mic size={16} /> : <MicOff size={16} />}
                <span className="text-xs font-medium">
                  {hasAudioTrack ? "Mic On" : "Mic Off"}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-dark-3 flex items-center justify-center">
              <VideoOff size={40} className="text-gray-500" />
            </div>
            <div>
              <p className="text-gray-300 font-medium mb-1">
                {joinWithMediaOff ? "Camera & Microphone Off" : "No Preview"}
              </p>
              <p className="text-gray-500 text-sm">
                {joinWithMediaOff
                  ? "You will join the meeting with audio and video disabled"
                  : permissionError || "Enable preview to test your setup"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Permission Error Alert */}
      {permissionError && !joinWithMediaOff && (
        <div className="max-w-[640px] w-full p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center mt-0.5">
              <span className="text-red-400 text-xs">!</span>
            </div>
            <div>
              <p className="text-red-400 font-medium text-sm mb-1">
                Permission Required
              </p>
              <p className="text-red-300/80 text-xs">{permissionError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col items-center gap-4">
        <label className="flex items-center gap-3 cursor-pointer group">
          <div className="relative">
            <input
              type="checkbox"
              className="peer w-5 h-5 accent-red-2 cursor-pointer"
              checked={joinWithMediaOff}
              onChange={(e) => handleToggleChange(e.target.checked)}
            />
          </div>
          <span className="text-base font-medium group-hover:text-gray-200 transition-colors">
            Join with audio/video off
          </span>
        </label>

        <Button
          className="rounded-lg bg-red-2 px-8 py-3 text-base font-semibold hover:bg-red-3 transition-colors shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleJoinMeeting}
          disabled={isLoading}
        >
          {isLoading ? "Loading..." : "Join Meeting"}
        </Button>

        <p className="text-xs text-gray-500 text-center max-w-md">
          Your preference will be saved. You can change audio/video settings
          after joining.
        </p>
      </div>
    </div>
  );
};

export default MeetingSetup;
