"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Users, Settings } from "lucide-react";
import { AnimatePresence } from "framer-motion";

import ChatSidebar from "./ChatSidebar";
import ChatButton from "./ChatButton";
import GridLayout from "./GridLayout";
import CustomControls from "./CustomControls";
import CustomHostControls from "./CustomHostControls";
import ParticipantSidebar from "./ParticipantSidebar";
import MessageNotification from "./MessageNotification";
import { cn } from "@/lib/utils";
import { useMediasoupContext } from "@/contexts/MediasoupContext";
import { useGetCallById } from "@/hooks/useGetCallById";
import { useSocketChat } from "@/hooks/useSocketChat";
import { ReceivedMessage } from "@/hooks/useSocketChat";

const MeetingRoom = () => {
  const params = useParams();
  const router = useRouter();
  const roomId = (params?.id as string) || "default-room";
  const { user } = useUser();

  // ✅ Get real-time data from Mediasoup Context
  const {
    socket,
    participants,
    remoteStreams,
    localStream,
    isInitialized,
    joinRoom,
  } = useMediasoupContext();

  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [visibleNotifications, setVisibleNotifications] = useState<ReceivedMessage[]>([]);
  const shownMessageIdsRef = useRef<Set<string>>(new Set());
  const MAX_VISIBLE_NOTIFICATIONS = 3;

  // Get meeting metadata to determine creator
  const { call } = useGetCallById(roomId);

  // Get chat data including unread messages
  const { unreadCount, unreadMessages } = useSocketChat(roomId, showChat);

  // ✅ Join the Mediasoup room on mount with user info
  useEffect(() => {
    if (socket && !isInitialized && user && call) {
      const userName = user.fullName || user.firstName || "Anonymous";
      const userImageUrl = user.imageUrl;

      // ✅ Determine if current user is the creator
      const isCreator = call.createdBy === user.id;

      console.log("🚀 Joining Mediasoup Room:", roomId, "as", userName, {
        isCreator,
        callCreatedBy: call.createdBy,
        currentUserId: user.id,
      });

      joinRoom(roomId, user.id, userName, userImageUrl, isCreator);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, isInitialized, user?.id, roomId, call]);

  // Manage notification stack - APPEND new messages only
  useEffect(() => {
    if (showChat) {
      // Clear all notifications when chat is opened
      setVisibleNotifications([]);
      shownMessageIdsRef.current = new Set();
      return;
    }

    if (unreadMessages.length === 0) {
      setVisibleNotifications([]);
      shownMessageIdsRef.current = new Set();
      return;
    }

    // Find NEW messages that haven't been shown yet
    const newMessages = unreadMessages.filter(
      (msg) => !shownMessageIdsRef.current.has(msg.message.id)
    );

    if (newMessages.length > 0) {
      setVisibleNotifications((prev) => {
        // Append new messages
        const updated = [...prev, ...newMessages];

        // Keep only the last MAX_VISIBLE_NOTIFICATIONS
        // Remove from the FRONT (oldest messages)
        if (updated.length > MAX_VISIBLE_NOTIFICATIONS) {
          return updated.slice(-MAX_VISIBLE_NOTIFICATIONS);
        }

        return updated;
      });

      // Track these messages as shown (using ref - doesn't trigger re-render)
      newMessages.forEach((msg) => {
        shownMessageIdsRef.current.add(msg.message.id);
      });
    }
  }, [unreadMessages, showChat]);

  const handleNotificationClose = (messageId: string) => {
    setVisibleNotifications((prev) =>
      prev.filter((msg) => msg.message.id !== messageId)
    );
    // Don't remove from shownMessageIdsRef - we want to remember it was shown
  };

  const handleNotificationClick = () => {
    setShowChat(true);
    setVisibleNotifications([]);
    shownMessageIdsRef.current = new Set();
  };

  return (
    <section className="relative h-screen w-full bg-[#0F1115] text-white overflow-hidden">
      {/* Debug component - remove in production */}

      <div
        className={cn(
          "h-full w-full flex overflow-hidden relative transition-all duration-300",
          showParticipants || showChat ? "pr-0 md:pr-[300px]" : "pr-0"
        )}
      >
        {/* VIDEO GRID AREA */}
        <div className="flex-1 h-full relative">
          {/* ✅ Pass real streams and participants to the grid */}
          <GridLayout
            participants={participants}
            remoteStreams={remoteStreams}
            localStream={localStream}
          />
        </div>

        {/* CHAT SIDEBAR */}
        <ChatSidebar
          open={showChat}
          onClose={() => setShowChat(false)}
          roomId={roomId}
        />

        {/* PARTICIPANTS SIDEBAR */}
        <ParticipantSidebar
          participants={participants}
          socket={socket}
          roomId={roomId}
          open={showParticipants}
          onClose={() => setShowParticipants(false)}
        />
      </div>

      {/* CONTROLS BAR */}
      <div className="fixed bottom-0 left-0 w-full flex justify-center pb-3 sm:pb-6 px-2 sm:px-0 z-40">
        <div className="flex items-center justify-center gap-1 sm:gap-3 bg-black/60 px-2 sm:px-5 py-2 sm:py-3 rounded-xl sm:rounded-2xl border border-white/10 backdrop-blur-2xl shadow-2xl w-full sm:w-auto max-w-full overflow-x-auto">
          {/* Participants Button */}
          <button
            onClick={() => setShowParticipants((p) => !p)}
            className="relative flex-shrink-0"
          >
            <div
              className={cn(
                "cursor-pointer rounded-lg sm:rounded-xl px-2 sm:px-4 py-2 border transition touch-manipulation active:scale-95",
                showParticipants
                  ? "bg-blue-600 border-blue-400"
                  : "bg-[#1c2732] border-white/10 hover:bg-[#2c3641]"
              )}
            >
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              {participants.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-500 text-[9px] sm:text-[10px] w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center">
                  {participants.length}
                </span>
              )}
            </div>
          </button>

          {/* Chat Button */}
          <div className="flex-shrink-0">
            <ChatButton
              onClick={() => setShowChat((p) => !p)}
              unreadCount={unreadCount}
              isActive={showChat}
            />
          </div>

          <div className="w-px h-4 sm:h-6 bg-white/10 mx-0.5 sm:mx-2 flex-shrink-0" />

          {/* Media Controls */}
          <CustomControls />
        </div>
      </div>

      {/* Message Notifications Stack - Desktop: LEFT, Mobile: BOTTOM */}
      <div className="fixed bottom-20 left-4 md:top-4 md:bottom-auto md:left-4 z-[100] flex flex-col gap-2 max-w-[calc(100vw-2rem)] md:max-w-none">
        <AnimatePresence mode="popLayout">
          {visibleNotifications.map((notification) => (
            <MessageNotification
              key={notification.message.id}
              message={notification}
              onClose={() => handleNotificationClose(notification.message.id)}
              onClick={handleNotificationClick}
            />
          ))}
        </AnimatePresence>
        {/* Unread count indicator if there are more than 3 */}
        {unreadCount > MAX_VISIBLE_NOTIFICATIONS && visibleNotifications.length > 0 && (
          <div className="w-full md:w-[360px] bg-dark-3/90 border border-white/10 rounded-lg px-3 py-2 text-center text-xs text-gray-300 backdrop-blur-md">
            + {unreadCount - MAX_VISIBLE_NOTIFICATIONS} more message
            {unreadCount - MAX_VISIBLE_NOTIFICATIONS > 1 ? "s" : ""}
          </div>
        )}
      </div>
    </section>
  );
};

export default MeetingRoom;
