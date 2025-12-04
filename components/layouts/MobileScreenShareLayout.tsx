import { ParticipantView } from "@stream-io/video-react-sdk";

const MobileScreenShareLayout = ({ participants, screenSharer, activeSpeaker }) => {

  const getGlowClass = (p) =>
    p.sessionId === activeSpeaker?.sessionId
      ? "ring-4 ring-blue-400 shadow-blue-300 shadow-xl scale-[1.03] transition-all duration-300"
      : "";

  return (
    <div className="w-full h-full flex flex-col gap-3 overflow-hidden">

      {/* Sticky shared screen */}
      <div
        className="
          sticky top-0 z-20 w-full 
          bg-black/40 rounded-xl shadow-xl overflow-hidden
          h-[40vh] min-h-[250px]
          md:h-[55vh]
        "
      >
        <ParticipantView
          participant={screenSharer}
          trackType="screenShareTrack"
        />
      </div>

      {/* Thumbnails */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2 overflow-y-auto pb-20">
        {participants
          .filter((p) => p.sessionId !== screenSharer.sessionId)
          .map((p) => (
            <div
              key={p.sessionId}
              className={`bg-black/40 h-[130px] rounded-xl overflow-hidden shadow-md ${getGlowClass(p)}`}
            >
              <ParticipantView 
                participant={p} 
                trackType="videoTrack" 
              />
            </div>
          ))}
      </div>
    </div>
  );
};

export default MobileScreenShareLayout;
