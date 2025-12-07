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

    // Document PiP toggle
    const toggleDocumentPiP = useCallback(async () => {
        if (!("documentPictureInPicture" in window)) {
            console.warn("Document PiP not supported");
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

    // Unified toggle - Document PiP only (removes video PiP fallback)
    const togglePiP = useCallback(async () => {
        await toggleDocumentPiP();
    }, [toggleDocumentPiP]);

    const isPiPSupported = "documentPictureInPicture" in window;
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