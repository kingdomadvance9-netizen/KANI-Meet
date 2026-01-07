"use client";

import { createContext, useContext, useRef, useState, useEffect } from "react";
import type { Socket } from "socket.io-client";
import { getSocket } from "@/lib/socket";
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
  const peerIdToUserIdRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    // Use the shared socket instance
    const socketInstance = getSocket();

    // Set up event listeners
    const handleConnect = () => {
      console.log("✅ Mediasoup socket connected:", socketInstance.id);
      setSocket(socketInstance);
    };

    const handleReconnect = () => {
      console.log("🔄 Mediasoup socket reconnected:", socketInstance.id);
    };

    const handleDisconnect = () => {
      console.log("❌ Mediasoup socket disconnected");
    };

    // If already connected, trigger handler immediately
    if (socketInstance.connected) {
      handleConnect();
    }

    socketInstance.on("connect", handleConnect);
    socketInstance.on("reconnect", handleReconnect);
    socketInstance.on("disconnect", handleDisconnect);

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

        // WORKAROUND: Correlate unmapped streams with new participants
        // When a new participant appears and we have streams keyed by socket IDs,
        // try to remap them to user IDs
        setParticipants((prevParticipants) => {
          const newParticipantIds = updatedList
            .map((p) => p.id)
            .filter((id) => !prevParticipants.find((prev) => prev.id === id));

          if (newParticipantIds.length > 0) {
            console.log("🆕 New participants detected:", newParticipantIds);

            // Check if we have any unmapped streams (keyed by socket IDs)
            setRemoteStreams((prevStreams) => {
              const newStreamsMap = new Map(prevStreams);
              const socketIdKeys = Array.from(prevStreams.keys()).filter(
                (key) => !key.startsWith("user_")
              );

              console.log(
                "🔍 Checking for unmapped socket ID streams:",
                socketIdKeys
              );

              // If we have unmapped streams and new participants, correlate them
              if (
                socketIdKeys.length > 0 &&
                newParticipantIds.length === socketIdKeys.length
              ) {
                socketIdKeys.forEach((socketId, index) => {
                  const userId = newParticipantIds[index];
                  const stream = prevStreams.get(socketId);
                  if (stream && userId) {
                    // Move stream from socket ID key to user ID key
                    newStreamsMap.set(userId, stream);
                    newStreamsMap.delete(socketId);
                    peerIdToUserIdRef.current.set(socketId, userId);
                    console.log("🔄 Remapped stream:", socketId, "→", userId);
                  }
                });
              }

              return newStreamsMap;
            });
          }

          return updatedList;
        });

        // Also try to request socket-to-user mapping (if server supports it)
        updatedList.forEach((participant) => {
          socketInstance.emit(
            "get-socket-id-for-user",
            { userId: participant.id },
            (response: any) => {
              if (response && response.socketId) {
                peerIdToUserIdRef.current.set(
                  response.socketId,
                  participant.id
                );
                console.log(
                  "🔗 Mapped socket to user (from server):",
                  response.socketId,
                  "→",
                  participant.id
                );

                // Also remap the stream if it exists
                setRemoteStreams((prev) => {
                  const newMap = new Map(prev);
                  const stream = prev.get(response.socketId);
                  if (stream) {
                    newMap.set(participant.id, stream);
                    newMap.delete(response.socketId);
                    console.log(
                      "🔄 Remapped stream via server response:",
                      response.socketId,
                      "→",
                      participant.id
                    );
                  }
                  return newMap;
                });
              }
            }
          );
        });
      }
    );

    // Map socket.id to userId when we join
    socketInstance.on(
      "socket-user-mapping",
      ({ socketId, userId }: { socketId: string; userId: string }) => {
        console.log("🔗 Mapping socket to user:", socketId, "→", userId);
        peerIdToUserIdRef.current.set(socketId, userId);
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
      // Clean up event listeners but don't disconnect the shared socket
      // as it may be used by other components (e.g., chat)
      socketInstance.off("connect", handleConnect);
      socketInstance.off("reconnect", handleReconnect);
      socketInstance.off("disconnect", handleDisconnect);
      socketInstance.off("participant-list-update");
      socketInstance.off("participant-left");
      socketInstance.off("force-mute");
      socketInstance.off("force-video-pause");
      socketInstance.off("kicked-from-room");
      socketInstance.off("new-producer");
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
      console.log("📝 Producer details:", {
        isArray: Array.isArray(existingProducers),
        length: existingProducers?.length,
        items: existingProducers,
        firstItem: existingProducers?.[0],
        firstItemType: typeof existingProducers?.[0],
      });

      // Step 4: Create Send Transport
      await createSendTransport(socket, newDevice, roomId);

      // Step 5: Create Receive Transport
      await createRecvTransport(socket, newDevice, roomId);

      // Step 6: Consume Existing Producers
      if (existingProducers && existingProducers.length > 0) {
        console.log("🔄 Starting to consume existing producers...");
        for (const item of existingProducers) {
          // Handle both string IDs and objects
          const producerId =
            typeof item === "string" ? item : item?.id || item?.producerId;

          if (producerId) {
            console.log("➡️ Consuming producer:", producerId);
            await consumeProducer(socket, newDevice, roomId, producerId);
          } else {
            console.error("❌ Invalid producer item:", item);
          }
        }
      } else {
        console.log("ℹ️ No existing producers to consume");
      }

      // Step 7: Listen for New Producers
      socket.on(
        "new-producer",
        async ({
          producerId,
          peerId,
          kind,
          userId: producerUserId,
        }: {
          producerId: string;
          peerId?: string;
          kind?: string;
          userId?: string;
        }) => {
          console.log("🆕 New producer detected:", {
            producerId,
            peerId,
            kind,
            userId: producerUserId,
            from: peerId || "unknown",
          });

          // Map peerId to userId if provided
          if (peerId && producerUserId) {
            peerIdToUserIdRef.current.set(peerId, producerUserId);
            console.log(
              "🔗 Mapped producer peer to user:",
              peerId,
              "→",
              producerUserId
            );
          }

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

    transport.on(
      "produce",
      ({ kind, rtpParameters, appData }, callback, errback) => {
        console.log(`📤 Producing ${kind} for transport:`, transport.id);
        socket.emit(
          "produce",
          { roomId, transportId: transport.id, kind, rtpParameters, appData },
          (response: any) => {
            if (response.error) {
              console.error("❌ Produce error:", response.error);
              return errback(response.error);
            }
            console.log(
              `✅ Producer created with ID:`,
              response.id,
              "for",
              kind
            );
            callback({ id: response.id });
          }
        );
      }
    );

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
    console.log("🔍 Attempting to consume producer:", producerId);

    const data = await new Promise<any>((resolve, reject) => {
      socket.emit(
        "consume",
        { roomId, producerId, rtpCapabilities: device.rtpCapabilities },
        (response: any) => {
          if (response.error) {
            console.error("❌ Consume error:", response.error);
            reject(response.error);
          } else {
            console.log("✅ Consume response:", response);
            console.log("📊 Response keys:", Object.keys(response));
            console.log(
              "📊 Response details:",
              JSON.stringify(response, null, 2)
            );
            resolve(response);
          }
        }
      );
    });

    if (!recvTransportRef.current) {
      console.error("❌ No receive transport available");
      return;
    }

    const consumer = await recvTransportRef.current.consume({
      id: data.id,
      producerId: data.producerId,
      kind: data.kind,
      rtpParameters: data.rtpParameters,
    });

    console.log("📦 Consumer created:", {
      id: consumer.id,
      kind: consumer.kind,
      producerId: consumer.producerId,
    });

    socket.emit("resume-consumer", { roomId, consumerId: consumer.id });

    const { track } = consumer;

    // Extract user/peer identification from response
    // Priority: data.userId (if server sends it) > mapped userId from socketId > socketId as fallback
    const socketPeerId =
      data.peerId || data.producerSocketId || data.from || producerId;
    let userId = data.userId || data.producerUserId;

    if (!userId) {
      // Try to get userId from our mapping
      userId = peerIdToUserIdRef.current.get(socketPeerId);
    }

    if (!userId) {
      // Fallback: use socketPeerId as key (will be updated when we get participant list)
      userId = socketPeerId;
      console.log(
        "⚠️ No userId mapping found, using socketPeerId as temporary key"
      );
    }

    console.log(
      `🎬 Consuming ${data.kind} from:`,
      "socketPeerId:",
      socketPeerId,
      "→ userId:",
      userId,
      "(track id:",
      track.id,
      ")"
    );

    setRemoteStreams((prev) => {
      const newMap = new Map(prev);
      const existingStream = newMap.get(userId) || new MediaStream();

      // Check if track already exists to avoid duplicates
      const existingTrack = existingStream
        .getTracks()
        .find((t) => t.id === track.id);
      if (!existingTrack) {
        existingStream.addTrack(track);
        console.log(
          `✅ Added ${data.kind} track to stream for userId:`,
          userId
        );
      } else {
        console.log(`⚠️ Track already exists in stream for userId:`, userId);
      }

      newMap.set(userId, existingStream);
      return newMap;
    });
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
