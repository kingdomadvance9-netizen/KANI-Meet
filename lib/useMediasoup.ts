"use client";

import { useRef } from "react";
import * as mediasoupClient from "mediasoup-client";
import type { Socket } from "socket.io-client";

export function useMediasoup(socket: Socket | null) {
  const deviceRef = useRef<mediasoupClient.Device | null>(null);
  const sendTransportRef = useRef<any>(null);

  const initMediasoup = async (roomId: string) => {
    if (!socket) throw new Error("Socket not ready");

    /* ===============================
       PHASE 4.1 — GET RTP CAPABILITIES
    =============================== */
    const { rtpCapabilities } = await new Promise<any>((resolve, reject) => {
      socket.emit("get-rtp-capabilities", { roomId }, (res: any) => {
        if (res?.error) reject(res.error);
        else resolve(res);
      });
    });

    /* ===============================
       PHASE 4.2 — LOAD DEVICE
    =============================== */
    const device = new mediasoupClient.Device();
    await device.load({ routerRtpCapabilities: rtpCapabilities });
    deviceRef.current = device;

    /* ===============================
       PHASE 4.3 — JOIN MEDIASOUP ROOM
    =============================== */
    await new Promise<void>((resolve, reject) => {
      socket.emit(
        "join-mediasoup-room",
        { roomId, rtpCapabilities: device.rtpCapabilities },
        (res: any) => {
          if (res?.error) reject(res.error);
          else resolve();
        }
      );
    });

    /* ===============================
       PHASE 4.4 — CREATE SEND TRANSPORT
    =============================== */
    const { params } = await new Promise<any>((resolve, reject) => {
      socket.emit("create-webrtc-transport", { roomId }, (res: any) => {
        if (res?.error) reject(res.error);
        else resolve(res);
      });
    });

    const sendTransport = device.createSendTransport(params);

    /* ===============================
       PHASE 4.5 — CONNECT TRANSPORT
    =============================== */
    sendTransport.on(
      "connect",
      ({ dtlsParameters }: any, callback: any, errback: any) => {
        socket.emit(
          "connect-transport",
          {
            roomId,
            transportId: sendTransport.id,
            dtlsParameters,
          },
          (res: any) => {
            if (res?.error) errback(res.error);
            else callback();
          }
        );
      }
    );

    sendTransportRef.current = sendTransport;

    console.log("✅ Mediasoup Phase 4 complete");
  };

  return { initMediasoup };
}
