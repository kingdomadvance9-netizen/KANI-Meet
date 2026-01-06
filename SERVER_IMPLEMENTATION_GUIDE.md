# Mediasoup Server Implementation Guide

This document provides step-by-step instructions for implementing a mediasoup server that works with this frontend.

## Quick Start

Your server needs to:

1. Create mediasoup Workers, Routers, and Transports
2. Handle specific Socket.IO events from clients
3. Manage rooms and participants
4. Coordinate media production and consumption between peers

## Prerequisites

Install required packages:

```bash
npm install mediasoup socket.io express
# or
yarn add mediasoup socket.io express
```

## Server Architecture

```
Server
├── Mediasoup Workers (CPU cores)
├── Routers (per room or shared)
├── WebRTC Transports (per participant, send/recv)
├── Producers (audio/video from each participant)
└── Consumers (receiving media for each participant)
```

## Core Data Structures

### Peer Object

```javascript
class Peer {
  constructor(socketId, rtpCapabilities) {
    this.id = socketId;
    this.rtpCapabilities = rtpCapabilities;
    this.sendTransport = null;
    this.recvTransport = null;
    this.producers = new Map(); // producerId -> Producer
    this.consumers = new Map(); // consumerId -> Consumer
  }
}
```

### Room Object

```javascript
class Room {
  constructor(roomId, router) {
    this.id = roomId;
    this.router = router;
    this.peers = new Map(); // socketId -> Peer
  }
}
```

## Socket Event Handlers Implementation

### 1. Server Initialization

```javascript
const express = require("express");
const { Server } = require("socket.io");
const mediasoup = require("mediasoup");

const app = express();
const server = require("http").createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // Your frontend URL
    methods: ["GET", "POST"],
  },
});

// Global storage
const workers = [];
const rooms = new Map(); // roomId -> Room

// Create mediasoup workers (one per CPU core recommended)
async function createWorkers() {
  const numWorkers = require("os").cpus().length;

  for (let i = 0; i < numWorkers; i++) {
    const worker = await mediasoup.createWorker({
      rtcMinPort: 10000,
      rtcMaxPort: 10100,
    });

    worker.on("died", () => {
      console.error("mediasoup worker died, exiting...");
      setTimeout(() => process.exit(1), 2000);
    });

    workers.push(worker);
  }

  console.log(`Created ${workers.length} mediasoup workers`);
}

// Get next available worker (round-robin)
let nextWorkerIdx = 0;
function getNextWorker() {
  const worker = workers[nextWorkerIdx];
  nextWorkerIdx = (nextWorkerIdx + 1) % workers.length;
  return worker;
}

// Create or get router for a room
async function getOrCreateRouter(roomId) {
  if (rooms.has(roomId)) {
    return rooms.get(roomId).router;
  }

  const worker = getNextWorker();
  const router = await worker.createRouter({
    mediaCodecs: [
      {
        kind: "audio",
        mimeType: "audio/opus",
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: "video",
        mimeType: "video/VP8",
        clockRate: 90000,
        parameters: {
          "x-google-start-bitrate": 1000,
        },
      },
    ],
  });

  const room = {
    id: roomId,
    router: router,
    peers: new Map(),
  };

  rooms.set(roomId, room);
  console.log(`Created router for room: ${roomId}`);

  return router;
}

// Initialize workers on server start
createWorkers().then(() => {
  console.log("Mediasoup workers ready");
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### 2. Socket Connection Handler

```javascript
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Store which room this socket is in
  let currentRoomId = null;
  let currentPeer = null;

  // Handler implementations below...

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);

    if (currentRoomId && currentPeer) {
      const room = rooms.get(currentRoomId);
      if (room) {
        // Close all transports
        currentPeer.sendTransport?.close();
        currentPeer.recvTransport?.close();

        // Remove peer from room
        room.peers.delete(socket.id);

        // Notify others
        socket.to(currentRoomId).emit("participant-left", {
          peerId: socket.id,
        });

        // Update participant list
        const participants = Array.from(room.peers.values()).map((p) => ({
          id: p.id,
          name: p.name || "Anonymous",
          isAudioMuted: false,
          isVideoPaused: false,
        }));
        io.to(currentRoomId).emit("participant-list-update", participants);

        // Clean up room if empty
        if (room.peers.size === 0) {
          room.router.close();
          rooms.delete(currentRoomId);
          console.log(`Room ${currentRoomId} closed (empty)`);
        }
      }
    }
  });

  // Event handlers...
});
```

### 3. Event: get-rtp-capabilities

```javascript
socket.on("get-rtp-capabilities", async ({ roomId }, callback) => {
  try {
    const router = await getOrCreateRouter(roomId);
    callback({
      rtpCapabilities: router.rtpCapabilities,
    });
  } catch (error) {
    console.error("Error getting RTP capabilities:", error);
    callback({ error: error.message });
  }
});
```

### 4. Event: join-mediasoup-room

```javascript
socket.on(
  "join-mediasoup-room",
  async ({ roomId, rtpCapabilities }, callback) => {
    try {
      currentRoomId = roomId;

      const room = rooms.get(roomId);
      if (!room) {
        return callback({ error: "Room not found" });
      }

      // Create peer
      currentPeer = {
        id: socket.id,
        name: "User " + socket.id.slice(0, 4),
        rtpCapabilities: rtpCapabilities,
        sendTransport: null,
        recvTransport: null,
        producers: new Map(),
        consumers: new Map(),
      };

      room.peers.set(socket.id, currentPeer);

      // Join socket.io room
      socket.join(roomId);

      // Get existing producers in the room
      const existingProducers = [];
      for (const [peerId, peer] of room.peers.entries()) {
        if (peerId !== socket.id) {
          for (const [producerId, producer] of peer.producers.entries()) {
            existingProducers.push(producerId);
          }
        }
      }

      console.log(`Peer ${socket.id} joined room ${roomId}`);

      // ✅ CRITICAL: Update participant list for EVERYONE including the new joiner
      const participants = Array.from(room.peers.values()).map((p) => ({
        id: p.id,
        name: p.name,
        isAudioMuted: false,
        isVideoPaused: false,
      }));

      // Send to ALL participants including the one who just joined
      io.to(roomId).emit("participant-list-update", participants);

      callback({ existingProducers });
    } catch (error) {
      console.error("Error joining room:", error);
      callback({ error: error.message });
    }
  }
);
```

### 5. Event: create-webrtc-transport

```javascript
socket.on(
  "create-webrtc-transport",
  async ({ roomId, direction }, callback) => {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        return callback({ error: "Room not found" });
      }

      const peer = room.peers.get(socket.id);
      if (!peer) {
        return callback({ error: "Peer not found" });
      }

      // Create WebRTC transport
      const transport = await room.router.createWebRtcTransport({
        listenIps: [
          {
            ip: "0.0.0.0",
            announcedIp: process.env.ANNOUNCED_IP || "127.0.0.1", // Use your public IP in production
          },
        ],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
      });

      // Store transport
      if (direction === "send") {
        peer.sendTransport = transport;
      } else {
        peer.recvTransport = transport;
      }

      console.log(`Created ${direction} transport for ${socket.id}`);

      callback({
        params: {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        },
      });
    } catch (error) {
      console.error("Error creating transport:", error);
      callback({ error: error.message });
    }
  }
);
```

### 6. Event: connect-transport

```javascript
socket.on(
  "connect-transport",
  async ({ roomId, transportId, dtlsParameters }, callback) => {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        return callback({ error: "Room not found" });
      }

      const peer = room.peers.get(socket.id);
      if (!peer) {
        return callback({ error: "Peer not found" });
      }

      // Find the transport
      let transport = null;
      if (peer.sendTransport && peer.sendTransport.id === transportId) {
        transport = peer.sendTransport;
      } else if (peer.recvTransport && peer.recvTransport.id === transportId) {
        transport = peer.recvTransport;
      }

      if (!transport) {
        return callback({ error: "Transport not found" });
      }

      await transport.connect({ dtlsParameters });
      console.log(`Transport ${transportId} connected`);

      callback({});
    } catch (error) {
      console.error("Error connecting transport:", error);
      callback({ error: error.message });
    }
  }
);
```

### 7. Event: produce

```javascript
socket.on(
  "produce",
  async ({ roomId, transportId, kind, rtpParameters, appData }, callback) => {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        return callback({ error: "Room not found" });
      }

      const peer = room.peers.get(socket.id);
      if (!peer || !peer.sendTransport) {
        return callback({ error: "Send transport not found" });
      }

      // Create producer
      const producer = await peer.sendTransport.produce({
        kind,
        rtpParameters,
        appData, // ✅ Pass appData (for screen share detection)
      });

      peer.producers.set(producer.id, producer);

      const isScreenShare = appData?.share === true;
      console.log(
        `Producer created: ${producer.id} (${kind}${
          isScreenShare ? " - SCREEN" : ""
        }) for ${socket.id}`
      );

      // ✅ Notify all other peers in the room about new producer
      socket.to(roomId).emit("new-producer", {
        producerId: producer.id,
        peerId: socket.id,
        kind: kind,
        isScreenShare: isScreenShare,
      });

      callback({ id: producer.id });
    } catch (error) {
      console.error("Error producing:", error);
      callback({ error: error.message });
    }
  }
);
```

### 8. Event: consume

```javascript
socket.on(
  "consume",
  async ({ roomId, producerId, rtpCapabilities }, callback) => {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        return callback({ error: "Room not found" });
      }

      const peer = room.peers.get(socket.id);
      if (!peer || !peer.recvTransport) {
        return callback({ error: "Receive transport not found" });
      }

      // Find the producer
      let producer = null;
      let producerPeerId = null;
      for (const [peerId, peerObj] of room.peers.entries()) {
        if (peerObj.producers.has(producerId)) {
          producer = peerObj.producers.get(producerId);
          producerPeerId = peerId;
          break;
        }
      }

      if (!producer) {
        return callback({ error: "Producer not found" });
      }

      // Check if can consume
      if (
        !room.router.canConsume({
          producerId: producer.id,
          rtpCapabilities,
        })
      ) {
        return callback({ error: "Cannot consume" });
      }

      // Create consumer
      const consumer = await peer.recvTransport.consume({
        producerId: producer.id,
        rtpCapabilities,
        paused: true, // Start paused
      });

      peer.consumers.set(consumer.id, consumer);

      console.log(
        `Consumer created: ${consumer.id} for producer ${producerId}`
      );

      callback({
        id: consumer.id,
        producerId: producer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        peerId: producerPeerId,
      });
    } catch (error) {
      console.error("Error consuming:", error);
      callback({ error: error.message });
    }
  }
);
```

### 9. Event: resume-consumer

```javascript
socket.on("resume-consumer", async ({ roomId, consumerId }) => {
  try {
    const room = rooms.get(roomId);
    if (!room) return;

    const peer = room.peers.get(socket.id);
    if (!peer) return;

    const consumer = peer.consumers.get(consumerId);
    if (!consumer) return;

    await consumer.resume();
    console.log(`Consumer resumed: ${consumerId}`);
  } catch (error) {
    console.error("Error resuming consumer:", error);
  }
});
```

## Environment Variables

Create a `.env` file:

```env
PORT=8080
ANNOUNCED_IP=your.public.ip.address
# For local testing, use:
# ANNOUNCED_IP=127.0.0.1
```

## Complete Server Example

Here's a minimal complete server file:

```javascript
// server.js
const express = require("express");
const { Server } = require("socket.io");
const mediasoup = require("mediasoup");
require("dotenv").config();

const app = express();
const server = require("http").createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// [Include all the code from sections above]

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    rooms: rooms.size,
    workers: workers.length,
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
```

## Testing Your Server

### 1. Check if server starts

```bash
node server.js
```

Expected output:

```
Created 8 mediasoup workers
Mediasoup workers ready
Server running on port 8080
```

### 2. Test socket connection

Use a browser console or tool like Socket.IO Client Tester:

```javascript
const socket = io("http://localhost:8080");

socket.on("connect", () => {
  console.log("Connected:", socket.id);

  // Test getting RTP capabilities
  socket.emit("get-rtp-capabilities", { roomId: "test" }, (response) => {
    console.log("RTP Capabilities:", response);
  });
});
```

### 3. Monitor logs

Your server should log:

- Worker creation
- Client connections
- Transport creation
- Producer/Consumer creation
- Disconnections

## Common Issues & Solutions

### Issue: "Cannot connect"

**Solution:** Check CORS settings and firewall rules

### Issue: "Transport connection failed"

**Solution:**

- Verify ANNOUNCED_IP is correct
- Check UDP ports 10000-10100 are open
- For local testing, use 127.0.0.1
- For production, use your public IP

### Issue: "No audio/video"

**Solution:**

- Check producer creation logs
- Verify `new-producer` event is emitted
- Check consumer creation and resume

### Issue: "Workers died"

**Solution:**

- Check system resources (CPU/Memory)
- Reduce number of workers
- Check mediasoup logs

## Deployment Considerations

### For Production:

1. **Use PM2 or similar process manager**

```bash
pm2 start server.js -i 1
```

2. **Set proper ANNOUNCED_IP**

```env
ANNOUNCED_IP=your.server.public.ip
```

3. **Open required ports**

- TCP: 8080 (or your PORT)
- UDP: 10000-10100 (for WebRTC)

4. **Use HTTPS for Socket.IO**

```javascript
const server = require("https").createServer(
  {
    key: fs.readFileSync("privkey.pem"),
    cert: fs.readFileSync("fullchain.pem"),
  },
  app
);
```

5. **Monitor resource usage**

- Each worker uses ~50-100MB RAM
- Each transport uses ~5-10MB RAM
- Scale workers based on CPU cores

## Advanced Features (Optional)

### Screen Sharing

Screen sharing is already supported! The frontend sends screen share as a video producer with `appData.share = true`.

Your server already handles this in the updated `produce` event handler above. No additional changes needed.

### Recording

To add recording functionality, install FFmpeg and add these event handlers:

```javascript
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// Store active recordings
const recordings = new Map(); // roomId -> recording info

socket.on("start-recording", async ({ roomId }, callback) => {
  try {
    const room = rooms.get(roomId);
    if (!room) {
      return callback({ error: "Room not found" });
    }

    if (recordings.has(roomId)) {
      return callback({ error: "Already recording" });
    }

    const recordingDir = path.join(__dirname, "recordings");
    if (!fs.existsSync(recordingDir)) {
      fs.mkdirSync(recordingDir, { recursive: true });
    }

    const timestamp = Date.now();
    const outputFile = path.join(
      recordingDir,
      `room_${roomId}_${timestamp}.webm`
    );

    // Simple implementation: record to file
    recordings.set(roomId, {
      startTime: Date.now(),
      outputFile,
      isRecording: true,
    });

    console.log(`🔴 Recording started for room ${roomId}`);
    io.to(roomId).emit("recording-started", { roomId });

    callback({ success: true, recordingId: timestamp });
  } catch (error) {
    console.error("Error starting recording:", error);
    callback({ error: error.message });
  }
});

socket.on("stop-recording", async ({ roomId }, callback) => {
  try {
    const recording = recordings.get(roomId);
    if (!recording) {
      return callback({ error: "No active recording" });
    }

    const duration = Date.now() - recording.startTime;
    recordings.delete(roomId);

    console.log(`⏹️ Recording stopped for room ${roomId}`);
    io.to(roomId).emit("recording-stopped", { roomId, duration });

    callback({ success: true, duration });
  } catch (error) {
    console.error("Error stopping recording:", error);
    callback({ error: error.message });
  }
});
```

**Note:** For production recording, use `mediasoup-recorder` or FFmpeg with PlainTransport. The above is a simplified implementation.

### Broadcasting

Use `createPlainTransport` for RTMP streaming

### Quality Adaptation

Implement simulcast and SVC layers

### Load Balancing

Distribute rooms across multiple servers using Redis pub/sub

## Debugging

Enable mediasoup debug logs:

```bash
DEBUG=mediasoup* node server.js
```

Enable all logs:

```bash
DEBUG=* node server.js
```

## Support Resources

- Mediasoup Documentation: https://mediasoup.org/documentation/
- Mediasoup Discourse: https://mediasoup.discourse.group/
- Example Code: https://github.com/versatica/mediasoup-demo

---

## Quick Checklist

Before testing with your frontend:

- [ ] Server starts without errors
- [ ] Workers are created
- [ ] Socket.IO connection works
- [ ] `get-rtp-capabilities` returns router capabilities
- [ ] `join-mediasoup-room` adds peer to room
- [ ] `create-webrtc-transport` creates transports
- [ ] `connect-transport` connects successfully
- [ ] `produce` creates producers and emits `new-producer`
- [ ] `consume` creates consumers
- [ ] `resume-consumer` resumes playback
- [ ] Disconnection cleanup works
- [ ] Ports 10000-10100 UDP are open
- [ ] ANNOUNCED_IP is correctly set

Your frontend should now connect and work seamlessly! 🎉
