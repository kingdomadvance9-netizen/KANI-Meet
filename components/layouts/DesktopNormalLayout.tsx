import {
  ParticipantView,
  StreamVideoParticipant,
} from "@stream-io/video-react-sdk";
// import CustomParticipantViewUI from "../CustomParticipantViewUI";

interface DesktopNormalLayoutProps {
  sorted: StreamVideoParticipant[];
  screenWidth: number;
  activeSpeaker: StreamVideoParticipant | null;
}

const DesktopNormalLayout = ({
  sorted,
  screenWidth,
  activeSpeaker,
}: DesktopNormalLayoutProps) => {
  const count = sorted.length;

  // Highlight active speaker
  const getGlowClass = (p: StreamVideoParticipant) =>
    p.sessionId === activeSpeaker?.sessionId
      ? "ring-4 ring-blue-400 shadow-blue-300 shadow-xl scale-[1.03] transition-all duration-300"
      : "";

  // SMART SCALING LOGIC
  let tileSize = 280;

  if (count === 1) {
    tileSize = Math.min(screenWidth * 0.5, 600);
  } else if (count <= 4) {
    tileSize = 350;
  } else if (count <= 6) {
    tileSize = 310;
  }

  // Column count
  const cols = screenWidth < 1536 ? 4 : screenWidth < 1800 ? 5 : 6;

  return (
    <div
      className="w-full h-full overflow-y-auto grid gap-4 place-items-center"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {sorted.map((p) => (
        <div
          data-session-id={p.sessionId}
          key={p.sessionId}
          className={`
            rounded-xl 
            shadow-lg 
            overflow-hidden 
            bg-black/40
            transition-all
            ${getGlowClass(p)}
          `}
          style={{
            width: `${tileSize}px`,
            height: `${tileSize}px`,
          }}
        >
          <ParticipantView
            participant={p}
            trackType="videoTrack"
            className="!h-full !w-full object-cover"
            // ParticipantViewUI={CustomParticipantViewUI}
          />
        </div>
      ))}
    </div>
  );
};

export default DesktopNormalLayout;
