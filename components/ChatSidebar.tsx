"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  useSocketChat,
  SocketChatMessage,
  ChatAttachment,
} from "@/hooks/useSocketChat";

import {
  X,
  Send,
  Reply,
  Pin,
  Plus,
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

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const uploadAttachment = (
    file: File,
    onProgress: (p: number) => void
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const form = new FormData();
      form.append("file", file);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        const res = JSON.parse(xhr.responseText);
        resolve(res.url);
      };

      xhr.onerror = reject;

      xhr.open("POST", "/api/upload");
      xhr.send(form);
    });
  };

  const handleSend = async () => {
    if (!input.trim() && attachments.length === 0) return;

    // Send optimistic message first
    sendMessage(input, replyTo ?? undefined, attachments);

    // Upload attachments
    for (const att of attachments) {
      if (!att.file) continue;

      const url = await uploadAttachment(att.file, (p) => {
        setAttachments((prev) =>
          prev.map((a) => (a.id === att.id ? { ...a, progress: p } : a))
        );
      });

      att.url = url;
      att.uploading = false;
    }

    setAttachments([]);
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
          className="cursor-pointer px-4 py-2 text-xs bg-yellow-900/30 text-yellow-300 border-b border-yellow-700 flex gap-2 items-center"
        >
          <Pin size={14} />
          <span>
            <b>{pinnedMessage.sender.name}:</b> {pinnedMessage.text}
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
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
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
            <div
              key={m.message.id}
              ref={(el) => {
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
              <div>{m.message.text}</div>

              {/* ATTACHMENTS */}
              {(() => {
                const atts = m.message.attachments;
                if (!atts || atts.length === 0) return null;

                return (
                  <div className="mt-2 space-y-1">
                    {atts.map((att) => (
                      <div key={att.id}>
                        {att.type === "image" && (
                          <img
                            src={att.url ?? att.previewUrl}
                            alt={att.name}
                            className="max-w-full rounded cursor-pointer"
                            onClick={() =>
                              setPreviewImage(att.url ?? att.previewUrl ?? null)
                            }
                          />
                        )}

                        {att.type !== "image" && (
                          <div className="text-xs bg-black/30 px-2 py-1 rounded">
                            📎 {att.name}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* REACTIONS (PUT IT HERE 👇) */}
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
            </div>
          );
        })}
      </div>

      {/* TYPING */}
      {typingUsers.length > 0 && (
        <div className="px-4 pb-2 text-xs text-gray-400">
          {typingUsers.map((u) => u.name).join(", ")} typing…
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
      <div className="p-3 border-t border-gray-700 space-y-2">
        {/* ATTACHMENT PREVIEW STRIP */}
        {attachments.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="relative bg-black/30 rounded p-1 text-xs text-white"
              >
                {att.type === "image" ? (
                  <img
                    src={att.previewUrl}
                    alt={att.name}
                    className="w-20 h-20 object-cover rounded"
                  />
                ) : (
                  <div className="px-2 py-1">📎 {att.name}</div>
                )}

                {/* UPLOAD PROGRESS */}
                {att.uploading && (
                  <div className="h-1 bg-gray-700 mt-1 rounded overflow-hidden">
                    <div
                      className="h-1 bg-blue-500 rounded transition-all"
                      style={{ width: `${att.progress ?? 0}%` }}
                    />
                  </div>
                )}

                <button
                  onClick={() =>
                    setAttachments((prev) =>
                      prev.filter((a) => a.id !== att.id)
                    )
                  }
                  className="absolute -top-2 -right-2 bg-red-500 rounded-full w-4 h-4 text-[10px]"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* INPUT ROW */}
        <div className="flex gap-2 items-center">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-white/10"
            title="Add attachment"
          >
            <Plus size={18} />
          </button>

          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              startTyping();
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message…"
            className="flex-1 rounded-md bg-[#0f141a] border border-gray-600 px-1 py-2 text-sm text-white outline-none focus:border-blue-500"
          />

          <button
            onClick={handleSend}
            disabled={!input.trim() && attachments.length === 0}
            className={cn(
              "p-2 rounded-md transition",
              input.trim() || attachments.length > 0
                ? "text-blue-500 hover:bg-blue-500/10"
                : "text-gray-500 cursor-not-allowed"
            )}
          >
            <Send size={20} />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={async (e) => {
            const files = Array.from(e.target.files || []);

            const mapped: ChatAttachment[] = files.map((file) => ({
              id: crypto.randomUUID(),
              name: file.name,
              type: file.type.startsWith("image")
                ? "image"
                : file.type.startsWith("video")
                ? "video"
                : file.type.startsWith("audio")
                ? "audio"
                : "file",
              mime: file.type,
              size: file.size,
              previewUrl: URL.createObjectURL(file),
              uploading: true,
              progress: 0,
              file,
            }));

            setAttachments((prev) => [...prev, ...mapped]);
            e.target.value = "";
          }}
        />
      </div>

      {previewImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          onClick={() => setPreviewImage(null)}
        >
          <img src={previewImage} className="max-h-[90%] max-w-[90%] rounded" />
        </div>
      )}
    </aside>
  );
};

export default ChatSidebar;
