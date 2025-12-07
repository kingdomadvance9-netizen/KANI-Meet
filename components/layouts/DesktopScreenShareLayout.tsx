import { ParticipantView, StreamVideoParticipant } from "@stream-io/video-react-sdk";
// import CustomParticipantViewUI from "../CustomParticipantViewUI";

interface DesktopScreenShareLayoutProps {
  participants: StreamVideoParticipant[];
  screenSharer: StreamVideoParticipant;
  activeSpeaker: StreamVideoParticipant | null;
}

const DesktopScreenShareLayout = ({ participants, screenSharer, activeSpeaker }: DesktopScreenShareLayoutProps) => {
  const getGlowClass = (p: StreamVideoParticipant) =>
    p.sessionId === activeSpeaker?.sessionId
      ? "ring-4 ring-blue-400 shadow-blue-300 shadow-xl scale-[1.03] transition-all duration-300"
      : "";

  return (
    <div className="w-full h-full flex gap-4 overflow-hidden">

      {/* Shared Screen - 3/4 width */}
      <div className="flex-[3] h-full">
        <div className="w-full h-full bg-black/40 rounded-xl overflow-hidden shadow-xl">
          <ParticipantView
            participant={screenSharer}
            trackType="screenShareTrack"
            className="!w-full !h-full object-cover"
            // ParticipantViewUI={CustomParticipantViewUI}
          />
        </div>
      </div>

      {/* Right thumbnails */}
      <div className="flex-[1] h-full overflow-y-auto flex flex-col gap-4 pr-1">
        {participants
          .filter((p) => p.sessionId !== screenSharer.sessionId)
          .map((p) => (
            <div
              key={p.sessionId}
              className={`
                w-full bg-black/40 rounded-xl overflow-hidden shadow-md 
                ${getGlowClass(p)}
              `}
              style={{ height: "180px", minHeight: "180px" }}
            >
              <ParticipantView
                participant={p}
                trackType="videoTrack"
                className="!w-full !h-full object-cover"
                // ParticipantViewUI={CustomParticipantViewUI}
              />
            </div>
          ))}
      </div>
    </div>
  );
};

export default DesktopScreenShareLayout;