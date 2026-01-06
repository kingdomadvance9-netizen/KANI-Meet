"use client";

import { useState, useCallback, useRef } from "react";
import { useMediasoupContext } from "@/providers/MediasoupProvider";
import { types } from "mediasoup-client";

export const useMediasoupMedia = () => {
  const { socket, device, isInitialized } = useMediasoupContext();
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const sendTransport = useRef<types.Transport | null>(null);
  const [producers, setProducers] = useState<Map<string, types.Producer>>(new Map());

    // Helper to turn MediaStreamTracks into Mediasoup Producers
  const produceTracks = async (stream: MediaStream, transport: types.Transport) => {
    const tracks = stream.getTracks();
    for (const track of tracks) {
      const producer = await transport.produce({ track });
      setProducers((prev) => new Map(prev).set(track.kind, producer));
    }
  };

  const startMedia = useCallback(async (video = true, audio = true) => {
    if (!isInitialized || !socket || !device) return;

    try {
      // 1. Get Browser Media
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: video ? { width: 1280, height: 720 } : false, 
        audio 
      });
      setLocalStream(stream);

      // 2. Create Send Transport (if not already created)
      if (!sendTransport.current) {
        socket.emit("createWebRtcTransport", { direction: "send" }, async (params: any) => {
          if (params.error) return console.error(params.error);

          const transport = device.createSendTransport(params);

          // Handshake: Connect
          transport.on("connect", ({ dtlsParameters }, callback, errback) => {
            socket.emit("connectWebRtcTransport", { 
              transportId: transport.id, 
              dtlsParameters 
            }, (response: any) => {
              if (response.error) return errback(response.error);
              callback();
            });
          });

          // Handshake: Produce
          transport.on("produce", ({ kind, rtpParameters, appData }, callback, errback) => {
            socket.emit("produce", { 
              transportId: transport.id, 
              kind, 
              rtpParameters, 
              appData 
            }, (response: any) => {
              if (response.error) return errback(response.error);
              callback({ id: response.id });
            });
          });

          sendTransport.current = transport;
          await produceTracks(stream, transport);
        });
      } else {
        await produceTracks(stream, sendTransport.current);
      }
    } catch (err) {
      console.error("Error accessing media:", err);
    }
  }, [isInitialized, socket, device]);



  const stopMedia = () => {
    localStream?.getTracks().forEach(track => track.stop());
    setLocalStream(null);
  };

  return {
    localStream,
    startMedia,
    stopMedia,
    producers
  };
};