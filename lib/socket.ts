import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:8080", {
      autoConnect: false,
      transports: ["websocket"], // important for Railway
    });
  }

  return socket;
};
