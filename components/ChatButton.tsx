"use client";

import { Button } from "./ui/button";
import { MessageSquare } from "lucide-react";

type ChatButtonProps = {
  onClick: () => void;
  unreadCount?: number;
  isActive?: boolean;
};

const ChatButton = ({ onClick, unreadCount = 0, isActive = false }: ChatButtonProps) => {
  return (
    <button onClick={onClick} className="relative flex-shrink-0">
      <div
        className={`
          cursor-pointer rounded-lg sm:rounded-xl px-2 sm:px-4 py-2 border transition touch-manipulation active:scale-95
          ${
            isActive
              ? "bg-blue-600 border-blue-400"
              : "bg-[#1c2732] border-white/10 hover:bg-[#2c3641]"
          }
        `}
      >
        <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
      </div>
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] sm:text-[10px] w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center font-semibold animate-pulse">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
};

export default ChatButton;
