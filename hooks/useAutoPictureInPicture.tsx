/* eslint-disable camelcase */
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";

// ✅ Helper functions (getColorForUser, createAvatarVideo) remain the same 
// as they are standard browser/canvas logic.
const AVATAR_COLORS = ["#FF6B6B", "#4ECDC4", "#556270", "#C44DFF", "#45B7D1", "#FFA931", "#6BCB77", "#F7B801"];

const getColorForUser = (userId: string) => {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const createAvatarVideoForParticipant = (participant: any) => {
    const id = `avatar-video-${participant.id}`; // Changed sessionId to id
    const existing = document.getElementById(id) as HTMLVideoElement | null;
    if (existing) return existing;

    const canvas = document.createElement("canvas");
    canvas.width = 640; canvas.height = 360;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#1f1f1f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const circleX = canvas.width / 2;
    const circleY = canvas.height / 2 - 40;
    const radius = 80;
    ctx.beginPath();
    ctx.arc(circleX, circleY, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = getColorForUser(participant.id);
    ctx.fill();

    ctx.fillStyle = "white";
    ctx.font = "32px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(participant.name || participant.id, canvas.width / 2, circleY + radius + 40);

    const stream = canvas.captureStream(15);
    const video = document.createElement("video");
    video.id = id;
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    video.style.display = "none";
    document.body.appendChild(video);
    video.play();
    return video;
};

/* ------------------------------------------------------
   REFINED MEDIASOUP HOOK
------------------------------------------------------- */
interface PiPProps {
    participants: any[];
    dominantSpeakerId?: string | null;
    screenShareParticipantId?: string | null;
}

export const useAutoPictureInPicture = ({ 
    participants, 
    dominantSpeakerId, 
    screenShareParticipantId 
}: PiPProps) => {
    const [isPiPActive, setIsPiPActive] = useState(false);
    const [pipWindow, setPipWindow] = useState<Window | null>(null);

    const screenSharer = useMemo(
        () => participants.find((p) => p.id === screenShareParticipantId),
        [participants, screenShareParticipantId]
    );

    const dominantSpeaker = useMemo(
        () => participants.find((p) => p.id === dominantSpeakerId),
        [participants, dominantSpeakerId]
    );

    const getTargetParticipant = useCallback(() => {
        if (screenSharer) return screenSharer;
        if (dominantSpeaker) return dominantSpeaker;
        return participants[0] || null;
    }, [dominantSpeaker, screenSharer, participants]);

    const currentTargetParticipant = useMemo(() => getTargetParticipant(), [getTargetParticipant]);

    /* --- DOCUMENT PIP LOGIC (Remains standard JS) --- */
    const toggleDocumentPiP = useCallback(async () => {
        if (!("documentPictureInPicture" in window)) return;
        if (pipWindow) {
            pipWindow.close();
            return;
        }

        try {
            const pw = await (window as any).documentPictureInPicture.requestWindow({
                width: 400, height: 300,
            });
            document.head.querySelectorAll("link[rel='stylesheet'], style")
                .forEach((node) => pw.document.head.appendChild(node.cloneNode(true)));

            pw.addEventListener("pagehide", () => {
                setPipWindow(null);
                setIsPiPActive(false);
            });
            setPipWindow(pw);
            setIsPiPActive(true);
        } catch (err) {
            console.error("Document PiP failed:", err);
        }
    }, [pipWindow]);

    /* --- VIDEO PIP FALLBACK --- */
    const toggleVideoPiP = useCallback(async () => {
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
                return;
            }
            if (!currentTargetParticipant) return;

            const videoEls = Array.from(document.querySelectorAll("video")) as HTMLVideoElement[];
            
            // Mediasoup Tip: We find the video element associated with this participant's track
            let targetVideo = videoEls.find((v) => v.dataset.peerId === currentTargetParticipant.id) || null;

            if (!targetVideo) {
                targetVideo = createAvatarVideoForParticipant(currentTargetParticipant);
            }

            if (targetVideo && "requestPictureInPicture" in targetVideo) {
                await targetVideo.requestPictureInPicture();
            }
        } catch (err) {
            console.error("Video PiP failed:", err);
        }
    }, [currentTargetParticipant]);

    const togglePiP = useCallback(async () => {
        if ("documentPictureInPicture" in window) {
            await toggleDocumentPiP();
        } else {
            await toggleVideoPiP();
        }
    }, [toggleDocumentPiP, toggleVideoPiP]);

    useEffect(() => {
        const enter = () => setIsPiPActive(true);
        const leave = () => setIsPiPActive(false);
        document.addEventListener("enterpictureinpicture", enter);
        document.addEventListener("leavepictureinpicture", leave);
        return () => {
            document.removeEventListener("enterpictureinpicture", enter);
            document.removeEventListener("leavepictureinpicture", leave);
        };
    }, []);

    return {
        togglePiP,
        isPiPActive,
        isPiPSupported: typeof window !== "undefined" && ("documentPictureInPicture" in window || !!document.pictureInPictureEnabled),
        pipWindow,
        currentTargetParticipant,
        isDocumentPiP: !!pipWindow && isPiPActive,
    };
};