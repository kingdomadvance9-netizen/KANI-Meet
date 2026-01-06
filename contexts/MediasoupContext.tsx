"use client";

import { createContext, useContext, useRef, useState, useEffect } from "react";
import type { Socket } from "socket.io-client";
import { io } from "socket.io-client";
import { Device, types } from "mediasoup-client";

interface Participant {
  id: string;
  name: string;
  imageUrl?: string;
  isAudioMuted: boolean;
  isVideoPaused: boolean;
  isHost: boolean;
}

type MediasoupContextType = {
  socket: Socket | null;
  device: Device | null;
  participants: Participant[];
  remoteStreams: Map<string, MediaStream>;
  localStream: MediaStream | null;
  isInitialized: boolean;
  muteAudio: () => void;
  unmuteAudio: () => void;
  toggleAudio: () => void;
  isAudioMuted: boolean;
  enableVideo: () => Promise<void>;
  disableVideo: () => void;
  toggleVideo: () => Promise<void>;
  isVideoEnabled: boolean;
  enableScreenShare: () => Promise<void>;
  disableScreenShare: () => void;
  isScreenSharing: boolean;
  isHost: boolean;
  makeHost: (participantId: string) => void;
  removeHost: (participantId: string) => void;
  joinRoom: (
    roomId: string,
    userId: string,
    userName?: string,
    userImageUrl?: string,
    isCreator?: boolean
  ) => Promise<void>;
};

const MediasoupContext = createContext<MediasoupContextType | null>(null);

export const MediasoupProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  // Socket & Device
  const [socket, setSocket] = useState<Socket | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Participants & Streams
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(
    new Map()
  );
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  // Media States
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHost, setIsHost] = useState(false);

  // Refs for Transports and Producers
  const sendTransportRef = useRef<types.Transport | null>(null);
  const recvTransportRef = useRef<types.Transport | null>(null);
  const audioProducerRef = useRef<types.Producer | null>(null);
  const videoProducerRef = useRef<types.Producer | null>(null);
  const screenProducerRef = useRef<types.Producer | null>(null);
  const currentRoomIdRef = useRef<string | null>(null);
  const hasJoinedRef = useRef<boolean>(false);

  useEffect(() => {
    const socketInstance = io(
      process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:8080",
      {
        transports: ["websocket"],
        autoConnect: true,
      }
    );

    socketInstance.on("connect", () => {
      console.log("✅ Socket connected:", socketInstance.id);
      setSocket(socketInstance);
    });

    socketInstance.on("disconnect", () => {
      console.log("❌ Socket disconnected");
    });

    socketInstance.on(
      "participant-list-update",
      (updatedList: Participant[]) => {
        console.log("👥 Participants updated:", updatedList);
        console.log("📝 Participant details:");
        updatedList.forEach((p) => {
          console.log(
            `  - ID: ${p.id}, Name: ${p.name}, Image: ${
              p.imageUrl || "none"
            }, Host: ${p.isHost}`
          );
        });

        setParticipants(updatedList);
      }
    );

    socketInstance.on("participant-left", ({ peerId }: { peerId: string }) => {
      console.log("👋 Participant left:", peerId);
      setParticipants((prev) => prev.filter((p) => p.id !== peerId));
      setRemoteStreams((prev) => {
        const newMap = new Map(prev);
        newMap.delete(peerId);
        return newMap;
      });
    });

    // ✅ Force control events from host
    socketInstance.on(
      "force-mute",
      ({ audio, by }: { audio: boolean; by: string }) => {
        if (audio) {
          // Mute audio
          if (audioProducerRef.current) {
            const track = audioProducerRef.current.track;
            track?.stop();
            audioProducerRef.current.close();
            audioProducerRef.current = null;
            setIsAudioMuted(true);

            setLocalStream((prev) => {
              if (!prev) return null;
              const newStream = new MediaStream(prev.getVideoTracks());
              return newStream.getTracks().length > 0 ? newStream : null;
            });
          }
          console.warn(`🔇 Your microphone was muted by ${by}`);
        }
      }
    );

    socketInstance.on(
      "force-video-pause",
      ({ video, by }: { video: boolean; by: string }) => {
        if (video) {
          // Pause video
          if (videoProducerRef.current) {
            const track = videoProducerRef.current.track;
            track?.stop();
            videoProducerRef.current.close();
            videoProducerRef.current = null;
            setIsVideoEnabled(false);

            setLocalStream((prev) => {
              if (!prev) return null;
              const newStream = new MediaStream(prev.getAudioTracks());
              return newStream.getTracks().length > 0 ? newStream : null;
            });
          }
          console.warn(`📹 Your camera was turned off by ${by}`);
        }
      }
    );

    socketInstance.on(
      "kicked-from-room",
      ({ by, reason }: { by: string; reason: string }) => {
        console.error(`❌ Removed from room by ${by}: ${reason}`);

        // Clean up all media
        if (audioProducerRef.current) {
          audioProducerRef.current.track?.stop();
          audioProducerRef.current.close();
        }
        if (videoProducerRef.current) {
          videoProducerRef.current.track?.stop();
          videoProducerRef.current.close();
        }
        if (screenProducerRef.current) {
          screenProducerRef.current.track?.stop();
          screenProducerRef.current.close();
        }

        // Redirect after a delay
        setTimeout(() => {
          if (typeof window !== "undefined") {
            window.location.href = "/";
          }
        }, 2000);
      }
    );

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Join Room and Initialize Mediasoup
  const joinRoom = async (
    roomId: string,
    userId: string,
    userName?: string,
    userImageUrl?: string,
    isCreator: boolean = false
  ) => {
    if (!socket || isInitialized) {
      console.log("⚠️ Cannot join: socket or already initialized");
      return;
    }

    // Prevent duplicate joins
    if (hasJoinedRef.current) {
      console.log("⚠️ Already joined room - ignoring duplicate call");
      return;
    }

    hasJoinedRef.current = true;
    currentRoomIdRef.current = roomId;
    setIsHost(isCreator);

    // Map socket to Clerk user ID for persistent identification
    socket.emit("set-user-id", userId);
    console.log("✅ Socket mapped to user:", userId);

    console.log(
      "🚪 Joining room:",
      roomId,
      "as",
      userName,
      isCreator ? "(Host)" : ""
    );

    try {
      // Step 1: Get Router RTP Capabilities
      const rtpCapabilities = await new Promise<any>((resolve, reject) => {
        socket.emit("get-rtp-capabilities", { roomId }, (response: any) => {
          if (response.error) {
            reject(response.error);
          } else {
            resolve(response.rtpCapabilities);
          }
        });
      });

      // Step 2: Load Device
      const newDevice = new Device();
      await newDevice.load({ routerRtpCapabilities: rtpCapabilities });
      setDevice(newDevice);
      console.log("📱 Device loaded");

      // Step 3: Join Mediasoup Room
      console.log("📤 Sending join request with:", {
        roomId,
        userId,
        userName,
        userImageUrl: userImageUrl ? "provided" : "missing",
        isCreator,
      });
      const { existingProducers } = await new Promise<any>(
        (resolve, reject) => {
          socket.emit(
            "join-mediasoup-room",
            {
              roomId,
              rtpCapabilities: newDevice.rtpCapabilities,
              userId,
              userName,
              userImageUrl,
              isCreator,
            },
            (response: any) => {
              if (response.error) {
                reject(response.error);
              } else {
                resolve(response);
              }
            }
          );
        }
      );
      console.log(
        "🎉 Joined mediasoup room, existing producers:",
        existingProducers
      );

      // Step 4: Create Send Transport
      await createSendTransport(socket, newDevice, roomId);

      // Step 5: Create Receive Transport
      await createRecvTransport(socket, newDevice, roomId);

      // Step 6: Consume Existing Producers
      if (existingProducers && existingProducers.length > 0) {
        for (const producerId of existingProducers) {
          await consumeProducer(socket, newDevice, roomId, producerId);
        }
      }

      // Step 7: Listen for New Producers
      socket.on(
        "new-producer",
        async ({ producerId }: { producerId: string }) => {
          console.log("🆕 New producer detected:", producerId);
          await consumeProducer(socket, newDevice, roomId, producerId);
        }
      );

      setIsInitialized(true);

      // Step 8: Start producing audio immediately
      await startAudio();
    } catch (error) {
      console.error("❌ Failed to join room:", error);
    }
  };

  // Create Send Transport
  const createSendTransport = async (
    socket: Socket,
    device: Device,
    roomId: string
  ) => {
    const params = await new Promise<any>((resolve, reject) => {
      socket.emit(
        "create-webrtc-transport",
        { roomId, direction: "send" },
        (response: any) => {
          if (response.error) {
            reject(response.error);
          } else {
            resolve(response.params);
          }
        }
      );
    });

    const transport = device.createSendTransport(params);

    transport.on("connect", ({ dtlsParameters }, callback, errback) => {
      socket.emit(
        "connect-transport",
        { roomId, transportId: transport.id, dtlsParameters },
        (response: any) => {
          if (response.error) return errback(response.error);
          callback();
        }
      );
    });

    transport.on("produce", ({ kind, rtpParameters }, callback, errback) => {
      socket.emit(
        "produce",
        { roomId, transportId: transport.id, kind, rtpParameters },
        (response: any) => {
          if (response.error) return errback(response.error);
          callback({ id: response.id });
        }
      );
    });

    sendTransportRef.current = transport;
    console.log("🚚 Send transport created");
  };

  // Create Receive Transport
  const createRecvTransport = async (
    socket: Socket,
    device: Device,
    roomId: string
  ) => {
    const params = await new Promise<any>((resolve, reject) => {
      socket.emit(
        "create-webrtc-transport",
        { roomId, direction: "recv" },
        (response: any) => {
          if (response.error) {
            reject(response.error);
          } else {
            resolve(response.params);
          }
        }
      );
    });

    const transport = device.createRecvTransport(params);

    transport.on("connect", ({ dtlsParameters }, callback, errback) => {
      socket.emit(
        "connect-transport",
        { roomId, transportId: transport.id, dtlsParameters },
        (response: any) => {
          if (response.error) return errback(response.error);
          callback();
        }
      );
    });

    recvTransportRef.current = transport;
    console.log("📥 Receive transport created");
  };

  // Consume a Producer
  const consumeProducer = async (
    socket: Socket,
    device: Device,
    roomId: string,
    producerId: string
  ) => {
    const data = await new Promise<any>((resolve, reject) => {
      socket.emit(
        "consume",
        { roomId, producerId, rtpCapabilities: device.rtpCapabilities },
        (response: any) => {
          if (response.error) {
            reject(response.error);
          } else {
            resolve(response);
          }
        }
      );
    });

    if (!recvTransportRef.current) return;

    const consumer = await recvTransportRef.current.consume({
      id: data.id,
      producerId: data.producerId,
      kind: data.kind,
      rtpParameters: data.rtpParameters,
    });

    socket.emit("resume-consumer", { roomId, consumerId: consumer.id });

    const { track } = consumer;
    const peerId = data.peerId || data.producerId; // Adjust based on your server response

    setRemoteStreams((prev) => {
      const newMap = new Map(prev);
      const existingStream = newMap.get(peerId) || new MediaStream();
      existingStream.addTrack(track);
      newMap.set(peerId, existingStream);
      return newMap;
    });

    console.log(`🎬 Consuming ${data.kind} from peer:`, peerId);
  };

  // Start Audio
  const startAudio = async () => {
    if (!sendTransportRef.current || audioProducerRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioTrack = stream.getAudioTracks()[0];

      const producer = await sendTransportRef.current.produce({
        track: audioTrack,
        codecOptions: { opusStereo: false, opusDtx: true },
      });

      audioProducerRef.current = producer;

      // Update local stream
      setLocalStream((prev) => {
        const newStream = prev
          ? new MediaStream([...prev.getTracks(), audioTrack])
          : new MediaStream([audioTrack]);
        return newStream;
      });

      console.log("🎤 Audio producer created");
    } catch (error) {
      console.error("❌ Failed to start audio:", error);
    }
  };

  // Audio Controls
  const muteAudio = () => {
    if (audioProducerRef.current && !audioProducerRef.current.paused) {
      audioProducerRef.current.pause();
      setIsAudioMuted(true);
      console.log("🔇 Audio muted");
    }
  };

  const unmuteAudio = () => {
    if (audioProducerRef.current && audioProducerRef.current.paused) {
      audioProducerRef.current.resume();
      setIsAudioMuted(false);
      console.log("🔊 Audio unmuted");
    }
  };

  const toggleAudio = () => {
    if (isAudioMuted) {
      unmuteAudio();
    } else {
      muteAudio();
    }
  };

  // Video Controls
  const enableVideo = async () => {
    if (!sendTransportRef.current || videoProducerRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
      });
      const videoTrack = stream.getVideoTracks()[0];

      const producer = await sendTransportRef.current.produce({
        track: videoTrack,
      });
      videoProducerRef.current = producer;

      // Update local stream
      setLocalStream((prev) => {
        const newStream = prev
          ? new MediaStream([...prev.getTracks(), videoTrack])
          : new MediaStream([videoTrack]);
        return newStream;
      });

      setIsVideoEnabled(true);
      console.log("📹 Video producer created");
    } catch (error) {
      console.error("❌ Failed to enable video:", error);
    }
  };

  const disableVideo = () => {
    if (videoProducerRef.current) {
      const track = videoProducerRef.current.track;
      track?.stop();
      videoProducerRef.current.close();
      videoProducerRef.current = null;

      // Update local stream
      setLocalStream((prev) => {
        if (!prev) return null;
        const newStream = new MediaStream(prev.getAudioTracks());
        return newStream.getTracks().length > 0 ? newStream : null;
      });

      setIsVideoEnabled(false);
      console.log("📹 Video disabled");
    }
  };

  const toggleVideo = async () => {
    if (isVideoEnabled) {
      disableVideo();
    } else {
      await enableVideo();
    }
  };

  // Screen Share Controls
  const enableScreenShare = async () => {
    if (!sendTransportRef.current || screenProducerRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "monitor",
        },
        audio: false,
      });
      const screenTrack = stream.getVideoTracks()[0];

      // Handle user clicking "Stop sharing" in browser UI
      screenTrack.onended = () => {
        disableScreenShare();
      };

      const producer = await sendTransportRef.current.produce({
        track: screenTrack,
        appData: { share: true }, // Mark as screen share
      });
      screenProducerRef.current = producer;

      setIsScreenSharing(true);
      console.log("🖥️ Screen share producer created");
    } catch (error) {
      console.error("❌ Failed to enable screen share:", error);
    }
  };

  const disableScreenShare = () => {
    if (screenProducerRef.current) {
      const track = screenProducerRef.current.track;
      track?.stop();
      screenProducerRef.current.close();
      screenProducerRef.current = null;

      setIsScreenSharing(false);
      console.log("🖥️ Screen share disabled");
    }
  };

  // Host Management
  const makeHost = (participantId: string) => {
    if (!socket || !isHost) {
      console.warn(
        "⚠️ Cannot make host: not authorized or socket not connected"
      );
      return;
    }
    console.log("👑 Making participant host:", participantId);
    socket.emit("make-host", {
      roomId: currentRoomIdRef.current,
      participantId,
    });
  };

  const removeHost = (participantId: string) => {
    if (!socket || !isHost) {
      console.warn(
        "⚠️ Cannot remove host: not authorized or socket not connected"
      );
      return;
    }
    console.log("👤 Removing host status:", participantId);
    socket.emit("remove-host", {
      roomId: currentRoomIdRef.current,
      participantId,
    });
  };

  return (
    <MediasoupContext.Provider
      value={{
        socket,
        device,
        participants,
        remoteStreams,
        localStream,
        isInitialized,
        muteAudio,
        unmuteAudio,
        toggleAudio,
        isAudioMuted,
        enableVideo,
        disableVideo,
        toggleVideo,
        isVideoEnabled,
        enableScreenShare,
        disableScreenShare,
        isScreenSharing,
        isHost,
        makeHost,
        removeHost,
        joinRoom,
      }}
    >
      {children}
    </MediasoupContext.Provider>
  );
};

export const useMediasoupContext = () => {
  const context = useContext(MediasoupContext);
  if (!context) {
    throw new Error(
      "useMediasoupContext must be used within MediasoupProvider"
    );
  }
  return context;
};
