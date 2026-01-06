# Server Socket Events Reference

This document lists all socket events your mediasoup server needs to handle for the frontend to work correctly.

## Socket Event Handlers Required

### 1. get-rtp-capabilities

**Direction:** Client → Server  
**Purpose:** Get the router's RTP capabilities to initialize the client device

**Request:**

```typescript
{
  roomId: string;
}
```

**Response:**

```typescript
{
  rtpCapabilities: RouterRtpCapabilities; // from mediasoup router.rtpCapabilities
}
```

**Server Implementation Example:**

```javascript
socket.on("get-rtp-capabilities", ({ roomId }, callback) => {
  const router = getOrCreateRouter(roomId);
  callback({ rtpCapabilities: router.rtpCapabilities });
});
```

---

### 2. join-mediasoup-room

**Direction:** Client → Server  
**Purpose:** Join a mediasoup room and get list of existing producers

**Request:**

```typescript
{
  roomId: string,
  rtpCapabilities: RtpCapabilities // client's capabilities
}
```

**Response:**

```typescript
{
  existingProducers: string[] // array of producer IDs already in the room
}
```

**Server Implementation Example:**

```javascript
socket.on("join-mediasoup-room", ({ roomId, rtpCapabilities }, callback) => {
  const peer = createPeer(socket.id, rtpCapabilities);
  addPeerToRoom(roomId, peer);

  const existingProducers = getAllProducerIdsInRoom(roomId);
  callback({ existingProducers });

  // Notify others
  socket
    .to(roomId)
    .emit("participant-list-update", getParticipantsList(roomId));
});
```

---

### 3. create-webrtc-transport

**Direction:** Client → Server  
**Purpose:** Create a WebRTC transport for sending or receiving media

**Request:**

```typescript
{
  roomId: string,
  direction: "send" | "recv"
}
```

**Response:**

```typescript
{
  params: {
    id: string,
    iceParameters: IceParameters,
    iceCandidates: IceCandidate[],
    dtlsParameters: DtlsParameters
  },
  error?: string
}
```

**Server Implementation Example:**

```javascript
socket.on(
  "create-webrtc-transport",
  async ({ roomId, direction }, callback) => {
    try {
      const router = getRouter(roomId);
      const transport = await router.createWebRtcTransport({
        listenIps: [{ ip: "0.0.0.0", announcedIp: "YOUR_PUBLIC_IP" }],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
      });

      const peer = getPeer(socket.id);
      if (direction === "send") {
        peer.sendTransport = transport;
      } else {
        peer.recvTransport = transport;
      }

      callback({
        params: {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        },
      });
    } catch (error) {
      callback({ error: error.message });
    }
  }
);
```

---

### 4. connect-transport

**Direction:** Client → Server  
**Purpose:** Complete the transport connection handshake

**Request:**

```typescript
{
  roomId: string,
  transportId: string,
  dtlsParameters: DtlsParameters
}
```

**Response:**

```typescript
{
  error?: string
}
```

**Server Implementation Example:**

```javascript
socket.on(
  "connect-transport",
  async ({ roomId, transportId, dtlsParameters }, callback) => {
    try {
      const peer = getPeer(socket.id);
      const transport = peer.getTransport(transportId);
      await transport.connect({ dtlsParameters });
      callback({});
    } catch (error) {
      callback({ error: error.message });
    }
  }
);
```

---

### 5. produce

**Direction:** Client → Server  
**Purpose:** Create a producer to send media (audio/video)

**Request:**

```typescript
{
  roomId: string,
  transportId: string,
  kind: "audio" | "video",
  rtpParameters: RtpParameters
}
```

**Response:**

```typescript
{
  id: string, // producer ID
  error?: string
}
```

**Server Implementation Example:**

```javascript
socket.on(
  "produce",
  async ({ roomId, transportId, kind, rtpParameters }, callback) => {
    try {
      const peer = getPeer(socket.id);
      const transport = peer.getTransport(transportId);

      const producer = await transport.produce({ kind, rtpParameters });
      peer.addProducer(producer);

      callback({ id: producer.id });

      // Notify other peers about new producer
      socket.to(roomId).emit("new-producer", {
        producerId: producer.id,
        peerId: socket.id,
      });
    } catch (error) {
      callback({ error: error.message });
    }
  }
);
```

---

### 6. consume

**Direction:** Client → Server  
**Purpose:** Create a consumer to receive media from a producer

**Request:**

```typescript
{
  roomId: string,
  producerId: string,
  rtpCapabilities: RtpCapabilities
}
```

**Response:**

```typescript
{
  id: string, // consumer ID
  producerId: string,
  kind: "audio" | "video",
  rtpParameters: RtpParameters,
  peerId?: string, // optional: ID of the peer who owns the producer
  error?: string
}
```

**Server Implementation Example:**

```javascript
socket.on(
  "consume",
  async ({ roomId, producerId, rtpCapabilities }, callback) => {
    try {
      const router = getRouter(roomId);
      const peer = getPeer(socket.id);
      const producer = getProducer(producerId);

      if (!router.canConsume({ producerId, rtpCapabilities })) {
        callback({ error: "Cannot consume" });
        return;
      }

      const consumer = await peer.recvTransport.consume({
        producerId,
        rtpCapabilities,
        paused: true, // Start paused, will resume via resume-consumer
      });

      peer.addConsumer(consumer);

      callback({
        id: consumer.id,
        producerId: producer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        peerId: producer.appData.peerId, // if you stored it
      });
    } catch (error) {
      callback({ error: error.message });
    }
  }
);
```

---

### 7. resume-consumer

**Direction:** Client → Server  
**Purpose:** Resume a paused consumer to start receiving media

**Request:**

```typescript
{
  roomId: string,
  consumerId: string
}
```

**Response:** None (or acknowledgment)

**Server Implementation Example:**

```javascript
socket.on("resume-consumer", async ({ roomId, consumerId }) => {
  const peer = getPeer(socket.id);
  const consumer = peer.getConsumer(consumerId);
  await consumer.resume();
});
```

---

## Server → Client Events (Emitted by Server)

### 1. new-producer

**Purpose:** Notify clients when someone starts producing media

**Payload:**

```typescript
{
  producerId: string,
  peerId?: string // optional: socket ID of producer
}
```

**When to emit:** After successfully creating a producer, broadcast to all other peers in the room

---

### 2. participant-list-update

**Purpose:** Notify clients about current participants in the room

**Payload:**

```typescript
Participant[] // array of participant objects

interface Participant {
  id: string,
  name: string,
  isAudioMuted: boolean,
  isVideoPaused: boolean
}
```

**When to emit:** When someone joins or leaves the room

---

### 3. participant-left

**Purpose:** Notify clients when someone leaves

**Payload:**

```typescript
{
  peerId: string; // socket ID of departed peer
}
```

**When to emit:** When a peer disconnects

---

## Connection Lifecycle

```
1. Client connects → Socket established
2. Client emits "get-rtp-capabilities" → Server responds with router capabilities
3. Client loads device with capabilities
4. Client emits "join-mediasoup-room" → Server responds with existing producers
5. Client emits "create-webrtc-transport" (send) → Server creates send transport
6. Client emits "create-webrtc-transport" (recv) → Server creates recv transport
7. Client emits "connect-transport" (for both transports)
8. Client emits "produce" (audio) → Server creates producer, notifies others via "new-producer"
9. Client emits "produce" (video) → (when camera enabled)
10. For each existing producer, client emits "consume" → Server creates consumer
11. Client emits "resume-consumer" for each consumer
12. Server emits "new-producer" when other peers start producing
13. Client consumes new producers automatically
```

---

## Error Handling Tips

1. **Always include error field in callbacks**

```javascript
callback({ error: error.message });
```

2. **Validate room exists before operations**

```javascript
if (!roomExists(roomId)) {
  callback({ error: "Room not found" });
  return;
}
```

3. **Check if transport/producer/consumer exists**

```javascript
if (!transport) {
  callback({ error: "Transport not found" });
  return;
}
```

4. **Handle disconnections cleanly**

```javascript
socket.on("disconnect", () => {
  const peer = getPeer(socket.id);
  peer.close(); // Close all transports, producers, consumers
  socket.to(roomId).emit("participant-left", { peerId: socket.id });
});
```

---

## Testing with Browser Console

You can test socket events from the browser console:

```javascript
// Get socket instance (if exposed globally or via window)
const socket = window.socket; // Adjust based on your setup

// Test get-rtp-capabilities
socket.emit("get-rtp-capabilities", { roomId: "test" }, (response) => {
  console.log("RTP Capabilities:", response);
});

// Test join room
socket.emit(
  "join-mediasoup-room",
  {
    roomId: "test",
    rtpCapabilities: device.rtpCapabilities,
  },
  (response) => {
    console.log("Join response:", response);
  }
);
```

---

## Debugging Commands

Enable mediasoup debug logs on server:

```bash
DEBUG=mediasoup* node server.js
```

Check WebRTC stats in browser:

- Chrome: `chrome://webrtc-internals`
- Firefox: `about:webrtc`
