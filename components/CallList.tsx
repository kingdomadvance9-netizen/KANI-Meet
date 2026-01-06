"use client";

import Loader from "./Loader";
import MeetingCard from "./MeetingCard";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Simplified types for mediasoup
interface Call {
  id: string;
  state?: {
    startsAt?: Date;
    endedAt?: Date;
  };
}

interface CallRecording {
  id: string;
  url: string;
  filename: string;
}

const CallList = ({ type }: { type: "ended" | "upcoming" | "recordings" }) => {
  const router = useRouter();
  const [calls, setCalls] = useState<Call[]>([]);
  const [recordings, setRecordings] = useState<CallRecording[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const getCalls = () => {
    switch (type) {
      case "ended":
        return calls.filter((c) => c.state?.endedAt);
      case "recordings":
        return recordings;
      case "upcoming":
        return calls.filter((c) => c.state?.startsAt && !c.state?.endedAt);
      default:
        return [];
    }
  };

  const getNoCallsMessage = () => {
    switch (type) {
      case "ended":
        return "No Previous Calls";
      case "upcoming":
        return "No Upcoming Calls";
      case "recordings":
        return "No Recordings";
      default:
        return "";
    }
  };

  useEffect(() => {
    // TODO: Fetch calls and recordings from your backend/database
    // For now, this is a placeholder
    setIsLoading(false);
  }, [type]);

  if (isLoading) return <Loader />;

  const callsList = getCalls();
  const noCallsMessage = getNoCallsMessage();

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      {callsList && callsList.length > 0 ? (
        callsList.map((meeting: any) => (
          <MeetingCard
            key={meeting.id}
            icon={
              type === "ended"
                ? "/icons/previous.svg"
                : type === "upcoming"
                ? "/icons/upcoming.svg"
                : "/icons/recordings.svg"
            }
            title={
              meeting.state?.custom?.description ||
              meeting.filename?.substring(0, 20) ||
              "Meeting"
            }
            date={
              meeting.state?.startsAt?.toLocaleString() ||
              meeting.start_time?.toLocaleString() ||
              "No date"
            }
            isPreviousMeeting={type === "ended"}
            link={
              type === "recordings"
                ? meeting.url
                : `${process.env.NEXT_PUBLIC_BASE_URL}/meeting/${meeting.id}`
            }
            buttonIcon1={type === "recordings" ? "/icons/play.svg" : undefined}
            buttonText={type === "recordings" ? "Play" : "Start"}
            handleClick={
              type === "recordings"
                ? () => router.push(meeting.url)
                : () => router.push(`/meeting/${meeting.id}`)
            }
          />
        ))
      ) : (
        <h1 className="text-2xl font-bold text-white">{noCallsMessage}</h1>
      )}
    </div>
  );
};

export default CallList;
