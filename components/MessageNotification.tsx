"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { ReceivedMessage } from "@/hooks/useSocketChat";

interface MessageNotificationProps {
  message: ReceivedMessage;
  onClose: () => void;
  onClick: () => void;
}

const MessageNotification = ({
  message,
  onClose,
  onClick,
}: MessageNotificationProps) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    setProgress(100);

    // Progress animation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          clearInterval(progressInterval);
          return 0;
        }
        return prev - 2; // Decrease by 2% every 100ms = 5 seconds total
      });
    }, 100);

    // Auto-dismiss after 5 seconds
    const timer = setTimeout(() => {
      onClose();
    }, 5000);

    return () => {
      clearTimeout(timer);
      clearInterval(progressInterval);
    };
  }, [message.message.id, onClose]);

  const truncateMessage = (text: string, maxLength: number = 80) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -100, scale: 0.9, transition: { duration: 0.2 } }}
      transition={{
        type: "spring",
        stiffness: 500,
        damping: 35,
        mass: 0.8
      }}
      onClick={onClick}
      className="w-full md:w-[380px] bg-gradient-to-br from-dark-1 to-dark-3/80 border border-white/20 rounded-xl shadow-2xl cursor-pointer hover:shadow-[0_20px_50px_rgba(8,_112,_184,_0.2)] hover:border-blue-500/40 hover:scale-[1.02] transition-all overflow-hidden backdrop-blur-md"
    >
      <div className="p-4 flex gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0 relative">
          {message.message.sender.avatarUrl ? (
            <img
              src={message.message.sender.avatarUrl}
              alt={message.message.sender.name}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-blue-500/30"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center font-bold text-sm shadow-lg ring-2 ring-blue-500/30">
              {message.message.sender.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-dark-1"></div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-white text-sm truncate">
              {message.message.sender.name}
            </span>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all p-1.5 flex-shrink-0 -mr-1"
            >
              <X size={14} />
            </button>
          </div>
          <p className="text-gray-200 text-sm leading-relaxed break-words line-clamp-2">
            {truncateMessage(message.message.text, 120)}
          </p>
          {message.message.replyTo && (
            <div className="mt-2 pl-3 border-l-2 border-blue-500/60 text-[11px] text-gray-400 bg-blue-500/5 rounded-r py-1 -ml-1">
              <span className="font-medium">
                ↩ Replying to {message.message.replyTo.senderName}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-dark-3/50 relative overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute top-0 left-0 h-full bg-blue-400/40 blur-sm transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </motion.div>
  );
};

export default MessageNotification;
