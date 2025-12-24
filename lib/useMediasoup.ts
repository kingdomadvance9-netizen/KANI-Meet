"use client";

import { useRef, useEffect } from "react";
import * as mediasoupClient from "mediasoup-client";
import type { Socket } from "socket.io-client";
import { getMicTrack } from "@/lib/useMicrophone";

export function useMediasoup(socket: Socket | null) {
  const deviceRef = useRef<mediasoupClient.Device | null>(null);
  const sendTransportRef = useRef<any>(null);
  const recvTransportRef = useRef<any>(null);
  const startedRef = useRef(false);
  const audioElementsRef = useRef<HTMLAudioElement[]>([]);
  const micTrackRef = useRef<MediaStreamTrack | null>(null);
  const newProducerHandlerRef = useRef<any>(null);
  const unloadBoundRef = useRef(false);

  const initMediasoup = async (roomId: string) => {
    if (!socket) return;
    if (startedRef.current) return;
    startedRef.current = true;

    /* =========================
        RTP CAPABILITIES
    ========================= */
    const { rtpCapabilities } = await new Promise<any>((resolve) => {
      socket.emit("get-rtp-capabilities", { roomId }, resolve);
    });

    const device = new mediasoupClient.Device();
    await device.load({ routerRtpCapabilities: rtpCapabilities });
    deviceRef.current = device;

    // ✅ CHANGE 1: Capture existingProducers from the response
    const { existingProducers } = await new Promise<any>((resolve) => {
      socket.emit(
        "join-mediasoup-room",
        { roomId, rtpCapabilities: device.rtpCapabilities },
        resolve
      );
    });

    /* =========================
        SEND TRANSPORT (MIC)
    ========================= */
    // ✅ CHANGE 2: Add { direction: "send" }
    const { params: sendParams } = await new Promise<any>((resolve) => {
      socket.emit(
        "create-webrtc-transport",
        { roomId, direction: "send" },
        resolve
      );
    });

    const sendTransport = device.createSendTransport(sendParams);

    sendTransport.on("connect", ({ dtlsParameters }, cb, eb) => {
      socket.emit(
        "connect-transport",
        { roomId, transportId: sendTransport.id, dtlsParameters },
        (res: any) => (res?.error ? eb(res.error) : cb())
      );
    });

    sendTransport.on("produce", ({ kind, rtpParameters }, cb, eb) => {
      socket.emit(
        "produce",
        {
          roomId,
          transportId: sendTransport.id,
          kind,
          rtpParameters,
        },
        ({ id, error }: any) => (error ? eb(error) : cb({ id }))
      );
    });

    const track = await getMicTrack();
    micTrackRef.current = track;

    await sendTransport.produce({
      track,
      codecOptions: {
        opusStereo: false,
        opusDtx: true,
      },
    });

    sendTransportRef.current = sendTransport;
    console.log("🎤 Audio producer created");

    /* =========================
        RECV TRANSPORT (HEAR OTHERS)
    ========================= */
    // ✅ CHANGE 3: Add { direction: "recv" }
    const { params: recvParams } = await new Promise<any>((resolve) => {
      socket.emit(
        "create-webrtc-transport",
        { roomId, direction: "recv" },
        resolve
      );
    });

    const recvTransport = device.createRecvTransport(recvParams);

    recvTransport.on("connect", ({ dtlsParameters }, cb, eb) => {
      socket.emit(
        "connect-transport",
        { roomId, transportId: recvTransport.id, dtlsParameters },
        (res: any) => (res?.error ? eb(res.error) : cb())
      );
    });

    recvTransportRef.current = recvTransport;

    /* =========================
        CONSUME AUDIO LOGIC
    ========================= */

    // We create a function so we can use it for BOTH new and existing producers
    const consumeProducer = async (producerId: string) => {
      const data = await new Promise<any>((resolve) => {
        socket.emit(
          "consume",
          {
            roomId,
            producerId,
            rtpCapabilities: device.rtpCapabilities,
          },
          resolve
        );
      });

      if (!data || data.error) return;

      const consumer = await recvTransport.consume({
        id: data.id,
        producerId: data.producerId,
        kind: data.kind,
        rtpParameters: data.rtpParameters,
      });

      const stream = new MediaStream([consumer.track]);
      const audio = document.createElement("audio");
      audio.srcObject = stream;
      audio.autoplay = true;
      (audio as any).playsInline = true;
      document.body.appendChild(audio);
      audioElementsRef.current.push(audio);

      socket.emit("resume-consumer", {
        roomId,
        consumerId: consumer.id,
      });
    };

    // ✅ CHANGE 4: Consume everyone who is already talking
    if (existingProducers) {
      existingProducers.forEach((id: string) => consumeProducer(id));
    }

    // Listen for people who join later
    const handler = async ({ producerId }: { producerId: string }) => {
      await consumeProducer(producerId);
    };

    newProducerHandlerRef.current = handler;
    socket.on("new-producer", handler);

    console.log("✅ Mediasoup audio fully connected");

    if (!unloadBoundRef.current) {
      window.addEventListener("beforeunload", cleanup);
      window.addEventListener("pagehide", cleanup);
      unloadBoundRef.current = true;
    }
  };

  const cleanup = () => {
    console.log("🧹 Cleaning up mediasoup");

    // 🔥 Stop mic
    micTrackRef.current?.stop();
    micTrackRef.current = null;

    // 🔥 Close transports
    sendTransportRef.current?.close();
    recvTransportRef.current?.close();

    sendTransportRef.current = null;
    recvTransportRef.current = null;

    // 🔥 Remove audio elements
    audioElementsRef.current.forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    });
    audioElementsRef.current = [];

    if (newProducerHandlerRef.current && socket) {
      socket.off("new-producer", newProducerHandlerRef.current);
      newProducerHandlerRef.current = null;
    }

    startedRef.current = false;
  };

  useEffect(() => {
    return () => {
      cleanup(); 
    };
  }, []);

  return { initMediasoup, cleanup };

}
