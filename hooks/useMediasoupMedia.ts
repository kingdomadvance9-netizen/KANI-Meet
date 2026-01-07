"use client";

import { useState, useCallback, useRef } from "react";
import { useMediasoupContext } from "@/providers/MediasoupProvider";
import { types } from "mediasoup-client";

export const useMediasoupMedia = () => {
  const { socket, device, isInitialized } = useMediasoupContext();
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const sendTransport = useRef<types.Transport | null>(null);
  // Store producers in a ref to access them without re-renders during setup
  const producersRef = useRef<Map<string, types.Producer>>(new Map());

  const produceTrack = useCallback(async (track: MediaStreamTrack, transport: types.Transport) => {
    // If we are already producing this kind of track, stop the old one
    const existing = producersRef.current.get(track.kind);
    if (existing) {
      existing.close();
      producersRef.current.delete(track.kind);
    }

    const producer = await transport.produce({ track });
    producersRef.current.set(track.kind, producer);

    producer.on("transportclose", () => {
      console.log(`${track.kind} producer transport closed`);
    });

    producer.on("trackended", () => {
      console.log(`${track.kind} track ended`);
    });

    return producer;
  }, []);

  const startMedia = useCallback(async (video = true, audio = true) => {
    if (!isInitialized || !socket || !device) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: video ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false, 
        audio 
      });
      
      setLocalStream(stream);

      const initTransportAndProduce = async () => {
        if (!sendTransport.current) {
          socket.emit("createWebRtcTransport", { direction: "send" }, async (params: any) => {
            if (params.error) return console.error(params.error);

            const transport = device.createSendTransport(params);

            transport.on("connect", ({ dtlsParameters }, callback, errback) => {
              socket.emit("connectWebRtcTransport", { transportId: transport.id, dtlsParameters }, (response: any) => {
                if (response.error) return errback(response.error);
                callback();
              });
            });

            transport.on("produce", ({ kind, rtpParameters, appData }, callback, errback) => {
              socket.emit("produce", { transportId: transport.id, kind, rtpParameters, appData }, (response: any) => {
                if (response.error) return errback(response.error);
                callback({ id: response.id });
              });
            });

            sendTransport.current = transport;
            for (const track of stream.getTracks()) {
              await produceTrack(track, transport);
            }
          });
        } else {
          for (const track of stream.getTracks()) {
            await produceTrack(track, sendTransport.current);
          }
        }
      };

      await initTransportAndProduce();
    } catch (err) {
      console.error("Error accessing media:", err);
    }
  }, [isInitialized, socket, device, produceTrack]);

  // ✅ ADDED: Screen Share Support
  const shareScreen = useCallback(async () => {
    if (!sendTransport.current || !device) return;
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];

      // We produce this as 'video', but we can add appData to tell the UI it's a screen
      const screenProducer = await sendTransport.current.produce({ 
        track: screenTrack,
        appData: { isScreen: true } 
      });

      screenTrack.onended = () => {
        screenProducer.close();
      };
    } catch (err) {
      console.error("Screen share failed:", err);
    }
  }, [device]);

  const stopMedia = () => {
    localStream?.getTracks().forEach(track => track.stop());
    producersRef.current.forEach(p => p.close());
    producersRef.current.clear();
    setLocalStream(null);
  };

  return {
    localStream,
    startMedia,
    stopMedia,
    shareScreen
  };
};