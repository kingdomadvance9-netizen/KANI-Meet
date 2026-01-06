# Mediasoup Server - Critical Fixes

## Issues to Fix

1. Participants not visible to each other
2. Can't see/hear other users' video/audio
3. Screen sharing not working
4. Recording not implemented
5. **User names and avatars not showing (generated names instead)**

---

## Fix #1: Participant List + User Info (CRITICAL)

**IMPORTANT**: You MUST capture and store `userName` and `userImageUrl` from the client!

In `join-mediasoup-room` event:

```javascript
socket.on(
  "join-mediasoup-room",
  async (
    { roomId, rtpCapabilities, userName, userImageUrl, isCreator },
    callback
  ) => {
    console.log(
      `🔍 JOIN REQUEST - User: ${userName}, Image: ${userImageUrl}, Creator: ${isCreator}`
    );

    // ✅ CRITICAL: Create peer with user info from client
    currentPeer = {
      id: socket.id,
      name: userName || "User " + socket.id.slice(0, 4),
      imageUrl: userImageUrl || null, // ✅ MUST include this
      isHost: isCreator || false, // ✅ Creator becomes host
      rtpCapabilities: rtpCapabilities,
      sendTransport: null,
      recvTransport: null,
      producers: new Map(),
      consumers: new Map(),
    };

    room.peers.set(socket.id, currentPeer);
    socket.join(roomId);

    // Get existing producers...
    const existingProducers = [];
    for (const [peerId, peer] of room.peers.entries()) {
      if (peerId !== socket.id) {
        for (const [producerId] of peer.producers.entries()) {
          existingProducers.push(producerId);
        }
      }
    }

    // ✅ CRITICAL: Build participant list with ALL user info
    const participants = Array.from(room.peers.values()).map((p) => ({
      id: p.id,
      name: p.name, // ✅ From userName parameter
      imageUrl: p.imageUrl, // ✅ From userImageUrl parameter
      isAudioMuted: false,
      isVideoPaused: false,
      isHost: p.isHost || false, // ✅ From isCreator parameter
    }));

    console.log(`📤 SENDING PARTICIPANT LIST:`, participants);

    // ✅ MUST use io.to() not socket.to() - includes sender
    io.to(roomId).emit("participant-list-update", participants);

    callback({ existingProducers });
  }
);
```

## Fix #2: Consumer Must Return peerId

In `consume` event:

```javascript
socket.on(
  "consume",
  async ({ roomId, producerId, rtpCapabilities }, callback) => {
    // ... find producer and create consumer ...

    callback({
      id: consumer.id,
      producerId: producer.id,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      peerId: producerPeerId, // ✅ ADD THIS - critical for identifying whose stream
    });
  }
);
```

## Fix #3: Screen Sharing Support

Update `produce` event to accept `appData`:

```javascript
socket.on(
  "produce",
  async ({ roomId, transportId, kind, rtpParameters, appData }, callback) => {
    const producer = await sendTransport.produce({
      kind,
      rtpParameters,
      appData, // ✅ ADD THIS
    });

    peer.producers.set(producer.id, producer);

    socket.to(roomId).emit("new-producer", {
      producerId: producer.id,
      peerId: socket.id,
      kind: kind,
      isScreenShare: appData?.share === true, // ✅ ADD THIS
    });

    callback({ id: producer.id });
  }
);
```

## Fix #4: Recording Events

Add these two event handlers:

```javascript
const recordings = new Map();

socket.on("start-recording", async ({ roomId }, callback) => {
  recordings.set(roomId, { startTime: Date.now() });
  io.to(roomId).emit("recording-started", { roomId });
  console.log(`🔴 Recording started: ${roomId}`);
  callback({ success: true });
});

socket.on("stop-recording", async ({ roomId }, callback) => {
  const recording = recordings.get(roomId);
  if (!recording) return callback({ error: "No recording found" });

  const duration = Date.now() - recording.startTime;
  recordings.delete(roomId);
  io.to(roomId).emit("recording-stopped", { roomId, duration });
  console.log(`⏹️ Recording stopped: ${roomId}`);
  callback({ success: true, duration });
});
```

## Fix #5: Disconnect Cleanup

Update disconnect handler:

```javascript
socket.on("disconnect", () => {
  if (currentRoomId && currentPeer) {
    const room = rooms.get(currentRoomId);
    if (!room) return;

    room.peers.delete(socket.id);

    // ✅ Update participant list with ALL user info
    const participants = Array.from(room.peers.values()).map((p) => ({
      id: p.id,
      name: p.name, // ✅ Must include
      imageUrl: p.imageUrl, // ✅ Must include
      isAudioMuted: false,
      isVideoPaused: false,
      isHost: p.isHost || false, // ✅ Must include
    }));
    io.to(currentRoomId).emit("participant-list-update", participants);

    // Notify about departure
    socket.to(currentRoomId).emit("participant-left", { peerId: socket.id });
  }
});
```

## Fix #6: Host Management Events

Add these event handlers for host promotion:

```javascript
socket.on("make-host", ({ roomId, participantId }) => {
  const room = rooms.get(roomId);
  if (!room) return;

  const peer = room.peers.get(participantId);
  if (!peer) return;

  peer.isHost = true;
  console.log(`👑 Made ${peer.name} a host`);

  // Update participant list
  const participants = Array.from(room.peers.values()).map((p) => ({
    id: p.id,
    name: p.name,
    imageUrl: p.imageUrl,
    isAudioMuted: false,
    isVideoPaused: false,
    isHost: p.isHost || false,
  }));
  io.to(roomId).emit("participant-list-update", participants);
});

socket.on("remove-host", ({ roomId, participantId }) => {
  const room = rooms.get(roomId);
  if (!room) return;

  const peer = room.peers.get(participantId);
  if (!peer) return;

  peer.isHost = false;
  console.log(`👤 Removed host status from ${peer.name}`);

  // Update participant list
  const participants = Array.from(room.peers.values()).map((p) => ({
    id: p.id,
    name: p.name,
    imageUrl: p.imageUrl,
    isAudioMuted: false,
    isVideoPaused: false,
    isHost: p.isHost || false,
  }));
  io.to(roomId).emit("participant-list-update", participants);
});
```

## Peer Object Structure

Make sure your peer object includes ALL user info:

```javascript
class Peer {
  constructor(socketId, name, imageUrl, rtpCapabilities, isHost = false) {
    this.id = socketId;
    this.name = name; // ✅ From userName parameter
    this.imageUrl = imageUrl || null; // ✅ From userImageUrl parameter
    this.isHost = isHost; // ✅ From isCreator parameter
    this.rtpCapabilities = rtpCapabilities;
    this.sendTransport = null;
    this.recvTransport = null;
    this.producers = new Map();
    this.consumers = new Map();
  }
}
```

---

## Debugging Guide

### Problem: Only seeing "User xxxx" instead of real names

**Check server console when user joins:**

```
🔍 JOIN REQUEST - User: John Doe, Image: https://..., Creator: true
```

If you see `User: undefined` or `User: null`, the problem is:

- Frontend is not sending userName/userImageUrl correctly
- Check browser console for "🚀 Joining Mediasoup Room"

**Check what's being sent in participant list:**

```
📤 SENDING PARTICIPANT LIST: [
  { id: "abc123", name: "John Doe", imageUrl: "https://...", isHost: true },
  { id: "def456", name: "Jane Smith", imageUrl: "https://...", isHost: false }
]
```

### Problem: Participants list is empty

**Most common cause:** Using `socket.to()` instead of `io.to()`

- `socket.to(roomId)` = everyone EXCEPT sender
- `io.to(roomId)` = everyone INCLUDING sender ✅

### Problem: Names show but avatars don't

**Check participant object in browser console:**

```javascript
// Should see:
{ id: "abc", name: "John", imageUrl: "https://img.clerk.com/..." }

// NOT:
{ id: "abc", name: "John", imageUrl: null }
```

If `imageUrl` is null, check:

1. Server is receiving and storing `userImageUrl` from client
2. Server includes `imageUrl` in participant list map function
3. Clerk authentication is providing `user.imageUrl` on frontend

## Testing

1. Open meeting in 2 browsers - both should see "Participants (2)"
2. Enable camera - other user should see video
3. Test screen share button - other user sees shared screen
4. Click record - all users see recording indicator

## Most Common Error

Using `socket.to()` instead of `io.to()` for participant list - this excludes the sender!
