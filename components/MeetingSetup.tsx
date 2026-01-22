"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "./ui/button";
import { Video, VideoOff, Mic, MicOff, Volume2, Sparkles } from "lucide-react";
import Image from "next/image";

interface JoinPreference {
  audio: boolean;
  video: boolean;
}

const STORAGE_KEY = "meeting-join-preference";

type AudioOption = "computer" | "phone" | "room" | "none";

const MeetingSetup = ({
  setIsSetupComplete,
}: {
  setIsSetupComplete: (value: boolean) => void;
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [audioOption, setAudioOption] = useState<AudioOption>("none");
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>("");
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>("");
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);

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
   * Enumerate media devices
   */
  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === "audioinput");
      const audioOutputs = devices.filter((d) => d.kind === "audiooutput");

      setMicrophones(audioInputs);
      setSpeakers(audioOutputs);

      // Set default selections
      if (audioInputs.length > 0 && !selectedMicrophone) {
        setSelectedMicrophone(audioInputs[0].deviceId);
      }
      if (audioOutputs.length > 0 && !selectedSpeaker) {
        setSelectedSpeaker(audioOutputs[0].deviceId);
      }
    } catch (error) {
      console.error("Failed to enumerate devices:", error);
    }
  }, [selectedMicrophone, selectedSpeaker]);

  /**
   * Request media permissions and show preview
   */
  const startMediaPreview = useCallback(async () => {
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
          deviceId: selectedMicrophone ? { exact: selectedMicrophone } : undefined,
        },
      });

      // Check if component is still mounted (prevent race condition)
      if (!isMountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;

      // Attach to video element and play
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playError) {
          console.warn("Video play failed:", playError);
        }
      }

      setIsCameraOn(true);

      // Enumerate devices after permission granted
      await enumerateDevices();

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
  }, [stopAllTracks, selectedMicrophone, enumerateDevices]);

  /**
   * Toggle camera on/off
   */
  const toggleCamera = useCallback(() => {
    console.log("🎥 Toggle camera - current state:", isCameraOn);
    if (isCameraOn) {
      stopAllTracks();
      setIsCameraOn(false);
      console.log("🎥 Camera turned OFF");
    } else {
      console.log("🎥 Starting camera...");
      startMediaPreview();
    }
  }, [isCameraOn, stopAllTracks, startMediaPreview]);

  /**
   * Handle microphone mute toggle
   */
  const toggleMicrophone = useCallback(() => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
    }
  }, []);

  /**
   * Handle join meeting
   * Save preference to localStorage and clean up tracks
   */
  const handleJoinMeeting = useCallback(() => {
    // Save user preference to localStorage
    const preference: JoinPreference = {
      audio: audioOption !== "none",
      video: isCameraOn,
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
  }, [audioOption, isCameraOn, stopAllTracks, setIsSetupComplete]);

  /**
   * Handle cancel
   */
  const handleCancel = useCallback(() => {
    stopAllTracks();
    // Navigate back or close
    window.history.back();
  }, [stopAllTracks]);

  /**
   * Effect: Start media preview on mount
   */
  useEffect(() => {
    enumerateDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Effect: Ensure video plays when camera is turned on
   */
  useEffect(() => {
    if (isCameraOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch((err) => {
        console.warn("Video autoplay prevented:", err);
      });
    }
  }, [isCameraOn]);

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
  const hasAudioTrack =
    streamRef.current?.getAudioTracks().some((track) => track.enabled) ?? false;
  const isMicrophoneMuted = !hasAudioTrack && isCameraOn;

  return (
    <div className="flex h-screen w-full flex-col bg-dark-2 text-white overflow-auto md:overflow-hidden">
      {/* Header with Logo and Meeting Info */}
      <div className="flex flex-col items-center pt-4 md:pt-8 pb-3 md:pb-6 gap-2 md:gap-4">
        <Image
          src="/icons/KANILOGO-no-bg.png"
          alt="KANI Logo"
          width={60}
          height={60}
          className="object-contain md:w-[80px] md:h-[80px]"
        />
        <div className="text-center">
          <h1 className="text-lg md:text-2xl font-semibold mb-1 md:mb-2">KANI Meeting</h1>
          <p className="text-xs md:text-sm text-gray-400">
            <span className="inline-flex items-center gap-2">
              <span>
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <span>•</span>
              <span>
                {new Date().toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </span>
          </p>
        </div>
      </div>

      {/* Main Content - Two Column Layout (stacks on mobile) */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 md:gap-6 px-4 md:px-6 pb-4 md:pb-6 md:overflow-hidden">
        {/* Left Column - Video Preview */}
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          <div className="relative flex-1 min-h-[200px] md:min-h-0 bg-dark-1 rounded-lg overflow-hidden border border-white/10 aspect-video md:aspect-auto">
            {isCameraOn && !permissionError ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                  onLoadedMetadata={() => {
                    console.log("📹 Video metadata loaded");
                  }}
                  onPlay={() => {
                    console.log("▶️ Video started playing");
                  }}
                />
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-dark-1/80 backdrop-blur-sm z-10">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 md:w-12 md:h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs md:text-sm text-gray-300">Starting preview...</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
                <VideoOff size={40} className="text-gray-500 md:w-12 md:h-12" />
                <div className="text-center">
                  <p className="text-sm md:text-base text-gray-300 font-medium">
                    Your camera is turned off
                  </p>
                  {permissionError && (
                    <p className="text-xs text-red-400 mt-2">{permissionError}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Camera Controls */}
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            <button
              onClick={toggleCamera}
              className="flex items-center gap-2 px-3 md:px-4 py-2 bg-dark-3 hover:bg-dark-4 rounded-lg transition-colors text-sm"
            >
              {isCameraOn ? (
                <Video size={16} className="text-white md:w-[18px] md:h-[18px]" />
              ) : (
                <VideoOff size={16} className="text-white md:w-[18px] md:h-[18px]" />
              )}
              <span className="text-xs md:text-sm">
                {isCameraOn ? "Camera on" : "Camera off"}
              </span>
            </button>
            <button className="flex items-center gap-2 px-3 md:px-4 py-2 bg-dark-3 hover:bg-dark-4 rounded-lg transition-colors text-sm">
              <Sparkles size={16} className="text-white md:w-[18px] md:h-[18px]" />
              <span className="text-xs md:text-sm">Effects and avatars</span>
            </button>
          </div>
        </div>

        {/* Right Column - Audio Settings */}
        <div className="w-full md:w-[400px] flex flex-col gap-3 md:gap-4 md:overflow-y-auto">
          {/* Computer Audio Option */}
          <label
            className={`flex items-center gap-3 p-3 md:p-4 rounded-lg border cursor-pointer transition-all ${
              audioOption === "computer"
                ? "border-blue-1 bg-blue-1/10"
                : "border-white/10 hover:border-white/20"
            }`}
          >
            <input
              type="radio"
              name="audio-option"
              value="computer"
              checked={audioOption === "computer"}
              onChange={() => setAudioOption("computer")}
              className="w-4 h-4 md:w-5 md:h-5 accent-blue-1 flex-shrink-0"
            />
            <span className="text-sm md:text-base font-medium">Computer audio</span>
          </label>

          {/* Audio Device Selectors (shown when Computer audio is selected) */}
          {audioOption === "computer" && (
            <div className="flex flex-col gap-3 pl-4 md:pl-8">
              {/* Microphone */}
              <div className="flex items-center gap-2 md:gap-3">
                <div className="flex items-center gap-1 md:gap-2 flex-1 min-w-0">
                  <button
                    onClick={toggleMicrophone}
                    className="p-2 hover:bg-dark-3 rounded transition-colors flex-shrink-0"
                  >
                    {isMicrophoneMuted ? (
                      <MicOff size={16} className="text-gray-400 md:w-[18px] md:h-[18px]" />
                    ) : (
                      <Mic size={16} className="text-white md:w-[18px] md:h-[18px]" />
                    )}
                  </button>
                  <select
                    value={selectedMicrophone}
                    onChange={(e) => setSelectedMicrophone(e.target.value)}
                    className="flex-1 min-w-0 bg-dark-1 border border-white/10 rounded px-2 md:px-3 py-2 text-xs md:text-sm text-white focus:outline-none focus:border-blue-1"
                  >
                    {microphones.map((mic) => (
                      <option key={mic.deviceId} value={mic.deviceId}>
                        {mic.label || `Microphone ${mic.deviceId.slice(0, 8)}`}
                      </option>
                    ))}
                  </select>
                </div>
                <button className="p-2 hover:bg-dark-3 rounded transition-colors flex-shrink-0 hidden md:block">
                  <span className="text-xs text-gray-400">⚙</span>
                </button>
              </div>

              {/* Speaker */}
              <div className="flex items-center gap-2 md:gap-3">
                <div className="flex items-center gap-1 md:gap-2 flex-1 min-w-0">
                  <div className="p-2 flex-shrink-0">
                    <Volume2 size={16} className="text-white md:w-[18px] md:h-[18px]" />
                  </div>
                  <select
                    value={selectedSpeaker}
                    onChange={(e) => setSelectedSpeaker(e.target.value)}
                    className="flex-1 min-w-0 bg-dark-1 border border-white/10 rounded px-2 md:px-3 py-2 text-xs md:text-sm text-white focus:outline-none focus:border-blue-1"
                  >
                    {speakers.map((speaker) => (
                      <option key={speaker.deviceId} value={speaker.deviceId}>
                        {speaker.label || `Speaker ${speaker.deviceId.slice(0, 8)}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Phone Audio Option */}
          <label
            className={`flex items-center gap-3 p-3 md:p-4 rounded-lg border cursor-pointer transition-all ${
              audioOption === "phone"
                ? "border-blue-1 bg-blue-1/10"
                : "border-white/10 hover:border-white/20"
            }`}
          >
            <input
              type="radio"
              name="audio-option"
              value="phone"
              checked={audioOption === "phone"}
              onChange={() => setAudioOption("phone")}
              className="w-4 h-4 md:w-5 md:h-5 accent-blue-1 flex-shrink-0"
            />
            <span className="text-sm md:text-base font-medium">Phone audio</span>
          </label>

          {/* Room Audio Option */}
          <label
            className={`flex items-center gap-3 p-3 md:p-4 rounded-lg border cursor-pointer transition-all ${
              audioOption === "room"
                ? "border-blue-1 bg-blue-1/10"
                : "border-white/10 hover:border-white/20"
            }`}
          >
            <input
              type="radio"
              name="audio-option"
              value="room"
              checked={audioOption === "room"}
              onChange={() => setAudioOption("room")}
              className="w-4 h-4 md:w-5 md:h-5 accent-blue-1 flex-shrink-0"
            />
            <span className="text-sm md:text-base font-medium">Room audio</span>
          </label>

          {/* Don't Use Audio Option */}
          <label
            className={`flex items-center gap-3 p-3 md:p-4 rounded-lg border cursor-pointer transition-all ${
              audioOption === "none"
                ? "border-blue-1 bg-blue-1/10"
                : "border-white/10 hover:border-white/20"
            }`}
          >
            <input
              type="radio"
              name="audio-option"
              value="none"
              checked={audioOption === "none"}
              onChange={() => setAudioOption("none")}
              className="w-4 h-4 md:w-5 md:h-5 accent-blue-1 flex-shrink-0"
            />
            <span className="text-sm md:text-base font-medium">Don&apos;t use audio</span>
          </label>
        </div>
      </div>

      {/* Footer with Buttons */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 md:gap-0 px-4 md:px-6 pb-4 md:pb-6 mt-auto">
        <a
          href="#"
          className="text-blue-1 text-xs md:text-sm hover:underline text-center md:text-left order-2 md:order-1"
          onClick={(e) => e.preventDefault()}
        >
          Need help?
        </a>
        <div className="flex items-center gap-2 md:gap-3 order-1 md:order-2">
          <Button
            onClick={handleCancel}
            variant="outline"
            className="flex-1 md:flex-initial px-4 md:px-6 py-2 bg-transparent border-white/20 text-white hover:bg-white/10 rounded-lg text-sm md:text-base"
          >
            Cancel
          </Button>
          <Button
            onClick={handleJoinMeeting}
            disabled={isLoading}
            className="flex-1 md:flex-initial px-4 md:px-6 py-2 bg-red-2 hover:bg-red-3 text-white rounded-lg font-medium text-sm md:text-base"
          >
            {isLoading ? "Loading..." : "Join now"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MeetingSetup;
