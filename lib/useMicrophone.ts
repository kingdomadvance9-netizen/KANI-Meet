"use client";

export async function getMicTrack() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false, // 🔥 IMPORTANT
      channelCount: 1,       // 🔥 MONO
      sampleRate: 48000,
    },
  });

  return stream.getAudioTracks()[0];
}
