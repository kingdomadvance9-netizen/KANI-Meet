'use client';

import { useEffect, useState, useRef } from 'react';
import { Button } from './ui/button';

const MeetingSetup = ({
  setIsSetupComplete,
}: {
  setIsSetupComplete: (value: boolean) => void;
}) => {
  const [isMicCamToggled, setIsMicCamToggled] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 🎥 Handle local camera preview
  useEffect(() => {
    const startPreview = async () => {
      try {
        // Stop any existing stream before starting a new one
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }

        if (!isMicCamToggled) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } else {
          streamRef.current = null;
          if (videoRef.current) {
            videoRef.current.srcObject = null;
          }
        }
      } catch (err) {
        console.error("Error accessing media devices:", err);
      }
    };

    startPreview();

    // Cleanup: Stop the camera when leaving the setup screen
    return () => {
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, [isMicCamToggled]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-3 text-white">
      <h1 className="text-center text-2xl font-bold text-white">Setup</h1>
      
      {/* 🖼️ Replacement for Stream's VideoPreview */}
      <div className="relative w-full max-w-[640px] aspect-video bg-dark-1 rounded-xl overflow-hidden border border-white/10">
        {!isMicCamToggled ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover mirror"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            Camera is off
          </div>
        )}
      </div>

      <div className="flex h-16 items-center justify-center gap-3">
        <label className="flex items-center justify-center gap-2 font-medium cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4 accent-red-2"
            checked={isMicCamToggled}
            onChange={(e) => setIsMicCamToggled(e.target.checked)}
          />
          Join with audio/video off (mediasoup enabled)
        </label>
      </div>

      <Button
        className="rounded-md bg-red-2 px-4 py-2.5 hover:bg-red-3 transition-colors"
        onClick={() => {
          // 🚀 Phase 4/5 Logic: Stop preview tracks so useMediasoup can take over
          streamRef.current?.getTracks().forEach(track => track.stop());
          setIsSetupComplete(true);
        }}
      >
        Join meeting
      </Button>
    </div>
  );
};

export default MeetingSetup;