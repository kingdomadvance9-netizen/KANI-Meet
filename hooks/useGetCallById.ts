"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

// ✅ Define a simple interface for your meeting metadata
export interface MeetingRoom {
  id: string;
  description?: string;
  startsAt?: string;
  createdBy?: string;
}

export const useGetCallById = (id: string | string[]) => {
  const [call, setCall] = useState<MeetingRoom | null>(null);
  const [isCallLoading, setIsCallLoading] = useState(true);
  const { user } = useUser();

  useEffect(() => {
    // Ensure we have a string ID
    const roomId = Array.isArray(id) ? id[0] : id;
    if (!roomId) return;

    const loadCall = async () => {
      try {
        // ✅ PHASE 6: Replace with your actual API endpoint
        // const response = await fetch(`/api/meetings/${roomId}`);
        // const data = await response.json();

        // ✅ NEW: Check localStorage to see if current user created this meeting
        let createdBy = "unknown";
        let description = "Meeting";
        try {
          const createdMeetings = JSON.parse(
            localStorage.getItem("created-meetings") || "[]"
          );
          const meeting = createdMeetings.find((m: any) => m.id === roomId);
          if (meeting) {
            createdBy = meeting.createdBy;
            description = meeting.description || "Meeting";
            console.log("✅ Found meeting in localStorage:", {
              roomId,
              createdBy,
              isCurrentUser: user?.id === createdBy,
            });
          } else {
            console.log(
              "ℹ️ Meeting not found in localStorage, treating as joined meeting"
            );
          }
        } catch (err) {
          console.error("Failed to read created meetings from localStorage:", err);
        }

        const mockCall: MeetingRoom = {
          id: roomId,
          description,
          startsAt: new Date().toISOString(),
          createdBy, // ✅ Now using actual creator ID from localStorage
        };

        setCall(mockCall);
        setIsCallLoading(false);
      } catch (error) {
        console.error("Failed to fetch room metadata:", error);
        setIsCallLoading(false);
      }
    };

    loadCall();
  }, [id, user?.id]);

  return { call, isCallLoading };
};
