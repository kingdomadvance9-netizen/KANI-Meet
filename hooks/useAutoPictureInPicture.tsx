// hooks/useAutoPictureInPicture.tsx
import { useEffect, useState, useCallback, useMemo } from "react";
import { 
    useCallStateHooks,
    hasScreenShare
} from "@stream-io/video-react-sdk";

export const useAutoPictureInPicture = () => {
    const { 
        useDominantSpeaker, 
        useHasOngoingScreenShare,
        useParticipants 
    } = useCallStateHooks();

    const participants = useParticipants();
    const dominantSpeaker = useDominantSpeaker();
    const hasOngoingScreenShare = useHasOngoingScreenShare();

    const [isPiPActive, setIsPiPActive] = useState(false);
    const [pipWindow, setPipWindow] = useState<Window | null>(null);

    const screenSharer = useMemo(
        () => participants.find((p) => hasScreenShare(p)),
        [participants]
    );

    // Priority logic for selecting participant
    const getTargetParticipant = useCallback(() => {
        // Priority 1: Screen sharer
        if (hasOngoingScreenShare && screenSharer) {
            return screenSharer;
        }
        // Priority 2: Dominant speaker
        if (dominantSpeaker) {
            return dominantSpeaker;
        }
        // Priority 3: First participant (sorted by Stream)
        return participants[0] || null;
    }, [dominantSpeaker, hasOngoingScreenShare, screenSharer, participants]);

    const currentTargetParticipant = useMemo(() => getTargetParticipant(), [getTargetParticipant]);

    // Document PiP toggle (desktop)
    const toggleDocumentPiP = useCallback(async () => {
        if (!("documentPictureInPicture" in window)) {
            return;
        }

        if (pipWindow) {
            pipWindow.close();
            setPipWindow(null);
            setIsPiPActive(false);
        } else {
            try {
                const pw = await (window as any).documentPictureInPicture.requestWindow({
                    width: 400,
                    height: 300
                });

                // Copy stylesheets to PiP window
                window.document.head
                    .querySelectorAll('link[rel="stylesheet"], style')
                    .forEach((node) => {
                        pw.document.head.appendChild(node.cloneNode(true));
                    });

                // Handle window close
                pw.addEventListener("pagehide", () => {
                    setPipWindow(null);
                    setIsPiPActive(false);
                });

                setPipWindow(pw);
                setIsPiPActive(true);
            } catch (error) {
                console.error("Document PiP failed:", error);
            }
        }
    }, [pipWindow]);

    // Video PiP toggle (mobile fallback)
    const toggleVideoPiP = useCallback(async () => {
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
                setIsPiPActive(false);
            } else {
                // Find video element for current target
                if (!currentTargetParticipant) return;
                
                const videoElements = Array.from(document.querySelectorAll('video')) as HTMLVideoElement[];
                let targetVideo: HTMLVideoElement | null = null;
                
                // Try to find the first active video
                for (const video of videoElements) {
                    if (video.srcObject && video.readyState >= 2) {
                        targetVideo = video;
                        break;
                    }
                }

                if (targetVideo && 'requestPictureInPicture' in targetVideo) {
                    await targetVideo.requestPictureInPicture();
                    setIsPiPActive(true);
                }
            }
        } catch (error) {
            console.error("Video PiP failed:", error);
        }
    }, [currentTargetParticipant]);

    // Unified toggle - prefer Document PiP, fallback to Video PiP
    const togglePiP = useCallback(async () => {
        if ("documentPictureInPicture" in window) {
            await toggleDocumentPiP();
        } else {
            await toggleVideoPiP();
        }
    }, [toggleDocumentPiP, toggleVideoPiP]);

    // Track Video PiP state changes
    useEffect(() => {
        const handleEnterPiP = () => setIsPiPActive(true);
        const handleLeavePiP = () => setIsPiPActive(false);

        document.addEventListener("enterpictureinpicture", handleEnterPiP);
        document.addEventListener("leavepictureinpicture", handleLeavePiP);

        return () => {
            document.removeEventListener("enterpictureinpicture", handleEnterPiP);
            document.removeEventListener("leavepictureinpicture", handleLeavePiP);
        };
    }, []);

    // Check if either PiP method is supported
    const isPiPSupported = 
        ("documentPictureInPicture" in window) || 
        (typeof document !== 'undefined' && document.pictureInPictureEnabled === true);
    
    const isDocumentPiP = !!pipWindow && isPiPActive;

    return { 
        togglePiP, 
        isPiPActive, 
        isPiPSupported,
        pipWindow,
        currentTargetParticipant,
        isDocumentPiP
    };
};