"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";

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
    if (!stream) {
      console.log("⚠️ No stream provided for:", participantName);
      return;
    }

    console.log(
      "🎬 Setting up MediasoupTile for:",
      participantName,
      "isLocal:",
      isLocal
    );
    console.log("📊 Stream tracks:", {
      audio: stream.getAudioTracks().length,
      video: stream.getVideoTracks().length,
    });

    const videoElement = videoRef.current;
    if (!videoElement) return;

    const updateStream = () => {
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      setHasVideo(!!videoTrack && videoTrack.enabled);

      // Re-assign srcObject to ensure the video tag picks up new tracks
      if (videoElement.srcObject !== stream) {
        videoElement.srcObject = stream;
      }

      // Also set audio element for remote participants to ensure audio plays
      const audioElement = audioRef.current;
      if (audioElement && !isLocal) {
        if (audioElement.srcObject !== stream) {
          audioElement.srcObject = stream;
          console.log(
            "🔊 Setting audio stream for remote participant:",
            participantName
          );
          audioElement.play().catch((err) => {
            console.warn(
              "⚠️ Audio autoplay blocked for",
              participantName,
              ":",
              err
            );
          });
        }
      }
    };

    updateStream();

    // ✅ CRITICAL: Listen for tracks added AFTER the stream object exists
    stream.onaddtrack = () => {
      console.log("🎵 New track added to stream for:", participantName);
      updateStream();
    };

    stream.onremovetrack = updateStream;

    // Handle Autoplay Policy
    const playVideo = async () => {
      try {
        await videoElement.play();
      } catch (err) {
        console.warn("Autoplay blocked. User interaction needed for audio.");
      }
    };
    playVideo();

    // 3. Audio Activity Detection
    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    // Wrap in try-catch because if stream has no audio yet, this might throw
    try {
      const source = audioContext.createMediaStreamSource(stream);
      const analyzer = audioContext.createAnalyser();
      source.connect(analyzer);
      const dataArray = new Uint8Array(analyzer.frequencyBinCount);

      const detectAudio = () => {
        analyzer.getByteFrequencyData(dataArray);
        const volume = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setIsTalking(volume > 10);
        requestAnimationFrame(detectAudio);
      };
      detectAudio();
    } catch (e) {
      console.log("No audio track available for detection yet");
    }

    return () => {
      audioContext.close();
    };
  }, [stream, participantName]);

  return (
    <div
      className={`relative aspect-video bg-[#1C1F2E] rounded-2xl overflow-hidden border-2 transition-all duration-300 ${
        isTalking
          ? "border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
          : "border-white/5"
      }`}
    >
      {/* HIDDEN AUDIO ELEMENT for remote participants */}
      {!isLocal && (
        <audio ref={audioRef} autoPlay playsInline className="hidden" />
      )}

      {/* VIDEO ELEMENT (Shows if hasVideo is true) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover transition-opacity duration-500 ${
          hasVideo ? "opacity-100" : "opacity-0 absolute"
        } ${isLocal ? "scale-x-[-1]" : ""}`}
      />

      {/* AUDIO AVATAR (Shows if hasVideo is false) */}
      {!hasVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <div className="relative">
            {isTalking && (
              <div className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-20" />
            )}
            {participantImage ? (
              <img
                src={participantImage}
                alt={participantName}
                className="w-20 h-20 rounded-full object-cover border border-white/10 relative z-10"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-dark-3 flex items-center justify-center text-2xl font-bold border border-white/10 relative z-10">
                {participantName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <p className="text-gray-500 text-xs font-medium uppercase tracking-widest">
            Audio Only
          </p>
        </div>
      )}

      {/* BOTTOM INFO BAR */}
      <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center">
        <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 flex items-center gap-2">
          {isTalking ? (
            <Mic size={14} className="text-blue-400" />
          ) : (
            <MicOff size={14} className="text-gray-400" />
          )}
          <span className="text-xs font-medium">
            {participantName} {isLocal ? "(You)" : ""}
          </span>
          {isHost && <span className="text-yellow-400 text-xs">👑</span>}
        </div>

        {!hasVideo && (
          <div className="p-1.5 bg-red-500/20 rounded-md border border-red-500/50">
            <VideoOff size={14} className="text-red-500" />
          </div>
        )}
      </div>
    </div>
  );
};

export default MediasoupTile;
