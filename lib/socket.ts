import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = () => {
  if (!socket) {
    const serverUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:8080";

    console.log("🔌 Attempting to connect to:", serverUrl);

    socket = io(serverUrl, {
      autoConnect: true,
      transports: ["websocket", "polling"], // Try websocket first, fallback to polling
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      timeout: 10000,
    });

    socket.on("connect", () => {
      console.log("✅ Socket connected successfully!");
      console.log("   - Socket ID:", socket?.id);
      console.log("   - Transport:", socket?.io?.engine?.transport?.name);
    });

    socket.on("disconnect", (reason) => {
      console.warn("⚠️ Socket disconnected:", reason);
      if (reason === "io server disconnect") {
        // Server disconnected, manually reconnect
        socket?.connect();
      }
    });

    socket.on("connect_error", (error) => {
      console.error("❌ Socket connection error:", error.message);
      console.error("   - Server URL:", serverUrl);
      console.error("   - Error details:", error);
      console.error("\n💡 Troubleshooting steps:");
      console.error("   1. Is your backend server running?");
      console.error("   2. Check if server is accessible at:", serverUrl);
      console.error("   3. Verify CORS settings on your server");
      console.error("   4. Check firewall/network settings");
    });

    socket.on("reconnect_attempt", (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}...`);
    });

    socket.on("reconnect_failed", () => {
      console.error("❌ Reconnection failed after all attempts");
    });
  }

  return socket;
};
