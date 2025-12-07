// hooks/useAutoPictureInPicture.tsx
import { useEffect, useState, useCallback, useMemo } from "react";
import { 
    useCallStateHooks,
    hasScreenShare
} from "@stream-io/video-react-sdk";

export const useAutoPictureInPicture = () => {
    // --- Stream Hooks ---
    const { 
        useDominantSpeaker, 
        useHasOngoingScreenShare,
        useParticipants 
    } = useCallStateHooks();

    const participants = useParticipants();
    const dominantSpeaker = useDominantSpeaker();
    const hasOngoingScreenShare = useHasOngoingScreenShare();

    // --- State ---
    const [isPiPActive, setIsPiPActive] = useState(false);

    // Find screen sharer
    const screenSharer = useMemo(
        () => participants.find((p) => hasScreenShare(p)),
        [participants]
    );

    // --- Helper to find the correct video element based on Priority ---
    const getTargetVideo = useCallback((): HTMLVideoElement | null => {
        let targetSessionId: string | undefined;

        // 1. SCREEN SHARE (Highest Priority)
        if (hasOngoingScreenShare && screenSharer) {
            targetSessionId = screenSharer.sessionId; 
        } 
        // 2. DOMINANT SPEAKER
        else if (dominantSpeaker) {
            targetSessionId = dominantSpeaker.sessionId;
        } 
        // 3. FIRST NON-LOCAL PARTICIPANT (Fallback)
        else {
            const nonLocalParticipant = participants.find(p => !p.isLocalParticipant);
            if (nonLocalParticipant) {
                targetSessionId = nonLocalParticipant.sessionId;
            }
        }

        if (!targetSessionId) {
            // Final fallback: any video element
            return document.querySelector('video') || null;
        }

        // Search for the video element corresponding to the targetSessionId
        // Note: You'll need to add data-session-id to your ParticipantView wrapper
        const selector = `video[data-session-id="${targetSessionId}"]`;
        const targetVideoElement = document.querySelector<HTMLVideoElement>(selector);

        if (targetVideoElement) {
            return targetVideoElement;
        }
        
        // Final fallback
        return document.querySelector('video') || null;
        
    }, [dominantSpeaker, hasOngoingScreenShare, screenSharer, participants]);
    
    // Memoize the target video element
    const currentTargetVideo = useMemo(() => getTargetVideo(), [getTargetVideo]);

    // --- PiP Control Functions ---
    const togglePiP = async () => {
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture().catch(console.error);
        } else if (currentTargetVideo && document.pictureInPictureEnabled) {
            await currentTargetVideo.requestPictureInPicture().catch(error => {
                console.error("Manual PiP failed:", error);
            });
        }
    };

    // --- EFFECT: Handle Events and Auto-Exit ---
    useEffect(() => {
        const handlePiPEvent = () => {
            setIsPiPActive(!!document.pictureInPictureElement);
        };

        document.addEventListener("enterpictureinpicture", handlePiPEvent);
        document.addEventListener("leavepictureinpicture", handlePiPEvent);
        
        // Auto-exit when returning to page
        const handleVisibilityChange = async () => {
            if (!document.hidden && document.pictureInPictureElement) {
                await document.exitPictureInPicture().catch(console.error);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.removeEventListener("enterpictureinpicture", handlePiPEvent);
            document.removeEventListener("leavepictureinpicture", handlePiPEvent);
        };
    }, []);
    
    // --- EFFECT: Switch PiP Target when speaker/sharer changes ---
    useEffect(() => {
        if (!isPiPActive) return;

        const currentPiPVideo = document.pictureInPictureElement;

        if (currentTargetVideo && currentPiPVideo !== currentTargetVideo) {
            console.log("Switching PiP target due to speaker/sharer change.");
            
            document.exitPictureInPicture()
                .then(() => currentTargetVideo.requestPictureInPicture())
                .catch(console.error);
        }
    }, [currentTargetVideo, isPiPActive]);

    return { 
        togglePiP, 
        isPiPActive, 
        isPiPSupported: document.pictureInPictureEnabled, 
        currentTargetVideo
    };
};