"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

interface Participant {
  id: string;
  name: string;
  imageUrl?: string;
  isVideoPaused?: boolean;
}

interface UseDominantSpeakerProps {
  participants: Participant[];
  remoteStreams: Map<string, MediaStream>;
  localStream?: MediaStream | null;
  localParticipantId?: string;
  /** Minimum volume threshold to consider as speaking (0-255) */
  speakingThreshold?: number;
  /** How long to wait before switching speakers (ms) */
  switchDebounce?: number;
  /** How long a speaker must be silent before losing dominance (ms) */
  silenceTimeout?: number;
}

interface SpeakerInfo {
  participantId: string;
  volume: number;
  lastSpokeAt: number;
}

/**
 * Client-side dominant speaker detection based on audio levels.
 * Uses Web Audio API to analyze audio from all participant streams.
 */
export const useDominantSpeaker = ({
  participants,
  remoteStreams,
  localStream,
  localParticipantId,
  speakingThreshold = 15,
  switchDebounce = 500,
  silenceTimeout = 2000,
}: UseDominantSpeakerProps) => {
  const [dominantSpeakerId, setDominantSpeakerId] = useState<string | null>(null);
  const [speakerVolumes, setSpeakerVolumes] = useState<Map<string, number>>(new Map());

  // Track audio contexts and analyzers for cleanup
  const audioContextsRef = useRef<Map<string, {
    context: AudioContext;
    analyser: AnalyserNode;
    source: MediaStreamAudioSourceNode;
  }>>(new Map());

  // Track speaker info for debouncing
  const speakerInfoRef = useRef<Map<string, SpeakerInfo>>(new Map());
  const lastDominantChangeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  // Get participant by ID
  const getParticipant = useCallback((id: string) => {
    if (id === localParticipantId) {
      return participants.find(p => p.id === localParticipantId) || { id: localParticipantId, name: "You" };
    }
    return participants.find(p => p.id === id);
  }, [participants, localParticipantId]);

  // Get dominant speaker participant object
  const dominantSpeaker = useMemo(() => {
    if (!dominantSpeakerId) return null;
    return getParticipant(dominantSpeakerId) || null;
  }, [dominantSpeakerId, getParticipant]);

  // Setup audio analyzer for a stream
  const setupAnalyzer = useCallback((participantId: string, stream: MediaStream) => {
    // Skip if already set up
    if (audioContextsRef.current.has(participantId)) return;

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;

    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3;

      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextsRef.current.set(participantId, { context, analyser, source });
      speakerInfoRef.current.set(participantId, {
        participantId,
        volume: 0,
        lastSpokeAt: 0,
      });
    } catch (err) {
      console.warn(`Failed to setup audio analyzer for ${participantId}:`, err);
    }
  }, []);

  // Cleanup analyzer for a participant
  const cleanupAnalyzer = useCallback((participantId: string) => {
    const entry = audioContextsRef.current.get(participantId);
    if (entry) {
      try {
        entry.source.disconnect();
        entry.context.close();
      } catch (err) {
        // Ignore cleanup errors
      }
      audioContextsRef.current.delete(participantId);
      speakerInfoRef.current.delete(participantId);
    }
  }, []);

  // Analyze audio levels
  const analyzeAudioLevels = useCallback(() => {
    const now = Date.now();
    const volumes = new Map<string, number>();

    // Use object ref to track loudest speaker (avoids TypeScript narrowing issues with forEach)
    const loudestRef: { speaker: { id: string; volume: number } | null } = { speaker: null };

    audioContextsRef.current.forEach((entry, participantId) => {
      const { analyser } = entry;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);

      // Calculate average volume
      const sum = dataArray.reduce((a, b) => a + b, 0);
      const avgVolume = sum / dataArray.length;

      volumes.set(participantId, avgVolume);

      // Update speaker info
      const info = speakerInfoRef.current.get(participantId);
      if (info) {
        info.volume = avgVolume;
        if (avgVolume > speakingThreshold) {
          info.lastSpokeAt = now;
        }
      }

      // Track loudest speaker
      if (avgVolume > speakingThreshold) {
        if (!loudestRef.speaker || avgVolume > loudestRef.speaker.volume) {
          loudestRef.speaker = { id: participantId, volume: avgVolume };
        }
      }
    });

    setSpeakerVolumes(volumes);

    // Determine dominant speaker with debouncing
    const timeSinceLastChange = now - lastDominantChangeRef.current;
    const loudestSpeaker = loudestRef.speaker;

    if (loudestSpeaker && timeSinceLastChange >= switchDebounce) {
      // Only switch if new speaker is significantly louder or current is silent
      const currentInfo = dominantSpeakerId ? speakerInfoRef.current.get(dominantSpeakerId) : null;
      const shouldSwitch = !dominantSpeakerId ||
        !currentInfo ||
        (now - currentInfo.lastSpokeAt > silenceTimeout) ||
        (loudestSpeaker.volume > (currentInfo.volume * 1.5));

      if (shouldSwitch && loudestSpeaker.id !== dominantSpeakerId) {
        setDominantSpeakerId(loudestSpeaker.id);
        lastDominantChangeRef.current = now;
      }
    } else if (!loudestSpeaker && dominantSpeakerId) {
      // Check if current dominant speaker has been silent too long
      const currentInfo = speakerInfoRef.current.get(dominantSpeakerId);
      if (currentInfo && now - currentInfo.lastSpokeAt > silenceTimeout) {
        // Keep the last dominant speaker even when silent (like Google Meet)
        // Only clear if they leave the meeting
      }
    }

    // Continue animation loop
    animationFrameRef.current = requestAnimationFrame(analyzeAudioLevels);
  }, [dominantSpeakerId, speakingThreshold, switchDebounce, silenceTimeout]);

  // Setup/cleanup analyzers when streams change
  useEffect(() => {
    // Setup analyzers for all remote streams
    remoteStreams.forEach((stream, participantId) => {
      // Skip screen share streams
      if (participantId.includes("-screen")) return;
      setupAnalyzer(participantId, stream);
    });

    // Setup analyzer for local stream (optional - usually muted for self)
    // We skip local stream analysis to avoid feedback issues
    // if (localStream && localParticipantId) {
    //   setupAnalyzer(localParticipantId, localStream);
    // }

    // Cleanup removed streams
    const activeIds = new Set(
      Array.from(remoteStreams.keys()).filter(id => !id.includes("-screen"))
    );
    audioContextsRef.current.forEach((_, id) => {
      if (!activeIds.has(id)) {
        cleanupAnalyzer(id);
      }
    });
  }, [remoteStreams, localStream, localParticipantId, setupAnalyzer, cleanupAnalyzer]);

  // Start/stop audio analysis loop
  useEffect(() => {
    if (audioContextsRef.current.size > 0) {
      animationFrameRef.current = requestAnimationFrame(analyzeAudioLevels);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyzeAudioLevels]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      audioContextsRef.current.forEach((_, id) => cleanupAnalyzer(id));
    };
  }, [cleanupAnalyzer]);

  // Clear dominant speaker if they leave
  useEffect(() => {
    if (dominantSpeakerId && !participants.some(p => p.id === dominantSpeakerId)) {
      // Dominant speaker left, find next best
      let nextDominant: string | null = null;
      let highestVolume = 0;

      speakerInfoRef.current.forEach((info, id) => {
        if (participants.some(p => p.id === id) && info.volume > highestVolume) {
          highestVolume = info.volume;
          nextDominant = id;
        }
      });

      setDominantSpeakerId(nextDominant);
    }
  }, [participants, dominantSpeakerId]);

  return {
    /** ID of the current dominant speaker */
    dominantSpeakerId,
    /** Participant object of the dominant speaker */
    dominantSpeaker,
    /** Map of participant IDs to their current audio volume (0-255) */
    speakerVolumes,
    /** Check if a participant is currently speaking */
    isSpeaking: useCallback((participantId: string) => {
      return (speakerVolumes.get(participantId) || 0) > speakingThreshold;
    }, [speakerVolumes, speakingThreshold]),
    /** Manually set dominant speaker (e.g., from server event) */
    setDominantSpeakerId,
  };
};

export default useDominantSpeaker;
