"use client";

import { useEffect, useState } from "react";

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

  useEffect(() => {
    // Ensure we have a string ID
    const roomId = Array.isArray(id) ? id[0] : id;
    if (!roomId) return;

    const loadCall = async () => {
      try {
        // ✅ PHASE 6: Replace with your actual API endpoint
        // const response = await fetch(`/api/meetings/${roomId}`);
        // const data = await response.json();
        
        // Mocking a successful fetch for now so your UI doesn't break
        const mockCall: MeetingRoom = {
          id: roomId,
          description: "Mediasoup Meeting",
          startsAt: new Date().toISOString(),
        };

        setCall(mockCall);
        setIsCallLoading(false);
      } catch (error) {
        console.error("Failed to fetch room metadata:", error);
        setIsCallLoading(false);
      }
    };

    loadCall();
  }, [id]);

  return { call, isCallLoading };
};