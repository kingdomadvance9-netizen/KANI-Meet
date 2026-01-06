"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { Device, types } from "mediasoup-client";

interface Participant {
  id: string;
  name: string;
  isAudioMuted: boolean;
  isVideoPaused: boolean;
}

interface MediasoupContextType {
  socket: Socket | null;
  device: Device | null;
  participants: Participant[];
  remoteStreams: Map<string, MediaStream>;
  isInitialized: boolean;
}

const MediasoupContext = createContext<MediasoupContextType | undefined>(undefined);

export const MediasoupProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isInitialized, setIsInitialized] = useState(false);

  const recvTransport = useRef<types.Transport | null>(null);

  useEffect(() => {
    const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:8080", {
        transports: ["websocket"],
    });

    socketInstance.on("connect", async () => {
      try {
        const newDevice = new Device();
        
        socketInstance.emit("getRouterRtpCapabilities", async (rtpCapabilities: any) => {
          if (!newDevice.loaded) {
            await newDevice.load({ routerRtpCapabilities: rtpCapabilities });
          }

          socketInstance.emit("createWebRtcTransport", { direction: "recv" }, async (params: any) => {
            const transport = newDevice.createRecvTransport(params);

            transport.on("connect", ({ dtlsParameters }, callback, errback) => {
              socketInstance.emit("connectWebRtcTransport", { 
                transportId: transport.id, 
                dtlsParameters 
              }, (response: any) => {
                if (response.error) return errback(response.error);
                callback();
              });
            });

            recvTransport.current = transport;
            setDevice(newDevice);
            setSocket(socketInstance);
            setIsInitialized(true);
          });
        });
      } catch (error) {
        console.error("Mediasoup initialization failed:", error);
      }
    });

    socketInstance.on("new-producer", async ({ producerId, peerId, kind }) => {
      if (!recvTransport.current || !device) return;

      socketInstance.emit("consume", {
        producerId,
        rtpCapabilities: device.rtpCapabilities,
      }, async ({ params }: any) => {
        if (params.error) return console.error("Consume error:", params.error);

        const consumer = await recvTransport.current!.consume(params);
        socketInstance.emit("consumer-resume", { consumerId: consumer.id });

        const { track } = consumer;
        
        setRemoteStreams((prev) => {
          const newMap = new Map(prev);
          const existingStream = newMap.get(peerId) || new MediaStream();
          existingStream.addTrack(track);
          newMap.set(peerId, existingStream);
          return newMap;
        });
      });
    });

    socketInstance.on("participant-list-update", (updatedList: Participant[]) => {
      setParticipants(updatedList);
    });

    socketInstance.on("participant-left", ({ peerId }) => {
      setParticipants((prev) => prev.filter((p) => p.id !== peerId));
      setRemoteStreams((prev) => {
        const newMap = new Map(prev);
        newMap.delete(peerId);
        return newMap;
      });
    });

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // ✅ Removed the Loader from here so the Provider doesn't block children
  return (
    <MediasoupContext.Provider value={{ socket, device, participants, remoteStreams, isInitialized }}>
      {children}
    </MediasoupContext.Provider>
  );
};

export const useMediasoupContext = () => {
  const context = useContext(MediasoupContext);
  if (!context) throw new Error("useMediasoupContext must be used within MediasoupProvider");
  return context;
};