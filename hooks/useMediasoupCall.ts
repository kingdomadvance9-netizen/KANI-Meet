"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useMediasoupContext } from "@/providers/MediasoupProvider";
// ✅ Correct type imports for Mediasoup Client
import { Device, types } from "mediasoup-client";

// Use the internal types namespace for cleaner code
type Transport = types.Transport;
type Producer = types.Producer;
type Consumer = types.Consumer;


export const useMediasoupCall = (roomId: string) => {
    
  const { socket, device, isInitialized } = useMediasoupContext();
  
  // Local Media State
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());

  // We use Refs for Transports to avoid re-renders during the connection handshake
  const sendTransport = useRef<Transport | null>(null);
  const recvTransport = useRef<Transport | null>(null);

  /* -----------------------------------------------------------
     1. CREATE TRANSPORT (The Bridge)
  ----------------------------------------------------------- */
  const createTransport = useCallback(async (direction: 'send' | 'recv') => {
    if (!socket || !device) return;

    // Ask server to create a WebRtcTransport
    socket.emit("createWebRtcTransport", { direction }, async (params: any) => {
      if (params.error) {
        console.error("Transport creation error:", params.error);
        return;
      }

      // Create the transport on the client side
      const transport = direction === 'send' 
        ? device.createSendTransport(params) 
        : device.createRecvTransport(params);

      // --- CRITICAL HANDSHAKE 1: Connect ---
      transport.on("connect", ({ dtlsParameters }, callback, errback) => {
        socket.emit("connectWebRtcTransport", { transportId: transport.id, dtlsParameters }, (response: any) => {
          if (response.error) return errback(response.error);
          callback();
        });
      });

      if (direction === 'send') {
        // --- CRITICAL HANDSHAKE 2: Produce (Send Only) ---
        transport.on("produce", ({ kind, rtpParameters, appData }, callback, errback) => {
          socket.emit("produce", { transportId: transport.id, kind, rtpParameters, appData }, (response: any) => {
            if (response.error) return errback(response.error);
            callback({ id: response.id });
          });
        });
        sendTransport.current = transport;
      } else {
        recvTransport.current = transport;
      }
    });
  }, [socket, device]);

  /* -----------------------------------------------------------
     2. START PRODUCING (Camera/Mic)
  ----------------------------------------------------------- */
  const startProducing = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);

      if (!sendTransport.current) await createTransport('send');

      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];

      if (videoTrack) await sendTransport.current?.produce({ track: videoTrack });
      if (audioTrack) await sendTransport.current?.produce({ track: audioTrack });
      
    } catch (err) {
      console.error("Error accessing media devices:", err);
    }
  }, [createTransport]);

  /* -----------------------------------------------------------
     3. LIFECYCLE
  ----------------------------------------------------------- */
  useEffect(() => {
    if (isInitialized && socket) {
      socket.emit("joinRoom", { roomId });
      createTransport('recv'); // Prepare to receive others
    }
  }, [isInitialized, socket, roomId, createTransport]);

  return {
    localStream,
    remoteStreams,
    startProducing,
    isReady: isInitialized
  };
};