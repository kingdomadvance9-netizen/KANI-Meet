// components/CustomParticipantViewUI.tsx
import { useEffect, useState } from "react";
import { useParticipantViewContext } from "@stream-io/video-react-sdk";

const CustomParticipantViewUI = () => {
  const { videoElement } = useParticipantViewContext();
  const [pictureInPictureElement, setPictureInPictureElement] = useState(
    document.pictureInPictureElement,
  );

  useEffect(() => {
    if (!videoElement) return;

    const handlePictureInPicture = () => {
      setPictureInPictureElement(document.pictureInPictureElement);
    };

    videoElement.addEventListener(
      "enterpictureinpicture",
      handlePictureInPicture,
    );
    videoElement.addEventListener(
      "leavepictureinpicture",
      handlePictureInPicture,
    );

    return () => {
      videoElement.removeEventListener(
        "enterpictureinpicture",
        handlePictureInPicture,
      );
      videoElement.removeEventListener(
        "leavepictureinpicture",
        handlePictureInPicture,
      );
    };
  }, [videoElement]);

  const togglePictureInPicture = () => {
    if (videoElement && pictureInPictureElement !== videoElement)
      return videoElement.requestPictureInPicture().catch(console.error);

    document.exitPictureInPicture().catch(console.error);
  };

  return (
    <button
      disabled={!document.pictureInPictureEnabled}
      style={{ 
        position: "absolute", 
        top: 10, 
        right: 10,
        zIndex: 50,
        background: "rgba(0,0,0,0.6)",
        color: "white",
        padding: "8px 12px",
        borderRadius: "8px",
        fontSize: "12px",
        border: "none",
        cursor: "pointer"
      }}
      onClick={togglePictureInPicture}
    >
      {pictureInPictureElement === videoElement ? "Exit PiP" : "PiP"}
    </button>
  );
};

export default CustomParticipantViewUI;