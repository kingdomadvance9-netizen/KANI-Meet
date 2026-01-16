"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getSocket } from "@/lib/socket";
import { useUser } from "@clerk/nextjs";

export type ChatAttachment = {
  id: string;
  name: string;
  type: "image" | "video" | "audio" | "file";
  mime: string;
  size: number;
  previewUrl?: string;
  url?: string;
  uploading?: boolean;
  progress?: number;
  file?: File;
};

export type SocketChatMessage = {
  id: string;
  text: string;
  createdAt: number;
  pinned: boolean;
  sender: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  attachments?: ChatAttachment[];
  replyTo?: {
    id: string;
    text: string;
    senderName: string;
  };
  reactions?: Record<string, string[]>; // emoji -> userIds
};

export type ReceivedMessage = {
  socketId: string;
  message: SocketChatMessage;
};

type TypingUser = {
  socketId: string;
  name: string;
};

export const useSocketChat = (roomId?: string) => {
  const { user } = useUser();
  const socket = getSocket();

  const [messages, setMessages] = useState<ReceivedMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [selfSocketId, setSelfSocketId] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [pinnedMessage, setPinnedMessage] = useState<SocketChatMessage | null>(
    null
  );

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ----------------------------
  // CONNECT + LISTENERS
  // ----------------------------
  useEffect(() => {
    if (!roomId || !user) return;

    console.log("💬 Chat hook initializing for room:", roomId);
    setConnected(socket.connected);
    setSelfSocketId(socket.id || null);

    // Request chat history explicitly (in case we missed the initial join-room emission)
    const requestHistory = () => {
      console.log("💬 Requesting chat history for room:", roomId);
      socket.emit("request-chat-history", { roomId });
    };

    // Request history on mount and after socket connects
    if (socket.connected) {
      requestHistory();
    }

    const handleConnect = () => {
      console.log("💬 Chat socket connected");
      setConnected(true);
      setSelfSocketId(socket.id || null);
      requestHistory();
    };

    const handleDisconnect = () => {
      console.log("💬 Chat socket disconnected");
      setConnected(false);
    };

    // ----------------------------
    // HANDLERS
    // ----------------------------
    const handleChatHistory = (history: ReceivedMessage[]) => {
      console.log(`💬 Chat history received: ${history.length} messages`);
      setMessages(history);

      const pinned = history.find((m) => m.message.pinned);
      if (pinned) setPinnedMessage(pinned.message);
    };

    const handleReceiveMessage = (data: ReceivedMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.message.id === data.message.id)) return prev;
        return [...prev, data];
      });
    };

    const handleTypingStart = (data: TypingUser) => {
      if (data.socketId === socket.id) return;
      setTypingUsers((prev) =>
        prev.some((u) => u.socketId === data.socketId) ? prev : [...prev, data]
      );
    };

    const handleTypingStop = ({ socketId }: { socketId: string }) => {
      setTypingUsers((prev) => prev.filter((u) => u.socketId !== socketId));
    };

    const handlePinMessage = (message: SocketChatMessage) => {
      setPinnedMessage(message);
    };

    const handleMessageReaction = ({
      messageId,
      emoji,
      userId,
    }: {
      messageId: string;
      emoji: string;
      userId: string;
    }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.message.id !== messageId) return m;

          const reactions = { ...(m.message.reactions || {}) };

          Object.keys(reactions).forEach((e) => {
            reactions[e] = reactions[e].filter((id) => id !== userId);
            if (reactions[e].length === 0) delete reactions[e];
          });

          reactions[emoji] = [...(reactions[emoji] || []), userId];

          return { ...m, message: { ...m.message, reactions } };
        })
      );
    };

    const handleReactionUpdate = (data: {
      messageId: string;
      userId: string;
      emoji: string;
      action: "added" | "removed" | "updated";
    }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.message.id !== data.messageId) return m;

          const reactions = { ...(m.message.reactions || {}) };

          Object.keys(reactions).forEach((key) => {
            reactions[key] = reactions[key].filter((id) => id !== data.userId);
            if (reactions[key].length === 0) delete reactions[key];
          });

          if (data.action !== "removed") {
            reactions[data.emoji] = [
              ...(reactions[data.emoji] || []),
              data.userId,
            ];
          }

          return { ...m, message: { ...m.message, reactions } };
        })
      );
    };

    const handlePinUpdate = ({
      messageId,
      pinned,
    }: {
      messageId: string;
      pinned: boolean;
    }) => {
      setMessages((prev) => {
        const updated = prev.map((m) =>
          m.message.id === messageId
            ? { ...m, message: { ...m.message, pinned } }
            : m
        );

        const pinnedMsg = updated.find((m) => m.message.pinned);
        setPinnedMessage(pinnedMsg ? pinnedMsg.message : null);

        return updated;
      });
    };

    const handleMessageError = ({
      messageId,
      error,
    }: {
      messageId: string;
      error: string;
    }) => {
      console.error(`Failed to send message ${messageId}:`, error);

      // Remove the optimistically added message
      setMessages((prev) => prev.filter((m) => m.message.id !== messageId));

      // Show error notification (you can add toast here if available)
      alert(error);
    };

    // ----------------------------
    // REGISTER LISTENERS
    // ----------------------------
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("chat-history", handleChatHistory);
    socket.on("receive-message", handleReceiveMessage);
    socket.on("typing-start", handleTypingStart);
    socket.on("typing-stop", handleTypingStop);
    socket.on("pin-message", handlePinMessage);
    socket.on("message-react", handleMessageReaction);
    socket.on("message-react-update", handleReactionUpdate);
    socket.on("pin-message-update", handlePinUpdate);
    socket.on("message-error", handleMessageError);

    // ----------------------------
    // CLEANUP
    // ----------------------------
    return () => {
      console.log("💬 Chat hook cleanup for room:", roomId);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("chat-history", handleChatHistory);
      socket.off("receive-message", handleReceiveMessage);
      socket.off("typing-start", handleTypingStart);
      socket.off("typing-stop", handleTypingStop);
      socket.off("pin-message", handlePinMessage);
      socket.off("message-react", handleMessageReaction);
      socket.off("message-react-update", handleReactionUpdate);
      socket.off("pin-message-update", handlePinUpdate);
      socket.off("message-error", handleMessageError);

      // NOTE: Do NOT emit leave-room here - MediasoupContext handles that
      // ❌ DO NOT socket.disconnect() (singleton!)
    };
  }, [roomId, user]);

  // ----------------------------
  // SEND MESSAGE
  // ----------------------------
  const sendMessage = useCallback(
    (text: string, replyTo?: SocketChatMessage) => {
      if (!roomId || !socket.id || !user) return;

      const message: SocketChatMessage = {
        id: crypto.randomUUID(),
        text,
        createdAt: Date.now(),
        pinned: false,
        sender: {
          id: user.id,
          name:
            user.fullName ||
            user.username ||
            user.primaryEmailAddress?.emailAddress ||
            "Anonymous",
          avatarUrl: user.imageUrl,
        },
        replyTo: replyTo
          ? {
              id: replyTo.id,
              text: replyTo.text,
              senderName: replyTo.sender.name,
            }
          : undefined,
      };

      socket.emit("send-message", { roomId, message });

      // Optimistic update: add message immediately for sender
      setMessages((prev) => [...prev, { socketId: socket.id!, message }]);
    },
    [roomId, socket, user]
  );

  // ----------------------------
  // PIN MESSAGE
  // ----------------------------
  const pinMessage = useCallback(
    (messageOrId: SocketChatMessage | string, isPinned?: boolean) => {
      let messageId: string;
      let pinnedStatus: boolean;

      if (typeof messageOrId === "string") {
        messageId = messageOrId;
        pinnedStatus = isPinned ?? true;
      } else {
        messageId = messageOrId.id;
        // Toggle logic: if it's currently pinned, we unpin it
        pinnedStatus = !messageOrId.pinned;
      }

      console.log("Pushing pin update:", { messageId, pinned: pinnedStatus });
      socket.emit("pin-message", { roomId, messageId, pinned: pinnedStatus });
    },
    [roomId, socket]
  );

  // ----------------------------
  // REACT TO MESSAGE ✅
  // ----------------------------
  const reactToMessage = useCallback(
    (messageId: string, emoji: string) => {
      if (!roomId || !user) return;

      socket.emit("message-react", {
        roomId,
        messageId,
        emoji,
        userId: user.id,
      });
    },
    [roomId, socket, user]
  );

  // ----------------------------
  // TYPING
  // ----------------------------
  const startTyping = useCallback(() => {
    if (!roomId || !user) return;

    socket.emit("typing-start", {
      roomId,
      name:
        user.fullName ||
        user.username ||
        user.primaryEmailAddress?.emailAddress ||
        "User",
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing-stop", { roomId });
    }, 1500);
  }, [roomId, socket, user]);

  return {
    connected,
    messages,
    sendMessage,
    typingUsers,
    startTyping,
    selfSocketId,
    pinnedMessage,
    pinMessage,
    reactToMessage, // ✅ NOW DEFINED
  };
};
