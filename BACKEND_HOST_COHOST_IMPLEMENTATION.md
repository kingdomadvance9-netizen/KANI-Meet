# Backend Implementation: Host & Co-Host System

## Overview

The frontend has been fully implemented for host and co-host management. Users need to be properly identified as hosts when they create meetings, and hosts need the ability to promote/demote other participants.

---

## 1. Meeting Creation - Store Creator ID

### When a meeting is created, save the creator's user ID:

**Database Schema (or add to existing):**

```javascript
// Meeting/Room Table
{
  id: string,              // Room ID
  createdBy: string,       // Clerk user ID of creator
  createdAt: Date,
  startsAt: Date,
  description: string,
  // ... other fields
}
```

**API Endpoint Needed:**

```javascript
// POST /api/meetings
// Or update your existing meeting creation logic

app.post("/api/meetings", async (req, res) => {
  const { roomId, userId, userName } = req.body;

  // Save to database
  const meeting = await db.meetings.create({
    id: roomId,
    createdBy: userId, // ← CRITICAL: Save creator's Clerk user ID
    createdAt: new Date(),
    startsAt: req.body.startsAt || new Date(),
    description: req.body.description || "Meeting",
  });

  res.json(meeting);
});

// GET /api/meetings/:id
app.get("/api/meetings/:id", async (req, res) => {
  const meeting = await db.meetings.findUnique({
    where: { id: req.params.id },
  });

  // Must return createdBy field
  res.json({
    id: meeting.id,
    createdBy: meeting.createdBy, // ← Frontend checks this
    description: meeting.description,
    startsAt: meeting.startsAt,
  });
});
```

---

## 2. Socket Event Handlers - Host Management

### Update your mediasoup socket handlers to include these events:

#### Event 1: `make-host`

**Frontend emits:**

```javascript
socket.emit("make-host", {
  roomId: "room-123",
  participantId: "user_abc123", // Clerk user ID to promote
});
```

**Backend handler:**

```javascript
socket.on("make-host", async ({ roomId, participantId }) => {
  console.log("📥 Received make-host:", {
    roomId,
    participantId,
    from: socket.id,
  });

  // 1. Get room
  const room = rooms.get(roomId);
  if (!room) {
    socket.emit("error", { message: "Room not found" });
    return;
  }

  // 2. Verify sender is host
  const sender = room.participants.get(socket.id);
  if (!sender || !sender.isHost) {
    console.warn("⚠️ Unauthorized make-host attempt by:", socket.id);
    socket.emit("error", { message: "Only hosts can promote others" });
    return;
  }

  // 3. Find target participant by userId (not socketId)
  let targetSocketId = null;
  for (const [sid, participant] of room.participants.entries()) {
    if (participant.userId === participantId) {
      targetSocketId = sid;
      participant.isHost = true; // ← Promote to host
      console.log("✅ Promoted to host:", participantId);
      break;
    }
  }

  if (!targetSocketId) {
    socket.emit("error", { message: "Participant not found" });
    return;
  }

  // 4. Broadcast to ALL participants in room
  io.to(roomId).emit("participant-updated", {
    participantId: participantId,
    updates: { isHost: true },
  });

  // 5. Notify the promoted user
  io.to(targetSocketId).emit("host-granted", {
    by: sender.name || "Host",
  });

  console.log("✅ make-host completed");
});
```

---

#### Event 2: `remove-host`

**Frontend emits:**

```javascript
socket.emit("remove-host", {
  roomId: "room-123",
  participantId: "user_abc123",
});
```

**Backend handler:**

```javascript
socket.on("remove-host", async ({ roomId, participantId }) => {
  console.log("📥 Received remove-host:", { roomId, participantId });

  const room = rooms.get(roomId);
  if (!room) {
    socket.emit("error", { message: "Room not found" });
    return;
  }

  // Verify sender is host
  const sender = room.participants.get(socket.id);
  if (!sender || !sender.isHost) {
    socket.emit("error", { message: "Only hosts can remove host status" });
    return;
  }

  // Find and demote target
  let targetSocketId = null;
  for (const [sid, participant] of room.participants.entries()) {
    if (participant.userId === participantId) {
      targetSocketId = sid;
      participant.isHost = false; // ← Demote
      break;
    }
  }

  if (!targetSocketId) {
    socket.emit("error", { message: "Participant not found" });
    return;
  }

  // Broadcast update
  io.to(roomId).emit("participant-updated", {
    participantId: participantId,
    updates: { isHost: false },
  });

  // Notify demoted user
  io.to(targetSocketId).emit("host-revoked", {
    by: sender.name || "Host",
  });

  console.log("✅ remove-host completed");
});
```

---

#### Event 3: `make-cohost`

**Frontend emits:**

```javascript
socket.emit("make-cohost", {
  roomId: "room-123",
  participantId: "user_abc123",
});
```

**Backend handler:**

```javascript
socket.on("make-cohost", async ({ roomId, participantId }) => {
  console.log("📥 Received make-cohost:", { roomId, participantId });

  const room = rooms.get(roomId);
  if (!room) {
    socket.emit("error", { message: "Room not found" });
    return;
  }

  // Only hosts can make co-hosts
  const sender = room.participants.get(socket.id);
  if (!sender || !sender.isHost) {
    socket.emit("error", { message: "Only hosts can promote co-hosts" });
    return;
  }

  // Find and promote target
  let targetSocketId = null;
  for (const [sid, participant] of room.participants.entries()) {
    if (participant.userId === participantId) {
      targetSocketId = sid;
      participant.isCoHost = true; // ← Promote to co-host
      break;
    }
  }

  if (!targetSocketId) {
    socket.emit("error", { message: "Participant not found" });
    return;
  }

  // Broadcast update
  io.to(roomId).emit("participant-updated", {
    participantId: participantId,
    updates: { isCoHost: true },
  });

  // Notify promoted user
  io.to(targetSocketId).emit("cohost-granted", {
    by: sender.name || "Host",
  });

  console.log("✅ make-cohost completed");
});
```

---

#### Event 4: `remove-cohost`

**Frontend emits:**

```javascript
socket.emit("remove-cohost", {
  roomId: "room-123",
  participantId: "user_abc123",
});
```

**Backend handler:**

```javascript
socket.on("remove-cohost", async ({ roomId, participantId }) => {
  console.log("📥 Received remove-cohost:", { roomId, participantId });

  const room = rooms.get(roomId);
  if (!room) return socket.emit("error", { message: "Room not found" });

  const sender = room.participants.get(socket.id);
  if (!sender || !sender.isHost) {
    return socket.emit("error", { message: "Only hosts can remove co-hosts" });
  }

  let targetSocketId = null;
  for (const [sid, participant] of room.participants.entries()) {
    if (participant.userId === participantId) {
      targetSocketId = sid;
      participant.isCoHost = false; // ← Demote
      break;
    }
  }

  if (!targetSocketId) {
    return socket.emit("error", { message: "Participant not found" });
  }

  io.to(roomId).emit("participant-updated", {
    participantId: participantId,
    updates: { isCoHost: false },
  });

  io.to(targetSocketId).emit("cohost-revoked", {
    by: sender.name || "Host",
  });

  console.log("✅ remove-cohost completed");
});
```

---

## 3. Update Existing Join Room Handler

### Modify your join-room logic to identify hosts:

```javascript
socket.on("join-room", async ({ roomId, userId, userName, userImageUrl }) => {
  console.log("👤 User joining:", userName, userId);

  // 1. Check if user is the creator (host)
  const meeting = await db.meetings.findUnique({ where: { id: roomId } });
  const isHost = meeting && meeting.createdBy === userId;

  console.log("🔍 Host check:", {
    userId,
    createdBy: meeting?.createdBy,
    isHost,
  });

  // 2. Create participant with host status
  const participant = {
    id: userId, // ← Use Clerk user ID (not socket ID)
    socketId: socket.id, // ← Also store socket ID for routing
    name: userName,
    imageUrl: userImageUrl,
    isHost: isHost, // ← Set based on creator check
    isCoHost: false,
    isAudioMuted: true,
    isVideoPaused: true,
  };

  // 3. Store in room
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      participants: new Map(),
      producers: new Map(),
    });
  }

  const room = rooms.get(roomId);
  room.participants.set(socket.id, participant);

  // 4. Send existing participants to new joiner
  const existingParticipants = Array.from(room.participants.values()).map(
    (p) => ({
      id: p.id,
      name: p.name,
      imageUrl: p.imageUrl,
      isHost: p.isHost,
      isCoHost: p.isCoHost || false, // ← Include co-host status
      isAudioMuted: p.isAudioMuted,
      isVideoPaused: p.isVideoPaused,
    })
  );

  socket.emit("existing-participants", existingParticipants);

  // 5. Broadcast new participant to others
  socket.to(roomId).emit("participant-joined", {
    id: participant.id,
    name: participant.name,
    imageUrl: participant.imageUrl,
    isHost: participant.isHost,
    isCoHost: participant.isCoHost,
    isAudioMuted: true,
    isVideoPaused: true,
  });

  console.log("✅ Join complete:", { userName, isHost });
});
```

---

## 4. Participant Data Structure

### Update your room/participant schema:

```javascript
// Room structure
{
  roomId: string,
  participants: Map<socketId, Participant>,
  producers: Map<producerId, Producer>,
  // ... other mediasoup data
}

// Participant structure (must include both IDs)
{
  id: string,           // Clerk user ID (permanent, for permissions)
  socketId: string,     // Socket ID (temporary, for routing)
  name: string,
  imageUrl: string,
  isHost: boolean,      // ← Is meeting creator
  isCoHost: boolean,    // ← Promoted by host
  isAudioMuted: boolean,
  isVideoPaused: boolean,
  // ... other mediasoup data
}
```

**Why both IDs?**

- `id` (Clerk user ID): Persistent across reconnects, used for permission checks
- `socketId`: Changes on reconnect, used for emitting events to specific sockets

---

## 5. Events Backend Must Emit

### `participant-updated` (broadcast to room)

```javascript
io.to(roomId).emit("participant-updated", {
  participantId: "user_abc123", // Clerk user ID
  updates: {
    isHost: true,
    // or
    isCoHost: true,
    // or both if needed
  },
});
```

### `host-granted` (to specific user)

```javascript
io.to(targetSocketId).emit("host-granted", {
  by: "Host Name",
});
```

### `host-revoked` (to specific user)

```javascript
io.to(targetSocketId).emit("host-revoked", {
  by: "Host Name",
});
```

### `cohost-granted` (to specific user)

```javascript
io.to(targetSocketId).emit("cohost-granted", {
  by: "Host Name",
});
```

### `cohost-revoked` (to specific user)

```javascript
io.to(targetSocketId).emit("cohost-revoked", {
  by: "Host Name",
});
```

---

## 6. Testing Checklist

### Database/API Tests

- [ ] Create meeting stores `createdBy` field with Clerk user ID
- [ ] GET `/api/meetings/:id` returns `createdBy` field
- [ ] Multiple users can create different meetings

### Host Identification Tests

- [ ] User who creates meeting joins as host (`isHost: true`)
- [ ] Other users who join same meeting are NOT hosts (`isHost: false`)
- [ ] Console log shows "🔍 Host check: { isHost: true }" for creator
- [ ] Frontend receives `isHost: true` in `existing-participants` event

### Host Promotion Tests

- [ ] Host can emit `make-host` event
- [ ] Non-host trying to emit `make-host` gets error
- [ ] Target user receives `host-granted` notification
- [ ] All participants see updated host badge (👑)
- [ ] Promoted user can now use host controls

### Co-Host Tests

- [ ] Host can emit `make-cohost` event
- [ ] Non-host trying to emit `make-cohost` gets error
- [ ] Target user receives `cohost-granted` notification
- [ ] All participants see co-host badge (🤝)
- [ ] Co-host can use control features (if you implement permissions)

### Edge Cases

- [ ] Can't promote yourself
- [ ] Can't promote someone not in room
- [ ] Room must exist
- [ ] Works with reconnects (user maintains Clerk ID)

---

## 7. Console Logs to Implement

Add these for debugging:

```javascript
// On join-room
console.log("🔍 Host check:", {
  userId: userId,
  createdBy: meeting?.createdBy,
  isHost: meeting?.createdBy === userId,
});

// On make-host
console.log("📥 Received make-host:", {
  roomId,
  participantId,
  fromSocket: socket.id,
  fromUser: sender.userId,
});

console.log("✅ Promoted to host:", participantId);

// On errors
console.warn("⚠️ Unauthorized make-host attempt by:", socket.id);
```

---

## 8. Quick Test After Implementation

1. **Create a meeting** as User A
2. **Open console** and verify log shows: `isHost: true`
3. **Join as User B** in different browser/tab
4. **As User A**, click 3-dots on User B → "Make Co-Host"
5. **Check console** for:
   - `🎯 Attempting to make co-host: User B user_xyz`
   - `🤝 Making participant co-host: user_xyz in room: room-123`
   - `✅ make-cohost event emitted`
6. **Check backend logs** for:
   - `📥 Received make-cohost: { roomId, participantId }`
   - `✅ make-cohost completed`
7. **Check User B's UI** shows:
   - Toast: "User A made you a co-host!"
   - Badge changes from "Participant" to "Co-Host" with 🤝

---

## Summary

**Backend needs to:**

1. **Store meeting creator** (`createdBy` field) when meeting is created
2. **Return creator ID** in GET `/api/meetings/:id` endpoint
3. **Check if user is creator** when they join room
4. **Set `isHost: true`** for creator in participant data
5. **Handle socket events**: `make-host`, `remove-host`, `make-cohost`, `remove-cohost`
6. **Emit updates**: `participant-updated`, `host-granted`, `host-revoked`, `cohost-granted`, `cohost-revoked`
7. **Use Clerk user ID** (not socket ID) for participant identification and permissions

**Frontend is ready and will work immediately** once backend implements these handlers.
