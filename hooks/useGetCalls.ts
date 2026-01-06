"use client";

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';

// ✅ Define a generic Meeting interface to replace the Stream Call type
export interface Meeting {
  id: string;
  description: string;
  startsAt: string;
  endedAt?: string;
  createdBy: string;
}

export const useGetCalls = () => {
  const { user } = useUser();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadMeetings = async () => {
      if (!user?.id) return;
      
      setIsLoading(true);

      try {
        // ✅ PHASE 6: Fetch from YOUR backend database
        // const response = await fetch(`/api/meetings?userId=${user.id}`);
        // const data = await response.json();
        
        // For now, we return an empty array or mock data to prevent UI crashes
        setMeetings([]); 
      } catch (error) {
        console.error("Error fetching meetings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMeetings();
  }, [user?.id]);

  const now = new Date();

  // Logic remains the same, just using our custom Meeting interface
  const endedCalls = meetings.filter(({ startsAt, endedAt }: Meeting) => {
    return (startsAt && new Date(startsAt) < now) || !!endedAt;
  });

  const upcomingCalls = meetings.filter(({ startsAt }: Meeting) => {
    return startsAt && new Date(startsAt) > now;
  });

  return { 
    endedCalls, 
    upcomingCalls, 
    callRecordings: meetings, // You will later link this to your S3/Storage bucket
    isLoading 
  };
};