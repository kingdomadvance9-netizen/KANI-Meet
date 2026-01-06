# 🚨 CRITICAL SERVER FIXES - READ THIS FIRST

## Issues You're Experiencing

1. ❌ Can't see list of other users
2. ❌ Only see yourself, not other participants
3. ❌ Screen sharing not working
4. ❌ Recording not working
5. ✅ Chat is working (confirms Socket.IO connection is fine)

## Root Cause

Your server is likely **NOT sending the participant list correctly** or **NOT emitting the `new-producer` event properly**.

---

## 🔴 CRITICAL FIX #1: Participant List

### Problem

When someone joins, other participants don't see them in the list.

### Solution

In your `join-mediasoup-room` event handler, change this line:

**❌ WRONG (only notifies others):**

```javascript
socket.to(roomId).emit("participant-list-update", participants);
```

**✅ CORRECT (notifies EVERYONE including the joiner):**

```javascript
io.to(roomId).emit("participant-list-update", participants);
```

**Complete Fixed Handler:**

```javascript
socket.on(
  "join-mediasoup-room",
  async ({ roomId, rtpCapabilities }, callback) => {
    try {
      // ... your existing code to create peer and add to room ...

      // ✅ CRITICAL: Build participant list AFTER adding new peer
      const participants = Array.from(room.peers.values()).map((p) => ({
        id: p.id,
        name: p.name || "User " + p.id.slice(0, 4),
        isAudioMuted: false,
        isVideoPaused: false,
      }));

      // ✅ Use io.to() not socket.to() - this includes the sender
      io.to(roomId).emit("participant-list-update", participants);

      callback({ existingProducers });
    } catch (error) {
      callback({ error: error.message });
    }
  }
);
```

---

## 🔴 CRITICAL FIX #2: See Other Participants' Video/Audio

### Problem

You can't see or hear other participants even though they're in the room.

### Solution

Make sure your `consume` event returns the `peerId`:

```javascript
socket.on(
  "consume",
  async ({ roomId, producerId, rtpCapabilities }, callback) => {
    try {
      // ... create consumer code ...

      // ✅ CRITICAL: Return peerId so frontend knows whose stream this is
      callback({
        id: consumer.id,
        producerId: producer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        peerId: producerPeerId, // ✅ ADD THIS - tells frontend whose video/audio this is
      });
    } catch (error) {
      callback({ error: error.message });
    }
  }
);
```

---

## 🔴 CRITICAL FIX #3: New Producer Detection

### Problem

When someone starts their camera/mic, others don't see/hear them.

### Solution

Ensure `new-producer` event is emitted:

```javascript
socket.on(
  "produce",
  async ({ roomId, kind, rtpParameters, appData }, callback) => {
    try {
      // ... create producer code ...

      // ✅ CRITICAL: Notify ALL other peers about new producer
      socket.to(roomId).emit("new-producer", {
        producerId: producer.id,
        peerId: socket.id,
        kind: kind,
      });

      callback({ id: producer.id });
    } catch (error) {
      callback({ error: error.message });
    }
  }
);
```

---

## 🔴 CRITICAL FIX #4: Screen Sharing

### Problem

Screen share button doesn't work.

### Solution

Update your `produce` handler to support `appData`:

```javascript
socket.on(
  "produce",
  async ({ roomId, transportId, kind, rtpParameters, appData }, callback) => {
    try {
      const producer = await peer.sendTransport.produce({
        kind,
        rtpParameters,
        appData, // ✅ ADD THIS - contains { share: true } for screen
      });

      const isScreenShare = appData?.share === true;

      socket.to(roomId).emit("new-producer", {
        producerId: producer.id,
        peerId: socket.id,
        kind: kind,
        isScreenShare: isScreenShare, // ✅ ADD THIS
      });

      callback({ id: producer.id });
    } catch (error) {
      callback({ error: error.message });
    }
  }
);
```

---

## 🔴 CRITICAL FIX #5: Recording

### Problem

Recording button does nothing.

### Solution

Add recording event handlers to your server:

```javascript
const recordings = new Map();

socket.on("start-recording", async ({ roomId }, callback) => {
  const recording = {
    startTime: Date.now(),
    roomId: roomId,
  };

  recordings.set(roomId, recording);
  io.to(roomId).emit("recording-started", { roomId });

  console.log(`🔴 Recording started: ${roomId}`);
  callback({ success: true });
});

socket.on("stop-recording", async ({ roomId }, callback) => {
  const recording = recordings.get(roomId);
  if (!recording) {
    return callback({ error: "No recording found" });
  }

  const duration = Date.now() - recording.startTime;
  recordings.delete(roomId);
  io.to(roomId).emit("recording-stopped", { roomId, duration });

  console.log(`⏹️ Recording stopped: ${roomId}`);
  callback({ success: true, duration });
});
```

---

## 🧪 Testing Checklist

After applying these fixes, test in this order:

### 1. Test Participant List

- [ ] Open meeting in two browser windows
- [ ] Check console logs: "👥 Participants updated: [...]"
- [ ] Both windows should show "Participants (2)"
- [ ] Click participants button - should see both users

### 2. Test Video/Audio Streams

- [ ] Enable camera in first window
- [ ] Second window should see the video automatically
- [ ] Check console: "🎬 Consuming video from peer: ..."
- [ ] Try audio - both should hear each other

### 3. Test Screen Sharing

- [ ] Click screen share button
- [ ] Select a screen/window
- [ ] Other participants should see the screen
- [ ] Check console: "🖥️ Screen share producer created"

### 4. Test Recording

- [ ] Click record button (admin only)
- [ ] Should see recording indicator
- [ ] Stop recording
- [ ] Check server console for recording logs

---

## 🐛 Debugging Tips

### If participants list is empty:

```javascript
// Add this to your join-mediasoup-room handler:
console.log("Current room peers:", Array.from(room.peers.keys()));
console.log("Emitting participant list:", participants);
```

### If you can't see others' video:

```javascript
// Add this to your consume handler:
console.log(
  "Creating consumer for producer:",
  producerId,
  "from peer:",
  producerPeerId
);
```

### If new-producer event not firing:

```javascript
// Add this to your produce handler:
console.log("Emitting new-producer to room:", roomId);
socket.to(roomId).emit("new-producer", { producerId, peerId: socket.id });
```

---

## 📋 Quick Copy-Paste Server Fixes

Here's the complete corrected code for the critical handlers:

```javascript
// 1. JOIN ROOM - Use io.to() not socket.to()
socket.on(
  "join-mediasoup-room",
  async ({ roomId, rtpCapabilities }, callback) => {
    // ... add peer to room ...

    const participants = Array.from(room.peers.values()).map((p) => ({
      id: p.id,
      name: p.name || "User " + p.id.slice(0, 4),
      isAudioMuted: false,
      isVideoPaused: false,
    }));

    io.to(roomId).emit("participant-list-update", participants); // ✅ io.to not socket.to
    callback({ existingProducers });
  }
);

// 2. PRODUCE - Add appData support
socket.on(
  "produce",
  async ({ roomId, transportId, kind, rtpParameters, appData }, callback) => {
    const producer = await sendTransport.produce({
      kind,
      rtpParameters,
      appData,
    });
    peer.producers.set(producer.id, producer);

    socket.to(roomId).emit("new-producer", {
      producerId: producer.id,
      peerId: socket.id,
      kind: kind,
      isScreenShare: appData?.share === true,
    });

    callback({ id: producer.id });
  }
);

// 3. CONSUME - Return peerId
socket.on(
  "consume",
  async ({ roomId, producerId, rtpCapabilities }, callback) => {
    // ... find producer and create consumer ...

    callback({
      id: consumer.id,
      producerId: producer.id,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      peerId: producerPeerId, // ✅ Essential!
    });
  }
);

// 4. DISCONNECT - Update participant list
socket.on("disconnect", () => {
  if (currentRoomId && currentPeer) {
    const room = rooms.get(currentRoomId);
    room.peers.delete(socket.id);

    const participants = Array.from(room.peers.values()).map((p) => ({
      id: p.id,
      name: p.name,
      isAudioMuted: false,
      isVideoPaused: false,
    }));

    io.to(currentRoomId).emit("participant-list-update", participants);
    socket.to(currentRoomId).emit("participant-left", { peerId: socket.id });
  }
});
```

---

## ✅ Expected Console Output

When working correctly, you should see:

**Server console:**

```
✅ Socket connected: abc123
🚪 Peer abc123 joined room test-room
👥 Emitting participant list: [ { id: 'abc123', name: 'User abc1' } ]
🎤 Producer created: def456 (audio) for abc123
📢 Emitting new-producer: def456
🎬 Consumer created: ghi789 for producer def456
```

**Browser console (each client):**

```
✅ Socket connected: abc123
🚪 Joining room: test-room
📱 Device loaded
🎉 Joined mediasoup room
🚚 Send transport created
📥 Receive transport created
🎤 Audio producer created
👥 Participants updated: [ { id: 'abc123', name: 'User abc1' }, { id: 'xyz789', name: 'User xyz7' } ]
🆕 New producer detected: def456
🎬 Consuming audio from peer: xyz789
```

---

## 🆘 Still Having Issues?

1. Check your server logs for errors
2. Check browser console for errors
3. Verify socket events are being received
4. Test with two different browsers (not just two tabs)
5. Make sure you're using the latest code from this guide

**The most common issue is using `socket.to()` instead of `io.to()` for participant list updates!**
