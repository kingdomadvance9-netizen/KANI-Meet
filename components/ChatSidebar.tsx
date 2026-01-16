"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  useSocketChat,
  SocketChatMessage,
} from "@/hooks/useSocketChat";

import {
  X,
  Send,
  Reply,
  Pin,
  ThumbsUp,
  Heart,
  Laugh,
} from "lucide-react";
import { useUser } from "@clerk/nextjs";

interface ChatSidebarProps {
  open: boolean;
  onClose: () => void;
  roomId: string; // ✅ ADDED: Pass roomId as a prop
}

const Avatar = ({ name, avatarUrl }: { name: string; avatarUrl?: string }) => {
  const [error, setError] = useState(false);

  if (!avatarUrl || error) {
    return (
      <div className="w-6 h-6 rounded-full bg-gray-600 text-white flex items-center justify-center text-xs shrink-0">
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={avatarUrl}
      alt={name}
      className="w-6 h-6 rounded-full object-cover shrink-0"
      onError={() => setError(true)}
    />
  );
};

interface ChatSidebarProps {
  open: boolean;
  onClose: () => void;
}

const formatDay = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

const ChatSidebar = ({ open, onClose , roomId}: ChatSidebarProps) => {
  const { user } = useUser();
  const selfUserId = user?.id;

  const {
    messages,
    sendMessage,
    connected,
    selfSocketId,
    typingUsers,
    startTyping,
    pinnedMessage,
    pinMessage,
    reactToMessage,
  } = useSocketChat(roomId);

  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<SocketChatMessage | null>(null);

  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);

  // Auto-scroll to bottom when messages change (if user is near bottom)
  useEffect(() => {
    if (isNearBottom && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isNearBottom]);

  // Check if user is near bottom of chat
  const checkIfNearBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const threshold = 150; // pixels from bottom
    const isNear =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      threshold;
    setIsNearBottom(isNear);
  };

  const handleSend = () => {
    if (!input.trim()) return;

    sendMessage(input, replyTo ?? undefined);

    setInput("");
    setReplyTo(null);
  };

  const scrollToMessage = (id: string) => {
    const el = messageRefs.current[id];
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "center" });

    el.classList.add("ring-2", "ring-blue-500");
    setTimeout(() => {
      el.classList.remove("ring-2", "ring-blue-500");
    }, 1500);
  };

  const firstMessageDay =
    messages.length > 0 ? formatDay(messages[0].message.createdAt) : null;

  return (
    <aside
      className={cn(
        `fixed right-0 top-0 h-full w-[300px]
         bg-[#0d1117] border-l border-gray-700 shadow-xl
         transition-transform duration-300 z-50 flex flex-col`,
        open ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* HEADER */}
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <h2 className="text-white font-semibold">Chat</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X size={18} />
        </button>
      </div>

      {/* PINNED MESSAGE */}
      {pinnedMessage && (
        <div
          onClick={() => scrollToMessage(pinnedMessage.id)}
          className="cursor-pointer px-4 py-2 text-xs bg-yellow-900/30 text-yellow-300 border-b border-yellow-700 flex gap-2 items-center hover:bg-yellow-900/40 transition-colors"
          title={`${pinnedMessage.sender.name}: ${pinnedMessage.text}`}
        >
          <Pin size={14} className="flex-shrink-0" />
          <span className="truncate">
            <b>{pinnedMessage.sender.name}:</b>{" "}
            {pinnedMessage.text.length > 60
              ? `${pinnedMessage.text.substring(0, 60)}...`
              : pinnedMessage.text}
          </span>
        </div>
      )}

      {/* STATUS */}
      {!connected && (
        <div className="px-4 py-2 text-xs text-yellow-400 border-b border-gray-700">
          Connecting…
        </div>
      )}

      {/* MESSAGES */}
      <div
        ref={messagesContainerRef}
        onScroll={checkIfNearBottom}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-1 scroll-smooth"
      >
        {firstMessageDay && (
          <div className="text-center text-xs text-gray-500 my-3">
            — {firstMessageDay} —
          </div>
        )}

        {messages.map((m, i) => {
          const isSelf = m.message.sender.id === selfUserId;

          const grouped =
            i > 0 &&
            messages[i - 1].socketId === m.socketId &&
            m.message.createdAt - messages[i - 1].message.createdAt <
              2 * 60 * 1000;

          return (
            <motion.div
              key={m.message.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: 0.2,
                ease: [0.22, 1, 0.36, 1],
              }}
              ref={(el: HTMLDivElement | null) => {
                messageRefs.current[m.message.id] = el;
              }}
              className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 text-sm transition-all",
                isSelf
                  ? "ml-auto bg-blue-600 text-white"
                  : "mr-auto bg-[#161b22] text-white",
                grouped ? "mt-0.5" : "mt-3"
              )}
            >
              {!isSelf && !grouped && (
                <div className="flex items-center gap-2 mb-1">
                  <Avatar
                    name={m.message.sender.name}
                    avatarUrl={m.message.sender.avatarUrl}
                  />

                  <span className="text-[11px] text-gray-400">
                    {m.message.sender.name}
                  </span>
                </div>
              )}

              {/* REPLY PREVIEW */}
              {m.message.replyTo &&
                (() => {
                  const reply = m.message.replyTo;

                  return (
                    <div
                      onClick={() => scrollToMessage(reply.id)}
                      className="mb-1 px-2 py-1 text-xs bg-black/30 rounded cursor-pointer"
                    >
                      <div className="font-semibold text-gray-300">
                        {reply.senderName}
                      </div>
                      <div className="opacity-80 truncate">{reply.text}</div>
                    </div>
                  );
                })()}

              {/* MESSAGE TEXT */}
              <div className="break-words">{m.message.text}</div>

              {/* REACTIONS */}
              {m.message.reactions && (
                <div className="flex gap-1 mt-1 text-xs">
                  {Object.entries(m.message.reactions).map(([emoji, users]) => (
                    <div
                      key={emoji}
                      className="px-1.5 py-0.5 bg-black/30 rounded"
                    >
                      {emoji} {users.length}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-1 text-[10px] opacity-70 text-right">
                {formatTime(m.message.createdAt)}
              </div>

              {!grouped && (
                <div className="flex gap-3 text-xs mt-1 opacity-60 items-center">
                  {/* Reply */}
                  <button
                    onClick={() => setReplyTo(m.message)}
                    className="hover:opacity-100"
                  >
                    <Reply size={14} />
                  </button>

                  {/* Pin */}
                  <button
                    onClick={() => pinMessage(m.message)}
                    className="hover:opacity-100"
                  >
                    <Pin size={14} />
                  </button>

                  {/* Reactions */}
                  <button
                    onClick={() => reactToMessage(m.message.id, "👍")}
                    className={cn(
                      "transition",
                      m.message.reactions?.["👍"]?.includes(selfUserId ?? "")
                        ? "text-blue-400"
                        : "opacity-60"
                    )}
                    title="Thumps Up"
                  >
                    <ThumbsUp size={14} />
                  </button>

                  <button
                    onClick={() => reactToMessage(m.message.id, "😂")}
                    className={cn(
                      "transition",
                      m.message.reactions?.["😂"]?.includes(selfUserId ?? "")
                        ? "text-yellow-400"
                        : "opacity-60"
                    )}
                    title="Laugh"
                  >
                    <Laugh size={14} />
                  </button>

                  <button
                    onClick={() => reactToMessage(m.message.id, "❤️")}
                    className={cn(
                      "transition",
                      m.message.reactions?.["❤️"]?.includes(selfUserId ?? "")
                        ? "text-red-400"
                        : "opacity-60"
                    )}
                    title="Love"
                  >
                    <Heart size={14} />
                  </button>
                </div>
              )}
            </motion.div>
          );
        })}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* TYPING INDICATORS */}
      {typingUsers.length > 0 && (
        <div className="px-4 pb-2 text-xs text-gray-400 flex items-center gap-2">
          {(() => {
            const count = typingUsers.length;

            if (count === 1) {
              return <span>{typingUsers[0].name} is typing...</span>;
            }

            if (count === 2) {
              return (
                <span>
                  {typingUsers[0].name} and {typingUsers[1].name} are typing...
                </span>
              );
            }

            if (count === 3) {
              return (
                <span>
                  {typingUsers[0].name}, {typingUsers[1].name}, and{" "}
                  {typingUsers[2].name} are typing...
                </span>
              );
            }

            if (count === 4) {
              return (
                <span>
                  {typingUsers[0].name}, {typingUsers[1].name}, and 2 others
                  are typing...
                </span>
              );
            }

            // 5+ users: Show first 3 avatars + count
            return (
              <div className="flex items-center gap-1.5">
                {typingUsers.slice(0, 3).map((u, i) => (
                  <div
                    key={i}
                    className="w-5 h-5 rounded-full bg-gray-600 text-white flex items-center justify-center text-[9px] font-semibold"
                  >
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                ))}
                <span className="text-gray-400">
                  and {count - 3} {count - 3 === 1 ? "other" : "others"} are
                  typing...
                </span>
              </div>
            );
          })()}
        </div>
      )}

      {/* REPLY BAR */}
      {replyTo && (
        <div className="px-3 py-2 text-xs bg-[#161b22] border-t border-gray-700 flex justify-between items-center">
          <span>
            Replying to <b>{replyTo.sender.name}</b>: {replyTo.text}
          </span>

          <button
            className="text-red-400 hover:text-red-300"
            onClick={() => setReplyTo(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* INPUT */}
      <div className="p-3 border-t border-gray-700">
        <div className="flex gap-2 items-center">
          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              startTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message…"
            className="flex-1 rounded-md bg-[#0f141a] border border-gray-600 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 transition"
          />

          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className={cn(
              "p-2 rounded-md transition",
              input.trim()
                ? "text-blue-500 hover:bg-blue-500/10"
                : "text-gray-500 cursor-not-allowed"
            )}
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default ChatSidebar;
