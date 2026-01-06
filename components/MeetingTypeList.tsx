/* eslint-disable camelcase */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import ReactDatePicker from "react-datepicker";

import HomeCard from "./HomeCard";
import MeetingModal from "./MeetingModal";
import Loader from "./Loader";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";

import "react-datepicker/dist/react-datepicker.css";

const initialValues = {
  dateTime: new Date(),
  description: "",
  link: "",
};

const MeetingTypeList = () => {
  const router = useRouter();
  const { user } = useUser();
  
  const [meetingState, setMeetingState] = useState<
    "isScheduleMeeting" | "isJoiningMeeting" | "isInstantMeeting" | undefined
  >(undefined);

  const [values, setValues] = useState(initialValues);
  const [generatedMeetingId, setGeneratedMeetingId] = useState<string | null>(null);

  const createMeeting = async () => {
    if (!user) return;

    try {
      if (!values.dateTime) {
        toast.error("Please select a date and time");
        return;
      }

      // 1. Generate a unique ID locally
      const id = crypto.randomUUID();
      
      // 2. PHASE 6: Save meeting metadata to YOUR database
      // Example: await fetch('/api/meetings', { 
      //   method: 'POST', 
      //   body: JSON.stringify({ id, userId: user.id, description: values.description, startsAt: values.dateTime }) 
      // });

      setGeneratedMeetingId(id);

      // 3. If it's an instant meeting, go straight to the room
      if (!values.description && meetingState === "isInstantMeeting") {
        router.push(`/meeting/${id}`);
      }

      toast.success("Meeting Created Successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to create meeting");
    }
  };

  // Removed client check, only need user for the dashboard
  if (!user) return <Loader />;

  const meetingLink = `${process.env.NEXT_PUBLIC_BASE_URL}/meeting/${generatedMeetingId}`;

  return (
    <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
      <HomeCard
        img="/icons/add-meeting.svg"
        title="New Meeting"
        description="Start an instant meeting"
        handleClick={() => setMeetingState("isInstantMeeting")}
        className="bg-orange-600" // Custom color
      />

      <HomeCard
        img="/icons/join-meeting.svg"
        title="Join Meeting"
        description="via invitation link"
        className="bg-blue-600"
        handleClick={() => setMeetingState("isJoiningMeeting")}
      />

      <HomeCard
        img="/icons/schedule.svg"
        title="Schedule Meeting"
        description="Plan your meeting"
        className="bg-purple-600"
        handleClick={() => setMeetingState("isScheduleMeeting")}
      />

      <HomeCard
        img="/icons/recordings.svg"
        title="View Recordings"
        description="Meeting Recordings"
        className="bg-yellow-600"
        handleClick={() => router.push("/recordings")}
      />

      {/* SCHEDULE MODAL */}
      {!generatedMeetingId ? (
        <MeetingModal
          isOpen={meetingState === "isScheduleMeeting"}
          onClose={() => setMeetingState(undefined)}
          title="Create Meeting"
          handleClick={createMeeting}
        >
          <div className="flex flex-col gap-2.5">
            <label className="text-base font-normal leading-[22.4px] text-sky-2">Add a description</label>
            <Textarea
              className="border-none bg-dark-3 focus-visible:ring-0 focus-visible:ring-offset-0"
              onChange={(e) => setValues({ ...values, description: e.target.value })}
            />
          </div>
          <div className="flex w-full flex-col gap-2.5">
            <label className="text-base font-normal leading-[22.4px] text-sky-2">Select Date and Time</label>
            <ReactDatePicker
              selected={values.dateTime}
              onChange={(date) => setValues({ ...values, dateTime: date! })}
              showTimeSelect
              timeFormat="HH:mm"
              timeIntervals={15}
              timeCaption="time"
              dateFormat="MMMM d, yyyy h:mm aa"
              className="w-full rounded bg-dark-3 p-2 focus:outline-none"
            />
          </div>
        </MeetingModal>
      ) : (
        <MeetingModal
          isOpen={meetingState === "isScheduleMeeting"}
          onClose={() => {
            setMeetingState(undefined);
            setGeneratedMeetingId(null);
          }}
          title="Meeting Created"
          handleClick={() => {
            navigator.clipboard.writeText(meetingLink);
            toast.success("Link Copied");
          }}
          image={"/icons/checked.svg"}
          buttonIcon="/icons/copy.svg"
          className="text-center"
          buttonText="Copy Meeting Link"
        />
      )}

      {/* JOIN MODAL */}
      <MeetingModal
        isOpen={meetingState === "isJoiningMeeting"}
        onClose={() => setMeetingState(undefined)}
        title="Paste the link or ID here"
        className="text-center"
        buttonText="Join Meeting"
        handleClick={() => {
            // Clean the link if the user pastes the whole URL
            const id = values.link.split('/').pop();
            router.push(`/meeting/${id}`);
        }}
      >
        <Input
          placeholder="Meeting link or ID"
          onChange={(e) => setValues({ ...values, link: e.target.value })}
          className="border-none bg-dark-3 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </MeetingModal>

      {/* INSTANT MEETING MODAL */}
      <MeetingModal
        isOpen={meetingState === "isInstantMeeting"}
        onClose={() => setMeetingState(undefined)}
        title="Start an Instant Meeting"
        className="text-center"
        buttonText="Start Meeting"
        handleClick={createMeeting}
      />
    </section>
  );
};

export default MeetingTypeList;