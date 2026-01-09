"use client";

import { createContext, useContext, useRef, useState, useEffect } from "react";
import type { Socket } from "socket.io-client";
import { getSocket } from "@/lib/socket";
import { Device, types } from "mediasoup-client";
import { toast } from "sonner";

interface Participant {
  id: string;
  name: string;
  imageUrl?: string;
  isAudioMuted: boolean;
  isVideoPaused: boolean;
  isHost: boolean;
  isCoHost?: boolean;
}

type MediasoupContextType = {
  socket: Socket | null;
  device: Device | null;
  participants: Participant[];
  remoteStreams: Map<string, MediaStream>;
  screenShareStreams: Set<string>; // Track which participants are screen sharing
  localStream: MediaStream | null;
  localScreenStream: MediaStream | null; // Local screen share stream
  isInitialized: boolean;
  muteAudio: () => void;
  unmuteAudio: () => Promise<void>;
  toggleAudio: () => Promise<void>;
  isAudioMuted: boolean;
  enableVideo: () => Promise<void>;
  disableVideo: () => void;
  toggleVideo: () => Promise<void>;
  isVideoEnabled: boolean;
  enableScreenShare: () => Promise<void>;
  disableScreenShare: () => void;
  isScreenSharing: boolean;
  isScreenShareGloballyEnabled: boolean;
  isHost: boolean;
  isCoHost: boolean;
  forceMuted: boolean;
  forceVideoPaused: boolean;
  globalVideoDisabled: boolean;
  makeHost: (participantId: string) => void;
  removeHost: (participantId: string) => void;
  makeCoHost: (participantId: string) => void;
  removeCoHost: (participantId: string) => void;
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
  const [screenShareStreams, setScreenShareStreams] = useState<Set<string>>(
    new Set()
  );
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] =
    useState<MediaStream | null>(null);

  // Media States - Initialize based on localStorage preference
  const getInitialMediaState = () => {
    try {
      const storedPref = localStorage.getItem("meeting-join-preference");
      if (storedPref) {
        const preference = JSON.parse(storedPref);
        return {
          // If audio preference is false, mic is effectively "muted" (off)
          isAudioMuted: !preference.audio,
          isVideoEnabled: preference.video ?? false,
        };
      }
    } catch (error) {
      console.error("Failed to read initial media state:", error);
    }
    // Default: mic on (not muted), video off
    return { isAudioMuted: false, isVideoEnabled: false };
  };

  const initialState = getInitialMediaState();
  const [isAudioMuted, setIsAudioMuted] = useState(initialState.isAudioMuted);
  const [isVideoEnabled, setIsVideoEnabled] = useState(
    initialState.isVideoEnabled
  );
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isScreenShareGloballyEnabled, setIsScreenShareGloballyEnabled] =
    useState(true);
  const [isHost, setIsHost] = useState(false);
  const [isCoHost, setIsCoHost] = useState(false);
  const [forceMuted, setForceMuted] = useState(false);
  const [forceVideoPaused, setForceVideoPaused] = useState(false);
  const [globalVideoDisabled, setGlobalVideoDisabled] = useState(false);

  // Refs for Transports and Producers
  const sendTransportRef = useRef<types.Transport | null>(null);
  const recvTransportRef = useRef<types.Transport | null>(null);
  const audioProducerRef = useRef<types.Producer | null>(null);
  const videoProducerRef = useRef<types.Producer | null>(null);
  const screenProducerRef = useRef<types.Producer | null>(null);
  const currentRoomIdRef = useRef<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const hasJoinedRef = useRef<boolean>(false);
  const peerIdToUserIdRef = useRef<Map<string, string>>(new Map());

  // Consumer tracking map: consumerId -> { consumer, userId, isScreenShare }
  const consumersRef = useRef<
    Map<
      string,
      {
        consumer: types.Consumer;
        userId: string;
        isScreenShare: boolean;
      }
    >
  >(new Map());

  // Debug: Log media state changes
  useEffect(() => {
    console.log(`🎛️ Media State Update:`, {
      isAudioMuted,
      isVideoEnabled,
      isScreenSharing,
      hasAudioProducer: !!audioProducerRef.current,
      hasVideoProducer: !!videoProducerRef.current,
      hasScreenProducer: !!screenProducerRef.current,
      audioProducerPaused: audioProducerRef.current?.paused ?? "N/A",
      videoProducerPaused: videoProducerRef.current?.paused ?? "N/A",
    });
  }, [isAudioMuted, isVideoEnabled, isScreenSharing]);

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

    socketInstance.on(
      "participant-left",
      ({ peerId, userId }: { peerId?: string; userId?: string }) => {
        const participantId = userId || peerId;
        console.log(`👋 Participant left: ${participantId}`, {
          peerId,
          userId,
        });

        if (!participantId) {
          console.warn("⚠️ participant-left received without valid ID");
          return;
        }

        // Remove from participants list
        setParticipants((prev) => prev.filter((p) => p.id !== participantId));

        // Clean up video/audio streams for this peer
        setRemoteStreams((prev) => {
          const newMap = new Map(prev);
          newMap.delete(participantId);
          // Also try deleting by socket ID if we have the mapping
          const socketId = Array.from(peerIdToUserIdRef.current.entries()).find(
            ([_, uid]) => uid === participantId
          )?.[0];
          if (socketId) {
            newMap.delete(socketId);
            peerIdToUserIdRef.current.delete(socketId);
          }
          return newMap;
        });
      }
    );

    // ✅ Listen for participant state changes
    socketInstance.on(
      "participant-state-changed",
      ({
        userId,
        isAudioMuted,
        isVideoPaused,
      }: {
        userId: string;
        isAudioMuted?: boolean;
        isVideoPaused?: boolean;
      }) => {
        console.log("🔄 Participant state changed:", {
          userId,
          isAudioMuted,
          isVideoPaused,
        });
        setParticipants((prev) =>
          prev.map((p) =>
            p.id === userId
              ? {
                  ...p,
                  ...(isAudioMuted !== undefined && { isAudioMuted }),
                  ...(isVideoPaused !== undefined && { isVideoPaused }),
                }
              : p
          )
        );
      }
    );

    // ✅ Listen for participant updates (including co-host changes)
    socketInstance.on(
      "participant-updated",
      ({
        participantId,
        updates,
      }: {
        participantId: string;
        updates: Partial<Participant>;
      }) => {
        console.log("🔄 Participant updated:", { participantId, updates });
        setParticipants((prev) =>
          prev.map((p) => (p.id === participantId ? { ...p, ...updates } : p))
        );

        // If it's the current user being updated, update their own status
        if (participantId === currentUserIdRef.current) {
          if (updates.isHost !== undefined) {
            console.log("👑 Updating own isHost status:", updates.isHost);
            setIsHost(updates.isHost);
          }
          if (updates.isCoHost !== undefined) {
            console.log("🤝 Updating own isCoHost status:", updates.isCoHost);
            setIsCoHost(updates.isCoHost);
          }
        }
      }
    );

    // ✅ Listen for co-host granted notification
    socketInstance.on("cohost-granted", ({ by }: { by: string }) => {
      console.log(`🤝 You were promoted to co-host by ${by}`);
      setIsCoHost(true);
      toast.success(`${by} made you a co-host!`);
    });

    // ✅ Listen for co-host revoked notification
    socketInstance.on("cohost-revoked", ({ by }: { by: string }) => {
      console.log(`👤 Your co-host status was removed by ${by}`);
      setIsCoHost(false);
      toast.info(`${by} removed your co-host status`);
    });

    // ✅ Listen for host granted notification
    socketInstance.on("host-granted", ({ by }: { by: string }) => {
      console.log(`👑 You were promoted to host by ${by}`);
      toast.success(`${by} made you a host!`);
      setIsHost(true);
    });

    // ✅ Listen for host revoked notification
    socketInstance.on("host-revoked", ({ by }: { by: string }) => {
      console.log(`👤 Your host status was removed by ${by}`);
      toast.info(`${by} removed your host status`);
      setIsHost(false);
    });

    // ✅ Force control events from host
    socketInstance.on(
      "force-mute",
      ({ audio, by }: { audio: boolean; by: string }) => {
        console.log(`====================================`);
        console.log(`🎤 FORCE-MUTE EVENT RECEIVED`);
        console.log(`   audio=${audio}, by=${by}`);
        console.log(`   This should ONLY affect MICROPHONE`);
        console.log(`====================================`);

        if (audio) {
          // Mute audio
          if (audioProducerRef.current) {
            const track = audioProducerRef.current.track;
            track?.stop();
            audioProducerRef.current.close();
            audioProducerRef.current = null;
            setIsAudioMuted(true);
            setForceMuted(true); // Lock mic until admin unmutes

            setLocalStream((prev) => {
              if (!prev) return null;
              const newStream = new MediaStream(prev.getVideoTracks());
              return newStream.getTracks().length > 0 ? newStream : null;
            });
          }

          // Update local participant state
          setParticipants((prev) =>
            prev.map((p) =>
              p.id === (socketInstance as any)?.auth?.userId
                ? { ...p, isAudioMuted: true }
                : p
            )
          );

          console.warn(`🔇 Your microphone was muted by ${by}`);
          toast.info(`${by} muted you`);
        } else {
          // Unmute - unlock the button
          setForceMuted(false);
          console.log(`🔊 ${by} unlocked your microphone (audio=${audio})`);
          toast.success(`${by} allowed you to unmute`);
        }
      }
    );

    socketInstance.on("allow-unmute", ({ by }: { by: string }) => {
      // Remove the mute restriction flag
      setForceMuted(false);
      console.log(`🔊 ${by} allowed you to unmute`);
      toast.success(`${by} allowed you to unmute`);
    });

    socketInstance.on(
      "force-video-pause",
      ({ video, by }: { video: boolean; by: string }) => {
        console.log(`====================================`);
        console.log(`📹 FORCE-VIDEO-PAUSE EVENT RECEIVED`);
        console.log(`   video=${video}, by=${by}`);
        console.log(`   This should ONLY affect CAMERA`);
        console.log(`====================================`);

        if (video) {
          // Pause video producer (don't close it)
          if (videoProducerRef.current && !videoProducerRef.current.paused) {
            videoProducerRef.current.pause();
            setIsVideoEnabled(false); // Video is OFF
            console.log("📹 Video producer paused by host");
          }

          setForceVideoPaused(true); // Lock camera until admin enables

          // Update local participant state (video is OFF, so isVideoPaused = true)
          setParticipants((prev) =>
            prev.map((p) =>
              p.id === (socketInstance as any)?.auth?.userId
                ? { ...p, isVideoPaused: true } // true = paused = OFF
                : p
            )
          );

          console.warn(`📹 Your camera was turned off by ${by}`);
          toast.info(`${by} disabled your camera`);
        } else {
          // Enable video - unlock the button
          setForceVideoPaused(false);
          console.log(`📹 ${by} unlocked your camera (video=${video})`);
          toast.success(`${by} allowed you to enable camera`);
        }
      }
    );

    socketInstance.on("allow-video-enable", ({ by }: { by: string }) => {
      // Remove the video restriction flag
      setForceVideoPaused(false);
      console.log(`📹 ${by} allowed you to enable camera`);
      toast.success(`${by} allowed you to enable camera`);
    });

    socketInstance.on("allow-unpause", ({ by }: { by: string }) => {
      // Remove the video restriction flag (alternative event name)
      setForceVideoPaused(false);
      console.log(`📹 ${by} allowed you to unpause video`);
      toast.success(`${by} allowed you to unpause video`);
    });

    // Listen for disable-all-cameras event from admin
    socketInstance.on("disable-all-cameras", ({ by }: { by: string }) => {
      console.log(
        `📹 DISABLE-ALL-CAMERAS received from ${by} for user ${
          (socketInstance as any)?.auth?.userId
        }`
      );

      // Always set global video disabled flag (applies to all users regardless of current state)
      setGlobalVideoDisabled(true);

      // Pause video producer if currently enabled (don't close it)
      if (videoProducerRef.current && !videoProducerRef.current.paused) {
        console.log(
          `📹 Pausing video producer for user ${
            (socketInstance as any)?.auth?.userId
          }`
        );
        videoProducerRef.current.pause();
        setIsVideoEnabled(false);

        setParticipants((prev) =>
          prev.map((p) =>
            p.id === (socketInstance as any)?.auth?.userId
              ? { ...p, isVideoPaused: true }
              : p
          )
        );
      } else {
        console.log(
          `📹 No active video producer to pause for user ${
            (socketInstance as any)?.auth?.userId
          }`
        );
      }

      console.warn(`📹 All cameras disabled by ${by}`);
      toast.info(`${by} disabled all cameras`);
    });

    // Listen for enable-all-cameras event from admin
    socketInstance.on("enable-all-cameras", ({ by }: { by: string }) => {
      console.log(`📹 ENABLE-ALL-CAMERAS received from ${by}`);

      // Remove global video disabled flag (don't auto-enable, let user choose)
      setGlobalVideoDisabled(false);
      console.log(`📹 Cameras unlocked by ${by}`);
      toast.success(`${by} allowed cameras to be enabled`);
    });

    // Listen for host commands to stop screen share
    socketInstance.on("host-stop-screenshare", ({ by }: { by: string }) => {
      console.log(`🖥️ HOST-STOP-SCREENSHARE received from ${by}`);

      // Stop local screen share if active
      if (screenProducerRef.current) {
        const producerId = screenProducerRef.current.id;
        const track = screenProducerRef.current.track;
        track?.stop();
        screenProducerRef.current.close();
        screenProducerRef.current = null;

        setLocalScreenStream(null);
        setIsScreenSharing(false);

        console.log(
          `🖥️ Screen share stopped by host ${by}, producer closed:`,
          producerId
        );
        toast.warning(`${by} stopped your screen share`);

        // Notify server
        if (
          socketInstance &&
          currentRoomIdRef.current &&
          currentUserIdRef.current
        ) {
          socketInstance.emit("screen-share-stopped", {
            roomId: currentRoomIdRef.current,
            userId: currentUserIdRef.current,
            producerId: producerId,
          });
        }
      }
    });

    // Listen for global screen share permission updates
    socketInstance.on(
      "screenshare-global-update",
      ({ enabled, by }: { enabled: boolean; by?: string }) => {
        console.log(
          `🖥️ SCREENSHARE-GLOBAL-UPDATE: ${
            enabled ? "enabled" : "disabled"
          } by ${by || "admin"}`
        );
        setIsScreenShareGloballyEnabled(enabled);

        // If disabled globally, stop any active screen share
        if (!enabled && screenProducerRef.current) {
          console.log("🖥️ Auto-stopping screen share due to global disable");

          // Inline cleanup to avoid calling disableScreenShare before declaration
          const producerId = screenProducerRef.current.id;
          const track = screenProducerRef.current.track;
          track?.stop();
          screenProducerRef.current.close();
          screenProducerRef.current = null;

          setLocalScreenStream(null);
          setIsScreenSharing(false);

          console.log("🖥️ Screen share disabled, producer closed:", producerId);

          // Notify server
          if (
            socketInstance &&
            currentRoomIdRef.current &&
            currentUserIdRef.current
          ) {
            socketInstance.emit("screen-share-stopped", {
              roomId: currentRoomIdRef.current,
              userId: currentUserIdRef.current,
              producerId: producerId,
            });
          }

          toast.warning(
            `Screen sharing has been disabled by ${by || "the host"}`
          );
        }

        // Show toast notification
        if (enabled) {
          toast.success(
            `Screen sharing has been enabled by ${by || "the host"}`
          );
        } else if (!screenProducerRef.current) {
          // Only show info if user wasn't actively sharing
          toast.info(`Screen sharing has been disabled by ${by || "the host"}`);
        }
      }
    );

    // Listen for screen share denied (when user tries but not allowed)
    socketInstance.on(
      "screenshare-denied",
      ({ reason }: { reason?: string }) => {
        console.log(
          "🖥️ SCREENSHARE-DENIED:",
          reason || "Screen sharing not allowed"
        );
        setIsScreenSharing(false);
        toast.error(
          reason || "Screen sharing is currently disabled by the host"
        );

        // Clean up any local screen share state
        if (screenProducerRef.current) {
          const track = screenProducerRef.current.track;
          track?.stop();
          screenProducerRef.current.close();
          screenProducerRef.current = null;
          setLocalScreenStream(null);
        }
      }
    );

    // Listen for producer-closed events (standard mediasoup event)
    socketInstance.on(
      "producer-closed",
      ({ producerId }: { producerId: string }) => {
        console.log("🔴 Producer closed:", producerId);

        // Find and close the associated consumer
        for (const [consumerId, data] of consumersRef.current.entries()) {
          if (data.consumer.producerId === producerId) {
            console.log(
              "🧹 Cleaning up consumer for closed producer:",
              consumerId
            );

            // Stop the track
            data.consumer.track.stop();

            // Close the consumer
            data.consumer.close();

            // Remove from consumer map
            consumersRef.current.delete(consumerId);

            // Clean up screen share state if it was a screen share
            if (data.isScreenShare) {
              setScreenShareStreams((prev) => {
                const newSet = new Set(prev);
                newSet.delete(data.userId);
                console.log("🖥️ Removed screen share for user:", data.userId);
                return newSet;
              });

              // Remove screen share stream
              setRemoteStreams((prev) => {
                const newMap = new Map(prev);
                newMap.delete(`${data.userId}-screen`);
                return newMap;
              });
            } else {
              // Remove regular stream's track
              setRemoteStreams((prev) => {
                const newMap = new Map(prev);
                const stream = newMap.get(data.userId);
                if (stream) {
                  // Remove the specific track from the stream
                  const trackToRemove = stream
                    .getTracks()
                    .find((t) => t.id === data.consumer.track.id);
                  if (trackToRemove) {
                    stream.removeTrack(trackToRemove);
                  }
                  // If stream has no tracks left, remove it
                  if (stream.getTracks().length === 0) {
                    newMap.delete(data.userId);
                  }
                }
                return newMap;
              });
            }

            break;
          }
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
      socketInstance.off("participant-state-changed");
      socketInstance.off("force-mute");
      socketInstance.off("allow-unmute");
      socketInstance.off("force-video-pause");
      socketInstance.off("allow-video-enable");
      socketInstance.off("allow-unpause");
      socketInstance.off("disable-all-cameras");
      socketInstance.off("enable-all-cameras");
      socketInstance.off("kicked-from-room");
      socketInstance.off("producer-closed");
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
    currentUserIdRef.current = userId;
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
      const {
        existingProducers,
        isHost: backendIsHost,
        isCoHost: backendIsCoHost,
      } = await new Promise<any>((resolve, reject) => {
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
              console.log("✅ Join response from backend:", {
                isHost: response.isHost,
                isCoHost: response.isCoHost,
                existingProducers: response.existingProducers?.length,
              });
              resolve(response);
            }
          }
        );
      });

      // Set host status from backend response
      if (backendIsHost !== undefined) {
        console.log("👑 Setting isHost from backend:", backendIsHost);
        setIsHost(backendIsHost);
      }
      if (backendIsCoHost !== undefined) {
        console.log("🤝 Setting isCoHost from backend:", backendIsCoHost);
        setIsCoHost(backendIsCoHost);
      }

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

      // Step 8: Check localStorage preference for initial media state
      try {
        const storedPref = localStorage.getItem("meeting-join-preference");
        const preference = storedPref
          ? JSON.parse(storedPref)
          : { audio: true, video: false };

        console.log("📋 Join preference from localStorage:", preference);

        // Start audio/video based on user's saved preference
        if (preference.audio) {
          await startAudio();
          // Audio producer created, set state to not muted
          setIsAudioMuted(false);
        } else {
          console.log("🔇 Skipping audio - user preference is OFF");
          // No audio producer, set state to muted (effectively off)
          setIsAudioMuted(true);
        }

        if (preference.video) {
          await enableVideo();
          // Video producer created, state already set in enableVideo
        } else {
          console.log("📹 Skipping video - user preference is OFF");
          // No video producer, ensure state is disabled
          setIsVideoEnabled(false);
        }
      } catch (error) {
        console.error("Failed to read localStorage preference:", error);
        // Fallback: start audio only (previous behavior)
        await startAudio();
        setIsAudioMuted(false);
      }
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
      appData: data.appData || {}, // Include appData from server
    });

    console.log("📦 Consumer created:", {
      id: consumer.id,
      kind: consumer.kind,
      producerId: consumer.producerId,
      appData: consumer.appData,
      isScreenShare: consumer.appData?.share || data.appData?.share,
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
      "), isScreenShare:",
      data.isScreenShare || false
    );

    const isScreenShare = data.isScreenShare || false;

    // Store consumer in tracking map
    consumersRef.current.set(consumer.id, {
      consumer,
      userId,
      isScreenShare,
    });

    // Listen for transport close on this consumer (mediasoup-client valid event)
    consumer.on("transportclose", () => {
      console.log(
        "🔴 Transport closed (consumer event):",
        consumer.id,
        "producerId:",
        consumer.producerId
      );

      // Stop the track
      consumer.track.stop();

      // Remove from consumer map
      consumersRef.current.delete(consumer.id);

      // Clean up screen share state if it was a screen share
      if (isScreenShare) {
        setScreenShareStreams((prev) => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          console.log("🖥️ Removed screen share for user:", userId);
          return newSet;
        });

        // Remove screen share stream
        setRemoteStreams((prev) => {
          const newMap = new Map(prev);
          newMap.delete(`${userId}-screen`);
          return newMap;
        });
      } else {
        // Remove regular stream's track
        setRemoteStreams((prev) => {
          const newMap = new Map(prev);
          const stream = newMap.get(userId);
          if (stream) {
            // Remove the specific track from the stream
            const trackToRemove = stream
              .getTracks()
              .find((t) => t.id === consumer.track.id);
            if (trackToRemove) {
              stream.removeTrack(trackToRemove);
            }
            // If stream has no tracks left, remove it
            if (stream.getTracks().length === 0) {
              newMap.delete(userId);
            }
          }
          return newMap;
        });
      }
    });

    // Use different key for screen share vs regular video
    const streamKey = isScreenShare ? `${userId}-screen` : userId;

    // Track screen share participants
    if (isScreenShare) {
      setScreenShareStreams((prev) => {
        const newSet = new Set(prev);
        newSet.add(userId);
        return newSet;
      });
    }

    setRemoteStreams((prev) => {
      const newMap = new Map(prev);
      const existingStream = newMap.get(streamKey) || new MediaStream();

      // Check if track already exists to avoid duplicates
      const existingTrack = existingStream
        .getTracks()
        .find((t) => t.id === track.id);
      if (!existingTrack) {
        existingStream.addTrack(track);
        console.log(
          `✅ Added ${data.kind} track to ${
            data.isScreenShare ? "SCREEN SHARE" : "regular"
          } stream for userId:`,
          userId,
          "streamKey:",
          streamKey
        );
      } else {
        console.log(
          `⚠️ Track already exists in stream for userId:`,
          userId,
          "streamKey:",
          streamKey
        );
      }

      newMap.set(streamKey, existingStream);
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

      // Set state: audio producer is active and not muted
      setIsAudioMuted(false);

      console.log("🎤 Audio producer created - state set to unmuted");
    } catch (error) {
      console.error("❌ Failed to start audio:", error);
      // If failed to start, treat as muted
      setIsAudioMuted(true);
    }
  };

  // Audio Controls
  const muteAudio = () => {
    if (audioProducerRef.current && !audioProducerRef.current.paused) {
      audioProducerRef.current.pause();
      setIsAudioMuted(true);
      console.log("🔇 Audio muted");

      // Update local participant state
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === (socket as any)?.auth?.userId
            ? { ...p, isAudioMuted: true }
            : p
        )
      );

      // Notify server of state change
      if (socket && currentRoomIdRef.current && currentUserIdRef.current) {
        socket.emit("update-my-state", {
          roomId: currentRoomIdRef.current,
          userId: currentUserIdRef.current,
          isAudioMuted: true,
        });
      }
    }
  };

  const unmuteAudio = async () => {
    // If producer exists and is paused, just resume it
    if (audioProducerRef.current && audioProducerRef.current.paused) {
      audioProducerRef.current.resume();
      setIsAudioMuted(false);
      console.log("🔊 Audio unmuted");

      // Update local participant state
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === (socket as any)?.auth?.userId
            ? { ...p, isAudioMuted: false }
            : p
        )
      );

      // Notify server of state change
      if (socket && currentRoomIdRef.current && currentUserIdRef.current) {
        socket.emit("update-my-state", {
          roomId: currentRoomIdRef.current,
          userId: currentUserIdRef.current,
          isAudioMuted: false,
        });
      }
    }
    // If producer doesn't exist (was closed by admin), restart it
    else if (!audioProducerRef.current) {
      await startAudio();
      setIsAudioMuted(false);

      // Update local participant state
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === (socket as any)?.auth?.userId
            ? { ...p, isAudioMuted: false }
            : p
        )
      );

      // Notify server of state change
      if (socket && currentRoomIdRef.current && currentUserIdRef.current) {
        socket.emit("update-my-state", {
          roomId: currentRoomIdRef.current,
          userId: currentUserIdRef.current,
          isAudioMuted: false,
        });
      }
    }
  };

  const toggleAudio = async () => {
    console.log(
      `🎤 toggleAudio called. Current state: isAudioMuted=${isAudioMuted}, producer=${
        audioProducerRef.current ? "exists" : "null"
      }`
    );

    // Handle case where producer doesn't exist (joined with audio off)
    if (!audioProducerRef.current) {
      console.log("🎤 No audio producer - creating one");
      await startAudio();
      return;
    }

    if (isAudioMuted) {
      await unmuteAudio();
    } else {
      muteAudio();
    }
  };

  // Video Controls
  const enableVideo = async () => {
    console.log(
      `📹 enableVideo called. Transport: ${
        sendTransportRef.current ? "exists" : "null"
      }, Producer: ${
        videoProducerRef.current ? "exists" : "null"
      }, Producer paused: ${
        videoProducerRef.current ? videoProducerRef.current.paused : "N/A"
      }, forceVideoPaused: ${forceVideoPaused}, globalVideoDisabled: ${globalVideoDisabled}`
    );

    // Prevent enabling video if host has disabled it (individually or globally)
    if (forceVideoPaused) {
      console.warn("📹 Cannot enable video - disabled by host (individual)");
      toast.warning("Camera is disabled by host");
      return;
    }

    if (globalVideoDisabled) {
      console.warn("📹 Cannot enable video - disabled by host (global)");
      toast.warning("All cameras are disabled by host");
      return;
    }

    if (!sendTransportRef.current) return;

    // If producer already exists and is paused, just resume it
    if (videoProducerRef.current) {
      if (videoProducerRef.current.paused) {
        videoProducerRef.current.resume();
        setIsVideoEnabled(true);
        console.log("📹 Video producer resumed");

        // Update local participant state
        setParticipants((prev) =>
          prev.map((p) =>
            p.id === (socket as any)?.auth?.userId
              ? { ...p, isVideoPaused: false }
              : p
          )
        );

        // Notify server of state change
        if (socket && currentRoomIdRef.current && currentUserIdRef.current) {
          socket.emit("update-my-state", {
            roomId: currentRoomIdRef.current,
            userId: currentUserIdRef.current,
            isVideoPaused: false,
          });
        }
      }
      return;
    }

    // Create new producer only if it doesn't exist
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

      setIsVideoEnabled(true); // Video is ON
      console.log("📹 Video producer created");

      // Update local participant state (isVideoPaused should be false when video is enabled)
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === (socket as any)?.auth?.userId
            ? { ...p, isVideoPaused: false } // false = not paused = ON
            : p
        )
      );

      // Notify server of state change
      if (socket && currentRoomIdRef.current && currentUserIdRef.current) {
        socket.emit("update-my-state", {
          roomId: currentRoomIdRef.current,
          userId: currentUserIdRef.current,
          isVideoPaused: false,
        });
      }
    } catch (error) {
      console.error("❌ Failed to enable video:", error);
    }
  };

  const disableVideo = () => {
    console.log(
      `📹 disableVideo called. Producer: ${
        videoProducerRef.current ? "exists" : "null"
      }, paused: ${
        videoProducerRef.current ? videoProducerRef.current.paused : "N/A"
      }`
    );
    if (videoProducerRef.current && !videoProducerRef.current.paused) {
      // Pause producer instead of closing it
      videoProducerRef.current.pause();
      setIsVideoEnabled(false); // Video is OFF
      console.log("📹 Video producer paused");

      // Update local participant state (isVideoPaused should be true when video is disabled)
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === (socket as any)?.auth?.userId
            ? { ...p, isVideoPaused: true } // true = paused = OFF
            : p
        )
      );

      // Notify server of state change
      if (socket && currentRoomIdRef.current && currentUserIdRef.current) {
        socket.emit("update-my-state", {
          roomId: currentRoomIdRef.current,
          userId: currentUserIdRef.current,
          isVideoPaused: true,
        });
      }
    }
  };

  const toggleVideo = async () => {
    console.log(
      `📹 toggleVideo called. Current state: isVideoEnabled=${isVideoEnabled}, producer=${
        videoProducerRef.current ? "exists" : "null"
      }, paused=${
        videoProducerRef.current ? videoProducerRef.current.paused : "N/A"
      }`
    );

    // If producer exists, check its paused state (source of truth)
    if (videoProducerRef.current) {
      if (videoProducerRef.current.paused) {
        console.log("📹 Enabling video (resuming)...");
        await enableVideo();
      } else {
        console.log("📹 Disabling video (pausing)...");
        disableVideo();
      }
    }
    // If video producer doesn't exist, create it
    else {
      console.log("📹 Enabling video (creating)...");
      await enableVideo();
    }
  };

  // Screen Share Controls
  const enableScreenShare = async () => {
    if (!sendTransportRef.current || screenProducerRef.current) return;

    // Check if screen sharing is globally disabled
    if (!isScreenShareGloballyEnabled) {
      toast.error("Screen sharing is disabled by the host");
      console.log("⚠️ Cannot share: globally disabled by host");
      return;
    }

    // Check if someone else is already sharing
    if (screenShareStreams.size > 0) {
      toast.error("Someone is already sharing their screen");
      console.log("⚠️ Cannot share: another user is already sharing");
      return;
    }

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

      // Store local screen share stream
      setLocalScreenStream(stream);
      setIsScreenSharing(true);
      console.log("🖥️ Screen share producer created:", {
        id: producer.id,
        kind: producer.kind,
        appData: producer.appData,
      });

      // Notify server that screen share is active
      if (socket && currentRoomIdRef.current && currentUserIdRef.current) {
        socket.emit("screen-share-started", {
          roomId: currentRoomIdRef.current,
          userId: currentUserIdRef.current,
          producerId: producer.id,
        });
        console.log("🖥️ Notified server of screen share start");
      }
    } catch (error) {
      console.error("❌ Failed to enable screen share:", error);
    }
  };

  const disableScreenShare = () => {
    if (screenProducerRef.current) {
      const producerId = screenProducerRef.current.id;
      const track = screenProducerRef.current.track;
      track?.stop();
      screenProducerRef.current.close();
      screenProducerRef.current = null;

      // Clear local screen share stream and state
      setLocalScreenStream(null);
      setIsScreenSharing(false);

      console.log("🖥️ Screen share disabled, producer closed:", producerId);

      // Notify server that screen share stopped
      // Server will broadcast producer-closed to all participants
      if (socket && currentRoomIdRef.current && currentUserIdRef.current) {
        socket.emit("screen-share-stopped", {
          roomId: currentRoomIdRef.current,
          userId: currentUserIdRef.current,
          producerId,
        });
        console.log("🖥️ Notified server of screen share stop");
      }
    }
  };

  // Host Management
  const makeHost = (participantId: string) => {
    if (!socket || !isHost) {
      console.warn(
        "⚠️ Cannot make host: not authorized or socket not connected",
        { socket: !!socket, isHost }
      );
      toast.error("Cannot make host: not authorized");
      return;
    }
    if (!currentRoomIdRef.current) {
      console.error("⚠️ No room ID available");
      toast.error("No room ID available");
      return;
    }
    console.log(
      "👑 Making participant host:",
      participantId,
      "in room:",
      currentRoomIdRef.current
    );
    socket.emit("make-host", {
      roomId: currentRoomIdRef.current,
      participantId,
    });
    console.log("✅ make-host event emitted");
  };

  const removeHost = (participantId: string) => {
    if (!socket || !isHost) {
      console.warn(
        "⚠️ Cannot remove host: not authorized or socket not connected",
        { socket: !!socket, isHost }
      );
      toast.error("Cannot remove host: not authorized");
      return;
    }
    if (!currentRoomIdRef.current) {
      console.error("⚠️ No room ID available");
      toast.error("No room ID available");
      return;
    }
    console.log(
      "👤 Removing host status:",
      participantId,
      "in room:",
      currentRoomIdRef.current
    );
    socket.emit("remove-host", {
      roomId: currentRoomIdRef.current,
      participantId,
    });
    console.log("✅ remove-host event emitted");
  };

  const makeCoHost = (participantId: string) => {
    console.log("🔍 makeCoHost called:", {
      participantId,
      socket: !!socket,
      isHost,
      currentRoomId: currentRoomIdRef.current,
    });

    if (!socket || !isHost) {
      console.warn(
        "⚠️ Cannot make co-host: not authorized or socket not connected",
        { socket: !!socket, isHost }
      );
      toast.error("Cannot make co-host: not authorized");
      return;
    }
    if (!currentRoomIdRef.current) {
      console.error("⚠️ No room ID available");
      toast.error("No room ID available");
      return;
    }
    console.log(
      "🤝 Making participant co-host:",
      participantId,
      "in room:",
      currentRoomIdRef.current
    );
    socket.emit("make-cohost", {
      roomId: currentRoomIdRef.current,
      participantId,
    });
    console.log("✅ make-cohost event emitted");
  };

  const removeCoHost = (participantId: string) => {
    if (!socket || !isHost) {
      console.warn(
        "⚠️ Cannot remove co-host: not authorized or socket not connected",
        { socket: !!socket, isHost }
      );
      toast.error("Cannot remove co-host: not authorized");
      return;
    }
    if (!currentRoomIdRef.current) {
      console.error("⚠️ No room ID available");
      toast.error("No room ID available");
      return;
    }
    console.log(
      "👤 Removing co-host status:",
      participantId,
      "in room:",
      currentRoomIdRef.current
    );
    socket.emit("remove-cohost", {
      roomId: currentRoomIdRef.current,
      participantId,
    });
    console.log("✅ remove-cohost event emitted");
  };

  return (
    <MediasoupContext.Provider
      value={{
        socket,
        device,
        participants,
        remoteStreams,
        screenShareStreams,
        localStream,
        localScreenStream,
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
        isScreenShareGloballyEnabled,
        isHost,
        isCoHost,
        forceMuted,
        forceVideoPaused,
        globalVideoDisabled,
        makeHost,
        removeHost,
        makeCoHost,
        removeCoHost,
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
