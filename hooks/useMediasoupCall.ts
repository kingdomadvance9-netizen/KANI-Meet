"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useMediasoupContext } from "@/providers/MediasoupProvider";
import { types } from "mediasoup-client";

type Transport = types.Transport;

export const useMediasoupCall = (roomId: string) => {
  const { socket, device, isInitialized } = useMediasoupContext();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  
  // Note: remoteStreams is managed by the Provider, but we can access it here if needed
  const { remoteStreams } = useMediasoupContext();

  const sendTransport = useRef<Transport | null>(null);
  const recvTransport = useRef<Transport | null>(null);

  /* --- 1. CREATE TRANSPORT (Modified to return a Promise) --- */
  const createTransport = useCallback(async (direction: 'send' | 'recv'): Promise<Transport | null> => {
    if (!socket || !device) return null;

    return new Promise((resolve) => {
      socket.emit("createWebRtcTransport", { direction }, async (params: any) => {
        if (params.error) {
          console.error("Transport error:", params.error);
          resolve(null);
          return;
        }

        const transport = direction === 'send' 
          ? device.createSendTransport(params) 
          : device.createRecvTransport(params);

        transport.on("connect", ({ dtlsParameters }, callback, errback) => {
          socket.emit("connectWebRtcTransport", { transportId: transport.id, dtlsParameters }, (response: any) => {
            if (response.error) return errback(response.error);
            callback();
          });
        });

        if (direction === 'send') {
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
        
        resolve(transport);
      });
    });
  }, [socket, device]);

  /* --- 2. START PRODUCING (Awaiting the transport correctly) --- */
  const startProducing = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);

      // ✅ Wait for transport to be fully created before proceeding
      let transport = sendTransport.current;
      if (!transport) {
        transport = await createTransport('send');
      }

      if (!transport) throw new Error("Failed to create send transport");

      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];

      if (videoTrack) await transport.produce({ track: videoTrack });
      if (audioTrack) await transport.produce({ track: audioTrack });
      
      console.log("✅ Successfully producing local media");
    } catch (err) {
      console.error("Error producing media:", err);
    }
  }, [createTransport]);

  useEffect(() => {
    if (isInitialized && socket) {
      socket.emit("joinRoom", { roomId });
      createTransport('recv'); 
    }
  }, [isInitialized, socket, roomId, createTransport]);

  return {
    localStream,
    remoteStreams, // Coming from context
    startProducing,
    isReady: isInitialized
  };
};