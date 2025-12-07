import { ParticipantView, StreamVideoParticipant } from "@stream-io/video-react-sdk";
// import CustomParticipantViewUI from "../CustomParticipantViewUI";

interface MobileNormalLayoutProps {
  sorted: StreamVideoParticipant[];
  activeSpeaker: StreamVideoParticipant | null;
  screenWidth: number;
}

const MobileNormalLayout = ({ sorted, activeSpeaker, screenWidth }: MobileNormalLayoutProps) => {

  const getGlowClass = (p: StreamVideoParticipant) =>
    p.sessionId === activeSpeaker?.sessionId
      ? "ring-4 ring-blue-400 shadow-blue-300 shadow-xl scale-[1.03] transition-all duration-300"
      : "";

  return (
    <div className="h-[calc(100vh-100px)] overflow-y-auto p-4 pb-24">
      <div
        className="
          grid 
          grid-cols-2 
          md:grid-cols-3   
          gap-4
        "
      >
        {sorted.map((p) => (
          <div
            key={p.sessionId}
            className={`
              bg-black/40 
              rounded-xl 
              overflow-hidden 
              shadow-lg 
              w-full 
              aspect-square
              transition-all
              ${getGlowClass(p)}
            `}
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

export default MobileNormalLayout;