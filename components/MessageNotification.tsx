"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { ReceivedMessage } from "@/hooks/useSocketChat";

interface MessageNotificationProps {
  message: ReceivedMessage;
  index: number;
  onClose: () => void;
  onClick: () => void;
}

const MessageNotification = ({
  message,
  index,
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
      initial={{ opacity: 0, y: -20, x: 50 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, x: 50, transition: { duration: 0.2 } }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      onClick={onClick}
      style={{
        marginTop: index * 8, // Slight stacking effect
      }}
      className="w-[300px] md:w-[360px] bg-dark-1 border border-white/20 rounded-lg shadow-2xl cursor-pointer hover:shadow-xl hover:border-white/30 transition-all overflow-hidden"
    >
      <div className="p-3 flex gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {message.message.sender.avatarUrl ? (
            <img
              src={message.message.sender.avatarUrl}
              alt={message.message.sender.name}
              className="w-9 h-9 rounded-full object-cover"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm">
              {message.message.sender.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="font-semibold text-white text-sm truncate">
              {message.message.sender.name}
            </span>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-white transition-colors p-1 flex-shrink-0"
            >
              <X size={14} />
            </button>
          </div>
          <p className="text-gray-300 text-xs break-words line-clamp-2">
            {truncateMessage(message.message.text, 100)}
          </p>
          {message.message.replyTo && (
            <div className="mt-1 pl-2 border-l-2 border-blue-500 text-[10px] text-gray-400">
              <span className="font-medium">
                Replying to {message.message.replyTo.senderName}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-gray-700">
        <div
          className="h-full bg-blue-500 transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </motion.div>
  );
};

export default MessageNotification;
