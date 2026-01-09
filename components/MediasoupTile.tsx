"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, VideoOff } from "lucide-react";

interface MediasoupTileProps {
  stream?: MediaStream;
  participantName: string;
  participantImage?: string;
  isLocal?: boolean;
  isHost?: boolean;
}

const MediasoupTile = ({
  stream,
  participantName,
  participantImage,
  isLocal,
  isHost,
}: MediasoupTileProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [hasVideo, setHasVideo] = useState(false);
  const [isTalking, setIsTalking] = useState(false);

  useEffect(() => {
    if (!stream) return;

    const videoElement = videoRef.current;
    if (!videoElement) return;

    let cleanupVideoTrackListeners: (() => void) | undefined;
    let audioContext: AudioContext | null = null;

    /** 🔄 Always re-evaluate current tracks */
    const updateStreamState = () => {
      const videoTrack = stream.getVideoTracks()[0];

      const active =
        !!videoTrack &&
        videoTrack.readyState === "live" &&
        videoTrack.enabled !== false;

      setHasVideo(active);

      if (videoElement.srcObject !== stream) {
        videoElement.srcObject = stream;
      }

      console.log("🎥 Video update:", {
        participantName,
        tracks: stream.getVideoTracks().length,
        readyState: videoTrack?.readyState,
        enabled: videoTrack?.enabled,
      });
    };

    /** 🎧 Bind listeners to the CURRENT video track */
    const bindVideoTrackListeners = () => {
      const track = stream.getVideoTracks()[0];
      if (!track) return;

      const onEnded = () => updateStreamState();
      const onMute = () => updateStreamState();
      const onUnmute = () => updateStreamState();

      track.addEventListener("ended", onEnded);
      track.addEventListener("mute", onMute);
      track.addEventListener("unmute", onUnmute);

      return () => {
        track.removeEventListener("ended", onEnded);
        track.removeEventListener("mute", onMute);
        track.removeEventListener("unmute", onUnmute);
      };
    };

    updateStreamState();
    cleanupVideoTrackListeners = bindVideoTrackListeners();

    /** 🔁 Handle mediasoup replacing tracks */
    stream.onaddtrack = () => {
      cleanupVideoTrackListeners?.();
      cleanupVideoTrackListeners = bindVideoTrackListeners();
      updateStreamState();
    };

    stream.onremovetrack = () => {
      updateStreamState();
    };

    /** ▶️ Play video (autoplay-safe) */
    videoElement.play().catch(() => {});

    /** 🔊 Audio for remote participants */
    if (!isLocal && audioRef.current) {
      audioRef.current.srcObject = stream;
      audioRef.current.play().catch(() => {});
    }

    /** 📊 Audio activity detection */
    try {
      audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);

      const detect = () => {
        analyser.getByteFrequencyData(data);
        const volume = data.reduce((a, b) => a + b, 0) / data.length;
        setIsTalking(volume > 10);
        requestAnimationFrame(detect);
      };

      detect();
    } catch {
      console.log("No audio track yet");
    }

    return () => {
      cleanupVideoTrackListeners?.();
      audioContext?.close();
    };
  }, [stream, participantName, isLocal]);

  return (
    <div
      className={`relative aspect-video bg-[#1C1F2E] rounded-2xl overflow-hidden border-2 transition-all ${
        isTalking
          ? "border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
          : "border-white/5"
      }`}
    >
      {!isLocal && (
        <audio ref={audioRef} autoPlay playsInline className="hidden" />
      )}

      {/* VIDEO */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          hasVideo ? "opacity-100" : "opacity-0 absolute"
        } ${isLocal ? "scale-x-[-1]" : ""}`}
      />

      {/* AVATAR */}
      {!hasVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 sm:gap-3">
          <div className="relative">
            {isTalking && (
              <div className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-20" />
            )}
            {participantImage ? (
              <img
                src={participantImage}
                alt={participantName}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border border-white/10 relative z-10"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-dark-3 flex items-center justify-center text-xl sm:text-2xl font-bold border border-white/10 relative z-10">
                {participantName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <p className="text-gray-500 text-[10px] sm:text-xs uppercase tracking-wide sm:tracking-widest px-2 text-center">
            Audio Only
          </p>
        </div>
      )}

      {/* INFO BAR */}
      <div className="absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-3 sm:right-3 flex justify-between items-center">
        <div className="bg-black/60 backdrop-blur px-2 py-1 sm:px-3 sm:py-1 rounded-lg border border-white/10 flex items-center gap-1.5 sm:gap-2">
          {isTalking ? (
            <Mic size={12} className="text-blue-400 sm:w-3.5 sm:h-3.5" />
          ) : (
            <MicOff size={12} className="text-gray-400 sm:w-3.5 sm:h-3.5" />
          )}
          <span className="text-[10px] sm:text-xs font-medium truncate max-w-[120px] sm:max-w-none">
            {participantName} {isLocal ? "(You)" : ""}
          </span>
          {isHost && (
            <span className="text-yellow-400 text-xs sm:text-sm">👑</span>
          )}
        </div>

        {!hasVideo && (
          <div className="p-1 sm:p-1.5 bg-red-500/20 rounded-md border border-red-500/50">
            <VideoOff size={12} className="text-red-500 sm:w-3.5 sm:h-3.5" />
          </div>
        )}
      </div>
    </div>
  );
};

export default MediasoupTile;
